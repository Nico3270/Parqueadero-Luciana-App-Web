"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { SessionStatus, VehicleType } from "@prisma/client";

export type LookupMode = "PLATE";

export type ExitLookupSuccess = {
  ok: true;
  mode: LookupMode;
  parkingSessionId: string;
  ticketCode: string;
  scanCode: string;
  status: "IN" | "OUT" | "CANCELED";
  entryAtIso: string;
  vehicle: {
    id: string;
    type: VehicleType;
    plate: string;
    plateNormalized: string;
  };
  createdBy?: { id: string; name?: string | null; email?: string | null };
  shiftId?: string | null;
  notes?: string | null;
};

export type ExitLookupError = {
  ok: false;
  code:
    | "VALIDATION_ERROR"
    | "NOT_FOUND"
    | "ALREADY_CLOSED"
    | "UNAUTHORIZED"
    | "INACTIVE_USER"
    | "UNKNOWN_ERROR";
  message: string;
  field?: "ticketOrPlate";
};

export type ExitLookupResult = ExitLookupSuccess | ExitLookupError;

export type ExitLookupState = {
  last?: ExitLookupResult;
};

function normalizePlate(raw: string) {
  const plate = (raw ?? "").trim().toUpperCase();
  const plateNormalized = plate.replace(/[^A-Z0-9]/g, "").slice(0, 10);
  return { plate, plateNormalized };
}

function isVehicleType(v: unknown): v is VehicleType {
  return (
    v === "CAR" ||
    v === "MOTO" ||
    v === "TRUCK" ||
    v === "BUS" ||
    v === "TRACTOMULA" ||
    v === "OTHER"
  );
}

function selectSessionLookupFields() {
  return {
    id: true,
    ticketCode: true,
    scanCode: true,
    status: true,
    entryAt: true,
    notes: true,
    shiftId: true,
    vehicle: {
      select: {
        id: true,
        type: true,
        plate: true,
        plateNormalized: true,
      },
    },
    createdBy: {
      select: { id: true, name: true, email: true },
    },
  } as const;
}

/**
 * Server Action:
 * - Búsqueda solo por placa
 * - Busca la ParkingSession IN más reciente por plateNormalized
 * - Si llega vehicleType, lo usa para evitar ambigüedad
 */
export async function lookupExitAction(
  _prevState: ExitLookupState,
  formData: FormData
): Promise<ExitLookupState> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return {
        last: {
          ok: false,
          code: "UNAUTHORIZED",
          message: "Debes iniciar sesión para buscar una salida.",
        },
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, isActive: true },
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

    const ticketOrPlateRaw = formData.get("ticketOrPlate");

    if (typeof ticketOrPlateRaw !== "string") {
      return {
        last: {
          ok: false,
          code: "VALIDATION_ERROR",
          field: "ticketOrPlate",
          message: "Ingresa una placa válida para buscar.",
        },
      };
    }

    const { plateNormalized } = normalizePlate(ticketOrPlateRaw);

    if (plateNormalized.length < 4) {
      return {
        last: {
          ok: false,
          code: "VALIDATION_ERROR",
          field: "ticketOrPlate",
          message: "La placa es muy corta. Verifica e intenta de nuevo.",
        },
      };
    }

    const vehicleTypeRaw = formData.get("vehicleType");
    const vehicleType = isVehicleType(vehicleTypeRaw) ? vehicleTypeRaw : null;

    const ps = await prisma.parkingSession.findFirst({
      where: {
        status: SessionStatus.IN,
        vehicle: vehicleType
          ? { plateNormalized, type: vehicleType }
          : { plateNormalized },
      },
      orderBy: { entryAt: "desc" },
      select: selectSessionLookupFields(),
    });

    if (!ps) {
      return {
        last: {
          ok: false,
          code: "NOT_FOUND",
          field: "ticketOrPlate",
          message:
            "No se encontró una entrada activa con esa placa. Verifica e intenta de nuevo.",
        },
      };
    }

    if (ps.status !== SessionStatus.IN) {
      return {
        last: {
          ok: false,
          code: "ALREADY_CLOSED",
          field: "ticketOrPlate",
          message: "Esta sesión ya fue cerrada o anulada.",
        },
      };
    }

    return {
      last: {
        ok: true,
        mode: "PLATE",
        parkingSessionId: ps.id,
        ticketCode: ps.ticketCode,
        scanCode: ps.scanCode,
        status: ps.status,
        entryAtIso: ps.entryAt.toISOString(),
        vehicle: {
          id: ps.vehicle.id,
          type: ps.vehicle.type,
          plate: ps.vehicle.plate,
          plateNormalized: ps.vehicle.plateNormalized,
        },
        createdBy: ps.createdBy ?? undefined,
        shiftId: ps.shiftId ?? null,
        notes: ps.notes ?? null,
      },
    };
  } catch (err) {
    console.error("[lookupExitAction] Error:", err);
    return {
      last: {
        ok: false,
        code: "UNKNOWN_ERROR",
        message: "Ocurrió un error al buscar. Intenta de nuevo.",
      },
    };
  }
}