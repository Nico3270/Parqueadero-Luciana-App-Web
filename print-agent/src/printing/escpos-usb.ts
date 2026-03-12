import "dotenv/config";

import { Printer as EscPosPrinter } from "@node-escpos/core";
import USB from "@node-escpos/usb-adapter";

const PRINT_TIMEOUT_MS = 15000;
const CLOSE_DELAY_MS = 1400;
const PRINTER_LINE_WIDTH = 32;
const USB_RETRY_COUNT = 3;
const USB_RETRY_DELAY_MS = 450;

const DEFAULT_PARKING_NAME = "Parqueadero Luca";
const DEFAULT_PARKING_ADDRESS = "Calle 6 Sur # 11-30";
const DEFAULT_PARKING_NIT = "NIT: 19.205.328-0 REG.SIMPLIF";

const PRINTER_VENDOR_ID = process.env.PRINTER_VENDOR_ID
  ? parseInt(process.env.PRINTER_VENDOR_ID, 16)
  : undefined;

const PRINTER_PRODUCT_ID = process.env.PRINTER_PRODUCT_ID
  ? parseInt(process.env.PRINTER_PRODUCT_ID, 16)
  : undefined;

export type PrintJobPayload = {
  kind: "ENTRY_TICKET" | "EXIT_RECEIPT" | "SUBSCRIPTION_RECEIPT";
  parkingName?: unknown;
  parkingAddress?: unknown;
  parkingNit?: unknown;
  ticketCode?: unknown;
  scanCode?: unknown;
  vehicle?: {
    plate?: unknown;
    type?: unknown;
  };
  entryAtIso?: unknown;
  exitAtIso?: unknown;
  durationMinutes?: unknown;
  finalAmount?: unknown;
  amountPaid?: unknown;
  methodLabel?: unknown;
  barcode?: {
    type?: unknown;
    value?: unknown;
  };
  qr?: {
    type?: unknown;
    value?: unknown;
  };
};

type EscposPrinterLike = {
  align(value: "lt" | "ct" | "rt"): void;
  style(value: "normal" | "b" | "u" | "bu"): void;
  size(width: number, height: number): void;
  text(value: string): void;
  barcode(
    value: string,
    type: string,
    options?: {
      width?: number;
      height?: number;
      position?: string;
      font?: string;
    }
  ): void;
  feed(lines?: number): void;
  cut(partial?: boolean): void;
  close(): void;
};

type UsbDeviceCandidate =
  | { mode: "vidpid"; vendorId: number; productId: number }
  | { mode: "autodetect" };

function ts() {
  return new Date().toISOString();
}

function log(message: string, meta?: Record<string, unknown>) {
  if (meta) {
    console.log(`[${ts()}] [escpos-usb] ${message}`, meta);
    return;
  }
  console.log(`[${ts()}] [escpos-usb] ${message}`);
}

function logError(message: string, meta?: Record<string, unknown>) {
  if (meta) {
    console.error(`[${ts()}] [escpos-usb] ${message}`, meta);
    return;
  }
  console.error(`[${ts()}] [escpos-usb] ${message}`);
}

function safeErrMsg(err: unknown) {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;

  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function s(v: unknown, fallback = "-") {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return fallback;
}

function n(v: unknown, fallback = 0) {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function toAscii(input: unknown, fallback = "-") {
  const raw =
    typeof input === "string"
      ? input
      : typeof input === "number" || typeof input === "boolean"
      ? String(input)
      : fallback;

  return (
    raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, " ")
      .replace(/\s+/g, " ")
      .trim() || fallback
  );
}

function normalizeCode(value: unknown) {
  return toAscii(value, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

function formatBogotaAscii(isoUtc?: unknown) {
  const iso = typeof isoUtc === "string" ? isoUtc : "";
  if (!iso) return "-";

  try {
    const d = new Date(iso);

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(d);

    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "";

    const day = get("day");
    const month = get("month");
    const year = get("year");
    const hour = get("hour");
    const minute = get("minute");
    const dayPeriod = get("dayPeriod").toUpperCase();

    return `${day}/${month}/${year} ${hour}:${minute} ${dayPeriod}`;
  } catch {
    return toAscii(iso, "-");
  }
}

function formatCopPlain(value?: unknown) {
  const v = Math.max(0, Math.trunc(n(value, 0)));
  return `${v} COP`;
}

function durationLabelAscii(minutes?: unknown) {
  const m = Math.max(0, Math.trunc(n(minutes, 0)));
  const h = Math.floor(m / 60);
  const r = m % 60;

  if (h <= 0) return `${r} min`;
  if (r === 0) return `${h} h`;
  return `${h} h ${r} min`;
}

function toVehicleTypeLabel(value: unknown) {
  const raw = normalizeCode(value);

  if (raw === "CAR" || raw === "CARRO" || raw === "AUTO") return "Carro";
  if (raw === "MOTO" || raw === "MOTORCYCLE") return "Moto";
  if (raw === "BICICLETA" || raw === "BIKE") return "Bicicleta";
  if (raw === "CAMION" || raw === "TRUCK") return "Camion";

  const normalized = toAscii(value, "-").toLowerCase();
  if (!normalized || normalized === "-") return "-";

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getUsbDeviceCandidates(): UsbDeviceCandidate[] {
  const candidates: UsbDeviceCandidate[] = [];

  if (
    typeof PRINTER_VENDOR_ID === "number" &&
    typeof PRINTER_PRODUCT_ID === "number"
  ) {
    candidates.push({
      mode: "vidpid",
      vendorId: PRINTER_VENDOR_ID,
      productId: PRINTER_PRODUCT_ID,
    });
  }

  candidates.push({ mode: "autodetect" });

  return candidates;
}

function instantiateUsbDevice(candidate: UsbDeviceCandidate) {
  if (candidate.mode === "vidpid") {
    log("creating USB device with explicit VID/PID", {
      vendorIdHex: `0x${candidate.vendorId.toString(16)}`,
      productIdHex: `0x${candidate.productId.toString(16)}`,
    });

    return new USB(candidate.vendorId, candidate.productId);
  }

  log("creating USB device with autodetect");
  return new USB();
}

async function createUsbDeviceWithRetry() {
  const candidates = getUsbDeviceCandidates();
  let lastError: unknown = new Error("USB_DEVICE_NOT_FOUND");

  for (let attempt = 1; attempt <= USB_RETRY_COUNT; attempt++) {
    for (const candidate of candidates) {
      try {
        const device = instantiateUsbDevice(candidate);

        log("USB device candidate created", {
          attempt,
          mode: candidate.mode,
        });

        return device;
      } catch (err) {
        lastError = err;

        logError("USB device candidate failed", {
          attempt,
          mode: candidate.mode,
          errorMessage: safeErrMsg(err),
        });
      }
    }

    if (attempt < USB_RETRY_COUNT) {
      log("retrying USB device detection", {
        attempt,
        nextAttempt: attempt + 1,
        delayMs: USB_RETRY_DELAY_MS,
      });

      await sleep(USB_RETRY_DELAY_MS);
    }
  }

  throw lastError;
}

function separator(printer: EscposPrinterLike) {
  printer.text("-".repeat(PRINTER_LINE_WIDTH));
}

function smallSeparator(printer: EscposPrinterLike) {
  printer.text("=".repeat(PRINTER_LINE_WIDTH));
}

function writeCenteredLines(printer: EscposPrinterLike, lines: string[]) {
  printer.align("ct");
  for (const line of lines) {
    const text = toAscii(line, "");
    if (text) printer.text(text);
  }
}

function writeCommonHeader(printer: EscposPrinterLike, payload: PrintJobPayload) {
  const parkingName = toAscii(payload.parkingName, DEFAULT_PARKING_NAME);
  const parkingAddress = toAscii(
    payload.parkingAddress,
    DEFAULT_PARKING_ADDRESS
  );
  const parkingNit = toAscii(payload.parkingNit, DEFAULT_PARKING_NIT);

  printer.align("ct");
  printer.style("b");
  printer.size(1, 1);
  printer.text(parkingName);
  printer.size(0, 0);
  printer.style("normal");
  printer.text(parkingAddress);
  printer.text(parkingNit);
  separator(printer);
}

function getEntryBarcodeValue(payload: PrintJobPayload) {
  const plate = normalizeCode(payload.vehicle?.plate);
  if (plate) return plate;

  const explicitBarcode = normalizeCode(payload.barcode?.value);
  if (explicitBarcode) return explicitBarcode;

  const scanCode = normalizeCode(payload.scanCode);
  if (scanCode) return scanCode;

  const ticketCode = normalizeCode(payload.ticketCode);
  if (ticketCode) return ticketCode;

  return "";
}

function getExitBarcodeValue(payload: PrintJobPayload) {
  const explicitBarcode = normalizeCode(payload.barcode?.value);
  if (explicitBarcode) return explicitBarcode;

  const scanCode = normalizeCode(payload.scanCode);
  if (scanCode) return scanCode;

  const ticketCode = normalizeCode(payload.ticketCode);
  if (ticketCode) return ticketCode;

  const plate = normalizeCode(payload.vehicle?.plate);
  if (plate) return plate;

  return "";
}

function printBarcode(printer: EscposPrinterLike, value: string) {
  const barcodeValue = normalizeCode(value);

  if (!barcodeValue) {
    log("barcode skipped because value is empty");
    return false;
  }

  try {
    log("printing barcode", {
      type: "CODE39",
      value: barcodeValue,
      length: barcodeValue.length,
    });

    printer.align("ct");
    printer.barcode(barcodeValue, "CODE39", {
      width: 2,
      height: 80,
      position: "blw",
      font: "A",
    });

    return true;
  } catch (err) {
    logError("printer.barcode failed", {
      type: "CODE39",
      value: barcodeValue,
      errorMessage: safeErrMsg(err),
    });
    return false;
  }
}

function doPartialCut(printer: EscposPrinterLike) {
  try {
    log("sending partial cut");
    printer.cut(true);
    return;
  } catch (err1) {
    logError("printer.cut(true) failed", {
      errorMessage: safeErrMsg(err1),
    });
  }

  try {
    log("fallback to printer.cut()");
    printer.cut();
  } catch (err2) {
    logError("printer.cut() failed", {
      errorMessage: safeErrMsg(err2),
    });
  }
}

function finalizePrinter(
  printer: EscposPrinterLike,
  finishOk: () => void,
  clearTimer: () => void
) {
  try {
    log("sending close() to printer");
    printer.close();
  } catch (err) {
    logError("printer.close() failed", {
      errorMessage: safeErrMsg(err),
    });
  }

  clearTimer();

  setTimeout(() => {
    log("finishOk after close delay", { closeDelayMs: CLOSE_DELAY_MS });
    finishOk();
  }, CLOSE_DELAY_MS);
}

function writeEntryRegulations(printer: EscposPrinterLike) {
  printer.align("ct");
  printer.style("b");
  printer.text("REGLAMENTO");
  printer.style("normal");

  printer.align("lt");
  printer.text(
    "El vehiculo se entregara al portador del recibo."
  );
  printer.text(
    "No aceptamos ordenes telefonicas ni escritas."
  );
  printer.text(
    "Retirado el vehiculo no aceptamos reclamos."
  );
  printer.text(
    "No respondemos por objetos dejados dentro."
  );
  printer.text(
    "No respondemos por perdida, deterioro o"
  );
  printer.text(
    "danos por incendio, terremoto, asonada,"
  );
  printer.text(
    "revolucion u otras causas similares."
  );
  printer.text(
    "El conductor debe verificar que el"
  );
  printer.text(
    "vehiculo quede bien asegurado."
  );
  printer.text(
    "No respondemos por danos causados por"
  );
  printer.text(
    "terceros."
  );
}

function writeEntryTicket(printer: EscposPrinterLike, payload: PrintJobPayload) {
  const plate = toAscii(payload.vehicle?.plate, "-").toUpperCase();
  const vtype = toVehicleTypeLabel(payload.vehicle?.type);
  const ticketCode = toAscii(payload.ticketCode, "-");
  const entryAt = formatBogotaAscii(payload.entryAtIso);
  const barcodeValue = getEntryBarcodeValue(payload);

  log("rendering ENTRY_TICKET", {
    plate,
    vtype,
    ticketCode,
    barcodeValue,
    hasBarcodeValue: Boolean(barcodeValue),
  });

  writeCommonHeader(printer, payload);

  printer.align("ct");
  printer.style("b");
  printer.text("TICKET DE ENTRADA");
  printer.style("normal");
  smallSeparator(printer);

  printer.align("ct");
  printer.style("b");
  printer.size(1, 1);
  printer.text(`PLACA ${plate}`);
  printer.size(0, 0);
  printer.style("normal");

  printer.feed(1);

  const barcodePrinted = printBarcode(printer, barcodeValue);

  if (!barcodePrinted) {
    printer.style("b");
    printer.text(plate);
    printer.style("normal");
  }

  printer.feed(1);

  printer.align("lt");
  printer.text(`Tipo: ${vtype}`);
  printer.text(`Entrada: ${entryAt}`);
  printer.text(`Ticket: ${ticketCode}`);

  separator(printer);

  printer.align("ct");
  printer.style("b");
  printer.text("GRACIAS POR SU VISITA");
  printer.style("normal");

  printer.feed(1);
  writeEntryRegulations(printer);
  printer.feed(4);
  doPartialCut(printer);
}

function writeExitReceipt(printer: EscposPrinterLike, payload: PrintJobPayload) {
  const plate = toAscii(payload.vehicle?.plate, "-").toUpperCase();
  const vtype = toVehicleTypeLabel(payload.vehicle?.type);
  const ticketCode = toAscii(payload.ticketCode, "-");
  const barcodeValue = getExitBarcodeValue(payload);

  log("rendering EXIT_RECEIPT", {
    plate,
    vtype,
    ticketCode,
    barcodeValue,
    hasBarcodeValue: Boolean(barcodeValue),
  });

  writeCommonHeader(printer, payload);

  printer.align("ct");
  printer.style("b");
  printer.text("RECIBO DE SALIDA");
  printer.style("normal");
  smallSeparator(printer);

  printer.align("lt");
  printer.text(`Placa: ${plate}`);
  printer.text(`Tipo: ${vtype}`);
  printer.text(`Entrada: ${formatBogotaAscii(payload.entryAtIso)}`);
  printer.text(`Salida: ${formatBogotaAscii(payload.exitAtIso)}`);
  printer.text(`Tiempo: ${durationLabelAscii(payload.durationMinutes)}`);
  printer.text(`Pagado: ${formatCopPlain(payload.amountPaid ?? payload.finalAmount)}`);
  printer.text(`Metodo: ${toAscii(payload.methodLabel, "-")}`);
  printer.text(`Ticket: ${ticketCode}`);

  separator(printer);

  if (barcodeValue) {
    printer.align("ct");
    printBarcode(printer, barcodeValue);
    printer.feed(1);
  }

  printer.align("ct");
  printer.style("b");
  printer.text("GRACIAS POR SU VISITA");
  printer.style("normal");

  printer.feed(4);
  doPartialCut(printer);
}

function writeSubscriptionReceipt(
  printer: EscposPrinterLike,
  payload: PrintJobPayload
) {
  writeCommonHeader(printer, payload);

  printer.align("ct");
  printer.style("b");
  printer.text("RECIBO MENSUALIDAD");
  printer.style("normal");
  printer.text("Pendiente");
  printer.feed(4);
  doPartialCut(printer);
}

export async function printUsbTicket(payload: PrintJobPayload) {
  log("printUsbTicket called", {
    kind: payload.kind,
    ticketCode: typeof payload.ticketCode === "string" ? payload.ticketCode : null,
    scanCode: typeof payload.scanCode === "string" ? payload.scanCode : null,
    barcodeValue:
      typeof payload.barcode?.value === "string" ? payload.barcode.value : null,
    plate:
      typeof payload.vehicle?.plate === "string" ? payload.vehicle.plate : null,
  });

  const startedAt = Date.now();
  const device = await createUsbDeviceWithRetry();
  const printer = new EscPosPrinter(device, {
    encoding: "CP437",
  }) as unknown as EscposPrinterLike;

  return await new Promise<void>((resolve, reject) => {
    let finished = false;
    let timer: NodeJS.Timeout | null = null;

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const finishOk = () => {
      if (finished) return;
      finished = true;

      try {
        log("closing USB device after success");
        device.close?.();
      } catch (err) {
        logError("device.close() after success failed", {
          errorMessage: safeErrMsg(err),
        });
      }

      log("printUsbTicket resolved", {
        elapsedMs: Date.now() - startedAt,
      });

      resolve();
    };

    const finishErr = (err: unknown) => {
      if (finished) return;
      finished = true;

      try {
        log("closing USB device after error");
        device.close?.();
      } catch (closeErr) {
        logError("device.close() after error failed", {
          errorMessage: safeErrMsg(closeErr),
        });
      }

      logError("printUsbTicket rejected", {
        elapsedMs: Date.now() - startedAt,
        errorMessage: safeErrMsg(err),
      });

      reject(err);
    };

    timer = setTimeout(() => {
      logError("print timeout reached", {
        timeoutMs: PRINT_TIMEOUT_MS,
      });
      finishErr(new Error("PRINT_TIMEOUT"));
    }, PRINT_TIMEOUT_MS);

    log("opening USB device");

    device.open((err: unknown) => {
      if (err) {
        clearTimer();
        logError("device.open failed", {
          errorMessage: safeErrMsg(err),
          hint:
            "Verifica acceso USB, usbipd/WSL si aplica y PRINTER_VENDOR_ID/PRINTER_PRODUCT_ID",
        });
        return finishErr(err);
      }

      log("device opened successfully");

      try {
        const kind = s(payload.kind, "ENTRY_TICKET") as PrintJobPayload["kind"];

        if (kind === "ENTRY_TICKET") {
          writeEntryTicket(printer, payload);
          return finalizePrinter(printer, finishOk, clearTimer);
        }

        if (kind === "EXIT_RECEIPT") {
          writeExitReceipt(printer, payload);
          return finalizePrinter(printer, finishOk, clearTimer);
        }

        writeSubscriptionReceipt(printer, payload);
        return finalizePrinter(printer, finishOk, clearTimer);
      } catch (err) {
        clearTimer();

        try {
          log("attempting printer.close() after render/write error");
          printer.close?.();
        } catch (closeErr) {
          logError("printer.close() after render/write error failed", {
            errorMessage: safeErrMsg(closeErr),
          });
        }

        return finishErr(err);
      }
    });
  });
}