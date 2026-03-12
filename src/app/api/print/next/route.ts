// src/app/api/print/next/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PrintJobStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NextJobResponse =
  | {
      ok: true;
      job: {
        id: string;
        type: string;
        stationId: string;
        copies: number;
        payload: any;
        createdAtIso: string;
      };
    }
  | { ok: true; job: null }
  | { ok: false; message: string };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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
  const n = Number(v ?? 20000);
  if (!Number.isFinite(n)) return 20000;
  return Math.min(Math.max(Math.trunc(n), 0), 25000);
}

/**
 * GET /api/print/next?stationId=TUNJA-1&agentId=PC-1&waitMs=20000
 *
 * - Reclama 1 job PENDING de la estación
 * - Si no hay, espera hasta waitMs (long-poll)
 * - Rescata jobs PRINTING "atascados" (lockedAt viejo) y los vuelve a PENDING
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const stationId = safeStationId(url.searchParams.get("stationId"));
    const agentId = safeAgentId(url.searchParams.get("agentId"));
    const waitMs = clampWaitMs(url.searchParams.get("waitMs"));

    const started = Date.now();
    const deadline = started + waitMs;

    // Si un job quedó PRINTING por un crash, lo devolvemos a PENDING después de X minutos
    const STUCK_MS = 2 * 60 * 1000; // 2 minutos

    while (true) {
      // 0) rescate suave (no bloqueante)
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
      } catch {
        // no rompemos el flujo si esto falla
      }

      // 1) intento de claim
      const claimed = await prisma.$transaction(async (tx) => {
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

        if (!job) return null;

        // si excedió reintentos, lo marcamos FAILED y no lo entregamos
        if (job.attempts >= job.maxAttempts) {
          await tx.printJob.update({
            where: { id: job.id },
            data: {
              status: PrintJobStatus.FAILED,
              lastError: "Max attempts exceeded (auto-failed by /api/print/next).",
              lockedAt: null,
              lockedBy: null,
            },
          });
          return null;
        }

        const updated = await tx.printJob.update({
          where: { id: job.id },
          data: {
            status: PrintJobStatus.PRINTING,
            lockedAt: new Date(),
            lockedBy: agentId,
          },
          select: {
            id: true,
            type: true,
            stationId: true,
            copies: true,
            payload: true,
            createdAt: true,
          },
        });

        return updated;
      });

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

      // 2) no hay job
      if (Date.now() >= deadline) {
        const body: NextJobResponse = { ok: true, job: null };
        return NextResponse.json(body, { status: 200 });
      }

      await sleep(350);
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