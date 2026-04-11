// src/actions/mensualidades/renewSubscriptionAction.ts
"use server";

import { revalidatePath } from "next/cache";
import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
} from "@prisma/client";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { createSubscriptionReceiptPrintJob } from "@/lib/printing/createSubscriptionReceiptPrintJob";

export type RenewSubscriptionField =
  | "currentSubscriptionId"
  | "startAt"
  | "endAt"
  | "amount"
  | "initialPaymentAmount"
  | "initialPaymentPaidAt"
  | "initialPaymentMethod"
  | "reference"
  | "notes";

export type RenewSubscriptionActionState = {
  ok: boolean;
  message?: string;
  errors?: Partial<Record<RenewSubscriptionField, string>>;
};

const INITIAL_STATE: RenewSubscriptionActionState = {
  ok: false,
  message: "",
  errors: {},
};

const DEFAULT_STATION_ID = "TUNJA-1";

function trimOrNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;

  const normalized = value.replace(/[^\d]/g, "");
  if (!normalized) return null;

  const parsed = Number(normalized);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function isValidPaymentMethod(value: string | null): value is PaymentMethod {
  if (!value) return false;

  return (
    value === PaymentMethod.CASH ||
    value === PaymentMethod.NEQUI ||
    value === PaymentMethod.TRANSFER ||
    value === PaymentMethod.OTHER
  );
}

function parsePaymentMethod(value: string | null): PaymentMethod | null {
  return isValidPaymentMethod(value) ? value : null;
}

/**
 * Convierte un datetime-local interpretado como hora de Bogotá
 * a un Date UTC real para persistencia.
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

  // Bogotá = UTC-5 sin DST.
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

function normalizeOptionalText(
  value: string | null,
  options?: { maxLength?: number }
): string | null {
  if (!value) return null;

  const normalized = value.trim();
  if (!normalized) return null;

  if (options?.maxLength && normalized.length > options.maxLength) {
    return normalized.slice(0, options.maxLength);
  }

  return normalized;
}

function normalizeStationId(value: string | null): string {
  const normalized = value?.trim().slice(0, 64);
  return normalized || DEFAULT_STATION_ID;
}

function parseReceiptBoolean(
  value: FormDataEntryValue | null,
  defaultValue: boolean
): boolean {
  if (typeof value !== "string") return defaultValue;

  const normalized = value.trim().toLowerCase();

  if (!normalized) return defaultValue;

  if (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "on" ||
    normalized === "yes" ||
    normalized === "si" ||
    normalized === "sí"
  ) {
    return true;
  }

  if (
    normalized === "false" ||
    normalized === "0" ||
    normalized === "off" ||
    normalized === "no"
  ) {
    return false;
  }

  return defaultValue;
}

function formatCurrencyCop(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildErrorState(
  message: string,
  errors?: Partial<Record<RenewSubscriptionField, string>>
): RenewSubscriptionActionState {
  return {
    ok: false,
    message,
    errors: errors ?? {},
  };
}

export async function renewSubscriptionAction(
  _prevState: RenewSubscriptionActionState = INITIAL_STATE,
  formData: FormData
): Promise<RenewSubscriptionActionState> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return buildErrorState(
        "Debes iniciar sesión para actualizar la mensualidad."
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        isActive: true,
        name: true,
      },
    });

    if (!user) {
      return buildErrorState("No se encontró el usuario autenticado.");
    }

    if (!user.isActive) {
      return buildErrorState(
        "Tu usuario está inactivo. No puedes actualizar mensualidades."
      );
    }

    const currentSubscriptionId = trimOrNull(
      formData.get("currentSubscriptionId")
    );
    const startAtRaw = trimOrNull(formData.get("startAt"));
    const endAtRaw = trimOrNull(formData.get("endAt"));
    const amountRaw = trimOrNull(formData.get("amount"));

    const initialPaymentAmountRaw = trimOrNull(
      formData.get("initialPaymentAmount")
    );
    const initialPaymentPaidAtRaw = trimOrNull(
      formData.get("initialPaymentPaidAt")
    );
    const initialPaymentMethodRaw = trimOrNull(
      formData.get("initialPaymentMethod")
    );

    const referenceRaw = trimOrNull(formData.get("reference"));
    const notesRaw = trimOrNull(formData.get("notes"));
    const stationId = normalizeStationId(trimOrNull(formData.get("stationId")));

    const parsedInitialPaymentAmount = parsePositiveInt(initialPaymentAmountRaw);
    const initialPaymentAmount = parsedInitialPaymentAmount ?? 0;

    const shouldPrintReceipt = parseReceiptBoolean(
      formData.get("printReceipt"),
      initialPaymentAmount > 0
    );

    const errors: Partial<Record<RenewSubscriptionField, string>> = {};

    if (!currentSubscriptionId) {
      errors.currentSubscriptionId = "No se recibió la mensualidad base.";
    }

    const startAt = parseBogotaDateTimeLocal(startAtRaw);
    if (!startAt) {
      errors.startAt = "La fecha inicial no es válida.";
    }

    const endAt = parseBogotaDateTimeLocal(endAtRaw);
    if (!endAt) {
      errors.endAt = "La fecha final no es válida.";
    }

    const requestedAmount = parsePositiveInt(amountRaw);
    if (!requestedAmount) {
      errors.amount = "Ingresa un valor válido mayor a 0.";
    }

    if (initialPaymentAmountRaw && initialPaymentAmount <= 0) {
      errors.initialPaymentAmount = "El abono no es válido.";
    }

    const initialPaymentMethod = initialPaymentAmount
      ? parsePaymentMethod(initialPaymentMethodRaw)
      : null;

    if (initialPaymentAmount > 0 && !initialPaymentMethod) {
      errors.initialPaymentMethod = "Selecciona un método de pago válido.";
    }

    const initialPaymentPaidAt =
      initialPaymentAmount > 0
        ? parseBogotaDateTimeLocal(initialPaymentPaidAtRaw)
        : null;

    if (initialPaymentAmount > 0 && !initialPaymentPaidAt) {
      errors.initialPaymentPaidAt = "La fecha y hora del abono no es válida.";
    }

    const reference = normalizeOptionalText(referenceRaw, { maxLength: 120 });
    const notes = normalizeOptionalText(notesRaw, { maxLength: 1000 });

    if (referenceRaw && !reference) {
      errors.reference = "La referencia no es válida.";
    }

    if (notesRaw && !notes && notesRaw.trim().length > 0) {
      errors.notes = "La nota no es válida.";
    }

    if (startAt && endAt && endAt.getTime() <= startAt.getTime()) {
      errors.endAt = "La fecha final debe ser mayor que la fecha inicial.";
    }

    if (Object.keys(errors).length > 0) {
      return buildErrorState("Revisa los campos del formulario.", errors);
    }

    const currentShift = await prisma.shift.findFirst({
      where: {
        operatorId: user.id,
        endedAt: null,
      },
      orderBy: {
        startedAt: "desc",
      },
      select: {
        id: true,
      },
    });

    const transactionResult = await prisma.$transaction(
      async (tx) => {
        const baseSubscription = await tx.subscription.findUnique({
          where: {
            id: currentSubscriptionId!,
          },
          select: {
            id: true,
            vehicleId: true,
            customerId: true,
            amount: true,
            status: true,
            startAt: true,
            endAt: true,
            notes: true,
            vehicle: {
              select: {
                id: true,
                plate: true,
                plateNormalized: true,
                type: true,
              },
            },
            customer: {
              select: {
                id: true,
                fullName: true,
                document: true,
                phone: true,
              },
            },
          },
        });

        if (!baseSubscription) {
          return {
            ok: false as const,
            message: "La mensualidad no existe o ya no está disponible.",
            errors: {
              currentSubscriptionId: "No se encontró la mensualidad base.",
            },
          };
        }

        if (baseSubscription.status === SubscriptionStatus.CANCELED) {
          return {
            ok: false as const,
            message: "No puedes ajustar una mensualidad cancelada.",
            errors: {
              currentSubscriptionId: "La mensualidad está cancelada.",
            },
          };
        }

        const overlappingSubscription = await tx.subscription.findFirst({
          where: {
            vehicleId: baseSubscription.vehicleId,
            id: {
              not: baseSubscription.id,
            },
            status: {
              not: SubscriptionStatus.CANCELED,
            },
            startAt: {
              lt: endAt!,
            },
            endAt: {
              gt: startAt!,
            },
          },
          select: {
            id: true,
          },
        });

        if (overlappingSubscription) {
          return {
            ok: false as const,
            message: "El periodo se cruza con otra mensualidad existente.",
            errors: {
              startAt: "Existe un cruce con otra mensualidad.",
              endAt: "Existe un cruce con otra mensualidad.",
            },
          };
        }

        const paymentAggregate = await tx.payment.aggregate({
          where: {
            subscriptionId: baseSubscription.id,
            status: PaymentStatus.COMPLETED,
          },
          _sum: {
            amount: true,
          },
        });

        const totalPaidBefore = paymentAggregate._sum.amount ?? 0;

        const effectiveAmount = Math.max(
          requestedAmount!,
          totalPaidBefore + initialPaymentAmount
        );

        const updatedSubscription = await tx.subscription.update({
          where: {
            id: baseSubscription.id,
          },
          data: {
            startAt: startAt!,
            endAt: endAt!,
            amount: effectiveAmount,
            notes: notes ?? null,
            status: SubscriptionStatus.ACTIVE,
          },
          select: {
            id: true,
            amount: true,
            status: true,
            startAt: true,
            endAt: true,
            notes: true,
          },
        });

        let payment:
          | {
              id: string;
              amount: number;
              paidAt: Date;
              method: PaymentMethod;
              reference: string | null;
              notes: string | null;
            }
          | null = null;

        if (
          initialPaymentAmount > 0 &&
          initialPaymentMethod &&
          initialPaymentPaidAt
        ) {
          payment = await tx.payment.create({
            data: {
              status: PaymentStatus.COMPLETED,
              method: initialPaymentMethod,
              amount: initialPaymentAmount,
              paidAt: initialPaymentPaidAt,
              subscriptionId: updatedSubscription.id,
              operatorId: user.id,
              shiftId: currentShift?.id ?? null,
              reference: reference ?? null,
              notes: null,
            },
            select: {
              id: true,
              amount: true,
              paidAt: true,
              method: true,
              reference: true,
              notes: true,
            },
          });
        }

        const totalPaidAfter = totalPaidBefore + (payment?.amount ?? 0);
        const pendingAmount = Math.max(
          updatedSubscription.amount - totalPaidAfter,
          0
        );

        let printJobId: string | null = null;

        if (shouldPrintReceipt) {
          const receiptJob = await createSubscriptionReceiptPrintJob({
            db: tx,
            stationId,
            receiptKind: "SUBSCRIPTION_RENEWAL",
            createdById: user.id,
            copies: 1,
            priority: 10,
            subscription: {
              id: updatedSubscription.id,
              status: updatedSubscription.status,
              startAt: updatedSubscription.startAt,
              endAt: updatedSubscription.endAt,
              amount: updatedSubscription.amount,
            },
            vehicle: {
              id: baseSubscription.vehicle.id,
              plate: baseSubscription.vehicle.plate,
              type: baseSubscription.vehicle.type,
            },
            customer: {
              id: baseSubscription.customer.id,
              fullName: baseSubscription.customer.fullName,
              document: baseSubscription.customer.document,
              phone: baseSubscription.customer.phone,
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
              totalPaidBefore,
            },
            operator: {
              id: user.id,
              name: user.name ?? null,
            },
            shift: {
              id: currentShift?.id ?? null,
            },
          });

          printJobId = receiptJob.job.id;
        }

        return {
          ok: true as const,
          subscriptionId: updatedSubscription.id,
          paymentId: payment?.id ?? null,
          printJobId,
          receiptQueued: shouldPrintReceipt,
          vehiclePlate: baseSubscription.vehicle.plate,
          vehiclePlateNormalized: baseSubscription.vehicle.plateNormalized,
          customerName: baseSubscription.customer.fullName,
          requestedAmount: requestedAmount!,
          effectiveAmount: updatedSubscription.amount,
          totalPaidBefore,
          totalPaidAfter,
          pendingAmount,
          hadNewPayment: Boolean(payment),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    if (!transactionResult.ok) {
      return {
        ok: false,
        message: transactionResult.message,
        errors: transactionResult.errors,
      };
    }

    revalidatePath("/mensualidades");
    revalidatePath(`/mensualidades/${transactionResult.vehiclePlate}`);
    revalidatePath(`/mensualidades/${transactionResult.vehiclePlateNormalized}`);

    const amountAdjustedMessage =
      transactionResult.effectiveAmount > transactionResult.requestedAmount
        ? ` El valor de la mensualidad se ajustó automáticamente a ${formatCurrencyCop(
            transactionResult.effectiveAmount
          )} para conservar el historial de pagos.`
        : "";

    const balanceMessage =
      transactionResult.totalPaidAfter > 0
        ? transactionResult.pendingAmount > 0
          ? `Mensualidad actualizada correctamente. Saldo pendiente: ${formatCurrencyCop(
              transactionResult.pendingAmount
            )}.`
          : "Mensualidad actualizada correctamente y quedó pagada en su totalidad."
        : "Mensualidad actualizada correctamente.";

    const receiptMessage = transactionResult.receiptQueued
      ? " Recibo enviado a impresión."
      : "";

    return {
      ok: true,
      message: `${balanceMessage}${amountAdjustedMessage}${receiptMessage}`,
      errors: {},
    };
  } catch (error) {
    console.error(
      "[renewSubscriptionAction] Error ajustando mensualidad:",
      error
    );

    if (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientUnknownRequestError ||
      error instanceof Prisma.PrismaClientValidationError
    ) {
      return buildErrorState(
        "No fue posible actualizar la mensualidad por un problema de base de datos."
      );
    }

    return buildErrorState(
      "No fue posible actualizar la mensualidad en este momento."
    );
  }
}