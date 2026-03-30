import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import MensualidadesPageActions from "@/components/mensualidades/MensualidadesPageActions";
import SubscriptionFilters from "@/components/mensualidades/SubscriptionFilters";
import SubscriptionsPagination from "@/components/mensualidades/SubscriptionsPagination";
import SubscriptionsTable from "@/components/mensualidades/SubscriptionsTable";
import { getSubscriptionsDashboardAction } from "@/actions/mensualidades/getSubscriptionsDashboardAction";

export const metadata: Metadata = {
  title: "Mensualidades | Parqueadero",
  description: "Gestión de mensualidades del parqueadero",
};

type MensualidadesPageProps = {
  searchParams?: Promise<{
    q?: string | string[];
    page?: string | string[];
    pageSize?: string | string[];
    status?: string | string[];
    inside?: string | string[];
    pending?: string | string[];
    sortBy?: string | string[];
    sortOrder?: string | string[];
  }>;
};

type SummaryCardTone = "default" | "success" | "warning" | "danger" | "info";

type SummaryCardProps = {
  title: string;
  value: string | number;
  description: string;
  tone?: SummaryCardTone;
};

function SummaryCard({
  title,
  value,
  description,
  tone = "default",
}: SummaryCardProps) {
  const toneClasses =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50/70"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50/70"
        : tone === "danger"
          ? "border-red-200 bg-red-50/70"
          : tone === "info"
            ? "border-sky-200 bg-sky-50/70"
            : "border-neutral-200 bg-white";

  return (
    <article
      className={[
        "rounded-2xl border px-3 py-3 shadow-sm sm:px-4 sm:py-3.5",
        toneClasses,
      ].join(" ")}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        {title}
      </p>

      <p className="mt-1 text-lg font-semibold tracking-tight text-neutral-950 sm:text-xl">
        {value}
      </p>

      <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-600">
        {description}
      </p>
    </article>
  );
}

function getSingleSearchParam(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  {
    min,
    max,
  }: {
    min: number;
    max: number;
  }
) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;

  const normalized = Math.trunc(parsed);

  if (normalized < min) return min;
  if (normalized > max) return max;

  return normalized;
}

function parsePendingFlag(value: string | undefined) {
  if (!value) return false;

  const normalized = value.trim().toLowerCase();

  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function MensualidadesPage({
  searchParams,
}: MensualidadesPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/login");
  }

  const role = session.user.role;

  if (role !== "ADMIN" && role !== "OPERATOR") {
    redirect("/");
  }

  const resolvedSearchParams = (await searchParams) ?? {};

  const q = getSingleSearchParam(resolvedSearchParams.q)?.trim() ?? "";

  const page = parsePositiveInteger(
    getSingleSearchParam(resolvedSearchParams.page),
    1,
    { min: 1, max: 9999 }
  );

  const pageSize = parsePositiveInteger(
    getSingleSearchParam(resolvedSearchParams.pageSize),
    10,
    { min: 1, max: 100 }
  );

  const rawStatus = getSingleSearchParam(resolvedSearchParams.status);
  const status =
    rawStatus === "ACTIVE" ||
    rawStatus === "EXPIRED" ||
    rawStatus === "SUSPENDED" ||
    rawStatus === "CANCELED"
      ? rawStatus
      : "ALL";

  const rawInside = getSingleSearchParam(resolvedSearchParams.inside);
  const inside =
    rawInside === "INSIDE" || rawInside === "OUTSIDE" ? rawInside : "ALL";

  const pending = parsePendingFlag(
    getSingleSearchParam(resolvedSearchParams.pending)
  );

  const rawSortBy = getSingleSearchParam(resolvedSearchParams.sortBy);
  const sortBy =
    rawSortBy === "createdAt" ||
    rawSortBy === "startAt" ||
    rawSortBy === "endAt"
      ? rawSortBy
      : "createdAt";

  const rawSortOrder = getSingleSearchParam(resolvedSearchParams.sortOrder);
  const sortOrder =
    rawSortOrder === "asc" || rawSortOrder === "desc"
      ? rawSortOrder
      : "desc";

  const dashboard = await getSubscriptionsDashboardAction({
    query: q,
    status,
    insideStatus: inside,
    onlyWithPendingBalance: pending,
    page,
    pageSize,
    sortBy,
    sortOrder,
  });

  return (
    <main className="min-h-screen bg-neutral-50">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:gap-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <header className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-500">
                Parqueadero · Gestión
              </p>

              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
                Mensualidades
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600 sm:text-base">
                Aquí podrás administrar clientes con mensualidad, registrar
                periodos, revisar abonos y verificar fácilmente qué vehículos
                están dentro o fuera del parqueadero.
              </p>
            </div>

            <div className="w-full lg:w-auto lg:max-w-md">
              <MensualidadesPageActions />
            </div>
          </div>
        </header>

        <SubscriptionFilters
          query={q}
          status={status}
          inside={inside}
          pending={pending}
          pageSize={pageSize}
          sortBy={sortBy}
          sortOrder={sortOrder}
        />

        {!dashboard.ok ? (
          <section className="overflow-hidden rounded-3xl border border-red-200 bg-white shadow-sm">
            <div className="border-b border-red-100 bg-red-50 px-4 py-4 sm:px-6">
              <h2 className="text-base font-semibold text-red-700">
                No fue posible cargar el panel
              </h2>
            </div>

            <div className="px-4 py-5 sm:px-6">
              <p className="text-sm text-neutral-700">{dashboard.message}</p>
            </div>
          </section>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
              <SummaryCard
                title="Activas"
                value={dashboard.stats.activeCount}
                description="Mensualidades vigentes"
                tone="success"
              />

              <SummaryCard
                title="Vencidas"
                value={dashboard.stats.expiredCount}
                description="Periodos finalizados"
                tone="warning"
              />

              <SummaryCard
                title="Suspendidas"
                value={dashboard.stats.suspendedCount}
                description="Requieren revisión"
                tone="danger"
              />

              <SummaryCard
                title="Dentro"
                value={dashboard.stats.insideCount}
                description="Vehículos en parqueadero"
                tone="info"
              />

              <div className="col-span-2 xl:col-span-1">
                <SummaryCard
                  title="Saldo pendiente"
                  value={formatCurrency(dashboard.stats.totalPendingAmount)}
                  description="Pendiente total por cobrar"
                  tone="default"
                />
              </div>
            </section>

            <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-neutral-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-neutral-900">
                    Mensualidades
                  </h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    Vista del listado según búsqueda, filtros y paginación.
                  </p>
                </div>

                <div className="shrink-0 text-sm text-neutral-500">
                  Página {dashboard.pagination.page} de{" "}
                  {dashboard.pagination.totalPages}
                </div>
              </div>

              <SubscriptionsTable items={dashboard.items} />

              <SubscriptionsPagination
                page={dashboard.pagination.page}
                totalPages={dashboard.pagination.totalPages}
                totalCount={dashboard.pagination.totalCount}
                pageSize={pageSize}
                query={q}
                status={status}
                inside={inside}
                pending={pending}
                sortBy={sortBy}
                sortOrder={sortOrder}
              />
            </section>

            {/**
             * Siguiente paso:
             * 1. Crear la ruta dinámica /mensualidades/[plate]
             * 2. Crear getSubscriptionDetailAction.ts
             * 3. Mostrar detalle financiero y operativo por placa
             */}
          </>
        )}
      </section>
    </main>
  );
}