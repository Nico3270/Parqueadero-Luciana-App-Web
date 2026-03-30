"use client";

import Link from "next/link";
import * as React from "react";
import {
  CarFront,
  Bike,
  Truck,
  Bus,
  Tractor,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  CalendarClock,
  Ticket,
  RotateCcw,
  X,
  ExternalLink,
} from "lucide-react";
import {
  CreateEntryResult,
  EntryActionState,
} from "@/actions/parking/createEntryAction";

/**
 * Tipos del dominio (coinciden con Prisma enum VehicleType)
 * Se muestran en español, pero se envían como el enum real.
 */
export type VehicleType =
  | "CAR"
  | "MOTO"
  | "TRUCK"
  | "BUS"
  | "TRACTOMULA"
  | "OTHER";

type Accent = {
  panelBg: string;
  panelBorder: string;
  selBg: string;
  selBorder: string;
  selRing: string;
  selChip: string;
  selIcon: string;
  selText: string;
  primaryBtn: string;
  primaryBtnHover: string;
};

type VehicleTypeUI = {
  type: VehicleType;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: Accent;
};

const VEHICLE_TYPES: VehicleTypeUI[] = [
  {
    type: "CAR",
    label: "Carro",
    Icon: CarFront,
    accent: {
      panelBg: "from-sky-50/80 to-white",
      panelBorder: "border-sky-200/70",
      selBg: "bg-sky-50",
      selBorder: "border-sky-400",
      selRing: "ring-sky-300",
      selChip: "bg-sky-600",
      selIcon: "text-sky-700",
      selText: "text-sky-950",
      primaryBtn: "bg-sky-600",
      primaryBtnHover: "hover:bg-sky-700",
    },
  },
  {
    type: "MOTO",
    label: "Moto",
    Icon: Bike,
    accent: {
      panelBg: "from-emerald-50/80 to-white",
      panelBorder: "border-emerald-200/70",
      selBg: "bg-emerald-50",
      selBorder: "border-emerald-400",
      selRing: "ring-emerald-300",
      selChip: "bg-emerald-600",
      selIcon: "text-emerald-700",
      selText: "text-emerald-950",
      primaryBtn: "bg-emerald-600",
      primaryBtnHover: "hover:bg-emerald-700",
    },
  },
  {
    type: "TRUCK",
    label: "Camión",
    Icon: Truck,
    accent: {
      panelBg: "from-indigo-50/80 to-white",
      panelBorder: "border-indigo-200/70",
      selBg: "bg-indigo-50",
      selBorder: "border-indigo-400",
      selRing: "ring-indigo-300",
      selChip: "bg-indigo-600",
      selIcon: "text-indigo-700",
      selText: "text-indigo-950",
      primaryBtn: "bg-indigo-600",
      primaryBtnHover: "hover:bg-indigo-700",
    },
  },
  {
    type: "BUS",
    label: "Bus",
    Icon: Bus,
    accent: {
      panelBg: "from-amber-50/80 to-white",
      panelBorder: "border-amber-200/70",
      selBg: "bg-amber-50",
      selBorder: "border-amber-400",
      selRing: "ring-amber-300",
      selChip: "bg-amber-600",
      selIcon: "text-amber-700",
      selText: "text-amber-950",
      primaryBtn: "bg-amber-600",
      primaryBtnHover: "hover:bg-amber-700",
    },
  },
  {
    type: "TRACTOMULA",
    label: "Tractomula",
    Icon: Tractor,
    accent: {
      panelBg: "from-violet-50/80 to-white",
      panelBorder: "border-violet-200/70",
      selBg: "bg-violet-50",
      selBorder: "border-violet-400",
      selRing: "ring-violet-300",
      selChip: "bg-violet-600",
      selIcon: "text-violet-700",
      selText: "text-violet-950",
      primaryBtn: "bg-violet-600",
      primaryBtnHover: "hover:bg-violet-700",
    },
  },
  {
    type: "OTHER",
    label: "Otro",
    Icon: HelpCircle,
    accent: {
      panelBg: "from-zinc-50/80 to-white",
      panelBorder: "border-zinc-200/70",
      selBg: "bg-zinc-50",
      selBorder: "border-zinc-400",
      selRing: "ring-zinc-300",
      selChip: "bg-zinc-800",
      selIcon: "text-zinc-700",
      selText: "text-zinc-950",
      primaryBtn: "bg-zinc-900",
      primaryBtnHover: "hover:bg-zinc-800",
    },
  },
];

export type CreateEntryServerAction = (
  prevState: EntryActionState,
  formData: FormData
) => Promise<EntryActionState>;

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

function isSuccessResult(
  value: CreateEntryResult | undefined
): value is Extract<CreateEntryResult, { ok: true }> {
  return Boolean(value && value.ok);
}

function isErrorResult(
  value: CreateEntryResult | undefined
): value is Extract<CreateEntryResult, { ok: false }> {
  return Boolean(value && !value.ok);
}

function isRegularEntrySuccess(
  value: CreateEntryResult | undefined
): value is Extract<CreateEntryResult, { ok: true; kind: "REGULAR_ENTRY" }> {
  return Boolean(
    value &&
      value.ok &&
      "kind" in value &&
      value.kind === "REGULAR_ENTRY"
  );
}

function isSubscriptionEntrySuccess(
  value: CreateEntryResult | undefined
): value is Extract<CreateEntryResult, { ok: true; kind: "SUBSCRIPTION_ENTRY" }> {
  return Boolean(
    value &&
      value.ok &&
      "kind" in value &&
      value.kind === "SUBSCRIPTION_ENTRY"
  );
}

function isRestartRequiredError(
  value: CreateEntryResult | undefined
): value is Extract<
  CreateEntryResult,
  { ok: false; code: "ACTIVE_SESSION_RESTART_REQUIRED" }
> {
  return Boolean(
    value &&
      !value.ok &&
      "code" in value &&
      value.code === "ACTIVE_SESSION_RESTART_REQUIRED"
  );
}

/**
 * Config simple por ahora:
 * - stationId: a qué estación/impresora se manda el print job
 * Luego lo haces dinámico (por usuario/turno/config).
 */
const DEFAULT_STATION_ID = "TUNJA-1";

export function EntryPanel({
  action,
  title = "Entrada",
  description = "Selecciona el tipo y registra la placa.",
  className,
  stationId = DEFAULT_STATION_ID,
}: {
  action: CreateEntryServerAction;
  title?: string;
  description?: string;
  className?: string;
  stationId?: string;
}) {
  const plateRef = React.useRef<HTMLInputElement | null>(null);
  const formRef = React.useRef<HTMLFormElement | null>(null);

  const [vehicleType, setVehicleType] = React.useState<VehicleType>("CAR");
  const [plate, setPlate] = React.useState<string>("");
  const [confirmRestartExisting, setConfirmRestartExisting] =
    React.useState(false);
  const [showRestartDialog, setShowRestartDialog] = React.useState(false);
  const [showSubscriptionDialog, setShowSubscriptionDialog] =
    React.useState(false);

  const initialState: EntryActionState = React.useMemo(() => ({}), []);
  const [state, formAction, isPending] = (React as any).useActionState
    ? (React as any).useActionState(action, initialState)
    : [initialState, action, false];

  const last = state?.last;
  const showSuccess = isSuccessResult(last);
  const showError = isErrorResult(last);
  const showRegularSuccess = isRegularEntrySuccess(last);
  const showGenericError = showError && !isRestartRequiredError(last);

  React.useEffect(() => {
    if (!last) return;

    if (isSuccessResult(last)) {
      setPlate("");
      setConfirmRestartExisting(false);
      setShowRestartDialog(false);

      if (isSubscriptionEntrySuccess(last)) {
        setShowSubscriptionDialog(true);
      } else {
        setShowSubscriptionDialog(false);
      }

      window.setTimeout(() => {
        plateRef.current?.focus();
      }, 30);
      return;
    }

    if (isRestartRequiredError(last)) {
      setConfirmRestartExisting(false);
      setShowSubscriptionDialog(false);
      setShowRestartDialog(true);
      return;
    }

    setConfirmRestartExisting(false);
    setShowRestartDialog(false);
  }, [last]);

  const selectedMeta =
    VEHICLE_TYPES.find((v) => v.type === vehicleType) ?? VEHICLE_TYPES[0];

  const canSubmit = plate.length >= 4 && !isPending;

  function handleCloseRestartDialog() {
    setShowRestartDialog(false);
    setConfirmRestartExisting(false);
    window.setTimeout(() => {
      plateRef.current?.focus();
    }, 30);
  }

  function handleConfirmRestart() {
    setConfirmRestartExisting(true);

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        formRef.current?.requestSubmit();
      });
    }
  }

  function handleCloseSubscriptionDialog() {
    setShowSubscriptionDialog(false);
    window.setTimeout(() => {
      plateRef.current?.focus();
    }, 30);
  }

  return (
    <>
      <section
        className={cx(
          "rounded-[26px] border shadow-[0_10px_30px_rgba(0,0,0,0.04)]",
          "bg-gradient-to-b",
          selectedMeta.accent.panelBg,
          selectedMeta.accent.panelBorder,
          "p-3 sm:p-4",
          className
        )}
        aria-label="Módulo de entrada"
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold tracking-tight text-zinc-950 sm:text-lg">
              {title}
            </h2>
            <p className="mt-1 text-[12px] leading-5 text-zinc-600 sm:text-sm">
              {description}
            </p>
          </div>

          <div
            className={cx(
              "hidden sm:inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1.5 text-xs font-semibold shadow-sm",
              selectedMeta.accent.selBorder,
              selectedMeta.accent.selText
            )}
          >
            <selectedMeta.Icon
              className={cx("size-4", selectedMeta.accent.selIcon)}
            />
            {selectedMeta.label}
          </div>
        </header>

        <div className="mt-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {VEHICLE_TYPES.map(({ type, label, Icon, accent }) => {
              const selected = type === vehicleType;

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setVehicleType(type)}
                  className={cx(
                    "group relative min-h-[78px] rounded-[20px] border p-2.5 text-left transition-all duration-200",
                    "focus:outline-none focus:ring-4",
                    selected
                      ? cx(
                          "shadow-[0_8px_24px_rgba(0,0,0,0.06)]",
                          accent.selBg,
                          accent.selBorder,
                          accent.selRing
                        )
                      : "border-zinc-200/90 bg-white/85 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:bg-white"
                  )}
                  aria-pressed={selected}
                >
                  <div className="flex h-full flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={cx(
                          "grid size-9 shrink-0 place-items-center rounded-2xl border bg-white shadow-sm",
                          selected ? accent.selBorder : "border-zinc-200"
                        )}
                      >
                        <Icon
                          className={cx(
                            "size-[17px]",
                            selected ? accent.selIcon : "text-zinc-600"
                          )}
                        />
                      </div>

                      <div
                        className={cx(
                          "mt-0.5 size-5 rounded-full border transition",
                          selected
                            ? cx(
                                "grid place-items-center",
                                accent.selBorder,
                                "bg-white"
                              )
                            : "border-zinc-200 bg-zinc-50"
                        )}
                      >
                        {selected ? (
                          <CheckCircle2
                            className={cx("size-3.5", accent.selIcon)}
                          />
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-2 min-w-0">
                      <div
                        className={cx(
                          "truncate text-[13px] font-semibold leading-4 sm:text-sm",
                          selected ? accent.selText : "text-zinc-900"
                        )}
                      >
                        {label}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <form ref={formRef} action={formAction} className="mt-3 grid gap-3">
          <input type="hidden" name="vehicleType" value={vehicleType} />
          <input type="hidden" name="clientTimeZone" value="America/Bogota" />
          <input type="hidden" name="stationId" value={stationId} />
          <input
            type="hidden"
            name="confirmRestartExisting"
            value={confirmRestartExisting ? "true" : "false"}
          />

          <div className="rounded-[22px] border border-zinc-200/80 bg-white/80 p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="plate"
                className="text-sm font-semibold tracking-tight text-zinc-800"
              >
                Placa
              </label>

              <div
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                  selectedMeta.accent.selBorder,
                  selectedMeta.accent.selText,
                  "bg-white"
                )}
              >
                <selectedMeta.Icon
                  className={cx("size-3.5", selectedMeta.accent.selIcon)}
                />
                {selectedMeta.label}
              </div>
            </div>

            <div className="mt-2 relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                <selectedMeta.Icon
                  className={cx("size-5", selectedMeta.accent.selIcon)}
                />
              </div>

              <input
                id="plate"
                name="plate"
                ref={plateRef}
                inputMode="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="Ej: ABC123"
                value={plate}
                onChange={(e) => setPlate(normalizePlateForInput(e.target.value))}
                className={cx(
                  "h-11 w-full rounded-[16px] border bg-white pl-11 pr-4",
                  "text-[15px] font-semibold tracking-[0.08em] text-zinc-900",
                  "placeholder:tracking-normal placeholder:text-zinc-400",
                  "shadow-sm transition",
                  "focus:outline-none focus:ring-4 focus:border-transparent",
                  selectedMeta.accent.selBorder,
                  selectedMeta.accent.selRing.replace("ring-", "focus:ring-")
                )}
              />
            </div>

            <p className="mt-2 text-[11px] leading-4 text-zinc-500 sm:text-xs">
              Se guarda en UTC y se muestra en hora Colombia.
            </p>
          </div>

          <div aria-live="polite" className="grid gap-3">
            {showRegularSuccess ? (
              <div className="flex items-start gap-2 rounded-[20px] border border-emerald-200 bg-emerald-50 p-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-emerald-900">
                    Entrada registrada
                  </div>

                  <div className="mt-0.5 text-sm text-emerald-800">
                    {last.plate} • {formatBogota(last.entryAtIso)}
                  </div>

                  {last.restartedPreviousSession ? (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-medium text-emerald-900">
                      <RotateCcw className="size-3.5" />
                      Se reinició una sesión anterior
                    </div>
                  ) : null}

                  <div className="mt-2 text-xs text-emerald-900/80">
                    Código de escaneo •{" "}
                    <span className="font-mono">{last.scanCode}</span>
                  </div>

                  <div className="mt-1 text-xs text-emerald-900/80">
                    Ticket en cola de impresión •{" "}
                    <span className="font-mono">{last.printJobId}</span>
                  </div>
                </div>
              </div>
            ) : null}

            {showGenericError ? (
              <div className="flex items-start gap-2 rounded-[20px] border border-amber-200 bg-amber-50 p-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-amber-900">
                    No se pudo registrar
                  </div>
                  <div className="mt-0.5 text-sm text-amber-900/90">
                    {last.message}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className={cx(
              "inline-flex h-11 w-full items-center justify-center gap-2 rounded-[16px] px-5",
              "text-sm font-semibold shadow-sm transition sm:text-base",
              "focus:outline-none focus:ring-4 focus:ring-zinc-200",
              !canSubmit
                ? "bg-zinc-200 text-zinc-500"
                : cx(
                    "text-white",
                    selectedMeta.accent.primaryBtn,
                    selectedMeta.accent.primaryBtnHover
                  )
            )}
          >
            {isPending ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                Registrando…
              </>
            ) : (
              <>Registrar entrada</>
            )}
          </button>

          <div className="text-[11px] leading-4 text-zinc-500 sm:text-xs">
            Tip: presiona <span className="font-semibold text-zinc-700">Enter</span>{" "}
            para registrar más rápido.
          </div>
        </form>
      </section>

      {showRestartDialog && isRestartRequiredError(last) ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/35 p-3 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-[28px] border border-zinc-200 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700">
                  <AlertTriangle className="size-5" />
                </div>

                <div className="min-w-0">
                  <h3 className="text-base font-semibold tracking-tight text-zinc-950">
                    Ya existe una sesión activa
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-zinc-600">
                    {last.message}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseRestartDialog}
                className="grid size-9 shrink-0 place-items-center rounded-full border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50"
                aria-label="Cerrar"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
              <div className="text-sm font-semibold text-zinc-900">
                Sesión actual del vehículo
              </div>

              <div className="mt-2 grid gap-2 text-sm text-zinc-700">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">Placa</span>
                  <span className="font-semibold tracking-[0.08em] text-zinc-950">
                    {plate || "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">Ingreso</span>
                  <span className="font-medium text-zinc-900">
                    {formatBogota(last.existingSession.entryAtIso)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">Código</span>
                  <span className="font-mono text-zinc-900">
                    {last.existingSession.scanCode}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-500">Tipo</span>
                  <span className="font-medium text-zinc-900">
                    {last.existingSession.pricingUnit === "SUBSCRIPTION"
                      ? "Mensualidad"
                      : "Ingreso normal"}
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-4 text-sm leading-5 text-zinc-600">
              Si continúas, la sesión anterior se cerrará automáticamente y se
              creará una nueva entrada para este vehículo.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleCloseRestartDialog}
                className="inline-flex h-11 items-center justify-center rounded-[16px] border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmRestart}
                disabled={isPending}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[16px] bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Reiniciando…
                  </>
                ) : (
                  <>
                    <RotateCcw className="size-4" />
                    Reiniciar ingreso
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showSubscriptionDialog && isSubscriptionEntrySuccess(last) ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/35 p-3 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-[28px] border border-zinc-200 bg-white p-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-700">
                  <CalendarClock className="size-5" />
                </div>

                <div className="min-w-0">
                  <h3 className="text-base font-semibold tracking-tight text-zinc-950">
                    Vehículo con mensualidad
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-zinc-600">
                    Se registró el ingreso sin imprimir ticket.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseSubscriptionDialog}
                className="grid size-9 shrink-0 place-items-center rounded-full border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50"
                aria-label="Cerrar"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-3">
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-sky-700 shadow-sm">
                  <Ticket className="size-4.5" />
                </div>

                <div className="min-w-0">
                  <div className="text-sm font-semibold text-sky-950">
                    {last.plate}
                  </div>
                  <div className="mt-1 text-sm text-sky-900/90">
                    Ingreso: {formatBogota(last.entryAtIso)}
                  </div>
                  <div className="mt-1 text-xs text-sky-900/80">
                    Vigente hasta: {formatBogota(last.subscriptionEndAtIso)}
                  </div>

                  {last.restartedPreviousSession ? (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-white px-2.5 py-1 text-[11px] font-medium text-sky-950">
                      <RotateCcw className="size-3.5" />
                      Se reinició una sesión anterior
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleCloseSubscriptionDialog}
                className="inline-flex h-11 items-center justify-center rounded-[16px] border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Cerrar
              </button>

              <Link
                href={last.subscriptionUrl}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[16px] bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
              >
                Ver mensualidad
                <ExternalLink className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default EntryPanel;