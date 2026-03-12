"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  CarFront,
  Bike,
  Truck,
  Bus,
  Tractor,
  HelpCircle,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

import ExitCheckoutModalContent, {
  type ExitCheckoutSubmitPayload,
} from "./ExitCheckoutModalContent";
import {
  ExitLookupResult,
  ExitLookupState,
  ExitLookupSuccess,
} from "@/actions/parking/lookupExitAction";
import { closeExitAction } from "@/actions/parking/closeExitAction";

export type VehicleType =
  | "CAR"
  | "MOTO"
  | "TRUCK"
  | "BUS"
  | "TRACTOMULA"
  | "OTHER";

export type LookupMode = "PLATE";

export type ExitLookupServerAction = (
  prevState: ExitLookupState,
  formData: FormData
) => Promise<ExitLookupState>;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizePlateForInput(raw: string) {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
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

function isLookupSuccess(
  value: ExitLookupResult | null
): value is ExitLookupSuccess {
  return Boolean(value && value.ok);
}

function isLookupError(
  value: ExitLookupResult | null
): value is Extract<ExitLookupResult, { ok: false }> {
  return Boolean(value && !value.ok);
}

const DEFAULT_STATION_ID = "TUNJA-1";
const FIXED_MODE: LookupMode = "PLATE";

export default function ExitLookupPanel({
  action,
  title = "Salida / Cobro",
  description = "Busca la sesión activa por placa para registrar la salida.",
  className,
  stationId = DEFAULT_STATION_ID,
}: {
  action: ExitLookupServerAction;
  title?: string;
  description?: string;
  className?: string;
  stationId?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const formRef = React.useRef<HTMLFormElement | null>(null);

  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const [lookupLoading, setLookupLoading] = React.useState(false);
  const [lookupResult, setLookupResult] =
    React.useState<ExitLookupResult | null>(null);

  const ok = isLookupSuccess(lookupResult);
  const err = isLookupError(lookupResult);

  const [closing, setClosing] = React.useState(false);
  const [closeError, setCloseError] = React.useState<string | null>(null);
  const [closeSuccess, setCloseSuccess] = React.useState<string | null>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (ok) {
      setCloseError(null);
      setCloseSuccess(null);
      setOpen(true);
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [ok]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open && !closing) {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closing]);

  const placeholder = "Ej: ABC123";
  const helper = "Tip: escribe la placa sin espacios ni guiones.";
  const canSubmit = query.trim().length >= 4 && !lookupLoading;

  async function handleLookupSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;

    setLookupLoading(true);
    setLookupResult(null);
    setCloseError(null);
    setCloseSuccess(null);

    try {
      const fd = new FormData(formRef.current);
      const resState = await action({}, fd);
      const last = resState?.last ?? null;

      if (!last) {
        setLookupResult({
          ok: false,
          code: "UNKNOWN_ERROR",
          message: "No se pudo procesar la búsqueda. Intenta de nuevo.",
        });
        return;
      }

      setLookupResult(last);
    } catch {
      setLookupResult({
        ok: false,
        code: "UNKNOWN_ERROR",
        message: "Error buscando la sesión. Intenta de nuevo.",
      });
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleConfirm(payload: ExitCheckoutSubmitPayload) {
    if (!ok) return;

    setClosing(true);
    setCloseError(null);
    setCloseSuccess(null);

    try {
      const res = await closeExitAction({
        parkingSessionId: payload.parkingSessionId,
        method: payload.method,
        amountPaid: payload.amountPaid,
        suggestedAmount: payload.suggestedAmount,
        stationId,
      });

      if (!res.ok) {
        setCloseError(res.message || "No se pudo registrar la salida.");
        return;
      }

      setCloseSuccess(
        `Salida registrada • ${res.finalAmount.toLocaleString("es-CO")} COP`
      );
      setOpen(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch {
      setCloseError("Ocurrió un error al registrar la salida. Intenta de nuevo.");
    } finally {
      setClosing(false);
    }
  }

  return (
    <>
      <section
        className={cx(
          "rounded-2xl border shadow-sm",
          "border-rose-200/70 bg-gradient-to-b from-rose-50/70 to-white",
          "p-4 sm:p-6",
          className
        )}
        aria-label="Módulo de salida"
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-zinc-900 sm:text-lg">
              {title}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">{description}</p>
          </div>

          <div className="shrink-0">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-100/70 px-3 py-2 text-sm font-semibold text-rose-900 shadow-sm">
              <Search className="size-4" />
              Búsqueda por placa
            </div>
          </div>
        </header>

        <form
          ref={formRef}
          onSubmit={handleLookupSubmit}
          className="mt-5 grid gap-4"
        >
          <input type="hidden" name="mode" value={FIXED_MODE} />
          <input type="hidden" name="clientTimeZone" value="America/Bogota" />
          <input type="hidden" name="stationId" value={stationId} />

          <div className="rounded-2xl border border-rose-200/70 bg-white/70 p-3 sm:p-4">
            <label htmlFor="ticketOrPlate" className="text-sm font-semibold text-zinc-800">
              Placa
            </label>

            <div className="mt-2 relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                <Search className="size-5 text-rose-700/70" />
              </div>

              <input
                id="ticketOrPlate"
                name="ticketOrPlate"
                ref={inputRef}
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                placeholder={placeholder}
                value={query}
                onChange={(e) => {
                  setQuery(normalizePlateForInput(e.target.value));
                }}
                className={cx(
                  "h-12 w-full rounded-2xl border bg-white pl-11 pr-4",
                  "text-base font-semibold tracking-wide text-zinc-900",
                  "placeholder:text-zinc-400 shadow-sm transition",
                  "focus:outline-none focus:ring-4 focus:ring-rose-200 focus:border-rose-300"
                )}
              />
            </div>

            <p className="mt-2 text-xs text-zinc-500">{helper}</p>
          </div>

          <div aria-live="polite" className="grid gap-3">
            {ok ? (
              <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <CheckCircle2 className="mt-0.5 size-5 text-emerald-700" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-emerald-900">
                    Sesión encontrada
                  </div>
                  <div className="mt-0.5 text-sm text-emerald-800">
                    {lookupResult.vehicle.plate} •{" "}
                    {formatBogota(lookupResult.entryAtIso)}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-emerald-900/80">
                    {(() => {
                      const meta = vehicleMeta(lookupResult.vehicle.type);
                      const Icon = meta.Icon;
                      return (
                        <>
                          <Icon className="size-4" />
                          <span>{meta.label}</span>
                        </>
                      );
                    })()}
                  </div>
                  <div className="mt-1 text-xs text-emerald-900/80">
                    Código de salida •{" "}
                    <span className="font-mono">{lookupResult.scanCode}</span>
                  </div>
                  <div className="mt-1 text-xs text-emerald-900/80">
                    Ticket interno •{" "}
                    <span className="font-mono">{lookupResult.ticketCode}</span>
                  </div>
                </div>
              </div>
            ) : null}

            {err ? (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <AlertTriangle className="mt-0.5 size-5 text-amber-700" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-amber-900">
                    No se encontró
                  </div>
                  <div className="mt-0.5 text-sm text-amber-900/90">
                    {lookupResult.message}
                  </div>
                </div>
              </div>
            ) : null}

            {closeError ? (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <AlertTriangle className="mt-0.5 size-5 text-amber-700" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-amber-900">
                    No se pudo registrar la salida
                  </div>
                  <div className="mt-0.5 text-sm text-amber-900/90">
                    {closeError}
                  </div>
                </div>
              </div>
            ) : null}

            {closeSuccess ? (
              <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <CheckCircle2 className="mt-0.5 size-5 text-emerald-700" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-emerald-900">
                    Listo
                  </div>
                  <div className="mt-0.5 text-sm text-emerald-800">
                    {closeSuccess}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className={cx(
              "inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-5",
              "text-base font-semibold shadow-sm transition",
              "focus:outline-none focus:ring-4 focus:ring-rose-200",
              !canSubmit
                ? "bg-zinc-200 text-zinc-500"
                : "bg-rose-600 text-white hover:bg-rose-700"
            )}
          >
            {lookupLoading ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                Buscando…
              </>
            ) : (
              <>
                <Search className="size-5" />
                Buscar por placa
              </>
            )}
          </button>
        </form>
      </section>

      <AnimatePresence>
        {open && ok ? (
          <motion.div
            className="fixed inset-0 z-[999]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-modal="true"
            role="dialog"
          >
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => (!closing ? setOpen(false) : null)}
            />

            <motion.div
              className="absolute left-1/2 top-1/2 w-[92vw] max-w-2xl -translate-x-1/2 -translate-y-1/2"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
            >
              <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white shadow-xl">
                <div className="flex items-start justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-5 text-emerald-600" />
                      <h3 className="text-base font-semibold tracking-tight text-zinc-900">
                        Registrar salida
                      </h3>
                    </div>
                    <p className="mt-1 text-sm text-zinc-600">
                      Confirma el pago y registra el cierre.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => (!closing ? setOpen(false) : null)}
                    className={cx(
                      "inline-flex size-10 items-center justify-center rounded-2xl border bg-white text-zinc-700 shadow-sm transition",
                      closing
                        ? "border-zinc-200 opacity-60"
                        : "border-zinc-200 hover:bg-zinc-50"
                    )}
                    aria-label="Cerrar"
                    disabled={closing}
                  >
                    <X className="size-5" />
                  </button>
                </div>

                <div className="max-h-[85vh] overflow-hidden">
                  <ExitCheckoutModalContent
                    data={{
                      parkingSessionId: lookupResult.parkingSessionId,
                      ticketCode: lookupResult.scanCode,
                      entryAtIso: lookupResult.entryAtIso,
                      vehicle: {
                        id: lookupResult.vehicle.id,
                        type: lookupResult.vehicle.type,
                        plate: lookupResult.vehicle.plate,
                        plateNormalized: lookupResult.vehicle.plateNormalized,
                      },
                    }}
                    onCancel={() => (!closing ? setOpen(false) : null)}
                    onConfirm={handleConfirm}
                  />
                </div>

                <AnimatePresence>
                  {closing ? (
                    <motion.div
                      className="absolute inset-0 bg-white/70 backdrop-blur-sm"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className="flex h-full items-center justify-center">
                        <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                          <Loader2 className="size-5 animate-spin text-rose-600" />
                          <div className="text-sm font-semibold text-zinc-900">
                            Registrando salida…
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}