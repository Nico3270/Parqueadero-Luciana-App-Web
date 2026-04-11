// src/components/mensualidades/detail/RenewSubscriptionModal.tsx
"use client";

import * as React from "react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  Banknote,
  CalendarDays,
  Landmark,
  Loader2,
  PencilLine,
  Smartphone,
  Wallet,
  X,
} from "lucide-react";

import type { GetSubscriptionDetailSuccess } from "@/actions/mensualidades/getSubscriptionDetailAction";
import type { RenewSubscriptionActionState } from "@/actions/mensualidades/renewSubscriptionAction";
import { PaymentMethod } from "@prisma/client";

type CurrentSubscription = GetSubscriptionDetailSuccess["currentSubscription"];
type VehicleSummary = GetSubscriptionDetailSuccess["vehicle"];
type HolderSummary = GetSubscriptionDetailSuccess["holder"];

type RenewSubscriptionModalProps = {
  subscription: CurrentSubscription;
  vehicle: VehicleSummary;
  holder: HolderSummary;
  action: (
    prevState: RenewSubscriptionActionState,
    formData: FormData
  ) => Promise<RenewSubscriptionActionState>;
  triggerLabel?: string;
  className?: string;
  onRenewed?: () => void;
};

const INITIAL_STATE: RenewSubscriptionActionState = {
  ok: false,
  message: "",
  errors: {},
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

function parseIsoToBogotaDateTimeLocalValue(value?: string | null) {
  if (!value) {
    return buildBogotaDateTimeLocalValue();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return buildBogotaDateTimeLocalValue();
  }

  return buildBogotaDateTimeLocalValue(date);
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
      return Wallet;
    default:
      return Wallet;
  }
}

function fieldClass(hasError: boolean, disabled = false) {
  return [
    "h-10 w-full rounded-2xl border bg-white px-3 text-sm text-zinc-900 outline-none transition",
    hasError
      ? "border-red-300 ring-2 ring-red-100"
      : "border-zinc-200 focus:border-zinc-300",
    disabled ? "cursor-not-allowed bg-zinc-100 text-zinc-500" : "",
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
          "mt-1 text-sm font-semibold text-zinc-900",
          valueClassName ?? "",
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
  disabled,
}: {
  method: PaymentMethod;
  selected: boolean;
  onSelect: (method: PaymentMethod) => void;
  disabled?: boolean;
}) {
  const Icon = getPaymentMethodIcon(method);

  return (
    <button
      type="button"
      onClick={() => {
        if (disabled) return;
        onSelect(method);
      }}
      disabled={disabled}
      className={[
        "flex h-10 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-medium transition",
        selected
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300",
        disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
    >
      <Icon className="h-4 w-4" />
      {getPaymentMethodLabel(method)}
    </button>
  );
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
          <PencilLine className="h-4 w-4" />
          Guardar cambios
        </>
      )}
    </button>
  );
}

export default function RenewSubscriptionModal({
  subscription,
  vehicle,
  holder,
  action,
  triggerLabel = "Reajustar mensualidad",
  className,
  onRenewed,
}: RenewSubscriptionModalProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const [isOpen, setIsOpen] = useState(false);

  const canOpen = Boolean(subscription);

  const defaultValues = useMemo(() => {
    const now = new Date();

    return {
      startAt: parseIsoToBogotaDateTimeLocalValue(subscription?.startAtIso),
      endAt: parseIsoToBogotaDateTimeLocalValue(subscription?.endAtIso),
      amount: subscription ? String(subscription.amount) : "",
      initialPaymentAmount: "",
      initialPaymentPaidAt: buildBogotaDateTimeLocalValue(now),
      initialPaymentMethod: PaymentMethod.CASH,
      reference: "",
      notes: subscription?.notes ?? "",
      printReceipt: true,
    };
  }, [subscription]);

  const [startAt, setStartAt] = useState(defaultValues.startAt);
  const [endAt, setEndAt] = useState(defaultValues.endAt);
  const [amount, setAmount] = useState(defaultValues.amount);
  const [initialPaymentAmount, setInitialPaymentAmount] = useState(
    defaultValues.initialPaymentAmount
  );
  const [initialPaymentPaidAt, setInitialPaymentPaidAt] = useState(
    defaultValues.initialPaymentPaidAt
  );
  const [initialPaymentMethod, setInitialPaymentMethod] =
    useState<PaymentMethod>(defaultValues.initialPaymentMethod);
  const [reference, setReference] = useState(defaultValues.reference);
  const [notes, setNotes] = useState(defaultValues.notes);
  const [printReceipt, setPrintReceipt] = useState(defaultValues.printReceipt);

  const initialPaymentNumber = Number(initialPaymentAmount || 0);
  const hasInitialPayment = Number.isFinite(initialPaymentNumber)
    ? initialPaymentNumber > 0
    : false;

  const amountNumber = Number(amount || 0);

  const resetForm = React.useCallback(() => {
    const now = new Date();

    setStartAt(parseIsoToBogotaDateTimeLocalValue(subscription?.startAtIso));
    setEndAt(parseIsoToBogotaDateTimeLocalValue(subscription?.endAtIso));
    setAmount(subscription ? String(subscription.amount) : "");
    setInitialPaymentAmount("");
    setInitialPaymentPaidAt(buildBogotaDateTimeLocalValue(now));
    setInitialPaymentMethod(PaymentMethod.CASH);
    setReference("");
    setNotes(subscription?.notes ?? "");
    setPrintReceipt(true);
  }, [subscription]);

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
    onRenewed?.();
  }, [state.ok, onRenewed, resetForm, router]);

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
        title={canOpen ? triggerLabel : "No hay mensualidad base"}
      >
        <PencilLine className="h-4 w-4" />
        {canOpen ? triggerLabel : "Sin base"}
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/30 p-3 sm:items-center"
          onClick={() => setIsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="renew-subscription-title"
            className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div className="min-w-0">
                <h2
                  id="renew-subscription-title"
                  className="text-base font-semibold text-zinc-900"
                >
                  Reajustar mensualidad
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <SummaryItem label="Placa" value={vehicle.plate} />
                <SummaryItem
                  label="Periodo actual"
                  value={
                    subscription
                      ? `${formatDate(subscription.startAtIso)} — ${formatDate(
                          subscription.endAtIso
                        )}`
                      : "—"
                  }
                />
                <SummaryItem
                  label="Valor actual"
                  value={subscription ? formatCurrency(subscription.amount) : "—"}
                />
                <SummaryItem
                  label="Pendiente actual"
                  value={
                    subscription
                      ? formatCurrency(subscription.pendingAmount)
                      : "—"
                  }
                  valueClassName={
                    subscription && subscription.pendingAmount > 0
                      ? "text-zinc-900"
                      : "text-emerald-600"
                  }
                />
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700">
                Aquí puedes ajustar el periodo actual, cambiar el valor y
                registrar un abono nuevo sin perder el historial existente.
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
                  name="currentSubscriptionId"
                  value={subscription?.id ?? ""}
                />
                <input
                  type="hidden"
                  name="initialPaymentMethod"
                  value={initialPaymentMethod}
                />
                <input
                  type="hidden"
                  name="printReceipt"
                  value={printReceipt ? "true" : "false"}
                />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="renew-subscription-startAt"
                      className="mb-1.5 block text-sm font-medium text-zinc-700"
                    >
                      Inicio del periodo
                    </label>
                    <input
                      id="renew-subscription-startAt"
                      name="startAt"
                      type="datetime-local"
                      value={startAt}
                      onChange={(event) => setStartAt(event.target.value)}
                      className={fieldClass(Boolean(state.errors?.startAt))}
                      required
                    />
                    {state.errors?.startAt ? (
                      <p className="mt-1 text-xs text-red-600">
                        {state.errors.startAt}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      htmlFor="renew-subscription-endAt"
                      className="mb-1.5 block text-sm font-medium text-zinc-700"
                    >
                      Fin del periodo
                    </label>
                    <input
                      id="renew-subscription-endAt"
                      name="endAt"
                      type="datetime-local"
                      value={endAt}
                      onChange={(event) => setEndAt(event.target.value)}
                      className={fieldClass(Boolean(state.errors?.endAt))}
                      required
                    />
                    {state.errors?.endAt ? (
                      <p className="mt-1 text-xs text-red-600">
                        {state.errors.endAt}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                  <div>
                    <label
                      htmlFor="renew-subscription-amount"
                      className="mb-1.5 block text-sm font-medium text-zinc-700"
                    >
                      Valor pactado
                    </label>
                    <input
                      id="renew-subscription-amount"
                      name="amount"
                      type="number"
                      inputMode="numeric"
                      min={1}
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
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (!subscription) return;
                        setAmount(String(subscription.amount));
                      }}
                      className="h-10 rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
                    >
                      Restaurar valor
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-zinc-500" />
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        Abono adicional
                      </p>
                      <p className="text-xs text-zinc-500">
                        Opcional. Puedes dejarlo vacío si solo vas a ajustar la
                        mensualidad.
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px]">
                    <div>
                      <label
                        htmlFor="renew-subscription-initialPaymentAmount"
                        className="mb-1.5 block text-sm font-medium text-zinc-700"
                      >
                        Valor del abono
                      </label>
                      <input
                        id="renew-subscription-initialPaymentAmount"
                        name="initialPaymentAmount"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={initialPaymentAmount}
                        onChange={(event) =>
                          setInitialPaymentAmount(event.target.value)
                        }
                        className={fieldClass(
                          Boolean(state.errors?.initialPaymentAmount)
                        )}
                        placeholder="0"
                      />
                      {state.errors?.initialPaymentAmount ? (
                        <p className="mt-1 text-xs text-red-600">
                          {state.errors.initialPaymentAmount}
                        </p>
                      ) : null}

                      {amountNumber > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setInitialPaymentAmount(String(amountNumber))
                            }
                            className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-300"
                          >
                            Pago completo
                          </button>

                          {amountNumber > 1 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setInitialPaymentAmount(
                                  String(Math.max(1, Math.floor(amountNumber / 2)))
                                )
                              }
                              className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-300"
                            >
                              Mitad
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => setInitialPaymentAmount("")}
                            className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-300"
                          >
                            Sin abono
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <label
                        htmlFor="renew-subscription-initialPaymentPaidAt"
                        className="mb-1.5 block text-sm font-medium text-zinc-700"
                      >
                        Fecha y hora del abono
                      </label>
                      <input
                        id="renew-subscription-initialPaymentPaidAt"
                        name="initialPaymentPaidAt"
                        type="datetime-local"
                        value={initialPaymentPaidAt}
                        onChange={(event) =>
                          setInitialPaymentPaidAt(event.target.value)
                        }
                        disabled={!hasInitialPayment}
                        className={fieldClass(
                          Boolean(state.errors?.initialPaymentPaidAt),
                          !hasInitialPayment
                        )}
                      />
                      {state.errors?.initialPaymentPaidAt ? (
                        <p className="mt-1 text-xs text-red-600">
                          {state.errors.initialPaymentPaidAt}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                      Método del abono
                    </label>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <MethodOption
                        method={PaymentMethod.CASH}
                        selected={initialPaymentMethod === PaymentMethod.CASH}
                        onSelect={setInitialPaymentMethod}
                        disabled={!hasInitialPayment}
                      />
                      <MethodOption
                        method={PaymentMethod.NEQUI}
                        selected={initialPaymentMethod === PaymentMethod.NEQUI}
                        onSelect={setInitialPaymentMethod}
                        disabled={!hasInitialPayment}
                      />
                      <MethodOption
                        method={PaymentMethod.TRANSFER}
                        selected={
                          initialPaymentMethod === PaymentMethod.TRANSFER
                        }
                        onSelect={setInitialPaymentMethod}
                        disabled={!hasInitialPayment}
                      />
                      <MethodOption
                        method={PaymentMethod.OTHER}
                        selected={initialPaymentMethod === PaymentMethod.OTHER}
                        onSelect={setInitialPaymentMethod}
                        disabled={!hasInitialPayment}
                      />
                    </div>

                    {state.errors?.initialPaymentMethod ? (
                      <p className="mt-1 text-xs text-red-600">
                        {state.errors.initialPaymentMethod}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-3">
                    <label
                      htmlFor="renew-subscription-reference"
                      className="mb-1.5 block text-sm font-medium text-zinc-700"
                    >
                      Referencia del abono
                    </label>
                    <input
                      id="renew-subscription-reference"
                      name="reference"
                      type="text"
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                      className={fieldClass(
                        Boolean(state.errors?.reference),
                        !hasInitialPayment
                      )}
                      placeholder="Ej. recibo, transferencia, comprobante"
                      disabled={!hasInitialPayment}
                    />
                    {state.errors?.reference ? (
                      <p className="mt-1 text-xs text-red-600">
                        {state.errors.reference}
                      </p>
                    ) : null}
                  </div>

                  <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200 bg-white px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={printReceipt}
                      onChange={(event) => setPrintReceipt(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-300"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900">
                        Generar recibo
                      </p>
                      <p className="text-xs text-zinc-500">
                        Se recomienda dejarlo activo cuando registres un abono.
                      </p>
                    </div>
                  </label>
                </div>

                <div>
                  <label
                    htmlFor="renew-subscription-notes"
                    className="mb-1.5 block text-sm font-medium text-zinc-700"
                  >
                    Notas del periodo
                  </label>
                  <textarea
                    id="renew-subscription-notes"
                    name="notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className={textareaClass(Boolean(state.errors?.notes))}
                    placeholder="Observaciones, acuerdos, horarios, recomendaciones"
                  />
                  {state.errors?.notes ? (
                    <p className="mt-1 text-xs text-red-600">
                      {state.errors.notes}
                    </p>
                  ) : null}
                </div>

                {state.errors?.currentSubscriptionId ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.errors.currentSubscriptionId}
                  </div>
                ) : null}

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <CalendarDays className="h-4 w-4" />
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em]">
                      Resumen
                    </p>
                  </div>

                  <div className="mt-2 space-y-1 text-sm text-zinc-700">
                    <p>
                      <span className="font-medium">Nuevo valor:</span>{" "}
                      {amountNumber > 0 ? formatCurrency(amountNumber) : "—"}
                    </p>
                    <p>
                      <span className="font-medium">Abono nuevo:</span>{" "}
                      {hasInitialPayment
                        ? formatCurrency(initialPaymentNumber)
                        : "Sin abono"}
                    </p>
                    <p>
                      <span className="font-medium">Saldo estimado luego del cambio:</span>{" "}
                      {subscription && amountNumber > 0
                        ? formatCurrency(
                            Math.max(
                              amountNumber -
                                subscription.totalPaid -
                                (hasInitialPayment ? initialPaymentNumber : 0),
                              0
                            )
                          )
                        : "—"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-zinc-500">
                    Se actualizará la mensualidad actual conservando el historial
                    y los pagos anteriores.
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
                      disabled={!subscription || amountNumber <= 0}
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