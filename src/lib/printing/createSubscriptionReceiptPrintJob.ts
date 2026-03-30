import { PrintJobType } from "@prisma/client";
import type {
  PaymentMethod,
  Prisma,
  PrismaClient,
  SubscriptionStatus,
  VehicleType,
} from "@prisma/client";

const BOGOTA_TIME_ZONE = "America/Bogota";
const LOCALE_ES_CO = "es-CO";

type DbClient = Prisma.TransactionClient | PrismaClient;

export type SubscriptionReceiptKind =
  | "SUBSCRIPTION_CREATED"
  | "SUBSCRIPTION_PAYMENT"
  | "SUBSCRIPTION_RENEWAL";

export type SubscriptionReceiptPayload = {
  version: 1;
  receiptType: "SUBSCRIPTION_RECEIPT";
  receiptKind: SubscriptionReceiptKind;

  stationId: string;
  issuedAtIso: string;
  timeZone: "America/Bogota";

  subscription: {
    id: string;
    status: SubscriptionStatus;
    startAtIso: string;
    endAtIso: string;
    amount: number;
  };

  vehicle: {
    id: string;
    plate: string;
    type: VehicleType;
  };

  customer: {
    id: string;
    fullName: string;
    document: string | null;
    phone: string | null;
  };

  payment: {
    id: string | null;
    amountReceived: number;
    paidAtIso: string | null;
    method: PaymentMethod | null;
    reference: string | null;
    notes: string | null;
  };

  totals: {
    subscriptionAmount: number;
    totalPaidBefore: number;
    totalPaidAfter: number;
    pendingAmount: number;
  };

  operator: {
    id: string | null;
    name: string | null;
  };

  shift: {
    id: string | null;
  };

  labels: {
    title: string;
    periodLabel: string;
    issuedAtLabel: string;
    paidAtLabel: string | null;
    amountLabel: string;
    receivedLabel: string;
    totalPaidAfterLabel: string;
    pendingAmountLabel: string;
  };

  flags: {
    hasPayment: boolean;
    hasPendingAmount: boolean;
  };
};

export type BuildSubscriptionReceiptPayloadInput = {
  stationId: string;
  receiptKind: SubscriptionReceiptKind;

  issuedAt?: Date;

  subscription: {
    id: string;
    status: SubscriptionStatus;
    startAt: Date;
    endAt: Date;
    amount: number;
  };

  vehicle: {
    id: string;
    plate: string;
    type: VehicleType;
  };

  customer: {
    id: string;
    fullName: string;
    document?: string | null;
    phone?: string | null;
  };

  payment?: {
    id?: string | null;
    amountReceived?: number;
    paidAt?: Date | null;
    method?: PaymentMethod | null;
    reference?: string | null;
    notes?: string | null;
  } | null;

  totals: {
    totalPaidBefore: number;
  };

  operator?: {
    id?: string | null;
    name?: string | null;
  } | null;

  shift?: {
    id?: string | null;
  } | null;
};

export type CreateSubscriptionReceiptPrintJobInput =
  BuildSubscriptionReceiptPayloadInput & {
    db: DbClient;
    createdById?: string | null;
    copies?: number;
    priority?: number;
    maxAttempts?: number;
  };

function requireTrimmedString(
  value: string | null | undefined,
  field: string,
  maxLength = 255
) {
  const normalized = (value ?? "").trim().slice(0, maxLength);

  if (!normalized) {
    throw new Error(`${field} es requerido.`);
  }

  return normalized;
}

function optionalTrimmedString(
  value: string | null | undefined,
  maxLength = 255
) {
  const normalized = (value ?? "").trim().slice(0, maxLength);
  return normalized || null;
}

function normalizeNonNegativeInt(value: number, field: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`${field} debe ser un número válido.`);
  }

  return Math.max(0, Math.trunc(value));
}

function clampCopies(value?: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(Math.trunc(value as number), 1), 5);
}

function clampPriority(value?: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.trunc(value as number), 0), 100);
}

function clampMaxAttempts(value?: number) {
  if (!Number.isFinite(value)) return 5;
  return Math.min(Math.max(Math.trunc(value as number), 1), 10);
}

function formatCurrencyCop(value: number) {
  return new Intl.NumberFormat(LOCALE_ES_CO, {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateBogota(date: Date) {
  return new Intl.DateTimeFormat(LOCALE_ES_CO, {
    timeZone: BOGOTA_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTimeBogota(date: Date) {
  return new Intl.DateTimeFormat(LOCALE_ES_CO, {
    timeZone: BOGOTA_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getReceiptTitle(receiptKind: SubscriptionReceiptKind) {
  switch (receiptKind) {
    case "SUBSCRIPTION_PAYMENT":
      return "RECIBO DE ABONO";
    case "SUBSCRIPTION_RENEWAL":
      return "RECIBO DE RENOVACIÓN";
    case "SUBSCRIPTION_CREATED":
    default:
      return "RECIBO DE MENSUALIDAD";
  }
}

function buildPeriodLabel(startAt: Date, endAt: Date) {
  return `${formatDateBogota(startAt)} - ${formatDateBogota(endAt)}`;
}

function computeTotals(params: {
  subscriptionAmount: number;
  totalPaidBefore: number;
  amountReceived: number;
}) {
  const totalPaidAfter = params.totalPaidBefore + params.amountReceived;
  const pendingAmount = Math.max(params.subscriptionAmount - totalPaidAfter, 0);

  return {
    subscriptionAmount: params.subscriptionAmount,
    totalPaidBefore: params.totalPaidBefore,
    totalPaidAfter,
    pendingAmount,
  };
}

export function buildSubscriptionReceiptPayload(
  input: BuildSubscriptionReceiptPayloadInput
): SubscriptionReceiptPayload {
  const stationId = requireTrimmedString(input.stationId, "stationId", 64);
  const issuedAt = input.issuedAt ?? new Date();

  const subscriptionAmount = normalizeNonNegativeInt(
    input.subscription.amount,
    "subscription.amount"
  );

  const totalPaidBefore = normalizeNonNegativeInt(
    input.totals.totalPaidBefore,
    "totals.totalPaidBefore"
  );

  const amountReceived = normalizeNonNegativeInt(
    input.payment?.amountReceived ?? 0,
    "payment.amountReceived"
  );

  const totals = computeTotals({
    subscriptionAmount,
    totalPaidBefore,
    amountReceived,
  });

  const paymentId = optionalTrimmedString(input.payment?.id, 64);
  const paidAt = input.payment?.paidAt ?? null;
  const hasPayment = Boolean(paymentId) || amountReceived > 0;

  return {
    version: 1,
    receiptType: "SUBSCRIPTION_RECEIPT",
    receiptKind: input.receiptKind,

    stationId,
    issuedAtIso: issuedAt.toISOString(),
    timeZone: BOGOTA_TIME_ZONE,

    subscription: {
      id: requireTrimmedString(input.subscription.id, "subscription.id", 64),
      status: input.subscription.status,
      startAtIso: input.subscription.startAt.toISOString(),
      endAtIso: input.subscription.endAt.toISOString(),
      amount: subscriptionAmount,
    },

    vehicle: {
      id: requireTrimmedString(input.vehicle.id, "vehicle.id", 64),
      plate: requireTrimmedString(input.vehicle.plate, "vehicle.plate", 20).toUpperCase(),
      type: input.vehicle.type,
    },

    customer: {
      id: requireTrimmedString(input.customer.id, "customer.id", 64),
      fullName: requireTrimmedString(input.customer.fullName, "customer.fullName", 160),
      document: optionalTrimmedString(input.customer.document, 60),
      phone: optionalTrimmedString(input.customer.phone, 40),
    },

    payment: {
      id: paymentId,
      amountReceived,
      paidAtIso: paidAt ? paidAt.toISOString() : null,
      method: input.payment?.method ?? null,
      reference: optionalTrimmedString(input.payment?.reference, 120),
      notes: optionalTrimmedString(input.payment?.notes, 500),
    },

    totals,

    operator: {
      id: optionalTrimmedString(input.operator?.id, 64),
      name: optionalTrimmedString(input.operator?.name, 120),
    },

    shift: {
      id: optionalTrimmedString(input.shift?.id, 64),
    },

    labels: {
      title: getReceiptTitle(input.receiptKind),
      periodLabel: buildPeriodLabel(
        input.subscription.startAt,
        input.subscription.endAt
      ),
      issuedAtLabel: formatDateTimeBogota(issuedAt),
      paidAtLabel: paidAt ? formatDateTimeBogota(paidAt) : null,
      amountLabel: formatCurrencyCop(totals.subscriptionAmount),
      receivedLabel: formatCurrencyCop(amountReceived),
      totalPaidAfterLabel: formatCurrencyCop(totals.totalPaidAfter),
      pendingAmountLabel: formatCurrencyCop(totals.pendingAmount),
    },

    flags: {
      hasPayment,
      hasPendingAmount: totals.pendingAmount > 0,
    },
  };
}

export async function createSubscriptionReceiptPrintJob(
  input: CreateSubscriptionReceiptPrintJobInput
) {
  const payload = buildSubscriptionReceiptPayload(input);

  const createdById =
    optionalTrimmedString(input.createdById, 64) ??
    optionalTrimmedString(input.operator?.id, 64);

  const job = await input.db.printJob.create({
    data: {
      type: PrintJobType.SUBSCRIPTION_RECEIPT,
      stationId: payload.stationId,
      subscriptionId: payload.subscription.id,
      paymentId: payload.payment.id,
      payload: payload as unknown as Prisma.InputJsonValue,
      copies: clampCopies(input.copies),
      priority: clampPriority(input.priority),
      maxAttempts: clampMaxAttempts(input.maxAttempts),
      createdById,
    },
    select: {
      id: true,
      type: true,
      status: true,
      stationId: true,
      subscriptionId: true,
      paymentId: true,
      copies: true,
      priority: true,
      maxAttempts: true,
      createdById: true,
      createdAt: true,
    },
  });

  return {
    job,
    payload,
  };
}