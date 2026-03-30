"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

type SubscriptionFilterStatus =
  | "ALL"
  | "ACTIVE"
  | "EXPIRED"
  | "SUSPENDED"
  | "CANCELED";

type SubscriptionInsideStatus = "ALL" | "INSIDE" | "OUTSIDE";
type SubscriptionSortBy = "createdAt" | "startAt" | "endAt";
type SubscriptionSortOrder = "asc" | "desc";

type SubscriptionFiltersProps = {
  actionPath?: string;
  query: string;
  status: SubscriptionFilterStatus;
  inside: SubscriptionInsideStatus;
  pending: boolean;
  pageSize: number;
  sortBy: SubscriptionSortBy;
  sortOrder: SubscriptionSortOrder;
};

type FilterChip = {
  key: string;
  label: string;
};

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_SORT_BY: SubscriptionSortBy = "createdAt";
const DEFAULT_SORT_ORDER: SubscriptionSortOrder = "desc";

function buildMensualidadesHref(
  actionPath: string,
  params: {
    q?: string;
    page?: number;
    pageSize?: number;
    status?: SubscriptionFilterStatus;
    inside?: SubscriptionInsideStatus;
    pending?: boolean;
    sortBy?: SubscriptionSortBy;
    sortOrder?: SubscriptionSortOrder;
  }
) {
  const searchParams = new URLSearchParams();

  if (params.q?.trim()) {
    searchParams.set("q", params.q.trim());
  }

  if (params.page && params.page > 1) {
    searchParams.set("page", String(params.page));
  }

  if (params.pageSize && params.pageSize !== DEFAULT_PAGE_SIZE) {
    searchParams.set("pageSize", String(params.pageSize));
  }

  if (params.status && params.status !== "ALL") {
    searchParams.set("status", params.status);
  }

  if (params.inside && params.inside !== "ALL") {
    searchParams.set("inside", params.inside);
  }

  if (params.pending) {
    searchParams.set("pending", "1");
  }

  if (params.sortBy && params.sortBy !== DEFAULT_SORT_BY) {
    searchParams.set("sortBy", params.sortBy);
  }

  if (params.sortOrder && params.sortOrder !== DEFAULT_SORT_ORDER) {
    searchParams.set("sortOrder", params.sortOrder);
  }

  const queryString = searchParams.toString();

  return queryString ? `${actionPath}?${queryString}` : actionPath;
}

function getStatusLabel(status: SubscriptionFilterStatus) {
  switch (status) {
    case "ACTIVE":
      return "Activas";
    case "EXPIRED":
      return "Vencidas";
    case "SUSPENDED":
      return "Suspendidas";
    case "CANCELED":
      return "Canceladas";
    default:
      return "Todas";
  }
}

function getInsideLabel(inside: SubscriptionInsideStatus) {
  switch (inside) {
    case "INSIDE":
      return "Dentro";
    case "OUTSIDE":
      return "Fuera";
    default:
      return "Todos";
  }
}

function getSortByLabel(sortBy: SubscriptionSortBy) {
  switch (sortBy) {
    case "startAt":
      return "Fecha inicial";
    case "endAt":
      return "Fecha final";
    case "createdAt":
    default:
      return "Registro";
  }
}

function getSortOrderLabel(sortOrder: SubscriptionSortOrder) {
  return sortOrder === "asc" ? "Más antiguas" : "Más recientes";
}

function getActiveFilterChips(params: {
  status: SubscriptionFilterStatus;
  inside: SubscriptionInsideStatus;
  pending: boolean;
  pageSize: number;
  sortBy: SubscriptionSortBy;
  sortOrder: SubscriptionSortOrder;
}) {
  const chips: FilterChip[] = [];

  if (params.status !== "ALL") {
    chips.push({
      key: "status",
      label: `Estado: ${getStatusLabel(params.status)}`,
    });
  }

  if (params.inside !== "ALL") {
    chips.push({
      key: "inside",
      label: `Ubicación: ${getInsideLabel(params.inside)}`,
    });
  }

  if (params.pending) {
    chips.push({
      key: "pending",
      label: "Solo saldo pendiente",
    });
  }

  if (params.pageSize !== DEFAULT_PAGE_SIZE) {
    chips.push({
      key: "pageSize",
      label: `${params.pageSize} por página`,
    });
  }

  if (params.sortBy !== DEFAULT_SORT_BY || params.sortOrder !== DEFAULT_SORT_ORDER) {
    chips.push({
      key: "sort",
      label: `Orden: ${getSortByLabel(params.sortBy)} · ${getSortOrderLabel(
        params.sortOrder
      )}`,
    });
  }

  return chips;
}

export default function SubscriptionFilters({
  actionPath = "/mensualidades",
  query,
  status,
  inside,
  pending,
  pageSize,
  sortBy,
  sortOrder,
}: SubscriptionFiltersProps) {
  const router = useRouter();

  const [searchValue, setSearchValue] = React.useState(query);
  const [draftStatus, setDraftStatus] =
    React.useState<SubscriptionFilterStatus>(status);
  const [draftInside, setDraftInside] =
    React.useState<SubscriptionInsideStatus>(inside);
  const [draftPending, setDraftPending] = React.useState(pending);
  const [draftPageSize, setDraftPageSize] = React.useState(pageSize);
  const [draftSortBy, setDraftSortBy] =
    React.useState<SubscriptionSortBy>(sortBy);
  const [draftSortOrder, setDraftSortOrder] =
    React.useState<SubscriptionSortOrder>(sortOrder);
  const [isFiltersOpen, setIsFiltersOpen] = React.useState(false);

  React.useEffect(() => {
    setSearchValue(query);
    setDraftStatus(status);
    setDraftInside(inside);
    setDraftPending(pending);
    setDraftPageSize(pageSize);
    setDraftSortBy(sortBy);
    setDraftSortOrder(sortOrder);
  }, [query, status, inside, pending, pageSize, sortBy, sortOrder]);

  React.useEffect(() => {
    if (!isFiltersOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsFiltersOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isFiltersOpen]);

  const activeChips = React.useMemo(
    () =>
      getActiveFilterChips({
        status: draftStatus,
        inside: draftInside,
        pending: draftPending,
        pageSize: draftPageSize,
        sortBy: draftSortBy,
        sortOrder: draftSortOrder,
      }),
    [draftInside, draftPageSize, draftPending, draftSortBy, draftSortOrder, draftStatus]
  );

  const activeFiltersCount = activeChips.length;

  const navigateWithCurrentValues = React.useCallback(() => {
    const href = buildMensualidadesHref(actionPath, {
      q: searchValue,
      page: 1,
      pageSize: draftPageSize,
      status: draftStatus,
      inside: draftInside,
      pending: draftPending,
      sortBy: draftSortBy,
      sortOrder: draftSortOrder,
    });

    router.push(href);
  }, [
    actionPath,
    draftInside,
    draftPageSize,
    draftPending,
    draftSortBy,
    draftSortOrder,
    draftStatus,
    router,
    searchValue,
  ]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigateWithCurrentValues();
  };

  const handleApplyFilters = () => {
    setIsFiltersOpen(false);
    navigateWithCurrentValues();
  };

  const handleClearAll = () => {
    setSearchValue("");
    setDraftStatus("ALL");
    setDraftInside("ALL");
    setDraftPending(false);
    setDraftPageSize(DEFAULT_PAGE_SIZE);
    setDraftSortBy(DEFAULT_SORT_BY);
    setDraftSortOrder(DEFAULT_SORT_ORDER);
    router.push(actionPath);
  };

  return (
    <>
      <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-neutral-900">
              Buscar mensualidad
            </h2>
            <p className="text-sm text-neutral-600">
              La placa es lo principal. También puedes escribir nombre o teléfono.
            </p>
          </div>
        </div>

        <div className="px-4 py-4 sm:px-6">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col gap-3 lg:flex-row lg:items-center"
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Buscar por placa. Ej. ABC123"
                className="h-12 w-full rounded-2xl border border-neutral-200 bg-white pl-11 pr-4 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 lg:flex lg:items-center">
              <button
                type="button"
                onClick={() => setIsFiltersOpen(true)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:text-neutral-950 lg:min-w-[140px]"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {activeFiltersCount > 0 ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-neutral-900 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    {activeFiltersCount}
                  </span>
                ) : null}
              </button>

              <button
                type="submit"
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800 lg:min-w-[140px]"
              >
                Buscar
              </button>
            </div>
          </form>

          {activeChips.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {activeChips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-700"
                >
                  {chip.label}
                </span>
              ))}

              <button
                type="button"
                onClick={handleClearAll}
                className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-neutral-500 transition hover:text-neutral-900"
              >
                Limpiar
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {isFiltersOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          onClick={() => setIsFiltersOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="subscription-filters-modal-title"
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-500">
                  Mensualidades
                </p>
                <h3
                  id="subscription-filters-modal-title"
                  className="text-xl font-semibold tracking-tight text-neutral-950"
                >
                  Filtros avanzados
                </h3>
                <p className="mt-1 text-sm text-neutral-600">
                  Ajusta el listado sin recargar visualmente el dashboard.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsFiltersOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
                aria-label="Cerrar filtros"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              <div className="grid gap-5">
                <section className="rounded-3xl border border-neutral-200 bg-white p-4">
                  <h4 className="text-sm font-semibold text-neutral-900">
                    Estado y ubicación
                  </h4>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="filters-status"
                        className="mb-1.5 block text-sm font-medium text-neutral-800"
                      >
                        Estado
                      </label>
                      <select
                        id="filters-status"
                        value={draftStatus}
                        onChange={(event) =>
                          setDraftStatus(
                            event.target.value as SubscriptionFilterStatus
                          )
                        }
                        className="h-11 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm text-neutral-900 outline-none transition focus:border-neutral-400"
                      >
                        <option value="ALL">Todas</option>
                        <option value="ACTIVE">Activas</option>
                        <option value="EXPIRED">Vencidas</option>
                        <option value="SUSPENDED">Suspendidas</option>
                        <option value="CANCELED">Canceladas</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="filters-inside"
                        className="mb-1.5 block text-sm font-medium text-neutral-800"
                      >
                        Ubicación
                      </label>
                      <select
                        id="filters-inside"
                        value={draftInside}
                        onChange={(event) =>
                          setDraftInside(
                            event.target.value as SubscriptionInsideStatus
                          )
                        }
                        className="h-11 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm text-neutral-900 outline-none transition focus:border-neutral-400"
                      >
                        <option value="ALL">Todos</option>
                        <option value="INSIDE">Dentro</option>
                        <option value="OUTSIDE">Fuera</option>
                      </select>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-neutral-200 bg-white p-4">
                  <h4 className="text-sm font-semibold text-neutral-900">
                    Cobro y orden
                  </h4>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="filters-pageSize"
                        className="mb-1.5 block text-sm font-medium text-neutral-800"
                      >
                        Mostrar
                      </label>
                      <select
                        id="filters-pageSize"
                        value={String(draftPageSize)}
                        onChange={(event) =>
                          setDraftPageSize(Number(event.target.value))
                        }
                        className="h-11 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm text-neutral-900 outline-none transition focus:border-neutral-400"
                      >
                        <option value="10">10 por página</option>
                        <option value="20">20 por página</option>
                        <option value="30">30 por página</option>
                        <option value="50">50 por página</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <label className="flex w-full items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={draftPending}
                          onChange={(event) => setDraftPending(event.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-neutral-300"
                        />
                        <span className="leading-5">
                          Mostrar solo mensualidades con saldo pendiente
                        </span>
                      </label>
                    </div>

                    <div>
                      <label
                        htmlFor="filters-sortBy"
                        className="mb-1.5 block text-sm font-medium text-neutral-800"
                      >
                        Ordenar por
                      </label>
                      <select
                        id="filters-sortBy"
                        value={draftSortBy}
                        onChange={(event) =>
                          setDraftSortBy(
                            event.target.value as SubscriptionSortBy
                          )
                        }
                        className="h-11 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm text-neutral-900 outline-none transition focus:border-neutral-400"
                      >
                        <option value="createdAt">Registro</option>
                        <option value="startAt">Fecha inicial</option>
                        <option value="endAt">Fecha final</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="filters-sortOrder"
                        className="mb-1.5 block text-sm font-medium text-neutral-800"
                      >
                        Dirección
                      </label>
                      <select
                        id="filters-sortOrder"
                        value={draftSortOrder}
                        onChange={(event) =>
                          setDraftSortOrder(
                            event.target.value as SubscriptionSortOrder
                          )
                        }
                        className="h-11 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm text-neutral-900 outline-none transition focus:border-neutral-400"
                      >
                        <option value="desc">Más recientes</option>
                        <option value="asc">Más antiguas</option>
                      </select>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="border-t border-neutral-200 bg-white px-4 py-4 sm:px-6">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-neutral-200 px-5 text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:text-neutral-950"
                >
                  Limpiar filtros
                </button>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setIsFiltersOpen(false)}
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-neutral-200 px-5 text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:text-neutral-950"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyFilters}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800"
                  >
                    <Check className="h-4 w-4" />
                    Aplicar filtros
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}