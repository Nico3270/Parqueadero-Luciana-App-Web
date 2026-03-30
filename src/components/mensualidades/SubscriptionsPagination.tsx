import Link from "next/link";

type SubscriptionFilterStatus =
  | "ALL"
  | "ACTIVE"
  | "EXPIRED"
  | "SUSPENDED"
  | "CANCELED";

type SubscriptionInsideStatus = "ALL" | "INSIDE" | "OUTSIDE";
type SubscriptionSortBy = "createdAt" | "startAt" | "endAt";
type SubscriptionSortOrder = "asc" | "desc";

type SubscriptionsPaginationProps = {
  actionPath?: string;
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  query: string;
  status: SubscriptionFilterStatus;
  inside: SubscriptionInsideStatus;
  pending: boolean;
  sortBy: SubscriptionSortBy;
  sortOrder: SubscriptionSortOrder;
};

function buildMensualidadesHref(
  actionPath: string,
  params: {
    q?: string;
    page?: number;
    pageSize?: number;
    status?: string;
    inside?: string;
    pending?: boolean;
    sortBy?: string;
    sortOrder?: string;
  }
) {
  const searchParams = new URLSearchParams();

  if (params.q?.trim()) {
    searchParams.set("q", params.q.trim());
  }

  if (params.page && params.page > 1) {
    searchParams.set("page", String(params.page));
  }

  if (params.pageSize && params.pageSize !== 10) {
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

  if (params.sortBy && params.sortBy !== "createdAt") {
    searchParams.set("sortBy", params.sortBy);
  }

  if (params.sortOrder && params.sortOrder !== "desc") {
    searchParams.set("sortOrder", params.sortOrder);
  }

  const queryString = searchParams.toString();

  return queryString ? `${actionPath}?${queryString}` : actionPath;
}

function clampPage(page: number, totalPages: number) {
  if (!Number.isFinite(page)) return 1;
  if (!Number.isFinite(totalPages) || totalPages <= 1) return 1;

  const normalizedPage = Math.trunc(page);
  const normalizedTotalPages = Math.trunc(totalPages);

  if (normalizedPage < 1) return 1;
  if (normalizedPage > normalizedTotalPages) return normalizedTotalPages;

  return normalizedPage;
}

export default function SubscriptionsPagination({
  actionPath = "/mensualidades",
  page,
  totalPages,
  totalCount,
  pageSize,
  query,
  status,
  inside,
  pending,
  sortBy,
  sortOrder,
}: SubscriptionsPaginationProps) {
  const safeTotalPages =
    Number.isFinite(totalPages) && totalPages > 0 ? Math.trunc(totalPages) : 1;

  const safePage = clampPage(page, safeTotalPages);
  const hasPreviousPage = safePage > 1;
  const hasNextPage = safePage < safeTotalPages;

  const pageStart = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd =
    totalCount === 0 ? 0 : Math.min(safePage * pageSize, totalCount);

  const previousHref = buildMensualidadesHref(actionPath, {
    q: query,
    page: Math.max(safePage - 1, 1),
    pageSize,
    status,
    inside,
    pending,
    sortBy,
    sortOrder,
  });

  const nextHref = buildMensualidadesHref(actionPath, {
    q: query,
    page: Math.min(safePage + 1, safeTotalPages),
    pageSize,
    status,
    inside,
    pending,
    sortBy,
    sortOrder,
  });

  return (
    <div className="flex flex-col gap-4 border-t border-neutral-200 bg-neutral-50 px-4 py-4 sm:px-6">
      <div className="text-center text-sm leading-6 text-neutral-600 sm:text-left">
        {totalCount > 0 ? (
          <>
            Mostrando <span className="font-medium">{pageStart}</span> a{" "}
            <span className="font-medium">{pageEnd}</span> de{" "}
            <span className="font-medium">{totalCount}</span> mensualidades.
          </>
        ) : (
          "No hay resultados para mostrar."
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="order-2 text-center text-sm font-medium text-neutral-700 sm:order-1 sm:text-left">
          Página {safePage} de {safeTotalPages}
        </div>

        <div className="order-1 grid grid-cols-2 gap-2 sm:order-2 sm:flex sm:items-center sm:justify-end">
          {hasPreviousPage ? (
            <Link
              href={previousHref}
              aria-label={`Ir a la página ${safePage - 1}`}
              className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:text-neutral-950 sm:h-10 sm:w-auto sm:min-w-[120px]"
            >
              Anterior
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="inline-flex h-11 w-full cursor-not-allowed items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-400 sm:h-10 sm:w-auto sm:min-w-[120px]"
            >
              Anterior
            </span>
          )}

          {hasNextPage ? (
            <Link
              href={nextHref}
              aria-label={`Ir a la página ${safePage + 1}`}
              className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:text-neutral-950 sm:h-10 sm:w-auto sm:min-w-[120px]"
            >
              Siguiente
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="inline-flex h-11 w-full cursor-not-allowed items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-400 sm:h-10 sm:w-auto sm:min-w-[120px]"
            >
              Siguiente
            </span>
          )}
        </div>
      </div>
    </div>
  );
}