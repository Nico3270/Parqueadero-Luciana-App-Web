// src/actions/mensualidades/updateSubscriptionNotesAction.ts
"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export type UpdateSubscriptionNotesField = "subscriptionId" | "notes";

export type UpdateSubscriptionNotesActionState = {
  ok: boolean;
  message?: string;
  errors?: Partial<Record<UpdateSubscriptionNotesField, string>>;
};

const INITIAL_STATE: UpdateSubscriptionNotesActionState = {
  ok: false,
  message: "",
  errors: {},
};

function trimOrNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeNotes(value: string | null, maxLength = 1000): string | null {
  if (!value) return null;

  const normalized = value.trim();
  if (!normalized) return null;

  if (normalized.length > maxLength) {
    return normalized.slice(0, maxLength);
  }

  return normalized;
}

function buildErrorState(
  message: string,
  errors?: Partial<Record<UpdateSubscriptionNotesField, string>>
): UpdateSubscriptionNotesActionState {
  return {
    ok: false,
    message,
    errors: errors ?? {},
  };
}

export async function updateSubscriptionNotesAction(
  _prevState: UpdateSubscriptionNotesActionState = INITIAL_STATE,
  formData: FormData
): Promise<UpdateSubscriptionNotesActionState> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return buildErrorState(
        "Debes iniciar sesión para actualizar las notas de la mensualidad."
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
        "Tu usuario está inactivo. No puedes actualizar notas de mensualidades."
      );
    }

    const subscriptionId = trimOrNull(formData.get("subscriptionId"));
    const notesRaw = trimOrNull(formData.get("notes"));

    const errors: Partial<Record<UpdateSubscriptionNotesField, string>> = {};

    if (!subscriptionId) {
      errors.subscriptionId = "No se recibió la mensualidad.";
    }

    const notes = normalizeNotes(notesRaw, 1000);

    if (typeof formData.get("notes") === "string") {
      const originalNotes = String(formData.get("notes") ?? "");
      if (originalNotes.trim().length > 1000) {
        errors.notes = "Las notas no pueden superar los 1000 caracteres.";
      }
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
            notes: true,
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

        const updatedSubscription = await tx.subscription.update({
          where: {
            id: subscription.id,
          },
          data: {
            notes,
          },
          select: {
            id: true,
            notes: true,
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
          vehiclePlate: updatedSubscription.vehicle.plate,
          vehiclePlateNormalized: updatedSubscription.vehicle.plateNormalized,
          notes: updatedSubscription.notes,
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
      message: transactionResult.notes
        ? "Notas actualizadas correctamente."
        : "Notas eliminadas correctamente.",
      errors: {},
    };
  } catch (error) {
    console.error(
      "[updateSubscriptionNotesAction] Error actualizando notas de mensualidad:",
      error
    );

    if (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientUnknownRequestError ||
      error instanceof Prisma.PrismaClientValidationError
    ) {
      return buildErrorState(
        "No fue posible actualizar las notas por un problema de base de datos."
      );
    }

    return buildErrorState(
      "No fue posible actualizar las notas de la mensualidad en este momento."
    );
  }
}