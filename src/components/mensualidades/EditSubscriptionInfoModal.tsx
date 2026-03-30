// src/components/mensualidades/EditSubscriptionInfoModal.tsx
"use client";

import * as React from "react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  CarFront,
  Loader2,
  PencilLine,
  Phone,
  User2,
  Wallet,
  X,
} from "lucide-react";

import type { GetSubscriptionDetailSuccess } from "@/actions/mensualidades/getSubscriptionDetailAction";

type CurrentSubscription = GetSubscriptionDetailSuccess["currentSubscription"];
type VehicleSummary = GetSubscriptionDetailSuccess["vehicle"];
type HolderSummary = GetSubscriptionDetailSuccess["holder"];

export type EditSubscriptionInfoField =
  | "subscriptionId"
  | "fullName"
  | "document"
  | "phone"
  | "phoneSecondary"
  | "amount"
  | "customerNotes"
  | "vehicleNotes"
  | "subscriptionNotes";

export type EditSubscriptionInfoActionState = {
  ok: boolean;
  message?: string;
  errors?: Partial<Record<EditSubscriptionInfoField, string>>;
};

type EditSubscriptionInfoModalProps = {
  subscription: CurrentSubscription;
  vehicle: VehicleSummary;
  holder: HolderSummary;
  action: (
    prevState: EditSubscriptionInfoActionState,
    formData: FormData
  ) => Promise<EditSubscriptionInfoActionState>;
  triggerLabel?: string;
  className?: string;
  onUpdated?: () => void;
};

const INITIAL_STATE: EditSubscriptionInfoActionState = {
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

function formatPeriod(startAtIso: string, endAtIso: string) {
  return `${formatDate(startAtIso)} — ${formatDate(endAtIso)}`;
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
    "min-h-[92px] w-full resize-none rounded-2xl border bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition",
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

export default function EditSubscriptionInfoModal({
  subscription,
  vehicle,
  holder,
  action,
  triggerLabel = "Editar información",
  className,
  onUpdated,
}: EditSubscriptionInfoModalProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const [isOpen, setIsOpen] = useState(false);

  const canOpen = Boolean(subscription);

  const initialValues = useMemo(
    () => ({
      fullName: holder?.fullName ?? "",
      document: holder?.document ?? "",
      phone: holder?.phone ?? "",
      phoneSecondary: holder?.phoneSecondary ?? "",
      amount: subscription ? String(subscription.amount) : "",
      customerNotes: holder?.notes ?? "",
      vehicleNotes: vehicle.notes ?? "",
      subscriptionNotes: subscription?.notes ?? "",
    }),
    [holder, subscription, vehicle]
  );

  const [fullName, setFullName] = useState(initialValues.fullName);
  const [documentValue, setDocumentValue] = useState(initialValues.document);
  const [phone, setPhone] = useState(initialValues.phone);
  const [phoneSecondary, setPhoneSecondary] = useState(
    initialValues.phoneSecondary
  );
  const [amount, setAmount] = useState(initialValues.amount);
  const [customerNotes, setCustomerNotes] = useState(initialValues.customerNotes);
  const [vehicleNotes, setVehicleNotes] = useState(initialValues.vehicleNotes);
  const [subscriptionNotes, setSubscriptionNotes] = useState(
    initialValues.subscriptionNotes
  );

  const amountNumber = Number(amount || 0);

  const resetForm = React.useCallback(() => {
    setFullName(initialValues.fullName);
    setDocumentValue(initialValues.document);
    setPhone(initialValues.phone);
    setPhoneSecondary(initialValues.phoneSecondary);
    setAmount(initialValues.amount);
    setCustomerNotes(initialValues.customerNotes);
    setVehicleNotes(initialValues.vehicleNotes);
    setSubscriptionNotes(initialValues.subscriptionNotes);
  }, [initialValues]);

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
    router.refresh();
    onUpdated?.();
  }, [state.ok, onUpdated, router]);

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
        title={canOpen ? triggerLabel : "No hay mensualidad actual"}
      >
        <PencilLine className="h-4 w-4" />
        {canOpen ? triggerLabel : "Sin mensualidad"}
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/30 p-3 sm:items-center"
          onClick={() => setIsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-subscription-info-title"
            className="flex max-h-[80dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div className="min-w-0">
                <h2
                  id="edit-subscription-info-title"
                  className="text-base font-semibold text-zinc-900"
                >
                  Editar información
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

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <SummaryItem label="Placa" value={vehicle.plate} />
                  <SummaryItem
                    label="Periodo"
                    value={
                      subscription
                        ? formatPeriod(
                            subscription.startAtIso,
                            subscription.endAtIso
                          )
                        : "—"
                    }
                  />
                  <SummaryItem
                    label="Valor actual"
                    value={subscription ? formatCurrency(subscription.amount) : "—"}
                  />
                  <SummaryItem
                    label="Pendiente"
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

                  <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="mb-3 flex items-center gap-2">
                      <User2 className="h-4 w-4 text-zinc-500" />
                      <h3 className="text-sm font-medium text-zinc-900">
                        Titular y contacto
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <label
                          htmlFor="edit-subscription-fullName"
                          className="mb-1.5 block text-sm font-medium text-zinc-700"
                        >
                          Nombre del titular
                        </label>
                        <input
                          id="edit-subscription-fullName"
                          name="fullName"
                          type="text"
                          value={fullName}
                          onChange={(event) => setFullName(event.target.value)}
                          className={fieldClass(Boolean(state.errors?.fullName))}
                          placeholder="Nombre completo"
                          required
                        />
                        {state.errors?.fullName ? (
                          <p className="mt-1 text-xs text-red-600">
                            {state.errors.fullName}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label
                          htmlFor="edit-subscription-document"
                          className="mb-1.5 block text-sm font-medium text-zinc-700"
                        >
                          Documento
                        </label>
                        <input
                          id="edit-subscription-document"
                          name="document"
                          type="text"
                          value={documentValue}
                          onChange={(event) =>
                            setDocumentValue(event.target.value)
                          }
                          className={fieldClass(Boolean(state.errors?.document))}
                          placeholder="Cédula o documento"
                        />
                        {state.errors?.document ? (
                          <p className="mt-1 text-xs text-red-600">
                            {state.errors.document}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label
                          htmlFor="edit-subscription-phone"
                          className="mb-1.5 block text-sm font-medium text-zinc-700"
                        >
                          Teléfono principal
                        </label>
                        <input
                          id="edit-subscription-phone"
                          name="phone"
                          type="text"
                          inputMode="tel"
                          value={phone}
                          onChange={(event) => setPhone(event.target.value)}
                          className={fieldClass(Boolean(state.errors?.phone))}
                          placeholder="Número principal"
                        />
                        {state.errors?.phone ? (
                          <p className="mt-1 text-xs text-red-600">
                            {state.errors.phone}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label
                          htmlFor="edit-subscription-phoneSecondary"
                          className="mb-1.5 block text-sm font-medium text-zinc-700"
                        >
                          Teléfono secundario
                        </label>
                        <input
                          id="edit-subscription-phoneSecondary"
                          name="phoneSecondary"
                          type="text"
                          inputMode="tel"
                          value={phoneSecondary}
                          onChange={(event) =>
                            setPhoneSecondary(event.target.value)
                          }
                          className={fieldClass(
                            Boolean(state.errors?.phoneSecondary)
                          )}
                          placeholder="Número alterno"
                        />
                        {state.errors?.phoneSecondary ? (
                          <p className="mt-1 text-xs text-red-600">
                            {state.errors.phoneSecondary}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="mb-3 flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-zinc-500" />
                      <h3 className="text-sm font-medium text-zinc-900">
                        Mensualidad actual
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                      <div>
                        <label
                          htmlFor="edit-subscription-amount"
                          className="mb-1.5 block text-sm font-medium text-zinc-700"
                        >
                          Valor pactado
                        </label>
                        <input
                          id="edit-subscription-amount"
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
                        <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600">
                          Nuevo valor:{" "}
                          <span className="font-semibold text-zinc-900">
                            {amountNumber > 0 ? formatCurrency(amountNumber) : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="mb-3 flex items-center gap-2">
                      <Phone className="h-4 w-4 text-zinc-500" />
                      <h3 className="text-sm font-medium text-zinc-900">
                        Notas y observaciones
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                      <div>
                        <label
                          htmlFor="edit-subscription-customerNotes"
                          className="mb-1.5 block text-sm font-medium text-zinc-700"
                        >
                          Notas del cliente
                        </label>
                        <textarea
                          id="edit-subscription-customerNotes"
                          name="customerNotes"
                          value={customerNotes}
                          onChange={(event) =>
                            setCustomerNotes(event.target.value)
                          }
                          className={textareaClass(
                            Boolean(state.errors?.customerNotes)
                          )}
                          placeholder="Observaciones del titular"
                        />
                        {state.errors?.customerNotes ? (
                          <p className="mt-1 text-xs text-red-600">
                            {state.errors.customerNotes}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label
                          htmlFor="edit-subscription-vehicleNotes"
                          className="mb-1.5 block text-sm font-medium text-zinc-700"
                        >
                          Notas del vehículo
                        </label>
                        <textarea
                          id="edit-subscription-vehicleNotes"
                          name="vehicleNotes"
                          value={vehicleNotes}
                          onChange={(event) => setVehicleNotes(event.target.value)}
                          className={textareaClass(
                            Boolean(state.errors?.vehicleNotes)
                          )}
                          placeholder="Observaciones del vehículo"
                        />
                        {state.errors?.vehicleNotes ? (
                          <p className="mt-1 text-xs text-red-600">
                            {state.errors.vehicleNotes}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label
                          htmlFor="edit-subscription-subscriptionNotes"
                          className="mb-1.5 block text-sm font-medium text-zinc-700"
                        >
                          Notas de la mensualidad
                        </label>
                        <textarea
                          id="edit-subscription-subscriptionNotes"
                          name="subscriptionNotes"
                          value={subscriptionNotes}
                          onChange={(event) =>
                            setSubscriptionNotes(event.target.value)
                          }
                          className={textareaClass(
                            Boolean(state.errors?.subscriptionNotes)
                          )}
                          placeholder="Acuerdos, horarios, recomendaciones"
                        />
                        {state.errors?.subscriptionNotes ? (
                          <p className="mt-1 text-xs text-red-600">
                            {state.errors.subscriptionNotes}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </section>

                  {state.errors?.subscriptionId ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {state.errors.subscriptionId}
                    </div>
                  ) : null}

                  <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="flex items-start gap-2">
                      <CarFront className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900">
                          Qué se editará
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          Este formulario actualiza los datos principales del titular,
                          el valor pactado de la mensualidad actual y las notas
                          operativas.
                        </p>
                      </div>
                    </div>
                  </section>

                  <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-zinc-500">
                      Los cambios se verán reflejados en esta misma página al guardar.
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
                      >
                        Cancelar
                      </button>

                      <SubmitButton disabled={!subscription || amountNumber <= 0} />
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}