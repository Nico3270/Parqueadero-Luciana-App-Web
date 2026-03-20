// src/app/api/print/next/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma, PrintJobStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_WAIT_MS = 120000; // 2 minutos
const MAX_WAIT_MS = 360000; // 6 minutos
const POLL_INTERVAL_MS = 350;
const STUCK_MS = 2 * 60 * 1000; // 2 minutos
const CLAIM_MAX_RETRIES = 4;
const CLAIM_RETRY_DELAY_MS = 180;

type NextJobResponse =
  | {
      ok: true;
      job: {
        id: string;
        type: string;
        stationId: string;
        copies: number;
        payload: Prisma.JsonValue;
        createdAtIso: string;
      };
    }
  | { ok: true; job: null }
  | { ok: false; message: string };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeStationId(v: string | null) {
  const s = (v ?? "").trim();
  return (s || "TUNJA-1").slice(0, 64);
}

function safeAgentId(v: string | null) {
  const s = (v ?? "").trim();
  return (s || "agent-unknown").slice(0, 64);
}

function clampWaitMs(v: string | null) {
  const n = Number(v ?? DEFAULT_WAIT_MS);
  if (!Number.isFinite(n)) return DEFAULT_WAIT_MS;
  return Math.min(Math.max(Math.trunc(n), 0), MAX_WAIT_MS);
}

function isRetryablePrismaWriteConflict(err: unknown) {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2034"
  );
}

async function rescueStuckPrintingJobs(stationId: string) {
  try {
    await prisma.printJob.updateMany({
      where: {
        stationId,
        status: PrintJobStatus.PRINTING,
        lockedAt: { lt: new Date(Date.now() - STUCK_MS) },
      },
      data: {
        status: PrintJobStatus.PENDING,
        lockedAt: null,
        lockedBy: null,
        lastError: "Recovered from stuck PRINTING (timeout).",
      },
    });
  } catch (err) {
    console.warn("[api/print/next] Soft rescue failed:", err);
  }
}

async function claimNextJobOnce(stationId: string, agentId: string) {
  return prisma.$transaction(
    async (tx) => {
      const job = await tx.printJob.findFirst({
        where: {
          stationId,
          status: PrintJobStatus.PENDING,
        },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          type: true,
          stationId: true,
          copies: true,
          payload: true,
          createdAt: true,
          attempts: true,
          maxAttempts: true,
        },
      });

      if (!job) {
        return null;
      }

      if (job.attempts >= job.maxAttempts) {
        await tx.printJob.updateMany({
          where: {
            id: job.id,
            status: PrintJobStatus.PENDING,
          },
          data: {
            status: PrintJobStatus.FAILED,
            lastError: "Max attempts exceeded (auto-failed by /api/print/next).",
            lockedAt: null,
            lockedBy: null,
          },
        });

        return null;
      }

      const updated = await tx.printJob.updateMany({
        where: {
          id: job.id,
          status: PrintJobStatus.PENDING,
        },
        data: {
          status: PrintJobStatus.PRINTING,
          lockedAt: new Date(),
          lockedBy: agentId,
        },
      });

      if (updated.count === 0) {
        return null;
      }

      const claimed = await tx.printJob.findUnique({
        where: { id: job.id },
        select: {
          id: true,
          type: true,
          stationId: true,
          copies: true,
          payload: true,
          createdAt: true,
        },
      });

      return claimed;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );
}

async function claimNextJobWithRetries(stationId: string, agentId: string) {
  let lastRetryableError: unknown = null;

  for (let attempt = 1; attempt <= CLAIM_MAX_RETRIES; attempt++) {
    try {
      return await claimNextJobOnce(stationId, agentId);
    } catch (err) {
      if (!isRetryablePrismaWriteConflict(err)) {
        throw err;
      }

      lastRetryableError = err;

      console.warn("[api/print/next] Retryable Prisma conflict", {
        attempt,
        stationId,
        agentId,
        code:
          err instanceof Prisma.PrismaClientKnownRequestError ? err.code : null,
        message: err instanceof Error ? err.message : String(err),
      });

      if (attempt < CLAIM_MAX_RETRIES) {
        await sleep(CLAIM_RETRY_DELAY_MS * attempt);
        continue;
      }
    }
  }

  throw lastRetryableError ?? new Error("Unknown retryable claim conflict");
}

/**
 * GET /api/print/next?stationId=TUNJA-1&agentId=PC-1&waitMs=120000
 *
 * - Reclama 1 job PENDING de la estación
 * - Si no hay, espera hasta waitMs (long-poll)
 * - Rescata jobs PRINTING atascados y los vuelve a PENDING
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const stationId = safeStationId(url.searchParams.get("stationId"));
    const agentId = safeAgentId(url.searchParams.get("agentId"));
    const waitMs = clampWaitMs(url.searchParams.get("waitMs"));

    const deadline = Date.now() + waitMs;

    while (true) {
      await rescueStuckPrintingJobs(stationId);

      const claimed = await claimNextJobWithRetries(stationId, agentId);

      if (claimed) {
        const body: NextJobResponse = {
          ok: true,
          job: {
            id: claimed.id,
            type: claimed.type,
            stationId: claimed.stationId,
            copies: claimed.copies,
            payload: claimed.payload,
            createdAtIso: claimed.createdAt.toISOString(),
          },
        };

        return NextResponse.json(body, { status: 200 });
      }

      if (Date.now() >= deadline) {
        const body: NextJobResponse = { ok: true, job: null };
        return NextResponse.json(body, { status: 200 });
      }

      await sleep(POLL_INTERVAL_MS);
    }
  } catch (err) {
    console.error("[api/print/next] Error:", err);

    const body: NextJobResponse = {
      ok: false,
      message: "Error obteniendo el siguiente trabajo de impresión.",
    };

    return NextResponse.json(body, { status: 500 });
  }
}