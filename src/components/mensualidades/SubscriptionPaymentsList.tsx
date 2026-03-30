// src/components/mensualidades/detail/SubscriptionPaymentsList.tsx
import type { SubscriptionPaymentItem } from "@/actions/mensualidades/getSubscriptionDetailAction";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { CreditCard } from "lucide-react";

type SubscriptionPaymentsListProps = {
  payments: SubscriptionPaymentItem[];
};

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return dateTimeFormatter.format(new Date(value));
}

function getPaymentMethodLabel(method: PaymentMethod) {
  switch (method) {
    case PaymentMethod.CASH:
      return "Efectivo";
    case PaymentMethod.NEQUI:
      return "Nequi";
    case PaymentMethod.TRANSFER:
      return "Transferencia";
    case PaymentMethod.OTHER:
      return "Otro";
    default:
      return method;
  }
}

function getPaymentStatusMeta(status: PaymentStatus) {
  switch (status) {
    case PaymentStatus.COMPLETED:
      return {
        label: "Completado",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case PaymentStatus.VOIDED:
      return {
        label: "Anulado",
        className: "border-red-200 bg-red-50 text-red-700",
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

function getReferenceText(payment: SubscriptionPaymentItem) {
  if (payment.reference?.trim()) return payment.reference.trim();
  if (payment.notes?.trim()) return payment.notes.trim();
  return "—";
}

function getSecondaryText(payment: SubscriptionPaymentItem) {
  const parts: string[] = [];

  const status = getPaymentStatusMeta(payment.status);
  parts.push(status.label);

  if (payment.operator?.name?.trim()) {
    parts.push(payment.operator.name.trim());
  }

  return parts.join(" · ");
}

export default function SubscriptionPaymentsList({
  payments,
}: SubscriptionPaymentsListProps) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-zinc-900">
            Pagos / abonos
          </h2>
          <p className="mt-0.5 text-sm text-zinc-600">
            Historial compacto de pagos de la mensualidad actual.
          </p>
        </div>

        <div className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600">
          {payments.length} {payments.length === 1 ? "pago" : "pagos"}
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-zinc-200 px-3 py-5 text-sm text-zinc-500">
          Aún no hay abonos registrados en este periodo.
        </div>
      ) : (
        <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="hidden grid-cols-[1.15fr_.8fr_.8fr_1fr] gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 md:grid">
            <span>Fecha</span>
            <span>Valor</span>
            <span>Método</span>
            <span>Referencia</span>
          </div>

          <div className="divide-y divide-zinc-200">
            {payments.map((payment) => {
              const statusMeta = getPaymentStatusMeta(payment.status);

              return (
                <div
                  key={payment.id}
                  className="grid gap-2.5 px-3 py-2.5 md:grid-cols-[1.15fr_.8fr_.8fr_1fr]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-zinc-900">
                        {formatDateTime(payment.paidAtIso)}
                      </p>
                      <span className={badgeClass(statusMeta.className)}>
                        {statusMeta.label}
                      </span>
                    </div>

                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {getSecondaryText(payment)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 md:block">
                    <span className="text-xs text-zinc-500 md:hidden">Valor</span>
                    <p className="text-sm font-semibold text-zinc-900">
                      {formatCurrency(payment.amount)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 md:block">
                    <span className="text-xs text-zinc-500 md:hidden">Método</span>
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-zinc-400" />
                      <p className="text-sm text-zinc-700">
                        {getPaymentMethodLabel(payment.method)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 md:block">
                    <span className="text-xs text-zinc-500 md:hidden">Ref.</span>
                    <p className="truncate text-sm text-zinc-600">
                      {getReferenceText(payment)}
                    </p>
                    {payment.shiftId ? (
                      <p className="mt-0.5 text-xs text-zinc-400">
                        Turno: {payment.shiftId}
                      </p>
                    ) : null}
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