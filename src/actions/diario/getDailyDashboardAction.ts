"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";

import {
  PaymentStatus,
  PricingUnit,
  SessionStatus,
  VehicleType,
} from "@prisma/client";
import { unstable_noStore as noStore } from "next/cache";

const BOGOTA_UTC_OFFSET_HOURS = 5;

export type DailyDashboardSessionItem = {
  id: string;
  vehicleId: string;
  plate: string;
  plateNormalized: string;
  vehicleType: VehicleType;
  customerName: string | null;
  status: SessionStatus;
  pricingUnit: PricingUnit;
  isSubscription: boolean;
  entryAt: string;
  exitAt: string | null;
  durationMinutes: number;
  finalAmount: number;
  amountPaid: number;
};

export type DailyDashboardSummary = {
  entriesCount: number;
  exitsCount: number;
  insideCount: number;

  entriesSubscriptionsCount: number;
  entriesRegularCount: number;

  exitsSubscriptionsCount: number;
  exitsRegularCount: number;

  insideSubscriptionsCount: number;
  insideRegularCount: number;

  uniqueVehiclesCount: number;

  revenueSessions: number;
  revenueSubscriptions: number;
  revenueTotal: number;

  averageStayMinutesOfExitedSessions: number;
  oldestInsideMinutes: number | null;
};

export type DailyDashboardData = {
  date: string;
  isToday: boolean;
  isFutureDate: boolean;
  snapshotMode: "NOW" | "END_OF_DAY" | "FUTURE_EMPTY";
  generatedAt: string;
  snapshotAt: string | null;
  range: {
    startAt: string;
    endAt: string;
  };
  summary: DailyDashboardSummary;
  insideNow: DailyDashboardSessionItem[];
  entriesToday: DailyDashboardSessionItem[];
  exitsToday: DailyDashboardSessionItem[];
};

type GetDailyDashboardInput =
  | {
      date?: string;
    }
  | string
  | undefined;

function getTodayDateKeyInBogota(): string {
  const now = new Date();
  const bogotaNow = new Date(
    now.getTime() - BOGOTA_UTC_OFFSET_HOURS * 60 * 60 * 1000,
  );

  return bogotaNow.toISOString().slice(0, 10);
}

function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return false;
  }

  const testDate = new Date(Date.UTC(year, month - 1, day));
  const normalized = testDate.toISOString().slice(0, 10);

  return normalized === value;
}

function getBogotaDayRangeUtc(dateKey: string): { startUtc: Date; endUtc: Date } {
  const [year, month, day] = dateKey.split("-").map(Number);

  const startUtc = new Date(
    Date.UTC(year, month - 1, day, BOGOTA_UTC_OFFSET_HOURS, 0, 0, 0),
  );

  const endUtc = new Date(
    Date.UTC(year, month - 1, day + 1, BOGOTA_UTC_OFFSET_HOURS, 0, 0, 0),
  );

  return {
    startUtc,
    endUtc,
  };
}

function diffMinutes(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();

  if (ms <= 0) {
    return 0;
  }

  return Math.floor(ms / 60000);
}

function isSubscriptionSession(session: {
  pricingUnit: PricingUnit;
  subscriptionId: string | null;
}): boolean {
  return (
    session.pricingUnit === PricingUnit.SUBSCRIPTION ||
    session.subscriptionId !== null
  );
}

function getEmptySummary(): DailyDashboardSummary {
  return {
    entriesCount: 0,
    exitsCount: 0,
    insideCount: 0,

    entriesSubscriptionsCount: 0,
    entriesRegularCount: 0,

    exitsSubscriptionsCount: 0,
    exitsRegularCount: 0,

    insideSubscriptionsCount: 0,
    insideRegularCount: 0,

    uniqueVehiclesCount: 0,

    revenueSessions: 0,
    revenueSubscriptions: 0,
    revenueTotal: 0,

    averageStayMinutesOfExitedSessions: 0,
    oldestInsideMinutes: null,
  };
}

function serializeSession(
  session: {
    id: string;
    vehicleId: string;
    status: SessionStatus;
    pricingUnit: PricingUnit;
    subscriptionId: string | null;
    entryAt: Date;
    exitAt: Date | null;
    finalAmount: number;
    amountPaid: number;
    vehicle: {
      plate: string;
      plateNormalized: string;
      type: VehicleType;
      customer: {
        fullName: string;
      } | null;
    };
  },
  snapshotAt: Date,
): DailyDashboardSessionItem {
  const durationEnd = session.exitAt ?? snapshotAt;

  return {
    id: session.id,
    vehicleId: session.vehicleId,
    plate: session.vehicle.plate,
    plateNormalized: session.vehicle.plateNormalized,
    vehicleType: session.vehicle.type,
    customerName: session.vehicle.customer?.fullName ?? null,
    status: session.status,
    pricingUnit: session.pricingUnit,
    isSubscription: isSubscriptionSession(session),
    entryAt: session.entryAt.toISOString(),
    exitAt: session.exitAt?.toISOString() ?? null,
    durationMinutes: diffMinutes(session.entryAt, durationEnd),
    finalAmount: session.finalAmount,
    amountPaid: session.amountPaid,
  };
}

function resolveDateKey(input?: GetDailyDashboardInput): string {
  if (typeof input === "string") {
    return input;
  }

  if (typeof input?.date === "string" && input.date.trim().length > 0) {
    return input.date.trim();
  }

  return getTodayDateKeyInBogota();
}

export async function getDailyDashboardAction(
  input?: GetDailyDashboardInput,
): Promise<DailyDashboardData> {
  noStore();

  const session = await auth();

  if (!session?.user) {
    throw new Error("No autorizado.");
  }

  const requestedDate = resolveDateKey(input);

  if (!isValidDateKey(requestedDate)) {
    throw new Error("La fecha enviada no es válida.");
  }

  const todayDateKey = getTodayDateKeyInBogota();
  const isToday = requestedDate === todayDateKey;
  const isFutureDate = requestedDate > todayDateKey;

  const { startUtc, endUtc } = getBogotaDayRangeUtc(requestedDate);

  if (isFutureDate) {
    return {
      date: requestedDate,
      isToday: false,
      isFutureDate: true,
      snapshotMode: "FUTURE_EMPTY",
      generatedAt: new Date().toISOString(),
      snapshotAt: null,
      range: {
        startAt: startUtc.toISOString(),
        endAt: endUtc.toISOString(),
      },
      summary: getEmptySummary(),
      insideNow: [],
      entriesToday: [],
      exitsToday: [],
    };
  }

  const snapshotAt = isToday ? new Date() : endUtc;

  const [insideRaw, entriesRaw, exitsRaw, sessionPaymentsAgg, subscriptionPaymentsAgg] =
    await prisma.$transaction([
      prisma.parkingSession.findMany({
        where: {
          status: {
            not: SessionStatus.CANCELED,
          },
          entryAt: {
            lte: snapshotAt,
          },
          OR: [
            {
              exitAt: null,
            },
            {
              exitAt: {
                gt: snapshotAt,
              },
            },
          ],
        },
        orderBy: {
          entryAt: "asc",
        },
        select: {
          id: true,
          vehicleId: true,
          status: true,
          pricingUnit: true,
          subscriptionId: true,
          entryAt: true,
          exitAt: true,
          finalAmount: true,
          amountPaid: true,
          vehicle: {
            select: {
              plate: true,
              plateNormalized: true,
              type: true,
              customer: {
                select: {
                  fullName: true,
                },
              },
            },
          },
        },
      }),

      prisma.parkingSession.findMany({
        where: {
          status: {
            not: SessionStatus.CANCELED,
          },
          entryAt: {
            gte: startUtc,
            lt: endUtc,
          },
        },
        orderBy: {
          entryAt: "desc",
        },
        select: {
          id: true,
          vehicleId: true,
          status: true,
          pricingUnit: true,
          subscriptionId: true,
          entryAt: true,
          exitAt: true,
          finalAmount: true,
          amountPaid: true,
          vehicle: {
            select: {
              plate: true,
              plateNormalized: true,
              type: true,
              customer: {
                select: {
                  fullName: true,
                },
              },
            },
          },
        },
      }),

      prisma.parkingSession.findMany({
        where: {
          status: SessionStatus.OUT,
          exitAt: {
            gte: startUtc,
            lt: endUtc,
          },
        },
        orderBy: {
          exitAt: "desc",
        },
        select: {
          id: true,
          vehicleId: true,
          status: true,
          pricingUnit: true,
          subscriptionId: true,
          entryAt: true,
          exitAt: true,
          finalAmount: true,
          amountPaid: true,
          vehicle: {
            select: {
              plate: true,
              plateNormalized: true,
              type: true,
              customer: {
                select: {
                  fullName: true,
                },
              },
            },
          },
        },
      }),

      prisma.payment.aggregate({
        where: {
          status: PaymentStatus.COMPLETED,
          paidAt: {
            gte: startUtc,
            lt: endUtc,
          },
          sessionId: {
            not: null,
          },
          subscriptionId: null,
        },
        _sum: {
          amount: true,
        },
      }),

      prisma.payment.aggregate({
        where: {
          status: PaymentStatus.COMPLETED,
          paidAt: {
            gte: startUtc,
            lt: endUtc,
          },
          subscriptionId: {
            not: null,
          },
          sessionId: null,
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

  const insideNow = insideRaw.map((item) => serializeSession(item, snapshotAt));
  const entriesToday = entriesRaw.map((item) => serializeSession(item, snapshotAt));
  const exitsToday = exitsRaw.map((item) => serializeSession(item, snapshotAt));

  const insideSubscriptionsCount = insideNow.filter(
    (item) => item.isSubscription,
  ).length;
  const insideRegularCount = insideNow.length - insideSubscriptionsCount;

  const entriesSubscriptionsCount = entriesToday.filter(
    (item) => item.isSubscription,
  ).length;
  const entriesRegularCount = entriesToday.length - entriesSubscriptionsCount;

  const exitsSubscriptionsCount = exitsToday.filter(
    (item) => item.isSubscription,
  ).length;
  const exitsRegularCount = exitsToday.length - exitsSubscriptionsCount;

  const uniqueVehiclesCount = new Set(
    entriesToday.map((item) => item.vehicleId),
  ).size;

  const revenueSessions = sessionPaymentsAgg._sum.amount ?? 0;
  const revenueSubscriptions = subscriptionPaymentsAgg._sum.amount ?? 0;
  const revenueTotal = revenueSessions + revenueSubscriptions;

  const averageStayMinutesOfExitedSessions =
    exitsToday.length > 0
      ? Math.round(
          exitsToday.reduce((acc, item) => acc + item.durationMinutes, 0) /
            exitsToday.length,
        )
      : 0;

  const oldestInsideMinutes =
    insideNow.length > 0 ? insideNow[0].durationMinutes : null;

  return {
    date: requestedDate,
    isToday,
    isFutureDate: false,
    snapshotMode: isToday ? "NOW" : "END_OF_DAY",
    generatedAt: new Date().toISOString(),
    snapshotAt: snapshotAt.toISOString(),
    range: {
      startAt: startUtc.toISOString(),
      endAt: endUtc.toISOString(),
    },
    summary: {
      entriesCount: entriesToday.length,
      exitsCount: exitsToday.length,
      insideCount: insideNow.length,

      entriesSubscriptionsCount,
      entriesRegularCount,

      exitsSubscriptionsCount,
      exitsRegularCount,

      insideSubscriptionsCount,
      insideRegularCount,

      uniqueVehiclesCount,

      revenueSessions,
      revenueSubscriptions,
      revenueTotal,

      averageStayMinutesOfExitedSessions,
      oldestInsideMinutes,
    },
    insideNow,
    entriesToday,
    exitsToday,
  };
}