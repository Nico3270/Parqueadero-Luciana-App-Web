"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import {
  PaymentMethod,
  PaymentStatus,
  PricingUnit,
  SessionStatus,
  SubscriptionStatus,
  VehicleType,
} from "@prisma/client";

type ActionUserSummary = {
  id: string;
  name: string | null;
  email: string | null;
};

type CustomerSummary = {
  id: string;
  fullName: string;
  document: string | null;
  phone: string | null;
  phoneSecondary: string | null;
  notes: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

type SessionSummary = {
  id: string;
  ticketCode: string;
  scanCode: string;
  status: SessionStatus;
  pricingUnit: PricingUnit;
  entryAtIso: string;
  exitAtIso: string | null;
  subscriptionId: string | null;
  notes: string | null;
  createdBy: ActionUserSummary | null;
  closedBy: ActionUserSummary | null;
};

export type SubscriptionPaymentItem = {
  id: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amount: number;
  paidAtIso: string;
  reference: string | null;
  notes: string | null;
  shiftId: string | null;
  operator: ActionUserSummary | null;
};

export type SubscriptionHistoryItem = {
  id: string;
  startAtIso: string;
  endAtIso: string;
  amount: number;
  status: SubscriptionStatus;
  computedStatus: SubscriptionStatus;
  notes: string | null;
  createdAtIso: string;
  updatedAtIso: string;
  isCurrentPeriod: boolean;
  daysUntilEnd: number;
  totalPaid: number;
  pendingAmount: number;
  isPaidInFull: boolean;
  paymentsCount: number;
  lastPaymentAtIso: string | null;
  customer: CustomerSummary;
};

export type CurrentSubscriptionDetail = SubscriptionHistoryItem & {
  payments: SubscriptionPaymentItem[];
};

export type GetSubscriptionDetailSuccess = {
  ok: true;
  normalizedPlate: string;
  vehicle: {
    id: string;
    plate: string;
    plateNormalized: string;
    type: VehicleType;
    notes: string | null;
    createdAtIso: string;
    updatedAtIso: string;
  };
  holder: CustomerSummary | null;
  currentSubscription: CurrentSubscriptionDetail | null;
  subscriptionHistory: SubscriptionHistoryItem[];
  location: {
    isInside: boolean;
    openSession: SessionSummary | null;
    lastSession: SessionSummary | null;
    lastEntryAtIso: string | null;
    lastExitAtIso: string | null;
  };
};

export type GetSubscriptionDetailError = {
  ok: false;
  code:
    | "VALIDATION_ERROR"
    | "UNAUTHORIZED"
    | "INACTIVE_USER"
    | "NOT_FOUND"
    | "UNKNOWN_ERROR";
  message: string;
  field?: "plate";
};

export type GetSubscriptionDetailResult =
  | GetSubscriptionDetailSuccess
  | GetSubscriptionDetailError;

type CustomerRow = {
  id: string;
  fullName: string;
  document: string | null;
  phone: string | null;
  phoneSecondary: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type SubscriptionRow = {
  id: string;
  startAt: Date;
  endAt: Date;
  amount: number;
  status: SubscriptionStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer: CustomerRow;
};

type SessionRow = {
  id: string;
  ticketCode: string;
  scanCode: string;
  status: SessionStatus;
  pricingUnit: PricingUnit;
  entryAt: Date;
  exitAt: Date | null;
  subscriptionId: string | null;
  notes: string | null;
  createdBy: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  closedBy: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
};

type PaymentRow = {
  id: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amount: number;
  paidAt: Date;
  reference: string | null;
  notes: string | null;
  shiftId: string | null;
  operator: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
};

type PaymentTotals = {
  totalPaid: number;
  paymentsCount: number;
  lastPaymentAt: Date | null;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function safeDecodePlate(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizePlate(value: string): string {
  return safeDecodePlate(value).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function toUserSummary(
  user:
    | {
        id: string;
        name: string | null;
        email: string | null;
      }
    | null
    | undefined
): ActionUserSummary | null {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

function toCustomerSummary(
  customer: CustomerRow | null | undefined
): CustomerSummary | null {
  if (!customer) return null;

  return {
    id: customer.id,
    fullName: customer.fullName,
    document: customer.document,
    phone: customer.phone,
    phoneSecondary: customer.phoneSecondary,
    notes: customer.notes,
    createdAtIso: customer.createdAt.toISOString(),
    updatedAtIso: customer.updatedAt.toISOString(),
  };
}

function toSessionSummary(
  session: SessionRow | null | undefined
): SessionSummary | null {
  if (!session) return null;

  return {
    id: session.id,
    ticketCode: session.ticketCode,
    scanCode: session.scanCode,
    status: session.status,
    pricingUnit: session.pricingUnit,
    entryAtIso: session.entryAt.toISOString(),
    exitAtIso: toIso(session.exitAt),
    subscriptionId: session.subscriptionId,
    notes: session.notes,
    createdBy: toUserSummary(session.createdBy),
    closedBy: toUserSummary(session.closedBy),
  };
}

function computeSubscriptionStatus(
  status: SubscriptionStatus,
  endAt: Date,
  now: Date
): SubscriptionStatus {
  if (status === SubscriptionStatus.CANCELED) {
    return SubscriptionStatus.CANCELED;
  }

  if (status === SubscriptionStatus.SUSPENDED) {
    return SubscriptionStatus.SUSPENDED;
  }

  if (endAt.getTime() < now.getTime()) {
    return SubscriptionStatus.EXPIRED;
  }

  return SubscriptionStatus.ACTIVE;
}

function computeDaysUntilEnd(endAt: Date, now: Date): number {
  const diff = endAt.getTime() - now.getTime();

  if (diff <= 0) {
    return 0;
  }

  return Math.ceil(diff / MS_PER_DAY);
}

function buildPaymentTotalsMap(
  groups: Array<{
    subscriptionId: string | null;
    _sum: { amount: number | null };
    _count: { _all: number };
    _max: { paidAt: Date | null };
  }>
): Map<string, PaymentTotals> {
  const map = new Map<string, PaymentTotals>();

  for (const group of groups) {
    if (!group.subscriptionId) continue;

    map.set(group.subscriptionId, {
      totalPaid: group._sum.amount ?? 0,
      paymentsCount: group._count._all ?? 0,
      lastPaymentAt: group._max.paidAt ?? null,
    });
  }

  return map;
}

function buildSubscriptionHistoryItem(
  subscription: SubscriptionRow,
  paymentTotalsMap: Map<string, PaymentTotals>,
  now: Date
): SubscriptionHistoryItem {
  const paymentTotals = paymentTotalsMap.get(subscription.id);
  const totalPaid = paymentTotals?.totalPaid ?? 0;
  const pendingAmount = Math.max(subscription.amount - totalPaid, 0);
  const computedStatus = computeSubscriptionStatus(
    subscription.status,
    subscription.endAt,
    now
  );

  return {
    id: subscription.id,
    startAtIso: subscription.startAt.toISOString(),
    endAtIso: subscription.endAt.toISOString(),
    amount: subscription.amount,
    status: subscription.status,
    computedStatus,
    notes: subscription.notes,
    createdAtIso: subscription.createdAt.toISOString(),
    updatedAtIso: subscription.updatedAt.toISOString(),
    isCurrentPeriod:
      subscription.startAt.getTime() <= now.getTime() &&
      subscription.endAt.getTime() >= now.getTime(),
    daysUntilEnd: computeDaysUntilEnd(subscription.endAt, now),
    totalPaid,
    pendingAmount,
    isPaidInFull: pendingAmount <= 0,
    paymentsCount: paymentTotals?.paymentsCount ?? 0,
    lastPaymentAtIso: toIso(paymentTotals?.lastPaymentAt),
    customer: toCustomerSummary(subscription.customer)!,
  };
}

function pickCurrentSubscription(
  history: SubscriptionHistoryItem[]
): SubscriptionHistoryItem | null {
  const active = history.find(
    (item) => item.computedStatus === SubscriptionStatus.ACTIVE
  );
  if (active) return active;

  const suspended = history.find(
    (item) => item.computedStatus === SubscriptionStatus.SUSPENDED
  );
  if (suspended) return suspended;

  return history[0] ?? null;
}

function rankVehicleCandidate(candidate: {
  updatedAt: Date;
  subscriptions: Array<{
    status: SubscriptionStatus;
    endAt: Date;
  }>;
  sessions: Array<{ id: string }>;
}) {
  const now = new Date();

  let subscriptionRank = 0;
  let latestSubscriptionEndAt = 0;

  for (const subscription of candidate.subscriptions) {
    const computed = computeSubscriptionStatus(
      subscription.status,
      subscription.endAt,
      now
    );

    if (computed === SubscriptionStatus.ACTIVE) {
      subscriptionRank = Math.max(subscriptionRank, 4);
    } else if (computed === SubscriptionStatus.SUSPENDED) {
      subscriptionRank = Math.max(subscriptionRank, 3);
    } else if (computed === SubscriptionStatus.EXPIRED) {
      subscriptionRank = Math.max(subscriptionRank, 2);
    } else {
      subscriptionRank = Math.max(subscriptionRank, 1);
    }

    latestSubscriptionEndAt = Math.max(
      latestSubscriptionEndAt,
      subscription.endAt.getTime()
    );
  }

  return {
    subscriptionRank,
    hasOpenSession: candidate.sessions.length > 0 ? 1 : 0,
    latestSubscriptionEndAt,
    updatedAt: candidate.updatedAt.getTime(),
  };
}

export async function getSubscriptionDetailAction(input: {
  plate: string;
}): Promise<GetSubscriptionDetailResult> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return {
        ok: false,
        code: "UNAUTHORIZED",
        message: "Debes iniciar sesión para consultar el detalle de la mensualidad.",
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, isActive: true },
    });

    if (!user) {
      return {
        ok: false,
        code: "UNAUTHORIZED",
        message: "No se encontró el usuario autenticado.",
      };
    }

    if (!user.isActive) {
      return {
        ok: false,
        code: "INACTIVE_USER",
        message: "Tu usuario está inactivo. No puedes consultar mensualidades.",
      };
    }

    const normalizedPlate = normalizePlate(input.plate);

    if (!normalizedPlate) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "La placa es obligatoria.",
        field: "plate",
      };
    }

    const vehicleCandidates = await prisma.vehicle.findMany({
      where: {
        plateNormalized: normalizedPlate,
      },
      select: {
        id: true,
        updatedAt: true,
        subscriptions: {
          take: 5,
          orderBy: [{ endAt: "desc" }, { createdAt: "desc" }],
          select: {
            status: true,
            endAt: true,
          },
        },
        sessions: {
          where: {
            status: SessionStatus.IN,
          },
          take: 1,
          select: {
            id: true,
          },
        },
      },
    });

    if (vehicleCandidates.length === 0) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "No se encontró ningún vehículo asociado a esa placa.",
        field: "plate",
      };
    }

    const sortedCandidates = [...vehicleCandidates].sort((a, b) => {
      const rankA = rankVehicleCandidate(a);
      const rankB = rankVehicleCandidate(b);

      if (rankB.subscriptionRank !== rankA.subscriptionRank) {
        return rankB.subscriptionRank - rankA.subscriptionRank;
      }

      if (rankB.hasOpenSession !== rankA.hasOpenSession) {
        return rankB.hasOpenSession - rankA.hasOpenSession;
      }

      if (rankB.latestSubscriptionEndAt !== rankA.latestSubscriptionEndAt) {
        return rankB.latestSubscriptionEndAt - rankA.latestSubscriptionEndAt;
      }

      return rankB.updatedAt - rankA.updatedAt;
    });

    const selectedVehicleId = sortedCandidates[0]?.id;

    if (!selectedVehicleId) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "No se pudo resolver el vehículo para esa placa.",
        field: "plate",
      };
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: {
        id: selectedVehicleId,
      },
      select: {
        id: true,
        plate: true,
        plateNormalized: true,
        type: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        customer: {
          select: {
            id: true,
            fullName: true,
            document: true,
            phone: true,
            phoneSecondary: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        subscriptions: {
          orderBy: [{ endAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            startAt: true,
            endAt: true,
            amount: true,
            status: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
            customer: {
              select: {
                id: true,
                fullName: true,
                document: true,
                phone: true,
                phoneSecondary: true,
                notes: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });

    if (!vehicle) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "No se encontró el vehículo para esa placa.",
        field: "plate",
      };
    }

    const subscriptionIds = vehicle.subscriptions.map(
      (subscription) => subscription.id
    );

    const [paymentGroups, openSessionRow, lastSessionRow, lastClosedSessionRow] =
      await Promise.all([
        subscriptionIds.length > 0
          ? prisma.payment.groupBy({
              by: ["subscriptionId"],
              where: {
                status: PaymentStatus.COMPLETED,
                subscriptionId: {
                  in: subscriptionIds,
                },
              },
              _sum: {
                amount: true,
              },
              _count: {
                _all: true,
              },
              _max: {
                paidAt: true,
              },
            })
          : Promise.resolve([]),
        prisma.parkingSession.findFirst({
          where: {
            vehicleId: vehicle.id,
            status: SessionStatus.IN,
          },
          orderBy: [{ entryAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            ticketCode: true,
            scanCode: true,
            status: true,
            pricingUnit: true,
            entryAt: true,
            exitAt: true,
            subscriptionId: true,
            notes: true,
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            closedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),
        prisma.parkingSession.findFirst({
          where: {
            vehicleId: vehicle.id,
          },
          orderBy: [{ entryAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            ticketCode: true,
            scanCode: true,
            status: true,
            pricingUnit: true,
            entryAt: true,
            exitAt: true,
            subscriptionId: true,
            notes: true,
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            closedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),
        prisma.parkingSession.findFirst({
          where: {
            vehicleId: vehicle.id,
            exitAt: {
              not: null,
            },
          },
          orderBy: [{ exitAt: "desc" }, { updatedAt: "desc" }],
          select: {
            exitAt: true,
          },
        }),
      ]);

    const paymentTotalsMap = buildPaymentTotalsMap(paymentGroups);
    const now = new Date();

    const subscriptionHistory = vehicle.subscriptions.map((subscription) =>
      buildSubscriptionHistoryItem(subscription, paymentTotalsMap, now)
    );

    const currentSubscriptionBase = pickCurrentSubscription(subscriptionHistory);

    const currentPaymentRows: PaymentRow[] = currentSubscriptionBase
      ? await prisma.payment.findMany({
          where: {
            subscriptionId: currentSubscriptionBase.id,
          },
          orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            status: true,
            method: true,
            amount: true,
            paidAt: true,
            reference: true,
            notes: true,
            shiftId: true,
            operator: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        })
      : [];

    const currentSubscription: CurrentSubscriptionDetail | null =
      currentSubscriptionBase
        ? {
            ...currentSubscriptionBase,
            payments: currentPaymentRows.map((payment) => ({
              id: payment.id,
              status: payment.status,
              method: payment.method,
              amount: payment.amount,
              paidAtIso: payment.paidAt.toISOString(),
              reference: payment.reference,
              notes: payment.notes,
              shiftId: payment.shiftId,
              operator: toUserSummary(payment.operator),
            })),
          }
        : null;

    const holder =
      currentSubscription?.customer ??
      toCustomerSummary(vehicle.customer) ??
      subscriptionHistory[0]?.customer ??
      null;

    const openSession = toSessionSummary(openSessionRow);
    const lastSession = toSessionSummary(lastSessionRow);

    return {
      ok: true,
      normalizedPlate,
      vehicle: {
        id: vehicle.id,
        plate: vehicle.plate,
        plateNormalized: vehicle.plateNormalized,
        type: vehicle.type,
        notes: vehicle.notes,
        createdAtIso: vehicle.createdAt.toISOString(),
        updatedAtIso: vehicle.updatedAt.toISOString(),
      },
      holder,
      currentSubscription,
      subscriptionHistory,
      location: {
        isInside: Boolean(openSessionRow),
        openSession,
        lastSession,
        lastEntryAtIso:
          openSession?.entryAtIso ?? lastSession?.entryAtIso ?? null,
        lastExitAtIso:
          toIso(lastClosedSessionRow?.exitAt) ?? lastSession?.exitAtIso ?? null,
      },
    };
  } catch (error) {
    console.error(
      "[getSubscriptionDetailAction] Error consultando detalle de mensualidad:",
      error
    );

    return {
      ok: false,
      code: "UNKNOWN_ERROR",
      message: "No fue posible consultar el detalle de la mensualidad.",
    };
  }
}