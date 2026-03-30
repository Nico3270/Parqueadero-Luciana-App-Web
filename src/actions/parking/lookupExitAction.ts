"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import {
  Prisma,
  PricingUnit,
  SessionStatus,
  VehicleType,
} from "@prisma/client";

export type LookupMode = "PLATE" | "SCAN_CODE";

export type ExitLookupSuccess = {
  ok: true;
  mode: LookupMode;
  parkingSessionId: string;
  ticketCode: string;
  scanCode: string;
  status: SessionStatus;
  entryAtIso: string;
  pricingUnit: PricingUnit;
  isSubscription: boolean;
  subscriptionId?: string | null;
  subscriptionEndAtIso?: string | null;
  subscriptionUrl?: string | null;
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

function normalizeLookup(raw: string) {
  const trimmed = (raw ?? "").trim();
  const codeNormalized = trimmed.toUpperCase().replace(/\s+/g, "");
  const { plateNormalized } = normalizePlate(trimmed);

  return {
    raw: trimmed,
    codeNormalized,
    plateNormalized,
  };
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
    pricingUnit: true,
    notes: true,
    shiftId: true,
    subscriptionId: true,
    subscription: {
      select: {
        id: true,
        endAt: true,
      },
    },
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

function buildLookupWhere(
  codeNormalized: string,
  plateNormalized: string,
  vehicleType: VehicleType | null
): Prisma.ParkingSessionWhereInput {
  const orConditions: Prisma.ParkingSessionWhereInput[] = [];

  if (codeNormalized.length >= 4) {
    orConditions.push({
      scanCode: codeNormalized,
    });
  }

  if (plateNormalized.length >= 4) {
    orConditions.push({
      vehicle: vehicleType
        ? {
            plateNormalized,
            type: vehicleType,
          }
        : {
            plateNormalized,
          },
    });
  }

  return { OR: orConditions };
}

/**
 * Server Action:
 * - Permite buscar por placa o scanCode
 * - Devuelve la sesión activa más reciente
 * - Expone pricingUnit / subscription para que la UI distinga mensualidad
 * - Si no hay activa, intenta detectar si la última ya fue cerrada/anulada
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
          message: "Ingresa una placa o código válido para buscar.",
        },
      };
    }

    const { codeNormalized, plateNormalized } = normalizeLookup(ticketOrPlateRaw);

    if (codeNormalized.length < 4 && plateNormalized.length < 4) {
      return {
        last: {
          ok: false,
          code: "VALIDATION_ERROR",
          field: "ticketOrPlate",
          message: "La placa o el código es muy corto. Verifica e intenta de nuevo.",
        },
      };
    }

    const vehicleTypeRaw = formData.get("vehicleType");
    const vehicleType = isVehicleType(vehicleTypeRaw) ? vehicleTypeRaw : null;

    const lookupWhere = buildLookupWhere(
      codeNormalized,
      plateNormalized,
      vehicleType
    );

    const activeSession = await prisma.parkingSession.findFirst({
      where: {
        status: SessionStatus.IN,
        ...lookupWhere,
      },
      orderBy: [{ entryAt: "desc" }],
      select: selectSessionLookupFields(),
    });

    if (activeSession) {
      const mode: LookupMode =
        activeSession.scanCode === codeNormalized ? "SCAN_CODE" : "PLATE";

      return {
        last: {
          ok: true,
          mode,
          parkingSessionId: activeSession.id,
          ticketCode: activeSession.ticketCode,
          scanCode: activeSession.scanCode,
          status: activeSession.status,
          entryAtIso: activeSession.entryAt.toISOString(),
          pricingUnit: activeSession.pricingUnit,
          isSubscription:
            activeSession.pricingUnit === PricingUnit.SUBSCRIPTION,
          subscriptionId: activeSession.subscriptionId ?? null,
          subscriptionEndAtIso: activeSession.subscription?.endAt
            ? activeSession.subscription.endAt.toISOString()
            : null,
          subscriptionUrl: activeSession.subscriptionId
            ? `/mensualidades/${encodeURIComponent(
                activeSession.vehicle.plateNormalized
              )}`
            : null,
          vehicle: {
            id: activeSession.vehicle.id,
            type: activeSession.vehicle.type,
            plate: activeSession.vehicle.plate,
            plateNormalized: activeSession.vehicle.plateNormalized,
          },
          createdBy: activeSession.createdBy ?? undefined,
          shiftId: activeSession.shiftId ?? null,
          notes: activeSession.notes ?? null,
        },
      };
    }

    const latestSession = await prisma.parkingSession.findFirst({
      where: lookupWhere,
      orderBy: [{ entryAt: "desc" }],
      select: {
        status: true,
      },
    });

    if (latestSession) {
      return {
        last: {
          ok: false,
          code: "ALREADY_CLOSED",
          field: "ticketOrPlate",
          message:
            latestSession.status === SessionStatus.CANCELED
              ? "La última sesión encontrada para este vehículo fue anulada."
              : "La última sesión encontrada para este vehículo ya fue cerrada.",
        },
      };
    }

    return {
      last: {
        ok: false,
        code: "NOT_FOUND",
        field: "ticketOrPlate",
        message:
          "No se encontró una entrada activa con esa placa o código. Verifica e intenta de nuevo.",
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