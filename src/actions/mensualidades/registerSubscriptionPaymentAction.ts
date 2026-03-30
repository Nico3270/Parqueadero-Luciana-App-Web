// src/actions/mensualidades/registerSubscriptionPaymentAction.ts
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

export type RegisterPaymentField =
  | "subscriptionId"
  | "amount"
  | "paidAt"
  | "method"
  | "reference"
  | "notes";

export type RegisterSubscriptionPaymentActionState = {
  ok: boolean;
  message?: string;
  errors?: Partial<Record<RegisterPaymentField, string>>;
};

const INITIAL_STATE: RegisterSubscriptionPaymentActionState = {
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

/**
 * Convierte un datetime-local que representa hora de Bogotá
 * a un Date UTC real para guardar correctamente en DB.
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
  defaultValue = true
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
  errors?: Partial<Record<RegisterPaymentField, string>>
): RegisterSubscriptionPaymentActionState {
  return {
    ok: false,
    message,
    errors: errors ?? {},
  };
}

export async function registerSubscriptionPaymentAction(
  _prevState: RegisterSubscriptionPaymentActionState = INITIAL_STATE,
  formData: FormData
): Promise<RegisterSubscriptionPaymentActionState> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return buildErrorState("Debes iniciar sesión para registrar abonos.");
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
        "Tu usuario está inactivo. No puedes registrar abonos."
      );
    }

    const subscriptionId = trimOrNull(formData.get("subscriptionId"));
    const amountRaw = trimOrNull(formData.get("amount"));
    const paidAtRaw = trimOrNull(formData.get("paidAt"));
    const methodRaw = trimOrNull(formData.get("method"));
    const referenceRaw = trimOrNull(formData.get("reference"));
    const notesRaw = trimOrNull(formData.get("notes"));
    const stationId = normalizeStationId(trimOrNull(formData.get("stationId")));
    const shouldPrintReceipt = parseReceiptBoolean(
      formData.get("printReceipt"),
      true
    );

    const errors: Partial<Record<RegisterPaymentField, string>> = {};

    if (!subscriptionId) {
      errors.subscriptionId = "No se recibió la mensualidad a pagar.";
    }

    const amount = parsePositiveInt(amountRaw);
    if (!amount) {
      errors.amount = "Ingresa un valor válido mayor a 0.";
    }

    const paidAt = parseBogotaDateTimeLocal(paidAtRaw);
    if (!paidAt) {
      errors.paidAt = "La fecha y hora del pago no es válida.";
    }

    const method = parsePaymentMethod(methodRaw);
    if (!method) {
      errors.method = "Selecciona un método de pago válido.";
    }

    const reference = normalizeOptionalText(referenceRaw, { maxLength: 120 });
    const notes = normalizeOptionalText(notesRaw, { maxLength: 500 });

    if (referenceRaw && !reference) {
      errors.reference = "La referencia no es válida.";
    }

    if (notesRaw && !notes && notesRaw.trim().length > 0) {
      errors.notes = "La nota no es válida.";
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
        const subscription = await tx.subscription.findUnique({
          where: {
            id: subscriptionId!,
          },
          select: {
            id: true,
            amount: true,
            status: true,
            startAt: true,
            endAt: true,
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

        if (!subscription) {
          return {
            ok: false as const,
            message: "La mensualidad no existe o ya no está disponible.",
            errors: {
              subscriptionId: "No se encontró la mensualidad seleccionada.",
            },
          };
        }

        if (subscription.status === SubscriptionStatus.CANCELED) {
          return {
            ok: false as const,
            message: "No puedes registrar pagos sobre una mensualidad cancelada.",
            errors: {
              subscriptionId: "La mensualidad está cancelada.",
            },
          };
        }

        const paymentAggregate = await tx.payment.aggregate({
          where: {
            subscriptionId: subscription.id,
            status: PaymentStatus.COMPLETED,
          },
          _sum: {
            amount: true,
          },
        });

        const totalPaid = paymentAggregate._sum.amount ?? 0;
        const pendingAmount = Math.max(subscription.amount - totalPaid, 0);

        if (pendingAmount <= 0) {
          return {
            ok: false as const,
            message: "Esta mensualidad ya no tiene saldo pendiente.",
            errors: {
              amount: "La mensualidad ya está al día.",
            },
          };
        }

        if ((amount ?? 0) > pendingAmount) {
          return {
            ok: false as const,
            message: "El valor del abono supera el saldo pendiente.",
            errors: {
              amount: `El máximo permitido es ${pendingAmount}.`,
            },
          };
        }

        const payment = await tx.payment.create({
          data: {
            status: PaymentStatus.COMPLETED,
            method: method!,
            amount: amount!,
            paidAt: paidAt!,
            subscriptionId: subscription.id,
            operatorId: user.id,
            shiftId: currentShift?.id ?? null,
            reference: reference ?? null,
            notes: notes ?? null,
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

        const newTotalPaid = totalPaid + payment.amount;
        const newPendingAmount = Math.max(subscription.amount - newTotalPaid, 0);

        let printJobId: string | null = null;

        if (shouldPrintReceipt) {
          const receiptJob = await createSubscriptionReceiptPrintJob({
            db: tx,
            stationId,
            receiptKind: "SUBSCRIPTION_PAYMENT",
            createdById: user.id,
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
              id: subscription.vehicle.id,
              plate: subscription.vehicle.plate,
              type: subscription.vehicle.type,
            },
            customer: {
              id: subscription.customer.id,
              fullName: subscription.customer.fullName,
              document: subscription.customer.document,
              phone: subscription.customer.phone,
            },
            payment: {
              id: payment.id,
              amountReceived: payment.amount,
              paidAt: payment.paidAt,
              method: payment.method,
              reference: payment.reference,
              notes: payment.notes,
            },
            totals: {
              totalPaidBefore: totalPaid,
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
          paymentId: payment.id,
          printJobId,
          receiptQueued: shouldPrintReceipt,
          vehiclePlate: subscription.vehicle.plate,
          vehiclePlateNormalized: subscription.vehicle.plateNormalized,
          newTotalPaid,
          newPendingAmount,
          customerName: subscription.customer.fullName,
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

    const balanceMessage =
      transactionResult.newPendingAmount > 0
        ? `Abono registrado correctamente. Saldo pendiente: ${formatCurrencyCop(
            transactionResult.newPendingAmount
          )}.`
        : "Abono registrado correctamente. La mensualidad quedó al día.";

    const receiptMessage = transactionResult.receiptQueued
      ? " Recibo enviado a impresión."
      : "";

    return {
      ok: true,
      message: `${balanceMessage}${receiptMessage}`,
      errors: {},
    };
  } catch (error) {
    console.error(
      "[registerSubscriptionPaymentAction] Error registrando abono de mensualidad:",
      error
    );

    if (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientUnknownRequestError ||
      error instanceof Prisma.PrismaClientValidationError
    ) {
      return buildErrorState(
        "No fue posible registrar el abono por un problema de base de datos."
      );
    }

    return buildErrorState("No fue posible registrar el abono en este momento.");
  }
}