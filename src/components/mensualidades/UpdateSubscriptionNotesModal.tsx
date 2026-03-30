// src/components/mensualidades/detail/UpdateSubscriptionNotesModal.tsx
"use client";

import * as React from "react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  FileText,
  Loader2,
  PencilLine,
  User2,
  X,
} from "lucide-react";

import type { GetSubscriptionDetailSuccess } from "@/actions/mensualidades/getSubscriptionDetailAction";
import type { UpdateSubscriptionNotesActionState } from "@/actions/mensualidades/updateSubscriptionNotesAction";

type CurrentSubscription = GetSubscriptionDetailSuccess["currentSubscription"];
type VehicleSummary = GetSubscriptionDetailSuccess["vehicle"];
type HolderSummary = GetSubscriptionDetailSuccess["holder"];

type UpdateSubscriptionNotesModalProps = {
  subscription: CurrentSubscription;
  vehicle: VehicleSummary;
  holder: HolderSummary;
  action: (
    prevState: UpdateSubscriptionNotesActionState,
    formData: FormData
  ) => Promise<UpdateSubscriptionNotesActionState>;
  triggerLabel?: string;
  className?: string;
  onUpdated?: () => void;
};

const INITIAL_STATE: UpdateSubscriptionNotesActionState = {
  ok: false,
  message: "",
  errors: {},
};

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeZone: "America/Bogota",
});

function formatDate(value?: string | null) {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

function formatPeriod(startAtIso: string, endAtIso: string) {
  return `${formatDate(startAtIso)} — ${formatDate(endAtIso)}`;
}

function textareaClass(hasError: boolean) {
  return [
    "min-h-[128px] w-full resize-none rounded-2xl border bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition",
    hasError
      ? "border-red-300 ring-2 ring-red-100"
      : "border-zinc-200 focus:border-zinc-300",
  ].join(" ");
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-zinc-900">{value}</p>
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
          Guardar notas
        </>
      )}
    </button>
  );
}

export default function UpdateSubscriptionNotesModal({
  subscription,
  vehicle,
  holder,
  action,
  triggerLabel = "Editar notas",
  className,
  onUpdated,
}: UpdateSubscriptionNotesModalProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const [isOpen, setIsOpen] = useState(false);

  const canOpen = Boolean(subscription);

  const initialNotes = useMemo(() => subscription?.notes ?? "", [subscription]);
  const [notes, setNotes] = useState(initialNotes);

  const notesLength = notes.length;
  const maxLength = 1000;
  const remaining = maxLength - notesLength;

  const resetForm = React.useCallback(() => {
    setNotes(subscription?.notes ?? "");
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
            aria-labelledby="update-subscription-notes-title"
            className="w-full max-w-xl rounded-[28px] border border-zinc-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div className="min-w-0">
                <h2
                  id="update-subscription-notes-title"
                  className="text-base font-semibold text-zinc-900"
                >
                  Editar notas
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

            <div className="space-y-3 px-4 py-3">
              <div className="grid grid-cols-2 gap-2">
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
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex items-start gap-2">
                  <User2 className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900">
                      Titular actual
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-600">
                      {holder?.fullName ?? "Sin titular asociado"}
                    </p>
                  </div>
                </div>
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

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <label
                      htmlFor="update-subscription-notes"
                      className="block text-sm font-medium text-zinc-700"
                    >
                      Notas de la mensualidad
                    </label>

                    <span
                      className={[
                        "text-xs",
                        remaining < 0 ? "text-red-600" : "text-zinc-500",
                      ].join(" ")}
                    >
                      {notesLength}/{maxLength}
                    </span>
                  </div>

                  <textarea
                    id="update-subscription-notes"
                    name="notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className={textareaClass(Boolean(state.errors?.notes))}
                    placeholder="Ej. horario habitual, acuerdo de pago, observaciones operativas, recomendaciones"
                    maxLength={maxLength}
                  />

                  {state.errors?.notes ? (
                    <p className="mt-1 text-xs text-red-600">
                      {state.errors.notes}
                    </p>
                  ) : null}

                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setNotes(initialNotes)}
                      className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-300"
                    >
                      Restaurar actual
                    </button>

                    <button
                      type="button"
                      onClick={() => setNotes("")}
                      className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-300"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                {state.errors?.subscriptionId ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.errors.subscriptionId}
                  </div>
                ) : null}

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="flex items-start gap-2">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900">
                        Recomendación
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Usa este campo para acuerdos, teléfonos alternos,
                        horarios frecuentes, observaciones operativas o notas del
                        periodo actual.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-zinc-500">
                    Puedes dejarlo vacío si quieres eliminar las notas actuales.
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
                    >
                      Cancelar
                    </button>

                    <SubmitButton disabled={!subscription} />
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