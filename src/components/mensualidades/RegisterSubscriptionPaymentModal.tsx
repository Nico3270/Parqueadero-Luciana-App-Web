// src/components/mensualidades/detail/RegisterSubscriptionPaymentModal.tsx
"use client";

import * as React from "react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  Banknote,
  CreditCard,
  Landmark,
  Loader2,
  Plus,
  Receipt,
  Smartphone,
  X,
} from "lucide-react";

import type { GetSubscriptionDetailSuccess } from "@/actions/mensualidades/getSubscriptionDetailAction";
import { PaymentMethod } from "@prisma/client";

type CurrentSubscription = GetSubscriptionDetailSuccess["currentSubscription"];
type VehicleSummary = GetSubscriptionDetailSuccess["vehicle"];
type HolderSummary = GetSubscriptionDetailSuccess["holder"];

type RegisterPaymentField =
  | "subscriptionId"
  | "amount"
  | "paidAt"
  | "method"
  | "reference"
  | "notes";

export type RegisterSubscriptionPaymentModalState = {
  ok: boolean;
  message?: string;
  errors?: Partial<Record<RegisterPaymentField, string>>;
};

type RegisterSubscriptionPaymentModalProps = {
  subscription: CurrentSubscription;
  vehicle: VehicleSummary;
  holder: HolderSummary;
  action: (
    prevState: RegisterSubscriptionPaymentModalState,
    formData: FormData
  ) => Promise<RegisterSubscriptionPaymentModalState>;
  triggerLabel?: string;
  className?: string;
  onRegistered?: () => void;
};

const INITIAL_STATE: RegisterSubscriptionPaymentModalState = {
  ok: false,
  message: "",
  errors: {},
};

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function buildBogotaDateTimeLocalValue(date = new Date()) {
  const formatted = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Bogota",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  return formatted.replace(" ", "T");
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

function getPaymentMethodIcon(method: PaymentMethod) {
  switch (method) {
    case PaymentMethod.CASH:
      return Banknote;
    case PaymentMethod.NEQUI:
      return Smartphone;
    case PaymentMethod.TRANSFER:
      return Landmark;
    case PaymentMethod.OTHER:
      return CreditCard;
    default:
      return CreditCard;
  }
}

function fieldClass(hasError: boolean) {
  return [
    "h-10 w-full rounded-2xl border bg-white px-3 text-sm text-zinc-900 outline-none transition",
    hasError
      ? "border-red-300 ring-2 ring-red-100"
      : "border-zinc-200 focus:border-zinc-300",
  ].join(" ");
}

function textareaClass(hasError: boolean) {
  return [
    "min-h-[96px] w-full resize-none rounded-2xl border bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition",
    hasError
      ? "border-red-300 ring-2 ring-red-100"
      : "border-zinc-200 focus:border-zinc-300",
  ].join(" ");
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={[
        "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition",
        disabled || pending
          ? "cursor-not-allowed bg-zinc-200 text-zinc-500"
          : "bg-zinc-900 text-white hover:bg-zinc-800",
      ].join(" ")}
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Guardando...
        </>
      ) : (
        <>
          <Plus className="h-4 w-4" />
          Registrar abono
        </>
      )}
    </button>
  );
}

function SummaryItem({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p
        className={[
          "mt-1 text-sm font-semibold",
          valueClassName ?? "text-zinc-900",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

function MethodOption({
  method,
  selected,
  onSelect,
}: {
  method: PaymentMethod;
  selected: boolean;
  onSelect: (method: PaymentMethod) => void;
}) {
  const Icon = getPaymentMethodIcon(method);

  return (
    <button
      type="button"
      onClick={() => onSelect(method)}
      className={[
        "flex h-10 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-medium transition",
        selected
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300",
      ].join(" ")}
    >
      <Icon className="h-4 w-4" />
      {getPaymentMethodLabel(method)}
    </button>
  );
}

export default function RegisterSubscriptionPaymentModal({
  subscription,
  vehicle,
  holder,
  action,
  triggerLabel = "Registrar abono",
  className,
  onRegistered,
}: RegisterSubscriptionPaymentModalProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const [isOpen, setIsOpen] = useState(false);

  const isAvailable = Boolean(subscription);
  const pendingAmount = subscription?.pendingAmount ?? 0;
  const totalPaid = subscription?.totalPaid ?? 0;
  const subscriptionAmount = subscription?.amount ?? 0;
  const isFullyPaid = isAvailable && pendingAmount <= 0;
  const canOpen = isAvailable && !isFullyPaid;

  const defaultAmount = useMemo(() => {
    if (!subscription) return "";
    return subscription.pendingAmount > 0
      ? String(subscription.pendingAmount)
      : "";
  }, [subscription]);

  const [amount, setAmount] = useState(defaultAmount);
  const [paidAt, setPaidAt] = useState(buildBogotaDateTimeLocalValue());
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [printReceipt, setPrintReceipt] = useState(true);

  const resetForm = React.useCallback(() => {
    setAmount(defaultAmount);
    setPaidAt(buildBogotaDateTimeLocalValue());
    setMethod(PaymentMethod.CASH);
    setReference("");
    setNotes("");
    setPrintReceipt(true);
  }, [defaultAmount]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    resetForm();
  }, [isOpen, resetForm]);

  useEffect(() => {
    if (!state.ok) return;

    setIsOpen(false);
    resetForm();
    router.refresh();
    onRegistered?.();
  }, [state.ok, onRegistered, resetForm, router]);

  const amountNumber = Number(amount || 0);
  const safeAmountNumber = Number.isFinite(amountNumber) ? amountNumber : 0;
  const estimatedPendingAfterPayment =
    subscription && safeAmountNumber > 0
      ? Math.max(pendingAmount - safeAmountNumber, 0)
      : pendingAmount;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!canOpen) return;
          setIsOpen(true);
        }}
        disabled={!canOpen}
        className={[
          "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition",
          canOpen
            ? "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:text-zinc-950"
            : "cursor-not-allowed border border-zinc-200 bg-zinc-100 text-zinc-400",
          className ?? "",
        ].join(" ")}
        title={
          !subscription
            ? "No hay mensualidad actual"
            : isFullyPaid
              ? "La mensualidad ya está al día"
              : triggerLabel
        }
      >
        <Plus className="h-4 w-4" />
        {!subscription ? "Sin mensualidad" : isFullyPaid ? "Al día" : triggerLabel}
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/30 p-3 sm:items-center"
          onClick={() => setIsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="register-subscription-payment-title"
            className="flex max-h-[88dvh] w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div className="min-w-0">
                <h2
                  id="register-subscription-payment-title"
                  className="text-base font-semibold text-zinc-900"
                >
                  Registrar abono
                </h2>
                <p className="mt-0.5 truncate text-sm text-zinc-600">
                  {vehicle.plate} · {holder?.fullName ?? "Sin titular"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-900"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <SummaryItem
                  label="Valor pactado"
                  value={formatCurrency(subscriptionAmount)}
                />
                <SummaryItem
                  label="Abonado"
                  value={formatCurrency(totalPaid)}
                />
                <SummaryItem
                  label="Pendiente"
                  value={formatCurrency(pendingAmount)}
                  valueClassName={
                    pendingAmount > 0 ? "text-zinc-900" : "text-emerald-600"
                  }
                />
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700">
                Registra un abono adicional sobre la mensualidad actual. El
                historial se conserva y el saldo se recalcula automáticamente.
              </div>

              {state.message ? (
                <div
                  className={[
                    "rounded-2xl border px-3 py-2 text-sm",
                    state.ok
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-red-200 bg-red-50 text-red-700",
                  ].join(" ")}
                >
                  {state.message}
                </div>
              ) : null}

              <form action={formAction} className="space-y-3">
                <input
                  type="hidden"
                  name="subscriptionId"
                  value={subscription?.id ?? ""}
                />
                <input type="hidden" name="method" value={method} />
                <input
                  type="hidden"
                  name="printReceipt"
                  value={printReceipt ? "true" : "false"}
                />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
                  <div>
                    <label
                      htmlFor="subscription-payment-amount"
                      className="mb-1.5 block text-sm font-medium text-zinc-700"
                    >
                      Valor del abono
                    </label>

                    <input
                      id="subscription-payment-amount"
                      name="amount"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={pendingAmount > 0 ? pendingAmount : undefined}
                      step={1}
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      className={fieldClass(Boolean(state.errors?.amount))}
                      placeholder="0"
                      required
                    />

                    {state.errors?.amount ? (
                      <p className="mt-1 text-xs text-red-600">
                        {state.errors.amount}
                      </p>
                    ) : null}

                    {pendingAmount > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setAmount(String(pendingAmount))}
                          className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-300"
                        >
                          Saldo completo
                        </button>

                        {pendingAmount > 1 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setAmount(
                                String(Math.max(1, Math.floor(pendingAmount / 2)))
                              )
                            }
                            className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-300"
                          >
                            Mitad
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => setAmount("")}
                          className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-300"
                        >
                          Limpiar
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <label
                      htmlFor="subscription-payment-paidAt"
                      className="mb-1.5 block text-sm font-medium text-zinc-700"
                    >
                      Fecha y hora
                    </label>

                    <input
                      id="subscription-payment-paidAt"
                      name="paidAt"
                      type="datetime-local"
                      value={paidAt}
                      onChange={(event) => setPaidAt(event.target.value)}
                      className={fieldClass(Boolean(state.errors?.paidAt))}
                      required
                    />

                    {state.errors?.paidAt ? (
                      <p className="mt-1 text-xs text-red-600">
                        {state.errors.paidAt}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                    Método de pago
                  </label>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <MethodOption
                      method={PaymentMethod.CASH}
                      selected={method === PaymentMethod.CASH}
                      onSelect={setMethod}
                    />
                    <MethodOption
                      method={PaymentMethod.NEQUI}
                      selected={method === PaymentMethod.NEQUI}
                      onSelect={setMethod}
                    />
                    <MethodOption
                      method={PaymentMethod.TRANSFER}
                      selected={method === PaymentMethod.TRANSFER}
                      onSelect={setMethod}
                    />
                    <MethodOption
                      method={PaymentMethod.OTHER}
                      selected={method === PaymentMethod.OTHER}
                      onSelect={setMethod}
                    />
                  </div>

                  {state.errors?.method ? (
                    <p className="mt-1 text-xs text-red-600">
                      {state.errors.method}
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.2fr]">
                  <div>
                    <label
                      htmlFor="subscription-payment-reference"
                      className="mb-1.5 block text-sm font-medium text-zinc-700"
                    >
                      Referencia
                    </label>

                    <input
                      id="subscription-payment-reference"
                      name="reference"
                      type="text"
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                      className={fieldClass(Boolean(state.errors?.reference))}
                      placeholder="Ej. comprobante, transferencia, recibo"
                    />

                    {state.errors?.reference ? (
                      <p className="mt-1 text-xs text-red-600">
                        {state.errors.reference}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      htmlFor="subscription-payment-notes"
                      className="mb-1.5 block text-sm font-medium text-zinc-700"
                    >
                      Notas
                    </label>

                    <textarea
                      id="subscription-payment-notes"
                      name="notes"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      className={textareaClass(Boolean(state.errors?.notes))}
                      placeholder="Observación opcional"
                    />

                    {state.errors?.notes ? (
                      <p className="mt-1 text-xs text-red-600">
                        {state.errors.notes}
                      </p>
                    ) : null}
                  </div>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={printReceipt}
                    onChange={(event) => setPrintReceipt(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-300"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-zinc-500" />
                      <p className="text-sm font-medium text-zinc-900">
                        Generar recibo
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Déjalo activo para enviar el comprobante a impresión al
                      registrar el abono.
                    </p>
                  </div>
                </label>

                {state.errors?.subscriptionId ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.errors.subscriptionId}
                  </div>
                ) : null}

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                    Resumen
                  </p>

                  <div className="mt-2 space-y-1 text-sm text-zinc-700">
                    <p>
                      <span className="font-medium">Abono:</span>{" "}
                      {safeAmountNumber > 0
                        ? formatCurrency(safeAmountNumber)
                        : "—"}
                    </p>
                    <p>
                      <span className="font-medium">Saldo estimado después:</span>{" "}
                      {formatCurrency(estimatedPendingAfterPayment)}
                    </p>
                    <p>
                      <span className="font-medium">Recibo:</span>{" "}
                      {printReceipt ? "Sí" : "No"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-zinc-500">
                    {safeAmountNumber > 0 ? (
                      <>Se registrará un abono de {formatCurrency(safeAmountNumber)}.</>
                    ) : (
                      <>Ingresa el valor del abono.</>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
                    >
                      Cancelar
                    </button>

                    <SubmitButton
                      disabled={!subscription || safeAmountNumber <= 0}
                    />
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}