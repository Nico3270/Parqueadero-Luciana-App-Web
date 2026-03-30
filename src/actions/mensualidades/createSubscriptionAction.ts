// src/actions/mensualidades/createSubscriptionAction.ts
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { createSubscriptionReceiptPrintJob } from "@/lib/printing/createSubscriptionReceiptPrintJob";
import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
  VehicleType,
} from "@prisma/client";

const DEFAULT_STATION_ID = "TUNJA-1";

export type CreateSubscriptionInput = {
  fullName: string;
  document?: string;
  phone?: string;
  phoneSecondary?: string;
  plate: string;
  type: VehicleType;
  amount: number;
  startAtIso: string;
  endAtIso?: string;
  notes?: string;

  initialPaidAmount?: number;
  initialPaymentMethod?: PaymentMethod;
  initialPaymentReference?: string;
  initialPaymentNotes?: string;

  shiftId?: string;
  stationId?: string;
  printReceipt?: boolean;
};

export type CreateSubscriptionSuccess = {
  ok: true;
  message: string;
  receiptQueued: boolean;
  printJobId: string | null;
  subscription: {
    id: string;
    status: SubscriptionStatus;
    startAtIso: string;
    endAtIso: string;
    amount: number;
    paidAmount: number;
    pendingAmount: number;
    isFullyPaid: boolean;
    notes: string | null;
  };
  customer: {
    id: string;
    fullName: string;
    document: string | null;
    phone: string | null;
    phoneSecondary: string | null;
  };
  vehicle: {
    id: string;
    plate: string;
    plateNormalized: string;
    type: VehicleType;
  };
  payment: {
    id: string;
    amount: number;
    method: PaymentMethod;
    reference: string | null;
    paidAtIso: string;
  } | null;
};

export type CreateSubscriptionError = {
  ok: false;
  code:
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "INACTIVE_USER"
    | "VALIDATION_ERROR"
    | "CONFLICT"
    | "NOT_FOUND"
    | "UNKNOWN_ERROR";
  message: string;
  field?:
    | "fullName"
    | "document"
    | "phone"
    | "phoneSecondary"
    | "plate"
    | "type"
    | "amount"
    | "startAtIso"
    | "endAtIso"
    | "notes"
    | "initialPaidAmount"
    | "initialPaymentMethod"
    | "shiftId";
};

export type CreateSubscriptionResult =
  | CreateSubscriptionSuccess
  | CreateSubscriptionError;

function sanitizeOptionalText(
  value: string | undefined | null,
  maxLength = 500
): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  return trimmed.slice(0, maxLength);
}

function normalizePlateForStorage(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

function normalizePlateForLookup(value: string) {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Z0-9]/g, "");
}

function isValidVehicleType(value: unknown): value is VehicleType {
  return (
    value === "CAR" ||
    value === "MOTO" ||
    value === "TRUCK" ||
    value === "BUS" ||
    value === "TRACTOMULA" ||
    value === "OTHER"
  );
}

function isValidPaymentMethod(value: unknown): value is PaymentMethod {
  return (
    value === "CASH" ||
    value === "NEQUI" ||
    value === "TRANSFER" ||
    value === "OTHER"
  );
}

/**
 * Convierte un datetime-local interpretado como hora de Bogotá
 * a un Date UTC real para persistencia.
 *
 * Ejemplo:
 * 2026-03-29T14:30 -> Date UTC equivalente a 2026-03-29 14:30 en Bogotá
 */
function parseBogotaDateTimeLocal(value: string | null): Date | null {
  if (!value) return null;

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;

  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const hourNumber = Number(hour);
  const minuteNumber = Number(minute);
  const secondNumber = Number(second ?? "0");

  if (
    !Number.isInteger(yearNumber) ||
    !Number.isInteger(monthNumber) ||
    !Number.isInteger(dayNumber) ||
    !Number.isInteger(hourNumber) ||
    !Number.isInteger(minuteNumber) ||
    !Number.isInteger(secondNumber)
  ) {
    return null;
  }

  if (
    monthNumber < 1 ||
    monthNumber > 12 ||
    dayNumber < 1 ||
    dayNumber > 31 ||
    hourNumber < 0 ||
    hourNumber > 23 ||
    minuteNumber < 0 ||
    minuteNumber > 59 ||
    secondNumber < 0 ||
    secondNumber > 59
  ) {
    return null;
  }

  // Bogotá = UTC-5 sin DST
  const utcMillis = Date.UTC(
    yearNumber,
    monthNumber - 1,
    dayNumber,
    hourNumber + 5,
    minuteNumber,
    secondNumber
  );

  const date = new Date(utcMillis);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

/**
 * Convierte un date-only interpretado como inicio del día en Bogotá
 * a un Date UTC real para persistencia.
 *
 * Ejemplo:
 * 2026-03-29 -> 2026-03-29 00:00 Bogotá
 */
function parseBogotaDateOnly(value: string | null): Date | null {
  if (!value) return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const [, year, month, day] = match;

  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);

  if (
    !Number.isInteger(yearNumber) ||
    !Number.isInteger(monthNumber) ||
    !Number.isInteger(dayNumber)
  ) {
    return null;
  }

  if (
    monthNumber < 1 ||
    monthNumber > 12 ||
    dayNumber < 1 ||
    dayNumber > 31
  ) {
    return null;
  }

  // 00:00 Bogotá = 05:00 UTC
  const utcMillis = Date.UTC(yearNumber, monthNumber - 1, dayNumber, 5, 0, 0);

  const date = new Date(utcMillis);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

/**
 * Soporta:
 * - datetime-local sin zona: se interpreta como hora de Bogotá
 * - date-only: se interpreta como 00:00 Bogotá
 * - ISO completo con zona: se respeta tal cual venga
 */
function parseDateInput(value: string | null | undefined): Date | null {
  if (!value || typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const fromBogotaDateTime = parseBogotaDateTimeLocal(trimmed);
  if (fromBogotaDateTime) return fromBogotaDateTime;

  const fromBogotaDateOnly = parseBogotaDateOnly(trimmed);
  if (fromBogotaDateOnly) return fromBogotaDateOnly;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function addOneMonthClamped(date: Date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const targetMonth = month + 1;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedTargetMonth = ((targetMonth % 12) + 12) % 12;

  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, normalizedTargetMonth + 1, 0)
  ).getUTCDate();

  const clampedDay = Math.min(day, lastDayOfTargetMonth);

  return new Date(
    Date.UTC(
      targetYear,
      normalizedTargetMonth,
      clampedDay,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds()
    )
  );
}

function normalizeStationId(value: string | undefined | null) {
  const normalized = (value ?? "").trim().slice(0, 64);
  return normalized || DEFAULT_STATION_ID;
}

export async function createSubscriptionAction(
  input: CreateSubscriptionInput
): Promise<CreateSubscriptionResult> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return {
        ok: false,
        code: "UNAUTHORIZED",
        message: "Debes iniciar sesión para crear una mensualidad.",
      };
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        isActive: true,
        name: true,
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
        message: "Tu usuario está inactivo y no puede crear mensualidades.",
      };
    }

    if (currentUser.role !== "ADMIN" && currentUser.role !== "OPERATOR") {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "No tienes permisos para crear mensualidades.",
      };
    }

    const fullName = sanitizeOptionalText(input.fullName, 160);
    const document = sanitizeOptionalText(input.document, 50);
    const phone = sanitizeOptionalText(input.phone, 50);
    const phoneSecondary = sanitizeOptionalText(input.phoneSecondary, 50);
    const notes = sanitizeOptionalText(input.notes, 2000);

    const plate = normalizePlateForStorage(input.plate ?? "");
    const plateNormalized = normalizePlateForLookup(input.plate ?? "");

    const type = input.type;
    const amount = Number(input.amount);

    const startAt = parseDateInput(input.startAtIso);
    const endAt = input.endAtIso
      ? parseDateInput(input.endAtIso)
      : startAt
        ? addOneMonthClamped(startAt)
        : null;

    const initialPaidAmountRaw =
      input.initialPaidAmount === undefined || input.initialPaidAmount === null
        ? 0
        : Number(input.initialPaidAmount);

    const initialPaymentMethod =
      input.initialPaymentMethod ?? PaymentMethod.CASH;

    const initialPaymentReference = sanitizeOptionalText(
      input.initialPaymentReference,
      120
    );

    const initialPaymentNotes = sanitizeOptionalText(
      input.initialPaymentNotes,
      500
    );

    const shiftId = sanitizeOptionalText(input.shiftId, 50);
    const stationId = normalizeStationId(input.stationId);
    const shouldPrintReceipt =
      typeof input.printReceipt === "boolean"
        ? input.printReceipt
        : initialPaidAmountRaw > 0;

    if (!fullName || fullName.length < 3) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        field: "fullName",
        message: "Debes ingresar el nombre completo del titular.",
      };
    }

    if (
      !plateNormalized ||
      plateNormalized.length < 4 ||
      plateNormalized.length > 12
    ) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        field: "plate",
        message: "Debes ingresar una placa válida.",
      };
    }

    if (!isValidVehicleType(type)) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        field: "type",
        message: "Debes seleccionar un tipo de vehículo válido.",
      };
    }

    if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        field: "amount",
        message: "El valor pactado debe ser un número entero mayor a cero.",
      };
    }

    if (!startAt) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        field: "startAtIso",
        message: "Debes ingresar una fecha inicial válida.",
      };
    }

    if (!endAt) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        field: "endAtIso",
        message: "Debes ingresar una fecha final válida.",
      };
    }

    if (endAt.getTime() <= startAt.getTime()) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        field: "endAtIso",
        message: "La fecha final debe ser posterior a la fecha inicial.",
      };
    }

    if (
      !Number.isFinite(initialPaidAmountRaw) ||
      !Number.isInteger(initialPaidAmountRaw) ||
      initialPaidAmountRaw < 0
    ) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        field: "initialPaidAmount",
        message:
          "El abono inicial debe ser un número entero igual o mayor a cero.",
      };
    }

    if (initialPaidAmountRaw > amount) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        field: "initialPaidAmount",
        message: "El abono inicial no puede ser mayor al valor pactado.",
      };
    }

    if (
      initialPaidAmountRaw > 0 &&
      !isValidPaymentMethod(initialPaymentMethod)
    ) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        field: "initialPaymentMethod",
        message: "Debes seleccionar un método de pago válido.",
      };
    }

    if (shiftId) {
      const shiftExists = await prisma.shift.findUnique({
        where: { id: shiftId },
        select: { id: true },
      });

      if (!shiftExists) {
        return {
          ok: false,
          code: "NOT_FOUND",
          field: "shiftId",
          message: "El turno seleccionado no existe.",
        };
      }
    }

    const currentShift = shiftId
      ? { id: shiftId }
      : await prisma.shift.findFirst({
          where: {
            operatorId: currentUser.id,
            endedAt: null,
          },
          orderBy: {
            startedAt: "desc",
          },
          select: {
            id: true,
          },
        });

    const result = await prisma.$transaction(
      async (tx) => {
        const existingVehicle = await tx.vehicle.findUnique({
          where: {
            plateNormalized_type: {
              plateNormalized,
              type,
            },
          },
          include: {
            customer: true,
          },
        });

        const overlappingSubscription = existingVehicle
          ? await tx.subscription.findFirst({
              where: {
                vehicleId: existingVehicle.id,
                status: {
                  in: [
                    SubscriptionStatus.ACTIVE,
                    SubscriptionStatus.SUSPENDED,
                  ],
                },
                startAt: {
                  lt: endAt,
                },
                endAt: {
                  gt: startAt,
                },
              },
              select: {
                id: true,
              },
            })
          : null;

        if (overlappingSubscription) {
          return {
            ok: false as const,
            code: "CONFLICT" as const,
            field: "plate" as const,
            message:
              "Ese vehículo ya tiene una mensualidad activa o suspendida que se cruza con ese periodo.",
          };
        }

        let customer =
          existingVehicle?.customer ??
          (document
            ? await tx.customer.findFirst({
                where: { document },
              })
            : null) ??
          (phone
            ? await tx.customer.findFirst({
                where: { phone },
              })
            : null);

        if (customer) {
          customer = await tx.customer.update({
            where: { id: customer.id },
            data: {
              fullName,
              document,
              phone,
              phoneSecondary,
              notes,
            },
          });
        } else {
          customer = await tx.customer.create({
            data: {
              fullName,
              document,
              phone,
              phoneSecondary,
              notes,
            },
          });
        }

        const vehicle = existingVehicle
          ? await tx.vehicle.update({
              where: { id: existingVehicle.id },
              data: {
                plate,
                plateNormalized,
                type,
                customerId: customer.id,
              },
            })
          : await tx.vehicle.create({
              data: {
                plate,
                plateNormalized,
                type,
                customerId: customer.id,
              },
            });

        const subscription = await tx.subscription.create({
          data: {
            customerId: customer.id,
            vehicleId: vehicle.id,
            startAt,
            endAt,
            amount,
            status: SubscriptionStatus.ACTIVE,
            notes,
          },
        });

        let payment:
          | {
              id: string;
              amount: number;
              method: PaymentMethod;
              reference: string | null;
              notes: string | null;
              paidAt: Date;
            }
          | null = null;

        if (initialPaidAmountRaw > 0) {
          payment = await tx.payment.create({
            data: {
              status: PaymentStatus.COMPLETED,
              method: initialPaymentMethod,
              amount: initialPaidAmountRaw,
              subscriptionId: subscription.id,
              operatorId: currentUser.id,
              shiftId: currentShift?.id ?? null,
              reference: initialPaymentReference,
              notes: initialPaymentNotes,
            },
            select: {
              id: true,
              amount: true,
              method: true,
              reference: true,
              notes: true,
              paidAt: true,
            },
          });
        }

        let printJobId: string | null = null;

        if (shouldPrintReceipt) {
          const receiptJob = await createSubscriptionReceiptPrintJob({
            db: tx,
            stationId,
            receiptKind: "SUBSCRIPTION_CREATED",
            createdById: currentUser.id,
            copies: 1,
            priority: 10,
            subscription: {
              id: subscription.id,
              status: subscription.status,
              startAt: subscription.startAt,
              endAt: subscription.endAt,
              amount: subscription.amount,
            },
            vehicle: {
              id: vehicle.id,
              plate: vehicle.plate,
              type: vehicle.type,
            },
            customer: {
              id: customer.id,
              fullName: customer.fullName,
              document: customer.document,
              phone: customer.phone,
            },
            payment: payment
              ? {
                  id: payment.id,
                  amountReceived: payment.amount,
                  paidAt: payment.paidAt,
                  method: payment.method,
                  reference: payment.reference,
                  notes: payment.notes,
                }
              : null,
            totals: {
              totalPaidBefore: 0,
            },
            operator: {
              id: currentUser.id,
              name: currentUser.name ?? null,
            },
            shift: {
              id: currentShift?.id ?? null,
            },
          });

          printJobId = receiptJob.job.id;
        }

        const paidAmount = payment?.amount ?? 0;
        const pendingAmount = Math.max(subscription.amount - paidAmount, 0);

        return {
          ok: true as const,
          message:
            payment && payment.amount > 0
              ? "Mensualidad creada y abono inicial registrado correctamente."
              : "Mensualidad creada correctamente.",
          receiptQueued: shouldPrintReceipt,
          printJobId,
          subscription: {
            id: subscription.id,
            status: subscription.status,
            startAtIso: subscription.startAt.toISOString(),
            endAtIso: subscription.endAt.toISOString(),
            amount: subscription.amount,
            paidAmount,
            pendingAmount,
            isFullyPaid: pendingAmount <= 0,
            notes: subscription.notes,
          },
          customer: {
            id: customer.id,
            fullName: customer.fullName,
            document: customer.document,
            phone: customer.phone,
            phoneSecondary: customer.phoneSecondary,
          },
          vehicle: {
            id: vehicle.id,
            plate: vehicle.plate,
            plateNormalized: vehicle.plateNormalized,
            type: vehicle.type,
          },
          payment: payment
            ? {
                id: payment.id,
                amount: payment.amount,
                method: payment.method,
                reference: payment.reference,
                paidAtIso: payment.paidAt.toISOString(),
              }
            : null,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    if (!result.ok) {
      return result;
    }

    revalidatePath("/mensualidades");
    revalidatePath(`/mensualidades/${result.vehicle.plate}`);
    revalidatePath(`/mensualidades/${result.vehicle.plateNormalized}`);

    return {
      ...result,
      message: result.receiptQueued
        ? `${result.message} Recibo enviado a impresión.`
        : result.message,
    };
  } catch (error) {
    console.error(
      "[mensualidades/createSubscriptionAction] Error creando mensualidad:",
      error
    );

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return {
          ok: false,
          code: "CONFLICT",
          message:
            "Ya existe un registro que entra en conflicto con los datos enviados.",
        };
      }
    }

    return {
      ok: false,
      code: "UNKNOWN_ERROR",
      message:
        "No fue posible crear la mensualidad en este momento. Intenta nuevamente.",
    };
  }
}