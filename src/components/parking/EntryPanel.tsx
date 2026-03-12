"use client";

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
} from "lucide-react";
import { CreateEntryResult, EntryActionState } from "@/actions/parking/createEntryAction";


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
  selSubText: string;

  primaryBtn: string;
  primaryBtnHover: string;
};

type VehicleTypeUI = {
  type: VehicleType;
  label: string;
  hint: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: Accent;
};

const VEHICLE_TYPES: VehicleTypeUI[] = [
  {
    type: "CAR",
    label: "Carro",
    hint: "Automóvil",
    Icon: CarFront,
    accent: {
      panelBg: "from-sky-50/70 to-white",
      panelBorder: "border-sky-200/70",
      selBg: "bg-sky-100",
      selBorder: "border-sky-300",
      selRing: "ring-sky-400",
      selChip: "bg-sky-600",
      selIcon: "text-sky-700",
      selText: "text-sky-950",
      selSubText: "text-sky-900/70",
      primaryBtn: "bg-sky-600",
      primaryBtnHover: "hover:bg-sky-700",
    },
  },
  {
    type: "MOTO",
    label: "Moto",
    hint: "Motocicleta",
    Icon: Bike,
    accent: {
      panelBg: "from-emerald-50/70 to-white",
      panelBorder: "border-emerald-200/70",
      selBg: "bg-emerald-100",
      selBorder: "border-emerald-300",
      selRing: "ring-emerald-400",
      selChip: "bg-emerald-600",
      selIcon: "text-emerald-700",
      selText: "text-emerald-950",
      selSubText: "text-emerald-900/70",
      primaryBtn: "bg-emerald-600",
      primaryBtnHover: "hover:bg-emerald-700",
    },
  },
  {
    type: "TRUCK",
    label: "Camión",
    hint: "Carga",
    Icon: Truck,
    accent: {
      panelBg: "from-indigo-50/70 to-white",
      panelBorder: "border-indigo-200/70",
      selBg: "bg-indigo-100",
      selBorder: "border-indigo-300",
      selRing: "ring-indigo-400",
      selChip: "bg-indigo-600",
      selIcon: "text-indigo-700",
      selText: "text-indigo-950",
      selSubText: "text-indigo-900/70",
      primaryBtn: "bg-indigo-600",
      primaryBtnHover: "hover:bg-indigo-700",
    },
  },
  {
    type: "BUS",
    label: "Bus",
    hint: "Transporte",
    Icon: Bus,
    accent: {
      panelBg: "from-amber-50/70 to-white",
      panelBorder: "border-amber-200/70",
      selBg: "bg-amber-100",
      selBorder: "border-amber-300",
      selRing: "ring-amber-400",
      selChip: "bg-amber-600",
      selIcon: "text-amber-700",
      selText: "text-amber-950",
      selSubText: "text-amber-900/70",
      primaryBtn: "bg-amber-600",
      primaryBtnHover: "hover:bg-amber-700",
    },
  },
  {
    type: "TRACTOMULA",
    label: "Tractomula",
    hint: "Pesado",
    Icon: Tractor,
    accent: {
      panelBg: "from-violet-50/70 to-white",
      panelBorder: "border-violet-200/70",
      selBg: "bg-violet-100",
      selBorder: "border-violet-300",
      selRing: "ring-violet-400",
      selChip: "bg-violet-600",
      selIcon: "text-violet-700",
      selText: "text-violet-950",
      selSubText: "text-violet-900/70",
      primaryBtn: "bg-violet-600",
      primaryBtnHover: "hover:bg-violet-700",
    },
  },
  {
    type: "OTHER",
    label: "Otro",
    hint: "Especial",
    Icon: HelpCircle,
    accent: {
      panelBg: "from-zinc-50/70 to-white",
      panelBorder: "border-zinc-200/70",
      selBg: "bg-zinc-100",
      selBorder: "border-zinc-300",
      selRing: "ring-zinc-400",
      selChip: "bg-zinc-800",
      selIcon: "text-zinc-800",
      selText: "text-zinc-950",
      selSubText: "text-zinc-900/70",
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

  const [vehicleType, setVehicleType] = React.useState<VehicleType>("CAR");
  const [plate, setPlate] = React.useState<string>("");

  const initialState: EntryActionState = React.useMemo(() => ({}), []);
  const [state, formAction, isPending] = (React as any).useActionState
    ? (React as any).useActionState(action, initialState)
    : [initialState, action, false];

  React.useEffect(() => {
    plateRef.current?.focus();
  }, [vehicleType]);

  React.useEffect(() => {
    if (state?.last?.ok) {
      setPlate("");
      requestAnimationFrame(() => plateRef.current?.focus());
    }
  }, [state?.last]);

  const last = state?.last;
  const showSuccess = isSuccessResult(last);
  const showError = isErrorResult(last);

  const selectedMeta =
    VEHICLE_TYPES.find((v) => v.type === vehicleType) ?? VEHICLE_TYPES[0];

  const canSubmit = plate.length >= 4 && !isPending;

  return (
    <section
      className={cx(
        "rounded-2xl border shadow-sm",
        "bg-gradient-to-b",
        selectedMeta.accent.panelBg,
        selectedMeta.accent.panelBorder,
        "p-4 sm:p-6",
        className
      )}
      aria-label="Módulo de entrada"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900 sm:text-lg">
            {title}
          </h2>
          <p className="mt-1 text-sm text-zinc-600">{description}</p>
        </div>

        <div
          className={cx(
            "hidden sm:inline-flex items-center gap-2 rounded-full border bg-white/70 px-3 py-1 text-xs font-semibold",
            selectedMeta.accent.selBorder,
            selectedMeta.accent.selText
          )}
        >
          <selectedMeta.Icon className={cx("size-4", selectedMeta.accent.selIcon)} />
          {selectedMeta.label}
        </div>
      </header>

      <div className="mt-4">
        <div className="flex flex-wrap gap-3">
          {VEHICLE_TYPES.map(({ type, label, hint, Icon, accent }) => {
            const selected = type === vehicleType;

            return (
              <button
                key={type}
                type="button"
                onClick={() => setVehicleType(type)}
                className={cx(
                  "basis-[170px] sm:basis-[200px] xl:basis-0 xl:flex-1",
                  "w-full",
                  "relative rounded-2xl border p-3 text-left transition",
                  "shadow-[0_1px_0_rgba(0,0,0,0.03)]",
                  "focus:outline-none focus:ring-4",
                  selected
                    ? cx(
                        accent.selBg,
                        accent.selBorder,
                        "ring-2",
                        accent.selRing,
                        "shadow-md",
                        "scale-[1.01]"
                      )
                    : "border-zinc-200 bg-white/80 hover:bg-white"
                )}
                aria-pressed={selected}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cx(
                      "grid size-11 place-items-center rounded-xl border bg-white shadow-sm",
                      selected ? accent.selBorder : "border-zinc-200"
                    )}
                  >
                    <Icon className={cx("size-5", selected ? accent.selIcon : "text-zinc-600")} />
                  </div>

                  <div className="min-w-0">
                    <div
                      className={cx(
                        "truncate text-sm font-semibold sm:text-[15px]",
                        selected ? accent.selText : "text-zinc-900"
                      )}
                    >
                      {label}
                    </div>
                    <div
                      className={cx(
                        "truncate text-xs",
                        selected ? accent.selSubText : "text-zinc-500"
                      )}
                    >
                      {hint}
                    </div>
                  </div>
                </div>

                {selected ? (
                  <div className="pointer-events-none absolute right-3 top-3">
                    <span
                      className={cx(
                        "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold text-white",
                        accent.selChip
                      )}
                    >
                      Seleccionado
                    </span>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <form action={formAction} className="mt-5 grid gap-4">
        <input type="hidden" name="vehicleType" value={vehicleType} />
        <input type="hidden" name="clientTimeZone" value="America/Bogota" />
        <input type="hidden" name="stationId" value={stationId} />

        <div className="rounded-2xl border border-zinc-200/80 bg-white/70 p-3 sm:p-4">
          <label htmlFor="plate" className="text-sm font-semibold text-zinc-800">
            Placa
          </label>

          <div className="mt-2 relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
              <selectedMeta.Icon className={cx("size-5", selectedMeta.accent.selIcon)} />
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
                "h-12 w-full rounded-2xl border bg-white pl-11 pr-4",
                "text-base font-semibold tracking-wide text-zinc-900",
                "placeholder:text-zinc-400 shadow-sm transition",
                "focus:outline-none focus:ring-4 focus:border-transparent",
                "ring-0",
                selectedMeta.accent.selBorder,
                selectedMeta.accent.selRing.replace("ring-", "focus:ring-")
              )}
            />
          </div>

          <p className="mt-2 text-xs text-zinc-500">
            Se guarda en UTC en el servidor y se muestra en hora Colombia.
          </p>
        </div>

        <div aria-live="polite" className="grid gap-3">
          {showSuccess ? (
            <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <CheckCircle2 className="mt-0.5 size-5 text-emerald-700" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-emerald-900">
                  Entrada registrada
                </div>
                <div className="mt-0.5 text-sm text-emerald-800">
                  {last.plate} • {formatBogota(last.entryAtIso)}
                </div>
                <div className="mt-1 text-xs text-emerald-900/80">
                  Codigo de escaneo • <span className="font-mono">{last.scanCode}</span>
                </div>
                <div className="mt-1 text-xs text-emerald-900/80">
                  Ticket en cola de impresión •{" "}
                  <span className="font-mono">{last.printJobId}</span>
                </div>
              </div>
            </div>
          ) : null}

          {showError ? (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="mt-0.5 size-5 text-amber-700" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-amber-900">
                  No se pudo registrar
                </div>
                <div className="mt-0.5 text-sm text-amber-900/90">{last.message}</div>
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

        <div className="text-xs text-zinc-500">
          Tip: presiona <span className="font-semibold text-zinc-700">Enter</span> para registrar más rápido.
        </div>
      </form>
    </section>
  );
}

export default EntryPanel;