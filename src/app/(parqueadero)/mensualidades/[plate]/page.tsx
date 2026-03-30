// src/app/mensualidades/[plate]/page.tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock3, FileText, ShieldAlert } from "lucide-react";

import { auth } from "@/auth";
import { getSubscriptionDetailAction } from "@/actions/mensualidades/getSubscriptionDetailAction";
import { registerSubscriptionPaymentAction } from "@/actions/mensualidades/registerSubscriptionPaymentAction";
import { renewSubscriptionAction } from "@/actions/mensualidades/renewSubscriptionAction";
import { toggleSubscriptionStatusAction } from "@/actions/mensualidades/toggleSubscriptionStatusAction";
import { updateSubscriptionNotesAction } from "@/actions/mensualidades/updateSubscriptionNotesAction";
import { updateSubscriptionCoreInfoAction } from "@/actions/mensualidades/updateSubscriptionCoreInfoAction";

import SubscriptionDetailHeader from "@/components/mensualidades/SubscriptionDetailHeader";
import SubscriptionDetailSummary from "@/components/mensualidades/SubscriptionDetailSummary";
import SubscriptionPaymentsList from "@/components/mensualidades/SubscriptionPaymentsList";
import SubscriptionHistoryList from "@/components/mensualidades/SubscriptionHistoryList";
import RegisterSubscriptionPaymentModal from "@/components/mensualidades/RegisterSubscriptionPaymentModal";
import RenewSubscriptionModal from "@/components/mensualidades/RenewSubscriptionModal";
import ToggleSubscriptionStatusModal from "@/components/mensualidades/ToggleSubscriptionStatusModal";
import UpdateSubscriptionNotesModal from "@/components/mensualidades/UpdateSubscriptionNotesModal";
import EditSubscriptionInfoModal from "@/components/mensualidades/EditSubscriptionInfoModal";

type PageProps = {
  params: Promise<{
    plate: string;
  }>;
};

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return dateTimeFormatter.format(new Date(value));
}

function sectionClassName() {
  return "rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:p-4";
}

function summaryCardClassName() {
  return "rounded-2xl border border-zinc-200 bg-zinc-50 p-3";
}

function actionButtonClassName(
  color: "indigo" | "sky" | "emerald" | "amber" | "zinc"
) {
  const base =
    "!h-11 !justify-center !rounded-full !border !font-medium !shadow-sm hover:!shadow-md";

  switch (color) {
    case "indigo":
      return `${base} !border-indigo-300 !bg-indigo-100 !text-indigo-800 hover:!border-indigo-400 hover:!bg-indigo-200 hover:!text-indigo-900`;
    case "sky":
      return `${base} !border-sky-300 !bg-sky-100 !text-sky-800 hover:!border-sky-400 hover:!bg-sky-200 hover:!text-sky-900`;
    case "emerald":
      return `${base} !border-emerald-300 !bg-emerald-100 !text-emerald-800 hover:!border-emerald-400 hover:!bg-emerald-200 hover:!text-emerald-900`;
    case "amber":
      return `${base} !border-amber-300 !bg-amber-100 !text-amber-800 hover:!border-amber-400 hover:!bg-amber-200 hover:!text-amber-900`;
    case "zinc":
      return `${base} !border-zinc-300 !bg-zinc-200 !text-zinc-800 hover:!border-zinc-400 hover:!bg-zinc-300 hover:!text-zinc-950`;
    default:
      return `${base} !border-zinc-200 !bg-white !text-zinc-700 hover:!border-zinc-300 hover:!text-zinc-950`;
  }
}

export default async function SubscriptionDetailPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const { plate } = await params;
  const result = await getSubscriptionDetailAction({ plate });

  if (!result.ok) {
    if (result.code === "UNAUTHORIZED") {
      redirect("/auth/login");
    }

    if (result.code === "NOT_FOUND") {
      notFound();
    }

    return (
      <main className="min-h-[100dvh] bg-zinc-50 text-zinc-950">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-3 py-2 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/mensualidades"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
          </div>

          <section className={sectionClassName()}>
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-red-200 bg-red-50 p-2 text-red-700">
                <ShieldAlert className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <h1 className="text-base font-semibold sm:text-lg">
                  No se pudo cargar el detalle de la mensualidad
                </h1>
                <p className="mt-1 text-sm text-zinc-600">{result.message}</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const detail = result;
  const currentSubscription = detail.currentSubscription;

  return (
    <main className="min-h-[100dvh] bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-3 py-0 sm:px-4 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2 ">
          <Link
            href="/mensualidades"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-yellow-500 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:border-zinc-300 hover:text-zinc-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a mensualidades
          </Link>
        </div>

        <SubscriptionDetailHeader
          vehicle={detail.vehicle}
          holder={detail.holder}
          currentSubscription={currentSubscription}
          location={detail.location}
        />

        <section className={sectionClassName()}>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-zinc-500" />
            <h2 className="text-base font-semibold">Acciones rápidas</h2>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <EditSubscriptionInfoModal
              subscription={currentSubscription}
              vehicle={detail.vehicle}
              holder={detail.holder}
              action={updateSubscriptionCoreInfoAction}
              className={actionButtonClassName("indigo")}
            />

            <RegisterSubscriptionPaymentModal
              subscription={currentSubscription}
              vehicle={detail.vehicle}
              holder={detail.holder}
              action={registerSubscriptionPaymentAction}
              className={actionButtonClassName("sky")}
            />

            <RenewSubscriptionModal
              subscription={currentSubscription}
              vehicle={detail.vehicle}
              holder={detail.holder}
              action={renewSubscriptionAction}
              className={actionButtonClassName("emerald")}
            />

            <ToggleSubscriptionStatusModal
              subscription={currentSubscription}
              vehicle={detail.vehicle}
              holder={detail.holder}
              action={toggleSubscriptionStatusAction}
              className={actionButtonClassName("amber")}
            />

            <UpdateSubscriptionNotesModal
              subscription={currentSubscription}
              vehicle={detail.vehicle}
              holder={detail.holder}
              action={updateSubscriptionNotesAction}
              className={actionButtonClassName("zinc")}
            />
          </div>
        </section>

        <SubscriptionDetailSummary currentSubscription={currentSubscription} />

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
          <div className="flex flex-col gap-3">
            <SubscriptionPaymentsList
              payments={currentSubscription?.payments ?? []}
            />

            <SubscriptionHistoryList history={detail.subscriptionHistory} />
          </div>

          <div className="flex flex-col gap-3">
            <section className={sectionClassName()}>
              <div>
                <h2 className="text-base font-semibold">Información operativa</h2>
                <p className="mt-0.5 text-sm text-zinc-600">
                  Estado actual del vehículo y últimos movimientos.
                </p>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <article className={summaryCardClassName()}>
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Clock3 className="h-4 w-4" />
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em]">
                      Última entrada
                    </p>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold">
                    {formatDateTime(detail.location.lastEntryAtIso)}
                  </p>
                </article>

                <article className={summaryCardClassName()}>
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Clock3 className="h-4 w-4" />
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em]">
                      Última salida
                    </p>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold">
                    {formatDateTime(detail.location.lastExitAtIso)}
                  </p>
                </article>
              </div>

              <div className="mt-3 space-y-2.5">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                    Sesión abierta
                  </p>
                  <p className="mt-1.5 text-sm font-semibold">
                    {detail.location.openSession
                      ? `Ingreso: ${formatDateTime(
                          detail.location.openSession.entryAtIso
                        )}`
                      : "No hay sesión abierta"}
                  </p>

                  {detail.location.openSession?.scanCode ? (
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Código: {detail.location.openSession.scanCode}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                    Notas
                  </p>

                  <div className="mt-1.5 space-y-1.5 text-sm text-zinc-700">
                    <p>
                      <span className="font-medium">Mensualidad:</span>{" "}
                      {currentSubscription?.notes?.trim() || "Sin notas"}
                    </p>
                    <p>
                      <span className="font-medium">Vehículo:</span>{" "}
                      {detail.vehicle.notes?.trim() || "Sin notas"}
                    </p>
                    <p>
                      <span className="font-medium">Cliente:</span>{" "}
                      {detail.holder?.notes?.trim() || "Sin notas"}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}