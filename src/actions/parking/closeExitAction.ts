"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import {
  PaymentMethod,
  PaymentStatus,
  PricingUnit,
  PrintJobStatus,
  PrintJobType,
  SessionStatus,
} from "@prisma/client";
import prisma from "@/lib/prisma";

export type CloseExitPayload = {
  parkingSessionId: string;
  method: "CASH" | "NEQUI" | "TRANSFER" | "OTHER";
  amountPaid: number;
  suggestedAmount: number;
  /**
   * Estación/impresora destino para el print agent local.
   */
  stationId?: string;
  /**
   * Define si se debe generar o no el recibo de salida.
   * Si no se envía, por compatibilidad se asume true.
   */
  generateReceipt?: boolean;
};

export type CloseExitResult =
  | {
      ok: true;
      parkingSessionId: string;
      ticketCode: string;
      scanCode: string;
      exitAtIso: string;
      finalAmount: number;
      amountPaid: number;
      paymentId: string;
      printJobId: string | null;
      receiptGenerated: boolean;
    }
  | {
      ok: false;
      code:
        | "VALIDATION_ERROR"
        | "NOT_FOUND"
        | "ALREADY_CLOSED"
        | "UNAUTHORIZED"
        | "INACTIVE_USER"
        | "UNKNOWN_ERROR";
      message: string;
      field?: "amountPaid" | "parkingSessionId" | "method";
    };

function toInt(n: unknown) {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? Math.trunc(v) : 0;
}

function isMethod(v: unknown): v is CloseExitPayload["method"] {
  return v === "CASH" || v === "NEQUI" || v === "TRANSFER" || v === "OTHER";
}

function safeStationId(raw?: string) {
  const s = (raw ?? "").trim();
  if (!s) return "TUNJA-1";
  return s.slice(0, 64);
}

function methodLabel(m: CloseExitPayload["method"]) {
  switch (m) {
    case "CASH":
      return "Efectivo";
    case "NEQUI":
      return "Nequi";
    case "TRANSFER":
      return "Transferencia";
    default:
      return "Otro";
  }
}

export async function closeExitAction(
  payload: CloseExitPayload
): Promise<CloseExitResult> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return {
        ok: false,
        code: "UNAUTHORIZED",
        message: "Debes iniciar sesión.",
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, isActive: true, name: true, email: true },
    });

    if (!user?.isActive) {
      return {
        ok: false,
        code: "INACTIVE_USER",
        message: "Tu usuario está inactivo. Contacta al administrador.",
      };
    }

    const parkingSessionId = (payload.parkingSessionId ?? "").trim();
    const suggestedAmount = Math.max(0, toInt(payload.suggestedAmount));
    const amountPaid = Math.max(0, toInt(payload.amountPaid));
    const method = payload.method;
    const stationId = safeStationId(payload.stationId);
    const generateReceipt = payload.generateReceipt !== false;

    if (!parkingSessionId) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        field: "parkingSessionId",
        message: "Falta el ID de la sesión.",
      };
    }

    if (!isMethod(method)) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        field: "method",
        message: "Selecciona un método de pago válido.",
      };
    }

    if (amountPaid <= 0) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        field: "amountPaid",
        message: "El valor recibido debe ser mayor a 0.",
      };
    }

    // En el flujo actual el valor final es el recibido manualmente
    const finalAmount = amountPaid;

    const res = await prisma.$transaction(
      async (tx) => {
        const ps = await tx.parkingSession.findUnique({
          where: { id: parkingSessionId },
          select: {
            id: true,
            status: true,
            ticketCode: true,
            scanCode: true,
            entryAt: true,
            exitAt: true,
            shiftId: true,
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

        if (!ps) {
          return {
            ok: false as const,
            code: "NOT_FOUND" as const,
            message: "Sesión no encontrada.",
          };
        }

        if (ps.status !== SessionStatus.IN) {
          return {
            ok: false as const,
            code: "ALREADY_CLOSED" as const,
            message: "Esta sesión ya fue cerrada o anulada.",
          };
        }

        const exitAt = new Date();
        const durationMs = Math.max(0, exitAt.getTime() - ps.entryAt.getTime());
        const durationMinutes = Math.ceil(durationMs / 60000);

        const updated = await tx.parkingSession.update({
          where: { id: ps.id },
          data: {
            status: SessionStatus.OUT,
            exitAt,
            pricingUnit: PricingUnit.MANUAL,
            suggestedAmount,
            finalAmount,
            amountPaid,
            closedById: user.id,
          },
          select: {
            id: true,
            ticketCode: true,
            scanCode: true,
            exitAt: true,
            shiftId: true,
          },
        });

        const payment = await tx.payment.create({
          data: {
            status: PaymentStatus.COMPLETED,
            method: method as PaymentMethod,
            amount: finalAmount,
            sessionId: updated.id,
            operatorId: user.id,
            shiftId: updated.shiftId ?? undefined,
          },
          select: { id: true },
        });

        const printJob = generateReceipt
          ? await tx.printJob.create({
              data: {
                type: PrintJobType.EXIT_RECEIPT,
                status: PrintJobStatus.PENDING,
                stationId,
                sessionId: updated.id,
                paymentId: payment.id,
                createdById: user.id,
                copies: 1,
                priority: 0,
                payload: {
                  kind: "EXIT_RECEIPT",
                  stationId,
                  parkingName: "Parqueadero Luca",

                  parkingSessionId: updated.id,
                  ticketCode: updated.ticketCode,
                  scanCode: updated.scanCode,
                  paymentId: payment.id,

                  vehicle: {
                    id: ps.vehicle.id,
                    type: ps.vehicle.type,
                    plate: ps.vehicle.plate,
                    plateNormalized: ps.vehicle.plateNormalized,
                  },

                  entryAtIso: ps.entryAt.toISOString(),
                  exitAtIso: exitAt.toISOString(),
                  durationMinutes,

                  suggestedAmount,
                  finalAmount,
                  amountPaid,
                  method,
                  methodLabel: methodLabel(method),

                  operator: {
                    id: user.id,
                    name: user.name ?? null,
                    email: user.email ?? null,
                  },

                  barcode: {
                    type: "SCAN_CODE",
                    value: updated.scanCode,
                  },

                  qr: {
                    type: "SCAN_CODE",
                    value: updated.scanCode,
                  },
                },
              },
              select: { id: true },
            })
          : null;

        return {
          ok: true as const,
          parkingSessionId: updated.id,
          ticketCode: updated.ticketCode,
          scanCode: updated.scanCode,
          exitAtIso: (updated.exitAt ?? exitAt).toISOString(),
          finalAmount,
          amountPaid,
          paymentId: payment.id,
          printJobId: printJob?.id ?? null,
          receiptGenerated: Boolean(printJob),
        };
      },
      { isolationLevel: "Serializable" }
    );

    if (!res.ok) return res;

    revalidatePath("/");

    return res;
  } catch (err) {
    console.error("[closeExitAction] Error:", err);
    return {
      ok: false,
      code: "UNKNOWN_ERROR",
      message: "Ocurrió un error al registrar la salida. Intenta de nuevo.",
    };
  }
}