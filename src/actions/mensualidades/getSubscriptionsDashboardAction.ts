"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  SessionStatus,
  SubscriptionStatus,
  VehicleType,
} from "@prisma/client";

type DashboardSubscriptionFilterStatus = "ALL" | SubscriptionStatus;
type DashboardInsideFilterStatus = "ALL" | "INSIDE" | "OUTSIDE";
type DashboardSortBy = "createdAt" | "startAt" | "endAt";
type DashboardSortOrder = "asc" | "desc";

export type GetSubscriptionsDashboardInput = {
  query?: string;
  status?: DashboardSubscriptionFilterStatus;
  insideStatus?: DashboardInsideFilterStatus;
  onlyWithPendingBalance?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: DashboardSortBy;
  sortOrder?: DashboardSortOrder;
};

export type SubscriptionDashboardStats = {
  totalCount: number;
  activeCount: number;
  expiredCount: number;
  suspendedCount: number;
  canceledCount: number;
  insideCount: number;
  outsideCount: number;
  totalAmount: number;
  totalPaidAmount: number;
  totalPendingAmount: number;
};

export type SubscriptionDashboardItem = {
  id: string;
  status: SubscriptionStatus;
  computedStatus: SubscriptionStatus;
  startAtIso: string;
  endAtIso: string;
  amount: number;
  paidAmount: number;
  pendingAmount: number;
  isFullyPaid: boolean;
  isInside: boolean;
  notes: string | null;
  customer: {
    id: string;
    fullName: string;
    phone: string | null;
    phoneSecondary: string | null;
  };
  vehicle: {
    id: string;
    plate: string;
    plateNormalized: string;
    type: VehicleType;
  };
  lastPayment: {
    id: string;
    amount: number;
    method: PaymentMethod;
    reference: string | null;
    paidAtIso: string;
  } | null;
};

export type GetSubscriptionsDashboardSuccess = {
  ok: true;
  filters: {
    query: string;
    status: DashboardSubscriptionFilterStatus;
    insideStatus: DashboardInsideFilterStatus;
    onlyWithPendingBalance: boolean;
    page: number;
    pageSize: number;
    sortBy: DashboardSortBy;
    sortOrder: DashboardSortOrder;
  };
  stats: SubscriptionDashboardStats;
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  items: SubscriptionDashboardItem[];
};

export type GetSubscriptionsDashboardError = {
  ok: false;
  code:
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "INACTIVE_USER"
    | "VALIDATION_ERROR"
    | "UNKNOWN_ERROR";
  message: string;
};

export type GetSubscriptionsDashboardResult =
  | GetSubscriptionsDashboardSuccess
  | GetSubscriptionsDashboardError;

type CandidateSubscriptionRow = {
  id: string;
  amount: number;
  status: SubscriptionStatus;
  startAt: Date;
  endAt: Date;
  notes: string | null;
  createdAt: Date;
  vehicle: {
    id: string;
    plateNormalized: string;
  };
};

type DerivedCandidateRow = {
  id: string;
  amount: number;
  status: SubscriptionStatus;
  computedStatus: SubscriptionStatus;
  startAt: Date;
  endAt: Date;
  notes: string | null;
  createdAt: Date;
  vehicleId: string;
  plateNormalized: string;
  paidAmount: number;
  pendingAmount: number;
  isFullyPaid: boolean;
  isInside: boolean;
};

function clampInteger(
  value: number | undefined,
  {
    fallback,
    min,
    max,
  }: {
    fallback: number;
    min: number;
    max: number;
  }
) {
  if (!Number.isFinite(value)) return fallback;
  const normalized = Math.trunc(value as number);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
}

function normalizeSearchText(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function computeSubscriptionStatus(
  status: SubscriptionStatus,
  endAt: Date,
  now: Date
): SubscriptionStatus {
  if (status === SubscriptionStatus.ACTIVE && endAt.getTime() < now.getTime()) {
    return SubscriptionStatus.EXPIRED;
  }

  return status;
}

function buildBaseWhere({
  query,
  normalizedQuery,
  status,
  now,
}: {
  query: string;
  normalizedQuery: string;
  status: DashboardSubscriptionFilterStatus;
  now: Date;
}): Prisma.SubscriptionWhereInput {
  const andConditions: Prisma.SubscriptionWhereInput[] = [];

  if (query) {
    const queryOr: Prisma.SubscriptionWhereInput[] = [
      {
        vehicle: {
          plate: {
            contains: query,
            mode: "insensitive",
          },
        },
      },
      {
        customer: {
          fullName: {
            contains: query,
            mode: "insensitive",
          },
        },
      },
      {
        customer: {
          phone: {
            contains: query,
            mode: "insensitive",
          },
        },
      },
      {
        customer: {
          phoneSecondary: {
            contains: query,
            mode: "insensitive",
          },
        },
      },
      {
        notes: {
          contains: query,
          mode: "insensitive",
        },
      },
    ];

    if (normalizedQuery) {
      queryOr.unshift({
        vehicle: {
          plateNormalized: {
            equals: normalizedQuery,
          },
        },
      });

      queryOr.push({
        vehicle: {
          plateNormalized: {
            contains: normalizedQuery,
          },
        },
      });
    }

    andConditions.push({
      OR: queryOr,
    });
  }

  if (status !== "ALL") {
    if (status === SubscriptionStatus.ACTIVE) {
      andConditions.push({
        status: SubscriptionStatus.ACTIVE,
        endAt: {
          gte: now,
        },
      });
    } else if (status === SubscriptionStatus.EXPIRED) {
      andConditions.push({
        OR: [
          {
            status: SubscriptionStatus.EXPIRED,
          },
          {
            status: SubscriptionStatus.ACTIVE,
            endAt: {
              lt: now,
            },
          },
        ],
      });
    } else {
      andConditions.push({
        status,
      });
    }
  }

  if (andConditions.length === 0) {
    return {};
  }

  return {
    AND: andConditions,
  };
}

function buildOrderBy(
  sortBy: DashboardSortBy,
  sortOrder: DashboardSortOrder
): Prisma.SubscriptionOrderByWithRelationInput[] {
  switch (sortBy) {
    case "startAt":
      return [{ startAt: sortOrder }, { createdAt: "desc" }];

    case "endAt":
      return [{ endAt: sortOrder }, { createdAt: "desc" }];

    case "createdAt":
    default:
      return [{ createdAt: sortOrder }];
  }
}

function prioritizeExactPlateMatches(
  rows: DerivedCandidateRow[],
  normalizedQuery: string
) {
  if (!normalizedQuery) return rows;

  const exactMatches: DerivedCandidateRow[] = [];
  const others: DerivedCandidateRow[] = [];

  for (const row of rows) {
    if (row.plateNormalized === normalizedQuery) {
      exactMatches.push(row);
    } else {
      others.push(row);
    }
  }

  if (exactMatches.length === 0) {
    return rows;
  }

  return [...exactMatches, ...others];
}

export async function getSubscriptionsDashboardAction(
  input: GetSubscriptionsDashboardInput = {}
): Promise<GetSubscriptionsDashboardResult> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return {
        ok: false,
        code: "UNAUTHORIZED",
        message: "Debes iniciar sesión para consultar las mensualidades.",
      };
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!currentUser) {
      return {
        ok: false,
        code: "UNAUTHORIZED",
        message: "No se encontró el usuario autenticado.",
      };
    }

    if (!currentUser.isActive) {
      return {
        ok: false,
        code: "INACTIVE_USER",
        message: "Tu usuario está inactivo y no puede consultar mensualidades.",
      };
    }

    if (currentUser.role !== "ADMIN" && currentUser.role !== "OPERATOR") {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "No tienes permisos para consultar las mensualidades.",
      };
    }

    const query = typeof input.query === "string" ? input.query.trim() : "";
    const normalizedQuery = normalizeSearchText(query);

    const status: DashboardSubscriptionFilterStatus =
      input.status === "ACTIVE" ||
      input.status === "EXPIRED" ||
      input.status === "SUSPENDED" ||
      input.status === "CANCELED"
        ? input.status
        : "ALL";

    const insideStatus: DashboardInsideFilterStatus =
      input.insideStatus === "INSIDE" || input.insideStatus === "OUTSIDE"
        ? input.insideStatus
        : "ALL";

    const onlyWithPendingBalance = Boolean(input.onlyWithPendingBalance);

    const page = clampInteger(input.page, {
      fallback: 1,
      min: 1,
      max: 9999,
    });

    const pageSize = clampInteger(input.pageSize, {
      fallback: 20,
      min: 1,
      max: 100,
    });

    const sortBy: DashboardSortBy =
      input.sortBy === "startAt" ||
      input.sortBy === "endAt" ||
      input.sortBy === "createdAt"
        ? input.sortBy
        : "createdAt";

    const sortOrder: DashboardSortOrder =
      input.sortOrder === "asc" || input.sortOrder === "desc"
        ? input.sortOrder
        : "desc";

    const now = new Date();

    const baseWhere = buildBaseWhere({
      query,
      normalizedQuery,
      status,
      now,
    });

    const candidateRows: CandidateSubscriptionRow[] =
      await prisma.subscription.findMany({
        where: baseWhere,
        select: {
          id: true,
          amount: true,
          status: true,
          startAt: true,
          endAt: true,
          notes: true,
          createdAt: true,
          vehicle: {
            select: {
              id: true,
              plateNormalized: true,
            },
          },
        },
        orderBy: buildOrderBy(sortBy, sortOrder),
      });

    if (candidateRows.length === 0) {
      return {
        ok: true,
        filters: {
          query,
          status,
          insideStatus,
          onlyWithPendingBalance,
          page: 1,
          pageSize,
          sortBy,
          sortOrder,
        },
        stats: {
          totalCount: 0,
          activeCount: 0,
          expiredCount: 0,
          suspendedCount: 0,
          canceledCount: 0,
          insideCount: 0,
          outsideCount: 0,
          totalAmount: 0,
          totalPaidAmount: 0,
          totalPendingAmount: 0,
        },
        pagination: {
          page: 1,
          pageSize,
          totalCount: 0,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false,
        },
        items: [],
      };
    }

    const candidateIds = candidateRows.map((row) => row.id);

    const [paymentSums, insideVehicleRows] = await prisma.$transaction([
      prisma.payment.groupBy({
        by: ["subscriptionId"],
        where: {
          subscriptionId: {
            in: candidateIds,
          },
          status: PaymentStatus.COMPLETED,
        },
        orderBy: {
          subscriptionId: "asc",
        },
        _sum: {
          amount: true,
        },
      }),

      prisma.parkingSession.findMany({
        where: {
          status: SessionStatus.IN,
          vehicleId: {
            in: [...new Set(candidateRows.map((row) => row.vehicle.id))],
          },
        },
        select: {
          vehicleId: true,
        },
        distinct: ["vehicleId"],
      }),
    ]);

    const paidAmountBySubscriptionId = new Map<string, number>();
    for (const row of paymentSums) {
      if (!row.subscriptionId) continue;
      paidAmountBySubscriptionId.set(row.subscriptionId, row._sum?.amount ?? 0);
    }

    const insideVehicleIds = new Set(
      insideVehicleRows.map((row) => row.vehicleId)
    );

    let derivedRows: DerivedCandidateRow[] = candidateRows.map((row) => {
      const paidAmount = paidAmountBySubscriptionId.get(row.id) ?? 0;
      const pendingAmount = Math.max(row.amount - paidAmount, 0);
      const isInside = insideVehicleIds.has(row.vehicle.id);
      const computedStatus = computeSubscriptionStatus(row.status, row.endAt, now);

      return {
        id: row.id,
        amount: row.amount,
        status: row.status,
        computedStatus,
        startAt: row.startAt,
        endAt: row.endAt,
        notes: row.notes,
        createdAt: row.createdAt,
        vehicleId: row.vehicle.id,
        plateNormalized: row.vehicle.plateNormalized,
        paidAmount,
        pendingAmount,
        isFullyPaid: pendingAmount <= 0,
        isInside,
      };
    });

    if (insideStatus !== "ALL") {
      derivedRows = derivedRows.filter((row) =>
        insideStatus === "INSIDE" ? row.isInside : !row.isInside
      );
    }

    if (onlyWithPendingBalance) {
      derivedRows = derivedRows.filter((row) => row.pendingAmount > 0);
    }

    derivedRows = prioritizeExactPlateMatches(derivedRows, normalizedQuery);

    const stats: SubscriptionDashboardStats = {
      totalCount: 0,
      activeCount: 0,
      expiredCount: 0,
      suspendedCount: 0,
      canceledCount: 0,
      insideCount: 0,
      outsideCount: 0,
      totalAmount: 0,
      totalPaidAmount: 0,
      totalPendingAmount: 0,
    };

    for (const row of derivedRows) {
      stats.totalCount += 1;
      stats.totalAmount += row.amount;
      stats.totalPaidAmount += row.paidAmount;
      stats.totalPendingAmount += row.pendingAmount;

      if (row.isInside) {
        stats.insideCount += 1;
      } else {
        stats.outsideCount += 1;
      }

      if (row.computedStatus === SubscriptionStatus.ACTIVE) {
        stats.activeCount += 1;
      } else if (row.computedStatus === SubscriptionStatus.EXPIRED) {
        stats.expiredCount += 1;
      } else if (row.computedStatus === SubscriptionStatus.SUSPENDED) {
        stats.suspendedCount += 1;
      } else if (row.computedStatus === SubscriptionStatus.CANCELED) {
        stats.canceledCount += 1;
      }
    }

    const totalCount = derivedRows.length;
    const totalPages = totalCount === 0 ? 1 : Math.ceil(totalCount / pageSize);
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * pageSize;

    const pageRows = derivedRows.slice(offset, offset + pageSize);
    const pageIds = pageRows.map((row) => row.id);

    if (pageIds.length === 0) {
      return {
        ok: true,
        filters: {
          query,
          status,
          insideStatus,
          onlyWithPendingBalance,
          page: safePage,
          pageSize,
          sortBy,
          sortOrder,
        },
        stats,
        pagination: {
          page: safePage,
          pageSize,
          totalCount,
          totalPages,
          hasPreviousPage: safePage > 1,
          hasNextPage: safePage < totalPages,
        },
        items: [],
      };
    }

    const [pageSubscriptions, lastPaymentsRaw] = await prisma.$transaction([
      prisma.subscription.findMany({
        where: {
          id: {
            in: pageIds,
          },
        },
        include: {
          customer: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              phoneSecondary: true,
            },
          },
          vehicle: {
            select: {
              id: true,
              plate: true,
              plateNormalized: true,
              type: true,
            },
          },
        },
      }),

      prisma.payment.findMany({
        where: {
          subscriptionId: {
            in: pageIds,
          },
          status: PaymentStatus.COMPLETED,
        },
        select: {
          id: true,
          subscriptionId: true,
          amount: true,
          method: true,
          reference: true,
          paidAt: true,
          createdAt: true,
        },
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      }),
    ]);

    const pageSubscriptionById = new Map(
      pageSubscriptions.map((row) => [row.id, row])
    );

    const lastPaymentBySubscriptionId = new Map<
      string,
      {
        id: string;
        amount: number;
        method: PaymentMethod;
        reference: string | null;
        paidAtIso: string;
      }
    >();

    for (const payment of lastPaymentsRaw) {
      if (!payment.subscriptionId) continue;
      if (lastPaymentBySubscriptionId.has(payment.subscriptionId)) continue;

      lastPaymentBySubscriptionId.set(payment.subscriptionId, {
        id: payment.id,
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference,
        paidAtIso: payment.paidAt.toISOString(),
      });
    }

    const items: SubscriptionDashboardItem[] = pageRows
      .map((row) => {
        const fullRow = pageSubscriptionById.get(row.id);
        if (!fullRow) return null;

        return {
          id: fullRow.id,
          status: fullRow.status,
          computedStatus: row.computedStatus,
          startAtIso: fullRow.startAt.toISOString(),
          endAtIso: fullRow.endAt.toISOString(),
          amount: fullRow.amount,
          paidAmount: row.paidAmount,
          pendingAmount: row.pendingAmount,
          isFullyPaid: row.isFullyPaid,
          isInside: row.isInside,
          notes: fullRow.notes,
          customer: {
            id: fullRow.customer.id,
            fullName: fullRow.customer.fullName,
            phone: fullRow.customer.phone,
            phoneSecondary: fullRow.customer.phoneSecondary,
          },
          vehicle: {
            id: fullRow.vehicle.id,
            plate: fullRow.vehicle.plate,
            plateNormalized: fullRow.vehicle.plateNormalized,
            type: fullRow.vehicle.type,
          },
          lastPayment: lastPaymentBySubscriptionId.get(fullRow.id) ?? null,
        };
      })
      .filter((item): item is SubscriptionDashboardItem => item !== null);

    return {
      ok: true,
      filters: {
        query,
        status,
        insideStatus,
        onlyWithPendingBalance,
        page: safePage,
        pageSize,
        sortBy,
        sortOrder,
      },
      stats,
      pagination: {
        page: safePage,
        pageSize,
        totalCount,
        totalPages,
        hasPreviousPage: safePage > 1,
        hasNextPage: safePage < totalPages,
      },
      items,
    };
  } catch (error) {
    console.error(
      "[mensualidades/getSubscriptionsDashboardAction] Error obteniendo dashboard:",
      error
    );

    return {
      ok: false,
      code: "UNKNOWN_ERROR",
      message:
        "No fue posible cargar el dashboard de mensualidades. Intenta nuevamente.",
    };
  }
}