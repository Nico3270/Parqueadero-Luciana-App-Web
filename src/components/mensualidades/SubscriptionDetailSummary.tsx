// src/components/mensualidades/detail/SubscriptionDetailSummary.tsx
import {
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Wallet,
} from "lucide-react";
import type { GetSubscriptionDetailSuccess } from "@/actions/mensualidades/getSubscriptionDetailAction";

type SubscriptionDetailSummaryProps = {
  currentSubscription: GetSubscriptionDetailSuccess["currentSubscription"];
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

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

function formatPeriod(startAtIso: string, endAtIso: string) {
  return `${formatDate(startAtIso)} — ${formatDate(endAtIso)}`;
}

function cardClassName() {
  return "rounded-2xl border border-zinc-200 bg-zinc-50 p-3";
}

function labelClassName() {
  return "text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500";
}

export default function SubscriptionDetailSummary({
  currentSubscription,
}: SubscriptionDetailSummaryProps) {
  if (!currentSubscription) {
    return (
      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <article className={cardClassName()}>
          <div className="flex items-center gap-2 text-zinc-500">
            <Wallet className="h-4 w-4" />
            <p className={labelClassName()}>Valor pactado</p>
          </div>
          <p className="mt-1.5 text-lg font-semibold text-zinc-900 sm:text-xl">
            —
          </p>
        </article>

        <article className={cardClassName()}>
          <div className="flex items-center gap-2 text-zinc-500">
            <CheckCircle2 className="h-4 w-4" />
            <p className={labelClassName()}>Abonado</p>
          </div>
          <p className="mt-1.5 text-lg font-semibold text-zinc-900 sm:text-xl">
            —
          </p>
        </article>

        <article className={cardClassName()}>
          <div className="flex items-center gap-2 text-zinc-500">
            <CreditCard className="h-4 w-4" />
            <p className={labelClassName()}>Pendiente</p>
          </div>
          <p className="mt-1.5 text-lg font-semibold text-zinc-900 sm:text-xl">
            —
          </p>
        </article>

        <article className={cardClassName()}>
          <div className="flex items-center gap-2 text-zinc-500">
            <CalendarDays className="h-4 w-4" />
            <p className={labelClassName()}>Vigencia</p>
          </div>
          <p className="mt-1.5 text-sm font-semibold text-zinc-900 sm:text-base">
            Sin periodo actual
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Esta placa no tiene mensualidad activa.
          </p>
        </article>
      </section>
    );
  }

  const isPaidInFull = currentSubscription.pendingAmount <= 0;
  const remainingDaysLabel =
    currentSubscription.daysUntilEnd > 0
      ? `${currentSubscription.daysUntilEnd} día(s) restantes`
      : "Finaliza hoy o ya venció";

  return (
    <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <article className={cardClassName()}>
        <div className="flex items-center gap-2 text-zinc-500">
          <Wallet className="h-4 w-4" />
          <p className={labelClassName()}>Valor pactado</p>
        </div>
        <p className="mt-1.5 text-lg font-semibold text-zinc-900 sm:text-xl">
          {formatCurrency(currentSubscription.amount)}
        </p>
      </article>

      <article className={cardClassName()}>
        <div className="flex items-center gap-2 text-zinc-500">
          <CheckCircle2 className="h-4 w-4" />
          <p className={labelClassName()}>Abonado</p>
        </div>
        <p className="mt-1.5 text-lg font-semibold text-zinc-900 sm:text-xl">
          {formatCurrency(currentSubscription.totalPaid)}
        </p>
        <p
          className={[
            "mt-1 text-xs font-medium",
            isPaidInFull ? "text-emerald-600" : "text-zinc-500",
          ].join(" ")}
        >
          {isPaidInFull ? "Mensualidad al día" : "Aún tiene saldo pendiente"}
        </p>
      </article>

      <article className={cardClassName()}>
        <div className="flex items-center gap-2 text-zinc-500">
          <CreditCard className="h-4 w-4" />
          <p className={labelClassName()}>Pendiente</p>
        </div>
        <p className="mt-1.5 text-lg font-semibold text-zinc-900 sm:text-xl">
          {formatCurrency(currentSubscription.pendingAmount)}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {currentSubscription.paymentsCount} pago(s) registrado(s)
        </p>
      </article>

      <article className={cardClassName()}>
        <div className="flex items-center gap-2 text-zinc-500">
          <CalendarDays className="h-4 w-4" />
          <p className={labelClassName()}>Vigencia</p>
        </div>
        <p className="mt-1.5 text-sm font-semibold text-zinc-900 sm:text-base">
          {formatPeriod(
            currentSubscription.startAtIso,
            currentSubscription.endAtIso
          )}
        </p>
        <p className="mt-1 text-xs text-zinc-500">{remainingDaysLabel}</p>
      </article>
    </section>
  );
}