// src/app/api/print/ack/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma, PrintJobStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACK_MAX_RETRIES = 4;
const ACK_RETRY_DELAY_MS = 180;

type AckBody = {
  jobId: string;
  stationId?: string;
  agentId?: string;
  outcome: "PRINTED" | "FAILED" | "CANCELED";
  printedAtIso?: string;
  errorMessage?: string;
};

type AckOkStatus = "PRINTED" | "FAILED" | "CANCELED";

type AckResponse =
  | { ok: true; jobId: string; status: AckOkStatus }
  | { ok: false; message: string };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryablePrismaWriteConflict(err: unknown) {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2034"
  );
}

function safeStationId(v?: string | null) {
  const s = (v ?? "").trim();
  return (s || "TUNJA-1").slice(0, 64);
}

function safeAgentId(v?: string | null) {
  const s = (v ?? "").trim();
  return (s || "agent-unknown").slice(0, 64);
}

function safeError(v?: string | null) {
  const s = (v ?? "").trim();
  return s.slice(0, 1000);
}

function parsePrintedAt(iso?: string) {
  if (!iso) return new Date();
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function mapFinalStatus(status: PrintJobStatus): AckOkStatus {
  if (status === PrintJobStatus.PRINTED) return "PRINTED";
  if (status === PrintJobStatus.CANCELED) return "CANCELED";
  return "FAILED";
}

async function processAckOnce(body: AckBody) {
  const jobId = body.jobId.trim();
  const stationId = safeStationId(body.stationId ?? null);
  const agentId = safeAgentId(body.agentId ?? null);
  const printedAt = parsePrintedAt(body.printedAtIso);
  const errorMessage = safeError(body.errorMessage ?? null);
  const outcome = body.outcome;

  return prisma.$transaction(
    async (tx) => {
      const job = await tx.printJob.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          stationId: true,
          status: true,
          lockedBy: true,
          attempts: true,
        },
      });

      if (!job) {
        return { ok: false as const, message: "PrintJob no existe." };
      }

      if (body.stationId && job.stationId !== stationId) {
        return {
          ok: false as const,
          message: "stationId no coincide con el job.",
        };
      }

      if (body.agentId && job.lockedBy && job.lockedBy !== agentId) {
        return {
          ok: false as const,
          message: "agentId no coincide con lockedBy.",
        };
      }

      // Idempotencia fuerte:
      // si ya quedó finalizado, devolvemos 200 OK sin volver a tocar nada.
      if (
        job.status === PrintJobStatus.PRINTED ||
        job.status === PrintJobStatus.FAILED ||
        job.status === PrintJobStatus.CANCELED
      ) {
        return {
          ok: true as const,
          jobId: job.id,
          status: mapFinalStatus(job.status),
        };
      }

      if (outcome === "CANCELED") {
        if (
          job.status !== PrintJobStatus.PENDING &&
          job.status !== PrintJobStatus.PRINTING
        ) {
          return {
            ok: false as const,
            message: "El job no puede cancelarse en este estado.",
          };
        }

        const updated = await tx.printJob.updateMany({
          where: {
            id: job.id,
            status: { in: [PrintJobStatus.PENDING, PrintJobStatus.PRINTING] },
          },
          data: {
            status: PrintJobStatus.CANCELED,
            lockedAt: null,
            lockedBy: null,
            lastError: errorMessage || null,
          },
        });

        if (updated.count === 0) {
          const fresh = await tx.printJob.findUnique({
            where: { id: job.id },
            select: { id: true, status: true },
          });

          if (
            fresh &&
            (fresh.status === PrintJobStatus.PRINTED ||
              fresh.status === PrintJobStatus.FAILED ||
              fresh.status === PrintJobStatus.CANCELED)
          ) {
            return {
              ok: true as const,
              jobId: fresh.id,
              status: mapFinalStatus(fresh.status),
            };
          }

          return {
            ok: false as const,
            message: "No se pudo cancelar el job por cambio concurrente.",
          };
        }

        return {
          ok: true as const,
          jobId: job.id,
          status: "CANCELED" as const,
        };
      }

      // Para PRINTED y FAILED esperamos que esté PRINTING.
      // Si por concurrencia ya cambió a final, el bloque de idempotencia de arriba lo cubre.
      if (job.status !== PrintJobStatus.PRINTING) {
        return {
          ok: false as const,
          message: "El job no está en estado PRINTING.",
        };
      }

      if (outcome === "PRINTED") {
        const updated = await tx.printJob.updateMany({
          where: {
            id: job.id,
            status: PrintJobStatus.PRINTING,
          },
          data: {
            status: PrintJobStatus.PRINTED,
            printedAt,
            lockedAt: null,
            lockedBy: null,
            lastError: null,
          },
        });

        if (updated.count === 0) {
          const fresh = await tx.printJob.findUnique({
            where: { id: job.id },
            select: { id: true, status: true },
          });

          if (
            fresh &&
            (fresh.status === PrintJobStatus.PRINTED ||
              fresh.status === PrintJobStatus.FAILED ||
              fresh.status === PrintJobStatus.CANCELED)
          ) {
            return {
              ok: true as const,
              jobId: fresh.id,
              status: mapFinalStatus(fresh.status),
            };
          }

          return {
            ok: false as const,
            message: "No se pudo confirmar la impresión por cambio concurrente.",
          };
        }

        return {
          ok: true as const,
          jobId: job.id,
          status: "PRINTED" as const,
        };
      }

      // outcome === FAILED
      const updated = await tx.printJob.updateMany({
        where: {
          id: job.id,
          status: PrintJobStatus.PRINTING,
        },
        data: {
          attempts: job.attempts + 1,
          lastError: errorMessage || "Print failed",
          status: PrintJobStatus.FAILED,
          lockedAt: null,
          lockedBy: null,
        },
      });

      if (updated.count === 0) {
        const fresh = await tx.printJob.findUnique({
          where: { id: job.id },
          select: { id: true, status: true },
        });

        if (
          fresh &&
          (fresh.status === PrintJobStatus.PRINTED ||
            fresh.status === PrintJobStatus.FAILED ||
            fresh.status === PrintJobStatus.CANCELED)
        ) {
          return {
            ok: true as const,
            jobId: fresh.id,
            status: mapFinalStatus(fresh.status),
          };
        }

        return {
          ok: false as const,
          message: "No se pudo marcar FAILED por cambio concurrente.",
        };
      }

      return {
        ok: true as const,
        jobId: job.id,
        status: "FAILED" as const,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );
}

/**
 * POST /api/print/ack
 * Body:
 * {
 *   "jobId": "xxx",
 *   "stationId": "TUNJA-1",
 *   "agentId": "PC-1",
 *   "outcome": "PRINTED" | "FAILED" | "CANCELED",
 *   "printedAtIso": "optional ISO",
 *   "errorMessage": "optional"
 * }
 *
 * Notas:
 * - Si outcome=FAILED -> marcamos FAILED FINAL para evitar bucles.
 * - Si Prisma devuelve P2034 -> reintentamos automáticamente.
 * - Si el job ya quedó finalizado -> respondemos 200 por idempotencia.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<AckBody>;

    const jobId = (body.jobId ?? "").trim();
    if (!jobId) {
      const res: AckResponse = { ok: false, message: "jobId es requerido." };
      return NextResponse.json(res, { status: 400 });
    }

    const outcome = body.outcome;
    if (outcome !== "PRINTED" && outcome !== "FAILED" && outcome !== "CANCELED") {
      const res: AckResponse = { ok: false, message: "outcome inválido." };
      return NextResponse.json(res, { status: 400 });
    }

    const normalizedBody: AckBody = {
      jobId,
      stationId: body.stationId,
      agentId: body.agentId,
      outcome,
      printedAtIso: body.printedAtIso,
      errorMessage: body.errorMessage,
    };

    let lastRetryableError: unknown = null;

    for (let attempt = 1; attempt <= ACK_MAX_RETRIES; attempt++) {
      try {
        const result = await processAckOnce(normalizedBody);

        if (!result.ok) {
          const res: AckResponse = { ok: false, message: result.message };
          return NextResponse.json(res, { status: 400 });
        }

        const res: AckResponse = {
          ok: true,
          jobId: result.jobId,
          status: result.status,
        };
        return NextResponse.json(res, { status: 200 });
      } catch (err) {
        if (!isRetryablePrismaWriteConflict(err)) {
          throw err;
        }

        lastRetryableError = err;

        console.warn("[api/print/ack] Retryable Prisma conflict", {
          attempt,
          jobId,
          code:
            err instanceof Prisma.PrismaClientKnownRequestError ? err.code : null,
          message: err instanceof Error ? err.message : String(err),
        });

        if (attempt < ACK_MAX_RETRIES) {
          await sleep(ACK_RETRY_DELAY_MS * attempt);
          continue;
        }
      }
    }

    console.error("[api/print/ack] Error after retries:", lastRetryableError);

    const res: AckResponse = {
      ok: false,
      message: "Conflicto concurrente procesando ACK. Intenta nuevamente.",
    };
    return NextResponse.json(res, { status: 409 });
  } catch (err) {
    console.error("[api/print/ack] Error:", err);
    const res: AckResponse = {
      ok: false,
      message: "Error procesando ACK de impresión.",
    };
    return NextResponse.json(res, { status: 500 });
  }
}