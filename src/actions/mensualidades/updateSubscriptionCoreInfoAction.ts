// src/actions/mensualidades/updateSubscriptionCoreInfoAction.ts
"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export type UpdateSubscriptionCoreInfoField =
  | "subscriptionId"
  | "fullName"
  | "document"
  | "phone"
  | "phoneSecondary"
  | "amount"
  | "customerNotes"
  | "vehicleNotes"
  | "subscriptionNotes";

export type UpdateSubscriptionCoreInfoActionState = {
  ok: boolean;
  message?: string;
  errors?: Partial<Record<UpdateSubscriptionCoreInfoField, string>>;
};

const INITIAL_STATE: UpdateSubscriptionCoreInfoActionState = {
  ok: false,
  message: "",
  errors: {},
};

function trimOrNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
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

function normalizeRequiredText(
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

function normalizePhone(value: string | null, maxLength = 30): string | null {
  if (!value) return null;

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  if (normalized.length > maxLength) {
    return normalized.slice(0, maxLength);
  }

  return normalized;
}

function buildErrorState(
  message: string,
  errors?: Partial<Record<UpdateSubscriptionCoreInfoField, string>>
): UpdateSubscriptionCoreInfoActionState {
  return {
    ok: false,
    message,
    errors: errors ?? {},
  };
}

export async function updateSubscriptionCoreInfoAction(
  _prevState: UpdateSubscriptionCoreInfoActionState = INITIAL_STATE,
  formData: FormData
): Promise<UpdateSubscriptionCoreInfoActionState> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return buildErrorState(
        "Debes iniciar sesión para editar la información de la mensualidad."
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!user) {
      return buildErrorState("No se encontró el usuario autenticado.");
    }

    if (!user.isActive) {
      return buildErrorState(
        "Tu usuario está inactivo. No puedes editar esta información."
      );
    }

    const subscriptionId = trimOrNull(formData.get("subscriptionId"));
    const fullNameRaw = trimOrNull(formData.get("fullName"));
    const documentRaw = trimOrNull(formData.get("document"));
    const phoneRaw = trimOrNull(formData.get("phone"));
    const phoneSecondaryRaw = trimOrNull(formData.get("phoneSecondary"));
    const amountRaw = trimOrNull(formData.get("amount"));
    const customerNotesRaw = trimOrNull(formData.get("customerNotes"));
    const vehicleNotesRaw = trimOrNull(formData.get("vehicleNotes"));
    const subscriptionNotesRaw = trimOrNull(formData.get("subscriptionNotes"));

    const errors: Partial<Record<UpdateSubscriptionCoreInfoField, string>> = {};

    if (!subscriptionId) {
      errors.subscriptionId = "No se recibió la mensualidad.";
    }

    const fullName = normalizeRequiredText(fullNameRaw, { maxLength: 120 });
    if (!fullName) {
      errors.fullName = "El nombre del titular es obligatorio.";
    }

    const documentValue = normalizeOptionalText(documentRaw, { maxLength: 40 });
    const phone = normalizePhone(phoneRaw, 30);
    const phoneSecondary = normalizePhone(phoneSecondaryRaw, 30);

    const amount = parsePositiveInt(amountRaw);
    if (!amount) {
      errors.amount = "Ingresa un valor válido mayor a 0.";
    }

    const customerNotes = normalizeOptionalText(customerNotesRaw, {
      maxLength: 1000,
    });
    const vehicleNotes = normalizeOptionalText(vehicleNotesRaw, {
      maxLength: 1000,
    });
    const subscriptionNotes = normalizeOptionalText(subscriptionNotesRaw, {
      maxLength: 1000,
    });

    if (documentRaw && !documentValue && documentRaw.trim().length > 0) {
      errors.document = "El documento no es válido.";
    }

    if (phoneRaw && !phone && phoneRaw.trim().length > 0) {
      errors.phone = "El teléfono principal no es válido.";
    }

    if (
      phoneSecondaryRaw &&
      !phoneSecondary &&
      phoneSecondaryRaw.trim().length > 0
    ) {
      errors.phoneSecondary = "El teléfono secundario no es válido.";
    }

    if (
      customerNotesRaw &&
      !customerNotes &&
      customerNotesRaw.trim().length > 0
    ) {
      errors.customerNotes = "Las notas del cliente no son válidas.";
    }

    if (vehicleNotesRaw && !vehicleNotes && vehicleNotesRaw.trim().length > 0) {
      errors.vehicleNotes = "Las notas del vehículo no son válidas.";
    }

    if (
      subscriptionNotesRaw &&
      !subscriptionNotes &&
      subscriptionNotesRaw.trim().length > 0
    ) {
      errors.subscriptionNotes = "Las notas de la mensualidad no son válidas.";
    }

    if (Object.keys(errors).length > 0) {
      return buildErrorState("Revisa los campos del formulario.", errors);
    }

    const transactionResult = await prisma.$transaction(
      async (tx) => {
        const subscription = await tx.subscription.findUnique({
          where: {
            id: subscriptionId!,
          },
          select: {
            id: true,
            customerId: true,
            vehicleId: true,
            vehicle: {
              select: {
                plate: true,
                plateNormalized: true,
              },
            },
          },
        });

        if (!subscription) {
          return {
            ok: false as const,
            message: "La mensualidad no existe o ya no está disponible.",
            errors: {
              subscriptionId: "No se encontró la mensualidad.",
            },
          };
        }

        await tx.customer.update({
          where: {
            id: subscription.customerId,
          },
          data: {
            fullName: fullName!,
            document: documentValue ?? null,
            phone: phone ?? null,
            phoneSecondary: phoneSecondary ?? null,
            notes: customerNotes ?? null,
          },
        });

        await tx.vehicle.update({
          where: {
            id: subscription.vehicleId,
          },
          data: {
            notes: vehicleNotes ?? null,
          },
        });

        const updatedSubscription = await tx.subscription.update({
          where: {
            id: subscription.id,
          },
          data: {
            amount: amount!,
            notes: subscriptionNotes ?? null,
          },
          select: {
            id: true,
            amount: true,
            vehicle: {
              select: {
                plate: true,
                plateNormalized: true,
              },
            },
          },
        });

        return {
          ok: true as const,
          subscriptionId: updatedSubscription.id,
          amount: updatedSubscription.amount,
          vehiclePlate: updatedSubscription.vehicle.plate,
          vehiclePlateNormalized: updatedSubscription.vehicle.plateNormalized,
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

    return {
      ok: true,
      message: "Información actualizada correctamente.",
      errors: {},
    };
  } catch (error) {
    console.error(
      "[updateSubscriptionCoreInfoAction] Error actualizando información principal de mensualidad:",
      error
    );

    if (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientUnknownRequestError ||
      error instanceof Prisma.PrismaClientValidationError
    ) {
      return buildErrorState(
        "No fue posible actualizar la información por un problema de base de datos."
      );
    }

    return buildErrorState(
      "No fue posible actualizar la información en este momento."
    );
  }
}