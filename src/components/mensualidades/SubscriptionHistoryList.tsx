// src/components/mensualidades/detail/SubscriptionHistoryList.tsx
import type { SubscriptionHistoryItem } from "@/actions/mensualidades/getSubscriptionDetailAction";
import { SubscriptionStatus } from "@prisma/client";
import { CalendarDays, CheckCircle2, Clock3, Wallet } from "lucide-react";

type SubscriptionHistoryListProps = {
  history: SubscriptionHistoryItem[];
};

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeZone: "America/Bogota",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return dateTimeFormatter.format(new Date(value));
}

function formatPeriod(startAtIso: string, endAtIso: string) {
  return `${formatDate(startAtIso)} — ${formatDate(endAtIso)}`;
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

function badgeClass(base?: string) {
  return [
    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
    base ?? "",
  ].join(" ");
}

function getSecondaryText(item: SubscriptionHistoryItem) {
  const parts: string[] = [];

  if (item.customer.fullName.trim()) {
    parts.push(item.customer.fullName.trim());
  }

  if (item.customer.phone?.trim()) {
    parts.push(item.customer.phone.trim());
  } else if (item.customer.phoneSecondary?.trim()) {
    parts.push(item.customer.phoneSecondary.trim());
  }

  if (parts.length === 0 && item.notes?.trim()) {
    parts.push(item.notes.trim());
  }

  if (parts.length === 0) {
    return "Sin detalle adicional";
  }

  return parts.join(" · ");
}

function getPendingMeta(item: SubscriptionHistoryItem) {
  if (item.pendingAmount <= 0) {
    return {
      label: "Al día",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  return {
    label: "Pendiente",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  };
}

function getRecencyText(item: SubscriptionHistoryItem) {
  if (item.computedStatus === SubscriptionStatus.ACTIVE) {
    if (item.daysUntilEnd > 0) {
      return `${item.daysUntilEnd} día(s) restantes`;
    }

    return "Finaliza hoy o ya venció";
  }

  if (item.lastPaymentAtIso) {
    return `Último pago: ${formatDateTime(item.lastPaymentAtIso)}`;
  }

  return "Sin pagos registrados";
}

export default function SubscriptionHistoryList({
  history,
}: SubscriptionHistoryListProps) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-zinc-900">
            Historial de mensualidades
          </h2>
          <p className="mt-0.5 text-sm text-zinc-600">
            Periodos anteriores y estado de cada mensualidad de esta placa.
          </p>
        </div>

        <div className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600">
          {history.length} {history.length === 1 ? "registro" : "registros"}
        </div>
      </div>

      {history.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-zinc-200 px-3 py-5 text-sm text-zinc-500">
          No hay historial de mensualidades para esta placa.
        </div>
      ) : (
        <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="divide-y divide-zinc-200">
            {history.map((item) => {
              const statusMeta = getSubscriptionStatusMeta(item.computedStatus);
              const pendingMeta = getPendingMeta(item);

              return (
                <div
                  key={item.id}
                  className="grid gap-2.5 px-3 py-2.5 sm:grid-cols-[1.15fr_.85fr_.9fr]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={badgeClass(statusMeta.className)}>
                        {statusMeta.label}
                      </span>

                      <span className={badgeClass(pendingMeta.className)}>
                        {pendingMeta.label}
                      </span>

                      {item.isCurrentPeriod ? (
                        <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                          Periodo actual
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-1.5 flex items-start gap-1.5 text-zinc-900">
                      <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                      <p className="text-sm font-semibold">
                        {formatPeriod(item.startAtIso, item.endAtIso)}
                      </p>
                    </div>

                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {getSecondaryText(item)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3 sm:block">
                      <span className="text-xs text-zinc-500 sm:hidden">Valor</span>
                      <div className="flex items-center gap-1.5">
                        <Wallet className="hidden h-3.5 w-3.5 text-zinc-400 sm:block" />
                        <p className="text-sm font-semibold text-zinc-900">
                          {formatCurrency(item.amount)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:block">
                      <span className="text-xs text-zinc-500 sm:hidden">
                        Abonado
                      </span>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="hidden h-3.5 w-3.5 text-zinc-400 sm:block" />
                        <p className="text-sm text-zinc-700">
                          {formatCurrency(item.totalPaid)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3 sm:block">
                      <span className="text-xs text-zinc-500 sm:hidden">Saldo</span>
                      <p className="text-sm font-semibold text-zinc-900">
                        {formatCurrency(item.pendingAmount)}
                      </p>
                    </div>

                    <div className="flex items-start gap-1.5 text-zinc-500">
                      <Clock3 className="mt-0.5 hidden h-3.5 w-3.5 shrink-0 sm:block" />
                      <p className="text-xs">{getRecencyText(item)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}