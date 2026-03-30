// src/components/mensualidades/detail/ToggleSubscriptionStatusModal.tsx
"use client";

import * as React from "react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  AlertTriangle,
  Loader2,
  PauseCircle,
  PlayCircle,
  ShieldAlert,
  User2,
  X,
} from "lucide-react";

import type { GetSubscriptionDetailSuccess } from "@/actions/mensualidades/getSubscriptionDetailAction";
import type { ToggleSubscriptionStatusActionState } from "@/actions/mensualidades/toggleSubscriptionStatusAction";
import type { SubscriptionStatus } from "@prisma/client";

type CurrentSubscription = GetSubscriptionDetailSuccess["currentSubscription"];
type VehicleSummary = GetSubscriptionDetailSuccess["vehicle"];
type HolderSummary = GetSubscriptionDetailSuccess["holder"];

type ToggleableSubscriptionStatus = "ACTIVE" | "SUSPENDED";

type ToggleSubscriptionStatusModalProps = {
  subscription: CurrentSubscription;
  vehicle: VehicleSummary;
  holder: HolderSummary;
  action: (
    prevState: ToggleSubscriptionStatusActionState,
    formData: FormData
  ) => Promise<ToggleSubscriptionStatusActionState>;
  className?: string;
  onCompleted?: () => void;
};

const INITIAL_STATE: ToggleSubscriptionStatusActionState = {
  ok: false,
  message: "",
  errors: {},
};

const ACTIVE_STATUS: ToggleableSubscriptionStatus = "ACTIVE";
const SUSPENDED_STATUS: ToggleableSubscriptionStatus = "SUSPENDED";
const EXPIRED_STATUS: SubscriptionStatus = "EXPIRED";
const CANCELED_STATUS: SubscriptionStatus = "CANCELED";

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

function getStatusMeta(status: SubscriptionStatus) {
  switch (status) {
    case ACTIVE_STATUS:
      return {
        label: "Activa",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case SUSPENDED_STATUS:
      return {
        label: "Suspendida",
        className: "border-orange-200 bg-orange-50 text-orange-700",
      };
    case EXPIRED_STATUS:
      return {
        label: "Vencida",
        className: "border-amber-200 bg-amber-50 text-amber-700",
      };
    case CANCELED_STATUS:
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

function SubmitButton({
  disabled,
  targetStatus,
}: {
  disabled: boolean;
  targetStatus: ToggleableSubscriptionStatus;
}) {
  const { pending } = useFormStatus();
  const isActivating = targetStatus === ACTIVE_STATUS;

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
      ) : isActivating ? (
        <>
          <PlayCircle className="h-4 w-4" />
          Reactivar
        </>
      ) : (
        <>
          <PauseCircle className="h-4 w-4" />
          Suspender
        </>
      )}
    </button>
  );
}

export default function ToggleSubscriptionStatusModal({
  subscription,
  vehicle,
  holder,
  action,
  className,
  onCompleted,
}: ToggleSubscriptionStatusModalProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const [isOpen, setIsOpen] = useState(false);

  const currentStatus = subscription?.computedStatus ?? null;

  const targetStatus = useMemo<ToggleableSubscriptionStatus | null>(() => {
    if (!subscription) return null;

    if (currentStatus === ACTIVE_STATUS) {
      return SUSPENDED_STATUS;
    }

    if (currentStatus === SUSPENDED_STATUS) {
      return ACTIVE_STATUS;
    }

    return null;
  }, [subscription, currentStatus]);

  const canToggle = Boolean(subscription && targetStatus);

  const currentStatusMeta = subscription
    ? getStatusMeta(subscription.computedStatus)
    : null;

  const targetLabel =
    targetStatus === ACTIVE_STATUS
      ? "Reactivar mensualidad"
      : targetStatus === SUSPENDED_STATUS
        ? "Suspender mensualidad"
        : "Sin acción";

  const title =
    targetStatus === ACTIVE_STATUS
      ? "Reactivar mensualidad"
      : "Suspender mensualidad";

  const description =
    targetStatus === ACTIVE_STATUS
      ? "La mensualidad volverá a quedar activa para este periodo."
      : "La mensualidad quedará suspendida hasta que decidas reactivarla.";

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
    if (!state.ok) return;

    setIsOpen(false);
    router.refresh();
    onCompleted?.();
  }, [state.ok, onCompleted, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!canToggle) return;
          setIsOpen(true);
        }}
        disabled={!canToggle}
        className={[
          "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition",
          canToggle
            ? "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:text-zinc-950"
            : "cursor-not-allowed border border-zinc-200 bg-zinc-100 text-zinc-400",
          className ?? "",
        ].join(" ")}
        title={canToggle ? targetLabel : "No se puede cambiar el estado actual"}
      >
        {targetStatus === ACTIVE_STATUS ? (
          <PlayCircle className="h-4 w-4" />
        ) : (
          <PauseCircle className="h-4 w-4" />
        )}
        {targetStatus === ACTIVE_STATUS
          ? "Reactivar"
          : targetStatus === SUSPENDED_STATUS
            ? "Suspender"
            : "Sin acción"}
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/30 p-3 sm:items-center"
          onClick={() => setIsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="toggle-subscription-status-title"
            className="w-full max-w-lg rounded-[28px] border border-zinc-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div className="min-w-0">
                <h2
                  id="toggle-subscription-status-title"
                  className="text-base font-semibold text-zinc-900"
                >
                  {title}
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
                  label="Estado actual"
                  value={currentStatusMeta?.label ?? "—"}
                />
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
                  label="Saldo pendiente"
                  value={
                    subscription
                      ? formatCurrency(subscription.pendingAmount)
                      : "—"
                  }
                />
              </div>

              {subscription ? (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                  <div className="flex items-start gap-2">
                    {targetStatus === ACTIVE_STATUS ? (
                      <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                    )}

                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900">
                        {description}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Esto no elimina pagos ni historial. Solo cambia el estado
                        de la mensualidad actual.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

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
                <input
                  type="hidden"
                  name="targetStatus"
                  value={targetStatus ?? ""}
                />

                {state.errors?.subscriptionId ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.errors.subscriptionId}
                  </div>
                ) : null}

                {state.errors?.targetStatus ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.errors.targetStatus}
                  </div>
                ) : null}

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

                <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-zinc-500">
                    {targetStatus === ACTIVE_STATUS
                      ? "La mensualidad volverá a mostrarse como activa."
                      : "Podrás reactivarla más adelante desde esta misma página."}
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
                      disabled={!canToggle || !targetStatus}
                      targetStatus={targetStatus ?? SUSPENDED_STATUS}
                    />
                  </div>
                </div>
              </form>

              {!canToggle ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Solo se puede suspender o reactivar una mensualidad actual
                      en estado activa o suspendida.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}