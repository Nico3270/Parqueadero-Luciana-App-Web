"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import {
  Prisma,
  PrintJobStatus,
  PrintJobType,
  PricingUnit,
  SessionStatus,
  SubscriptionStatus,
  VehicleType,
} from "@prisma/client";
import prisma from "@/lib/prisma";

type VehicleTypeInput = "CAR" | "MOTO" | "TRUCK" | "BUS" | "TRACTOMULA" | "OTHER";

const SCAN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SCAN_CODE_LENGTH = 6;
const SCAN_CODE_MAX_RETRIES = 12;

type RestartableActiveSessionInfo = {
  id: string;
  ticketCode: string;
  scanCode: string;
  entryAtIso: string;
  pricingUnit: PricingUnit;
  subscriptionId: string | null;
};

type CreateEntrySuccessBase = {
  ok: true;
  sessionId: string;
  ticketCode: string;
  scanCode: string;
  vehicleId: string;
  plate: string;
  plateNormalized: string;
  vehicleType: VehicleTypeInput;
  entryAtIso: string;
  restartedPreviousSession: boolean;
  restartedSessionId?: string;
  restartedSessionsCount?: number;
  message?: string;
};

type CreateEntryRegularSuccess = CreateEntrySuccessBase & {
  kind: "REGULAR_ENTRY";
  printJobId: string;
};

type CreateEntrySubscriptionSuccess = CreateEntrySuccessBase & {
  kind: "SUBSCRIPTION_ENTRY";
  subscriptionId: string;
  subscriptionUrl: string;
  subscriptionEndAtIso: string;
};

type CreateEntryError =
  | {
      ok: false;
      code: "VALIDATION_ERROR";
      message: string;
      field?: "plate" | "vehicleType";
    }
  | {
      ok: false;
      code: "ALREADY_ACTIVE";
      message: string;
      field?: "plate";
    }
  | {
      ok: false;
      code: "ACTIVE_SESSION_RESTART_REQUIRED";
      message: string;
      field: "plate";
      canRestart: true;
      existingSession: RestartableActiveSessionInfo;
    }
  | {
      ok: false;
      code: "UNAUTHORIZED" | "INACTIVE_USER" | "UNKNOWN_ERROR";
      message: string;
      field?: "plate" | "vehicleType";
    };

export type CreateEntryResult =
  | CreateEntryRegularSuccess
  | CreateEntrySubscriptionSuccess
  | CreateEntryError;

export type EntryActionState = {
  last?: CreateEntryResult;
};

function normalizePlate(raw: string) {
  const plate = (raw ?? "").trim().toUpperCase();
  const plateNormalized = plate.replace(/[^A-Z0-9]/g, "").slice(0, 10);
  return { plate, plateNormalized };
}

function isVehicleType(v: unknown): v is VehicleTypeInput {
  return (
    v === "CAR" ||
    v === "MOTO" ||
    v === "TRUCK" ||
    v === "BUS" ||
    v === "TRACTOMULA" ||
    v === "OTHER"
  );
}

function safeStationId(raw?: string | null) {
  const s = (raw ?? "").trim();
  return (s || "TUNJA-1").slice(0, 64);
}

function randomScanCode(length = SCAN_CODE_LENGTH) {
  let out = "";
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * SCAN_CODE_ALPHABET.length);
    out += SCAN_CODE_ALPHABET[idx];
  }
  return out;
}

function parseBooleanFormValue(value: FormDataEntryValue | null | undefined) {
  if (typeof value !== "string") return false;

  const normalized = value.trim().toLowerCase();

  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on" ||
    normalized === "si" ||
    normalized === "sí"
  );
}

function buildRestartNote(operatorLabel: string, restartedAtIso: string) {
  return `[SISTEMA] Sesión cerrada automáticamente por reinicio de ingreso el ${restartedAtIso} por ${operatorLabel}.`;
}

async function generateUniqueScanCode(tx: Prisma.TransactionClient) {
  for (let i = 0; i < SCAN_CODE_MAX_RETRIES; i++) {
    const candidate = randomScanCode();

    const exists = await tx.parkingSession.findUnique({
      where: { scanCode: candidate },
      select: { id: true },
    });

    if (!exists) return candidate;
  }

  throw new Error("SCAN_CODE_GENERATION_FAILED");
}

/**
 * Server Action
 * - Upsert Vehicle por (plateNormalized, type)
 * - Detecta mensualidad activa del vehículo
 * - Si hay sesión activa:
 *   - devuelve estado de confirmación para reinicio
 *   - o la cierra automáticamente si llega confirmRestartExisting
 * - Crea nueva ParkingSession
 * - Solo crea PrintJob si NO es mensualidad
 *
 * Nota:
 * - Incluso para mensualidad se registra ParkingSession, para saber
 *   qué vehículos están actualmente dentro del parqueadero.
 * - En mensualidad NO se imprime ticket de entrada.
 */
export async function createEntryAction(
  _prevState: EntryActionState,
  formData: FormData
): Promise<EntryActionState> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return {
        last: {
          ok: false,
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesión para registrar una entrada.",
        },
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, isActive: true, name: true, email: true },
    });

    if (!user?.isActive) {
      return {
        last: {
          ok: false,
          code: "INACTIVE_USER",
          message: "Tu usuario está inactivo. Contacta al administrador.",
        },
      };
    }

    const vehicleTypeRaw = formData.get("vehicleType");
    const plateRaw = formData.get("plate");
    const stationId = safeStationId(formData.get("stationId") as string | null);
    const confirmRestartExisting = parseBooleanFormValue(
      formData.get("confirmRestartExisting")
    );

    if (!isVehicleType(vehicleTypeRaw)) {
      return {
        last: {
          ok: false,
          code: "VALIDATION_ERROR",
          field: "vehicleType",
          message: "Selecciona un tipo de vehículo válido.",
        },
      };
    }

    if (typeof plateRaw !== "string") {
      return {
        last: {
          ok: false,
          code: "VALIDATION_ERROR",
          field: "plate",
          message: "Ingresa una placa válida.",
        },
      };
    }

    const { plate, plateNormalized } = normalizePlate(plateRaw);

    if (plateNormalized.length < 4) {
      return {
        last: {
          ok: false,
          code: "VALIDATION_ERROR",
          field: "plate",
          message: "La placa es demasiado corta. Verifica e inténtalo de nuevo.",
        },
      };
    }

    const operatorLabel =
      user.name?.trim() ||
      user.email?.trim() ||
      `usuario ${user.id}`;

    const result = await prisma.$transaction(
      async (tx) => {
        const vehicle = await tx.vehicle.upsert({
          where: {
            plateNormalized_type: {
              plateNormalized,
              type: vehicleTypeRaw as VehicleType,
            },
          },
          create: {
            plate,
            plateNormalized,
            type: vehicleTypeRaw as VehicleType,
          },
          update: {
            plate,
            plateNormalized,
          },
          select: {
            id: true,
            plate: true,
            plateNormalized: true,
            type: true,
          },
        });

        const existingActiveSession = await tx.parkingSession.findFirst({
          where: {
            vehicleId: vehicle.id,
            status: SessionStatus.IN,
          },
          orderBy: {
            entryAt: "desc",
          },
          select: {
            id: true,
            ticketCode: true,
            scanCode: true,
            entryAt: true,
            pricingUnit: true,
            subscriptionId: true,
          },
        });

        if (existingActiveSession && !confirmRestartExisting) {
          return {
            ok: false as const,
            code: "ACTIVE_SESSION_RESTART_REQUIRED" as const,
            field: "plate" as const,
            canRestart: true as const,
            message:
              "Este vehículo ya tiene una sesión activa. Si deseas, puedes reiniciarla para cerrar la anterior y crear una nueva entrada.",
            existingSession: {
              id: existingActiveSession.id,
              ticketCode: existingActiveSession.ticketCode,
              scanCode: existingActiveSession.scanCode,
              entryAtIso: existingActiveSession.entryAt.toISOString(),
              pricingUnit: existingActiveSession.pricingUnit,
              subscriptionId: existingActiveSession.subscriptionId,
            },
          };
        }

        let restartedPreviousSession = false;
        let restartedSessionId: string | undefined;
        let restartedSessionsCount = 0;

        if (existingActiveSession && confirmRestartExisting) {
          const restartedAt = new Date();
          const restartNote = buildRestartNote(
            operatorLabel,
            restartedAt.toISOString()
          );

          const closedSessions = await tx.parkingSession.updateMany({
            where: {
              vehicleId: vehicle.id,
              status: SessionStatus.IN,
            },
            data: {
              status: SessionStatus.CANCELED,
              exitAt: restartedAt,
              closedById: user.id,
              notes: restartNote,
            },
          });

          restartedPreviousSession = closedSessions.count > 0;
          restartedSessionId = existingActiveSession.id;
          restartedSessionsCount = closedSessions.count;
        }

        const now = new Date();

        const activeSubscription = await tx.subscription.findFirst({
          where: {
            vehicleId: vehicle.id,
            status: SubscriptionStatus.ACTIVE,
            startAt: {
              lte: now,
            },
            endAt: {
              gte: now,
            },
          },
          orderBy: {
            endAt: "desc",
          },
          select: {
            id: true,
            endAt: true,
          },
        });

        const scanCode = await generateUniqueScanCode(tx);

        const parkingSession = await tx.parkingSession.create({
          data: {
            status: SessionStatus.IN,
            vehicleId: vehicle.id,
            createdById: user.id,
            scanCode,
            pricingUnit: activeSubscription
              ? PricingUnit.SUBSCRIPTION
              : PricingUnit.MANUAL,
            subscriptionId: activeSubscription?.id ?? null,
          },
          select: {
            id: true,
            ticketCode: true,
            scanCode: true,
            entryAt: true,
            vehicleId: true,
            pricingUnit: true,
            subscriptionId: true,
            vehicle: {
              select: {
                id: true,
                type: true,
                plate: true,
                plateNormalized: true,
              },
            },
          },
        });

        if (activeSubscription) {
          return {
            ok: true as const,
            kind: "SUBSCRIPTION_ENTRY" as const,
            sessionId: parkingSession.id,
            ticketCode: parkingSession.ticketCode,
            scanCode: parkingSession.scanCode,
            vehicleId: parkingSession.vehicleId,
            plate: vehicle.plate,
            plateNormalized: vehicle.plateNormalized,
            vehicleType: vehicle.type as VehicleTypeInput,
            entryAtIso: parkingSession.entryAt.toISOString(),
            subscriptionId: activeSubscription.id,
            subscriptionUrl: `/mensualidades/${encodeURIComponent(
              vehicle.plateNormalized
            )}`,
            subscriptionEndAtIso: activeSubscription.endAt.toISOString(),
            restartedPreviousSession,
            restartedSessionId,
            restartedSessionsCount,
            message: restartedPreviousSession
              ? "Vehículo con mensualidad activa. Se cerró la sesión anterior y se registró un nuevo ingreso sin imprimir ticket."
              : "Vehículo con mensualidad activa. Se registró el ingreso sin imprimir ticket.",
          };
        }

        const printJob = await tx.printJob.create({
          data: {
            type: PrintJobType.ENTRY_TICKET,
            status: PrintJobStatus.PENDING,
            stationId,
            sessionId: parkingSession.id,
            createdById: user.id,
            copies: 1,
            priority: 0,
            payload: {
              kind: "ENTRY_TICKET",
              stationId,
              parkingName: "Parqueadero Luca",

              parkingSessionId: parkingSession.id,
              ticketCode: parkingSession.ticketCode,
              scanCode: parkingSession.scanCode,

              vehicle: {
                id: parkingSession.vehicle.id,
                type: parkingSession.vehicle.type,
                plate: parkingSession.vehicle.plate,
                plateNormalized: parkingSession.vehicle.plateNormalized,
              },

              entryAtIso: parkingSession.entryAt.toISOString(),

              operator: {
                id: user.id,
                name: user.name ?? null,
                email: user.email ?? null,
              },

              barcode: {
                type: "SCAN_CODE",
                value: parkingSession.scanCode,
              },

              qr: {
                type: "SCAN_CODE",
                value: parkingSession.scanCode,
              },
            },
          },
          select: {
            id: true,
          },
        });

        return {
          ok: true as const,
          kind: "REGULAR_ENTRY" as const,
          sessionId: parkingSession.id,
          ticketCode: parkingSession.ticketCode,
          scanCode: parkingSession.scanCode,
          vehicleId: parkingSession.vehicleId,
          plate: vehicle.plate,
          plateNormalized: vehicle.plateNormalized,
          vehicleType: vehicle.type as VehicleTypeInput,
          entryAtIso: parkingSession.entryAt.toISOString(),
          printJobId: printJob.id,
          restartedPreviousSession,
          restartedSessionId,
          restartedSessionsCount,
          message: restartedPreviousSession
            ? "Entrada registrada. Se cerró la sesión anterior y se generó un nuevo ticket."
            : "Entrada registrada.",
        };
      },
      { isolationLevel: "Serializable" }
    );

    if (!result.ok) {
      return { last: result };
    }

    revalidatePath("/");
    revalidatePath("/mensualidades");

    return { last: result };
  } catch (err) {
    console.error("[createEntryAction] Error:", err);

    if (err instanceof Error && err.message === "SCAN_CODE_GENERATION_FAILED") {
      return {
        last: {
          ok: false,
          code: "UNKNOWN_ERROR",
          message: "No se pudo generar el código del ticket. Intenta de nuevo.",
        },
      };
    }

    return {
      last: {
        ok: false,
        code: "UNKNOWN_ERROR",
        message: "Ocurrió un error. Intenta de nuevo.",
      },
    };
  }
}