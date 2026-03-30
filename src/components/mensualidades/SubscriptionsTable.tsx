import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import type { SubscriptionDashboardItem } from "@/actions/mensualidades/getSubscriptionsDashboardAction";

type SubscriptionsTableProps = {
  items: SubscriptionDashboardItem[];
  emptyTitle?: string;
  emptyDescription?: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(valueIso: string) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "medium",
  }).format(new Date(valueIso));
}

function formatShortDate(valueIso: string) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(valueIso));
}

function getStatusLabel(status: string) {
  switch (status) {
    case "ACTIVE":
      return "Activa";
    case "EXPIRED":
      return "Vencida";
    case "SUSPENDED":
      return "Suspendida";
    case "CANCELED":
      return "Cancelada";
    default:
      return status;
  }
}

function getStatusClasses(status: string) {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "EXPIRED":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "SUSPENDED":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "CANCELED":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-neutral-200 bg-neutral-50 text-neutral-700";
  }
}

function getInsideLabel(isInside: boolean) {
  return isInside ? "Dentro" : "Fuera";
}

function getInsideClasses(isInside: boolean) {
  return isInside
    ? "border-sky-200 bg-sky-50 text-sky-700"
    : "border-neutral-200 bg-neutral-50 text-neutral-700";
}

function getVehicleTypeLabel(type: string) {
  switch (type) {
    case "CAR":
      return "Carro";
    case "MOTO":
      return "Moto";
    case "TRUCK":
      return "Camión";
    case "BUS":
      return "Bus";
    case "TRACTOMULA":
      return "Tractomula";
    case "OTHER":
      return "Otro";
    default:
      return type;
  }
}

function buildPlateHref(plate: string) {
  return `/mensualidades/${encodeURIComponent(plate)}`;
}

export default function SubscriptionsTable({
  items,
  emptyTitle = "No encontramos mensualidades con esos filtros",
  emptyDescription = "Ajusta la búsqueda o limpia los filtros para ver más resultados.",
}: SubscriptionsTableProps) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-10 text-center sm:px-6">
        <p className="text-sm font-medium text-neutral-900">{emptyTitle}</p>
        <p className="mt-1 text-sm text-neutral-600">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <div className="min-w-[920px]">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Vehículo
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Titular
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Periodo
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Ubicación
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-200 bg-white">
              {items.map((item) => {
                const plateHref = buildPlateHref(item.vehicle.plate);

                return (
                  <tr
                    key={item.id}
                    className="align-top transition hover:bg-neutral-50/80"
                  >
                    <td className="px-6 py-4">
                      <div className="flex min-w-0 flex-col">
                        <Link
                          href={plateHref}
                          className="group inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-neutral-950 underline decoration-neutral-300 underline-offset-4 transition hover:text-neutral-700 hover:decoration-neutral-500"
                        >
                          <span>{item.vehicle.plate}</span>
                          <ExternalLink className="h-3.5 w-3.5 text-neutral-400 transition group-hover:text-neutral-700" />
                        </Link>

                        <span className="mt-0.5 text-sm text-neutral-500">
                          {getVehicleTypeLabel(item.vehicle.type)}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex min-w-0 flex-col">
                        <span className="break-words text-sm font-medium text-neutral-900">
                          {item.customer.fullName}
                        </span>

                        <span className="mt-0.5 text-sm text-neutral-500">
                          {item.customer.phone || "Sin teléfono"}
                        </span>

                        {item.customer.phoneSecondary ? (
                          <span className="mt-0.5 text-sm text-neutral-500">
                            Adicional: {item.customer.phoneSecondary}
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-neutral-900">
                          {formatDate(item.startAtIso)}
                        </span>

                        <span className="mt-0.5 text-sm text-neutral-500">
                          hasta {formatDate(item.endAtIso)}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-neutral-900">
                          {formatCurrency(item.amount)}
                        </span>

                        <span className="mt-0.5 text-sm text-neutral-500">
                          Abonado: {formatCurrency(item.paidAmount)}
                        </span>

                        <span className="mt-0.5 text-sm text-neutral-500">
                          Pendiente: {formatCurrency(item.pendingAmount)}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={[
                          "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                          getStatusClasses(item.computedStatus),
                        ].join(" ")}
                      >
                        {getStatusLabel(item.computedStatus)}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={[
                          "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                          getInsideClasses(item.isInside),
                        ].join(" ")}
                      >
                        {getInsideLabel(item.isInside)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="lg:hidden">
        <div className="divide-y divide-neutral-200">
          {items.map((item) => {
            const plateHref = buildPlateHref(item.vehicle.plate);

            return (
              <Link
                key={item.id}
                href={plateHref}
                className="group block px-3 py-3 transition hover:bg-neutral-50 sm:px-4"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-neutral-950 underline decoration-neutral-300 underline-offset-4 transition group-hover:decoration-neutral-500">
                        {item.vehicle.plate}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-neutral-400 transition group-hover:text-neutral-700" />
                    </div>

                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                      {getVehicleTypeLabel(item.vehicle.type)}
                      {" · "}
                      {item.customer.fullName}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                        getStatusClasses(item.computedStatus),
                      ].join(" ")}
                    >
                      {getStatusLabel(item.computedStatus)}
                    </span>

                    <ChevronRight className="h-4 w-4 text-neutral-400 transition group-hover:text-neutral-700" />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-neutral-50 px-2.5 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      Período
                    </p>
                    <p className="mt-1 text-xs font-medium text-neutral-900">
                      {formatShortDate(item.startAtIso)}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      a {formatShortDate(item.endAtIso)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-neutral-50 px-2.5 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      Valor
                    </p>
                    <p className="mt-1 truncate text-xs font-medium text-neutral-900">
                      {formatCurrency(item.amount)}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      Pend: {formatCurrency(item.pendingAmount)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-neutral-50 px-2.5 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      Ubicación
                    </p>
                    <div className="mt-1">
                      <span
                        className={[
                          "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                          getInsideClasses(item.isInside),
                        ].join(" ")}
                      >
                        {getInsideLabel(item.isInside)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-neutral-500">
                      Abonado: {formatCurrency(item.paidAmount)}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}