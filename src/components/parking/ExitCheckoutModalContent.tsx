"use client";

import * as React from "react";
import {
  CarFront,
  Bike,
  Truck,
  Bus,
  Tractor,
  HelpCircle,
  Clock,
  CalendarClock,
  BadgeDollarSign,
  ArrowRight,
  AlertTriangle,
  Printer,
  CheckCircle2,
} from "lucide-react";

import { getSuggestedPrice } from "@/lib/pricing/suggestedPricing";
import type { VehicleType } from "./ExitLookupPanel";

export type PaymentMethod = "CASH" | "NEQUI" | "TRANSFER" | "OTHER";

export type ExitCheckoutData = {
  parkingSessionId: string;
  /**
   * Por compatibilidad con el componente, este campo sigue llamándose ticketCode,
   * pero en el flujo nuevo debe contener el scanCode corto/escaneable.
   */
  ticketCode: string;
  entryAtIso: string;
  vehicle: {
    id: string;
    type: VehicleType;
    plate: string;
    plateNormalized: string;
  };
};

export type ExitCheckoutSubmitPayload = {
  parkingSessionId: string;
  method: PaymentMethod;
  amountPaid: number;
  suggestedAmount: number;
  exitAtIsoClient: string;
  generateReceipt: boolean;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatBogota(isoUtc: string) {
  try {
    const d = new Date(isoUtc);
    return new Intl.DateTimeFormat("es-CO", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return isoUtc;
  }
}

function formatCOP(value: number) {
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${Math.round(value).toLocaleString("es-CO")}`;
  }
}

function normalizeAmountInput(raw: string) {
  return raw.replace(/\D/g, "").slice(0, 9);
}

function clampInt(raw: string) {
  const cleaned = normalizeAmountInput(raw);
  const n = cleaned ? parseInt(cleaned, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

function vehicleMeta(type: VehicleType) {
  switch (type) {
    case "CAR":
      return { label: "Carro", Icon: CarFront };
    case "MOTO":
      return { label: "Moto", Icon: Bike };
    case "TRUCK":
      return { label: "Camión", Icon: Truck };
    case "BUS":
      return { label: "Bus", Icon: Bus };
    case "TRACTOMULA":
      return { label: "Tractomula", Icon: Tractor };
    default:
      return { label: "Otro", Icon: HelpCircle };
  }
}

export default function ExitCheckoutModalContent({
  data,
  onCancel,
  onConfirm,
}: {
  data: ExitCheckoutData;
  onCancel: () => void;
  onConfirm: (payload: ExitCheckoutSubmitPayload) => void;
}) {
  const amountInputRef = React.useRef<HTMLInputElement | null>(null);

  const [nowIso, setNowIso] = React.useState<string>(() =>
    new Date().toISOString()
  );
  const [amountPaidText, setAmountPaidText] = React.useState<string>("");
  const [generateReceipt, setGenerateReceipt] = React.useState<boolean>(true);

  React.useEffect(() => {
    const t = window.setInterval(() => {
      setNowIso(new Date().toISOString());
    }, 15_000);

    return () => window.clearInterval(t);
  }, []);

  React.useEffect(() => {
    setNowIso(new Date().toISOString());
    setAmountPaidText("");
    setGenerateReceipt(true);

    window.setTimeout(() => {
      amountInputRef.current?.focus();
      amountInputRef.current?.select();
    }, 40);
  }, [data.parkingSessionId]);

  const entryAt = React.useMemo(() => new Date(data.entryAtIso), [data.entryAtIso]);
  const exitAt = React.useMemo(() => new Date(nowIso), [nowIso]);

  const suggestion = React.useMemo(() => {
    return getSuggestedPrice({
      vehicleType: data.vehicle.type,
      entryAt,
      exitAt,
    });
  }, [data.vehicle.type, entryAt, exitAt]);

  const amountPaid = React.useMemo(() => clampInt(amountPaidText), [amountPaidText]);

  const difference = amountPaid - suggestion.suggestedAmount;
  const canConfirm = amountPaid > 0;

  const { Icon: VehicleIcon, label: vehicleLabel } = vehicleMeta(data.vehicle.type);

  const amountStatus = React.useMemo(() => {
    if (amountPaid <= 0) {
      return {
        tone: "warning" as const,
        label: "Ingresa un valor mayor a 0.",
      };
    }

    if (difference === 0) {
      return {
        tone: "ok" as const,
        label: "Coincide con el valor sugerido.",
      };
    }

    if (difference > 0) {
      return {
        tone: "info" as const,
        label: `Recibes ${formatCOP(difference)} por encima del sugerido.`,
      };
    }

    return {
      tone: "warning" as const,
      label: `Recibes ${formatCOP(Math.abs(difference))} por debajo del sugerido.`,
    };
  }, [amountPaid, difference, suggestion.suggestedAmount]);

  function handleConfirm() {
    if (!canConfirm) return;

    const payload: ExitCheckoutSubmitPayload = {
      parkingSessionId: data.parkingSessionId,
      method: "CASH",
      amountPaid,
      suggestedAmount: suggestion.suggestedAmount,
      exitAtIsoClient: nowIso,
      generateReceipt,
    };

    onConfirm(payload);
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto px-4 pb-4 sm:px-5 sm:pb-5">
      <div className="rounded-2xl border border-rose-200/70 bg-rose-50 p-4">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl border border-rose-200 bg-white shadow-sm">
            <VehicleIcon className="size-6 text-rose-700" />
          </div>

          <div className="min-w-0">
            <div className="text-base font-semibold tracking-tight text-zinc-900">
              {data.vehicle.plate}{" "}
              <span className="font-medium text-zinc-500">• {vehicleLabel}</span>
            </div>

            <div className="mt-0.5 text-sm text-zinc-600">
              Código:{" "}
              <span className="font-mono text-[13px]">{data.ticketCode}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <InfoRow
            icon={<CalendarClock className="size-4 text-rose-700" />}
            label="Entrada"
            value={formatBogota(data.entryAtIso)}
          />

          <InfoRow
            icon={<Clock className="size-4 text-rose-700" />}
            label="Salida"
            value={formatBogota(nowIso)}
          />

          <InfoRow
            icon={<Clock className="size-4 text-rose-700" />}
            label="Duración"
            value={suggestion.durationLabel}
          />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900">
              Valor sugerido
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              {suggestion.tierLabel}
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-semibold tracking-tight text-zinc-900">
              {formatCOP(suggestion.suggestedAmount)}
            </div>
            <div className="mt-1 text-xs text-zinc-500">COP</div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAmountPaidText(String(suggestion.suggestedAmount))}
            className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-100"
          >
            Usar sugerido
          </button>

          <button
            type="button"
            onClick={() =>
              setAmountPaidText(String(Math.max(0, suggestion.suggestedAmount + 1000)))
            }
            className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            + $1.000
          </button>

          <button
            type="button"
            onClick={() => setAmountPaidText("")}
            className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            Limpiar
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-900">
                  Generar recibo
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Método de pago: efectivo.
                </div>
              </div>

              <div className="hidden rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700 sm:inline-flex">
                Efectivo
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGenerateReceipt(true)}
                aria-pressed={generateReceipt}
                className={cx(
                  "inline-flex h-12 items-center justify-center gap-2 rounded-2xl border text-sm font-semibold shadow-sm transition",
                  "focus:outline-none focus:ring-4 focus:ring-rose-200",
                  generateReceipt
                    ? "border-rose-300 bg-rose-50 text-rose-800"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                )}
              >
                <Printer
                  className={cx(
                    "size-4",
                    generateReceipt ? "text-rose-700" : "text-zinc-500"
                  )}
                />
                Sí imprimir
              </button>

              <button
                type="button"
                onClick={() => setGenerateReceipt(false)}
                aria-pressed={!generateReceipt}
                className={cx(
                  "inline-flex h-12 items-center justify-center gap-2 rounded-2xl border text-sm font-semibold shadow-sm transition",
                  "focus:outline-none focus:ring-4 focus:ring-rose-200",
                  !generateReceipt
                    ? "border-rose-300 bg-rose-50 text-rose-800"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                )}
              >
                <Printer
                  className={cx(
                    "size-4",
                    !generateReceipt ? "text-rose-700" : "text-zinc-500"
                  )}
                />
                No imprimir
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-zinc-900">
              Valor recibido
            </div>

            <div className="mt-3 relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                <BadgeDollarSign className="size-5 text-rose-700/70" />
              </div>

              <input
                ref={amountInputRef}
                value={amountPaidText}
                onChange={(e) => setAmountPaidText(normalizeAmountInput(e.target.value))}
                inputMode="numeric"
                autoComplete="off"
                placeholder="Ej: 8000"
                className={cx(
                  "h-12 w-full rounded-2xl border bg-white pl-11 pr-4",
                  "text-base font-semibold tracking-wide text-zinc-900",
                  "placeholder:text-zinc-400 shadow-sm transition",
                  "focus:outline-none focus:ring-4 focus:ring-rose-200 focus:border-rose-300"
                )}
              />
            </div>

            <div className="mt-2 text-sm font-semibold text-zinc-900">
              {amountPaid > 0 ? formatCOP(amountPaid) : "—"}
            </div>

            <div aria-live="polite" className="mt-3">
              {amountStatus.tone === "ok" ? (
                <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                  <CheckCircle2 className="mt-0.5 size-4 text-emerald-700" />
                  <div className="text-xs font-medium text-emerald-900">
                    {amountStatus.label}
                  </div>
                </div>
              ) : amountStatus.tone === "info" ? (
                <div className="flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3">
                  <BadgeDollarSign className="mt-0.5 size-4 text-sky-700" />
                  <div className="text-xs font-medium text-sky-900">
                    {amountStatus.label}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangle className="mt-0.5 size-4 text-amber-700" />
                  <div className="text-xs font-medium text-amber-900">
                    {amountStatus.label}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 mt-4 bg-white/90 py-3 backdrop-blur-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={cx(
              "inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-5",
              "text-sm font-semibold shadow-sm transition",
              "focus:outline-none focus:ring-4 focus:ring-rose-200",
              !canConfirm
                ? "bg-zinc-200 text-zinc-500"
                : "bg-rose-600 text-white hover:bg-rose-700"
            )}
          >
            Registrar salida
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-rose-200/70 bg-white/70 p-3">
      <div className="flex items-center gap-2">
        {icon}
        <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          {label}
        </div>
      </div>
      <div className="mt-1 text-sm font-semibold text-zinc-900">{value}</div>
    </div>
  );
}