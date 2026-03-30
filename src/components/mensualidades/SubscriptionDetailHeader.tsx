// src/components/mensualidades/detail/SubscriptionDetailHeader.tsx
import { CarFront, Clock3, Phone, User2 } from "lucide-react";
import type { GetSubscriptionDetailSuccess } from "@/actions/mensualidades/getSubscriptionDetailAction";
import { SubscriptionStatus, VehicleType } from "@prisma/client";

type SubscriptionDetailHeaderProps = Pick<
  GetSubscriptionDetailSuccess,
  "vehicle" | "holder" | "currentSubscription" | "location"
>;

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeZone: "America/Bogota",
});

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return dateTimeFormatter.format(new Date(value));
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

function formatPeriod(startAtIso: string, endAtIso: string) {
  return `${formatDate(startAtIso)} — ${formatDate(endAtIso)}`;
}

function getVehicleTypeLabel(type: VehicleType) {
  switch (type) {
    case VehicleType.CAR:
      return "Carro";
    case VehicleType.MOTO:
      return "Moto";
    case VehicleType.TRUCK:
      return "Camión";
    case VehicleType.BUS:
      return "Bus";
    case VehicleType.TRACTOMULA:
      return "Tractomula";
    case VehicleType.OTHER:
      return "Otro";
    default:
      return type;
  }
}

function getSubscriptionStatusMeta(status: SubscriptionStatus) {
  switch (status) {
    case SubscriptionStatus.ACTIVE:
      return {
        label: "Activa",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case SubscriptionStatus.EXPIRED:
      return {
        label: "Vencida",
        className: "border-amber-200 bg-amber-50 text-amber-700",
      };
    case SubscriptionStatus.SUSPENDED:
      return {
        label: "Suspendida",
        className: "border-orange-200 bg-orange-50 text-orange-700",
      };
    case SubscriptionStatus.CANCELED:
      return {
        label: "Cancelada",
        className: "border-zinc-200 bg-zinc-100 text-zinc-700",
      };
    default:
      return {
        label: status,
        className: "border-zinc-200 bg-zinc-100 text-zinc-700",
      };
  }
}

function getLocationMeta(isInside: boolean) {
  if (isInside) {
    return {
      label: "Dentro",
      className: "border-sky-200 bg-sky-50 text-sky-700",
    };
  }

  return {
    label: "Fuera",
    className: "border-zinc-200 bg-zinc-100 text-zinc-700",
  };
}

function badgeClass(base?: string) {
  return [
    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
    base ?? "",
  ].join(" ");
}

function phoneHref(phone: string) {
  return `tel:${phone.replace(/\s+/g, "")}`;
}

export default function SubscriptionDetailHeader({
  vehicle,
  holder,
  currentSubscription,
  location,
}: SubscriptionDetailHeaderProps) {
  const currentStatusMeta = currentSubscription
    ? getSubscriptionStatusMeta(currentSubscription.computedStatus)
    : null;

  const locationMeta = getLocationMeta(location.isInside);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600">
              <CarFront className="h-3.5 w-3.5" />
              {getVehicleTypeLabel(vehicle.type)}
            </span>

            {currentStatusMeta ? (
              <span className={badgeClass(currentStatusMeta.className)}>
                {currentStatusMeta.label}
              </span>
            ) : (
              <span className={badgeClass("border-zinc-200 bg-zinc-100 text-zinc-700")}>
                Sin mensualidad activa
              </span>
            )}

            <span className={badgeClass(locationMeta.className)}>
              {locationMeta.label}
            </span>
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
            {vehicle.plate}
          </h1>

          {currentSubscription ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600">
              <span>{formatPeriod(currentSubscription.startAtIso, currentSubscription.endAtIso)}</span>
              <span className="hidden text-zinc-300 sm:inline">•</span>
              <span>
                {currentSubscription.daysUntilEnd > 0
                  ? `${currentSubscription.daysUntilEnd} día(s) restantes`
                  : "Finaliza hoy o ya venció"}
              </span>
            </div>
          ) : (
            <p className="mt-1.5 text-sm text-zinc-500">
              Esta placa no tiene una mensualidad activa en este momento.
            </p>
          )}

          <div className="mt-3 flex flex-col gap-2 text-sm text-zinc-600">
            <div className="flex items-start gap-2">
              <User2 className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
              <div className="min-w-0">
                <p className="font-medium text-zinc-900">
                  {holder?.fullName ?? "Sin titular asociado"}
                </p>

                {holder?.document ? (
                  <p className="truncate text-zinc-500">Documento: {holder.document}</p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-zinc-500" />

              {holder?.phone ? (
                <a
                  href={phoneHref(holder.phone)}
                  className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
                >
                  {holder.phone}
                </a>
              ) : (
                <span className="text-xs text-zinc-500">Sin teléfono principal</span>
              )}

              {holder?.phoneSecondary ? (
                <a
                  href={phoneHref(holder.phoneSecondary)}
                  className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
                >
                  {holder.phoneSecondary}
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:min-w-[250px]">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
              Dentro/Fuera
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">
              {location.isInside ? "Vehículo dentro" : "Vehículo fuera"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex items-center gap-1.5 text-zinc-500">
              <Clock3 className="h-3.5 w-3.5" />
              <p className="text-[11px] font-medium uppercase tracking-[0.14em]">
                Última entrada
              </p>
            </div>
            <p className="mt-1 text-sm font-semibold text-zinc-900">
              {formatDateTime(location.lastEntryAtIso)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}