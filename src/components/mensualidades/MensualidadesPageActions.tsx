"use client";

import * as React from "react";
import { CheckCircle2, Plus, X } from "lucide-react";

import CreateSubscriptionModal from "@/components/mensualidades/CreateSubscriptionModal";
import { CreateSubscriptionSuccess } from "@/actions/mensualidades/createSubscriptionAction";


type MensualidadesPageActionsProps = {
  defaultShiftId?: string | null;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function MensualidadesPageActions({
  defaultShiftId,
}: MensualidadesPageActionsProps) {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [recentCreated, setRecentCreated] =
    React.useState<CreateSubscriptionSuccess | null>(null);

  const handleOpenCreate = React.useCallback(() => {
    setIsCreateOpen(true);
  }, []);

  const handleCloseCreate = React.useCallback(() => {
    setIsCreateOpen(false);
  }, []);

  const handleCreated = React.useCallback(
    (result: CreateSubscriptionSuccess) => {
      setRecentCreated(result);
      setIsCreateOpen(false);
    },
    []
  );

  const handleDismissRecentCreated = React.useCallback(() => {
    setRecentCreated(null);
  }, []);

  return (
    <>
      <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[320px] lg:max-w-md lg:items-end">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 active:scale-[0.99] sm:w-auto sm:min-w-[210px]"
          >
            <Plus className="h-4 w-4" />
            Nueva mensualidad
          </button>
        </div>

        <p className="text-center text-xs leading-5 text-neutral-500 lg:text-right">
          Registra clientes, vehículos y abonos iniciales.
        </p>

        {recentCreated ? (
          <div className="w-full overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm">
            <div className="flex items-start gap-3 border-b border-emerald-100 bg-emerald-50 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
                <CheckCircle2 className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-emerald-800">
                  Mensualidad creada correctamente
                </p>

                <p className="mt-0.5 break-words text-sm text-emerald-700">
                  {recentCreated.vehicle.plate} ·{" "}
                  {recentCreated.customer.fullName}
                </p>
              </div>

              <button
                type="button"
                onClick={handleDismissRecentCreated}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-emerald-700 transition hover:bg-white/80"
                aria-label="Cerrar mensaje"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 px-4 py-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-neutral-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Valor pactado
                </p>
                <p className="mt-1 break-words text-sm font-semibold text-neutral-900">
                  {formatCurrency(recentCreated.subscription.amount)}
                </p>
              </div>

              <div className="rounded-2xl bg-neutral-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Abonado
                </p>
                <p className="mt-1 break-words text-sm font-semibold text-neutral-900">
                  {formatCurrency(recentCreated.subscription.paidAmount)}
                </p>
              </div>

              <div className="rounded-2xl bg-neutral-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Pendiente
                </p>
                <p className="mt-1 break-words text-sm font-semibold text-neutral-900">
                  {formatCurrency(recentCreated.subscription.pendingAmount)}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <CreateSubscriptionModal
        open={isCreateOpen}
        onClose={handleCloseCreate}
        onCreated={handleCreated}
        defaultShiftId={defaultShiftId}
      />
    </>
  );
}