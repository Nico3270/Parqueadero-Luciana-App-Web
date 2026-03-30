// src/actions/mensualidades/toggleSubscriptionStatusAction.ts
"use server";

import { revalidatePath } from "next/cache";
import { Prisma, SubscriptionStatus } from "@prisma/client";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export type ToggleSubscriptionStatusField =
  | "subscriptionId"
  | "targetStatus";

export type ToggleSubscriptionStatusActionState = {
  ok: boolean;
  message?: string;
  errors?: Partial<Record<ToggleSubscriptionStatusField, string>>;
};

const INITIAL_STATE: ToggleSubscriptionStatusActionState = {
  ok: false,
  message: "",
  errors: {},
};

function trimOrNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function buildErrorState(
  message: string,
  errors?: Partial<Record<ToggleSubscriptionStatusField, string>>
): ToggleSubscriptionStatusActionState {
  return {
    ok: false,
    message,
    errors: errors ?? {},
  };
}

function parseTargetStatus(value: string | null): SubscriptionStatus | null {
  if (!value) return null;

  if (value === SubscriptionStatus.ACTIVE) {
    return SubscriptionStatus.ACTIVE;
  }

  if (value === SubscriptionStatus.SUSPENDED) {
    return SubscriptionStatus.SUSPENDED;
  }

  return null;
}

function computeEffectiveStatus(
  status: SubscriptionStatus,
  endAt: Date,
  now: Date
): SubscriptionStatus {
  if (status === SubscriptionStatus.CANCELED) {
    return SubscriptionStatus.CANCELED;
  }

  if (endAt.getTime() <= now.getTime()) {
    return SubscriptionStatus.EXPIRED;
  }

  if (status === SubscriptionStatus.SUSPENDED) {
    return SubscriptionStatus.SUSPENDED;
  }

  return SubscriptionStatus.ACTIVE;
}

export async function toggleSubscriptionStatusAction(
  _prevState: ToggleSubscriptionStatusActionState = INITIAL_STATE,
  formData: FormData
): Promise<ToggleSubscriptionStatusActionState> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return buildErrorState(
        "Debes iniciar sesión para cambiar el estado de la mensualidad."
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
        "Tu usuario está inactivo. No puedes cambiar el estado de mensualidades."
      );
    }

    const subscriptionId = trimOrNull(formData.get("subscriptionId"));
    const targetStatusRaw = trimOrNull(formData.get("targetStatus"));

    const errors: Partial<Record<ToggleSubscriptionStatusField, string>> = {};

    if (!subscriptionId) {
      errors.subscriptionId = "No se recibió la mensualidad.";
    }

    const parsedTargetStatus = parseTargetStatus(targetStatusRaw);

    if (targetStatusRaw && !parsedTargetStatus) {
      errors.targetStatus = "El estado solicitado no es válido.";
    }

    if (Object.keys(errors).length > 0) {
      return buildErrorState("Revisa la solicitud.", errors);
    }

    const now = new Date();

    const transactionResult = await prisma.$transaction(
      async (tx) => {
        const subscription = await tx.subscription.findUnique({
          where: {
            id: subscriptionId!,
          },
          select: {
            id: true,
            status: true,
            endAt: true,
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

        const effectiveStatus = computeEffectiveStatus(
          subscription.status,
          subscription.endAt,
          now
        );

        if (effectiveStatus === SubscriptionStatus.CANCELED) {
          return {
            ok: false as const,
            message:
              "No puedes cambiar el estado de una mensualidad cancelada.",
            errors: {
              targetStatus: "La mensualidad está cancelada.",
            },
          };
        }

        if (effectiveStatus === SubscriptionStatus.EXPIRED) {
          return {
            ok: false as const,
            message:
              "No puedes suspender o reactivar una mensualidad vencida. Debes renovarla.",
            errors: {
              targetStatus: "La mensualidad ya está vencida.",
            },
          };
        }

        const targetStatus =
          parsedTargetStatus ??
          (subscription.status === SubscriptionStatus.SUSPENDED
            ? SubscriptionStatus.ACTIVE
            : SubscriptionStatus.SUSPENDED);

        if (
          targetStatus !== SubscriptionStatus.ACTIVE &&
          targetStatus !== SubscriptionStatus.SUSPENDED
        ) {
          return {
            ok: false as const,
            message: "El estado solicitado no es válido.",
            errors: {
              targetStatus: "Solo se permite activar o suspender.",
            },
          };
        }

        if (subscription.status === targetStatus) {
          return {
            ok: false as const,
            message:
              targetStatus === SubscriptionStatus.ACTIVE
                ? "La mensualidad ya está activa."
                : "La mensualidad ya está suspendida.",
            errors: {
              targetStatus:
                targetStatus === SubscriptionStatus.ACTIVE
                  ? "La mensualidad ya está activa."
                  : "La mensualidad ya está suspendida.",
            },
          };
        }

        const updatedSubscription = await tx.subscription.update({
          where: {
            id: subscription.id,
          },
          data: {
            status: targetStatus,
          },
          select: {
            id: true,
            status: true,
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
          status: updatedSubscription.status,
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
      message:
        transactionResult.status === SubscriptionStatus.SUSPENDED
          ? "Mensualidad suspendida correctamente."
          : "Mensualidad reactivada correctamente.",
      errors: {},
    };
  } catch (error) {
    console.error(
      "[toggleSubscriptionStatusAction] Error cambiando estado de mensualidad:",
      error
    );

    if (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientUnknownRequestError ||
      error instanceof Prisma.PrismaClientValidationError
    ) {
      return buildErrorState(
        "No fue posible cambiar el estado por un problema de base de datos."
      );
    }

    return buildErrorState(
      "No fue posible cambiar el estado de la mensualidad en este momento."
    );
  }
}