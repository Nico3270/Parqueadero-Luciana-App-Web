"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { Prisma, PrintJobStatus, PrintJobType, VehicleType } from "@prisma/client";
import prisma from "@/lib/prisma";

type VehicleTypeInput = "CAR" | "MOTO" | "TRUCK" | "BUS" | "TRACTOMULA" | "OTHER";

const SCAN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SCAN_CODE_LENGTH = 6;
const SCAN_CODE_MAX_RETRIES = 12;

export type CreateEntryResult =
  | {
      ok: true;
      sessionId: string;
      ticketCode: string;
      scanCode: string;
      vehicleId: string;
      plate: string;
      plateNormalized: string;
      vehicleType: VehicleTypeInput;
      entryAtIso: string;
      printJobId: string;
      message?: string;
    }
  | {
      ok: false;
      code:
        | "VALIDATION_ERROR"
        | "ALREADY_ACTIVE"
        | "UNAUTHORIZED"
        | "INACTIVE_USER"
        | "UNKNOWN_ERROR";
      message: string;
      field?: "plate" | "vehicleType";
    };

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
 * - Verifica que NO exista sesión IN activa para ese vehículo
 * - Genera scanCode corto y único
 * - Crea ParkingSession (IN)
 * - Crea PrintJob (ENTRY_TICKET) para impresión local near-realtime
 *
 * Nota horas:
 * - Prisma/PG guarda DateTime en UTC. UI formatea con America/Bogota.
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

        const active = await tx.parkingSession.findFirst({
          where: {
            vehicleId: vehicle.id,
            status: "IN",
          },
          select: { id: true },
        });

        if (active) {
          return {
            ok: false as const,
            code: "ALREADY_ACTIVE" as const,
            message: "Este vehículo ya tiene una entrada activa. Revisa la salida/cobro.",
            field: "plate" as const,
          };
        }

        const scanCode = await generateUniqueScanCode(tx);

        const ps = await tx.parkingSession.create({
          data: {
            status: "IN",
            vehicleId: vehicle.id,
            createdById: user.id,
            scanCode,
          },
          select: {
            id: true,
            ticketCode: true,
            scanCode: true,
            entryAt: true,
            vehicleId: true,
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

        const printJob = await tx.printJob.create({
          data: {
            type: PrintJobType.ENTRY_TICKET,
            status: PrintJobStatus.PENDING,
            stationId,
            sessionId: ps.id,
            createdById: user.id,
            copies: 1,
            priority: 0,
            payload: {
              kind: "ENTRY_TICKET",
              stationId,
              parkingName: "Parqueadero Luca",

              parkingSessionId: ps.id,
              ticketCode: ps.ticketCode,
              scanCode: ps.scanCode,

              vehicle: {
                id: ps.vehicle.id,
                type: ps.vehicle.type,
                plate: ps.vehicle.plate,
                plateNormalized: ps.vehicle.plateNormalized,
              },

              entryAtIso: ps.entryAt.toISOString(),

              operator: {
                id: user.id,
                name: user.name ?? null,
                email: user.email ?? null,
              },

              barcode: {
                type: "SCAN_CODE",
                value: ps.scanCode,
              },

              qr: {
                type: "SCAN_CODE",
                value: ps.scanCode,
              },
            },
          },
          select: { id: true },
        });

        return {
          ok: true as const,
          sessionId: ps.id,
          ticketCode: ps.ticketCode,
          scanCode: ps.scanCode,
          vehicleId: ps.vehicleId,
          plate: vehicle.plate,
          plateNormalized: vehicle.plateNormalized,
          vehicleType: vehicle.type as VehicleTypeInput,
          entryAtIso: ps.entryAt.toISOString(),
          printJobId: printJob.id,
          message: "Entrada registrada.",
        };
      },
      { isolationLevel: "Serializable" }
    );

    if (!result.ok) {
      return { last: result };
    }

    revalidatePath("/");

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