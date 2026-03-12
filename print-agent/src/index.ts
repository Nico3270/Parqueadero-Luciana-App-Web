// print-agent/src/index.ts
import "dotenv/config";
import { z } from "zod";
import { printUsbTicket, type PrintJobPayload } from "./printing/escpos-usb";

const Env = z.object({
  SERVER_BASE_URL: z.string().url(),
  STATION_ID: z.string().min(1),
  AGENT_ID: z.string().min(1),
  WAIT_MS: z.coerce.number().int().min(0).max(25000).default(20000),
});

const env = Env.parse(process.env);

type NextJobResponse =
  | { ok: true; job: null }
  | {
      ok: true;
      job: {
        id: string;
        type: string;
        stationId: string;
        copies: number;
        payload: PrintJobPayload;
        createdAtIso: string;
      };
    }
  | { ok: false; message: string };

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function ts() {
  return new Date().toISOString();
}

function log(message: string, meta?: Record<string, unknown>) {
  if (meta) {
    console.log(`[${ts()}] [print-agent] ${message}`, meta);
    return;
  }
  console.log(`[${ts()}] [print-agent] ${message}`);
}

function logError(message: string, meta?: Record<string, unknown>) {
  if (meta) {
    console.error(`[${ts()}] [print-agent] ${message}`, meta);
    return;
  }
  console.error(`[${ts()}] [print-agent] ${message}`);
}

async function getNextJob() {
  const url = new URL(`${env.SERVER_BASE_URL}/api/print/next`);
  url.searchParams.set("stationId", env.STATION_ID);
  url.searchParams.set("agentId", env.AGENT_ID);
  url.searchParams.set("waitMs", String(env.WAIT_MS));

  const startedAt = Date.now();
  log("requesting next job", {
    url: url.toString(),
    stationId: env.STATION_ID,
    agentId: env.AGENT_ID,
    waitMs: env.WAIT_MS,
  });

  const res = await fetch(url.toString(), { method: "GET" });
  const elapsedMs = Date.now() - startedAt;

  log("response from /api/print/next", {
    status: res.status,
    ok: res.ok,
    elapsedMs,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`next failed: ${res.status} ${body}`);
  }

  const json = (await res.json()) as NextJobResponse;

  if (json.ok && json.job) {
    log("job received from /api/print/next", {
      jobId: json.job.id,
      type: json.job.type,
      stationId: json.job.stationId,
      copies: json.job.copies,
      createdAtIso: json.job.createdAtIso,
      payloadKind: json.job.payload?.kind ?? null,
      ticketCode:
        typeof json.job.payload?.ticketCode === "string"
          ? json.job.payload.ticketCode
          : null,
      plate:
        typeof json.job.payload?.vehicle?.plate === "string"
          ? json.job.payload.vehicle.plate
          : null,
    });
  } else if (json.ok && !json.job) {
    log("no pending jobs");
  } else {
    logError("api returned ok=false", {
      message: (json as { ok: false; message: string }).message,
    });
  }

  return json;
}

async function ackJob(args: {
  jobId: string;
  outcome: "PRINTED" | "FAILED";
  errorMessage?: string;
}) {
  const body = {
    jobId: args.jobId,
    stationId: env.STATION_ID,
    agentId: env.AGENT_ID,
    outcome: args.outcome,
    errorMessage: args.errorMessage,
    printedAtIso: new Date().toISOString(),
  };

  const startedAt = Date.now();
  log("sending ack", {
    jobId: args.jobId,
    outcome: args.outcome,
    hasErrorMessage: Boolean(args.errorMessage),
  });

  const res = await fetch(`${env.SERVER_BASE_URL}/api/print/ack`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const elapsedMs = Date.now() - startedAt;

  log("response from /api/print/ack", {
    jobId: args.jobId,
    outcome: args.outcome,
    status: res.status,
    ok: res.ok,
    elapsedMs,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ack failed: ${res.status} ${text}`);
  }

  return (await res.json()) as { ok: boolean };
}

function safeErrMsg(err: unknown) {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
      ? err
      : "Unknown error";

  return msg.slice(0, 900);
}

async function printWithCopies(payload: PrintJobPayload, copies: number) {
  const n = Number.isFinite(copies)
    ? Math.max(1, Math.min(5, Math.trunc(copies)))
    : 1;

  log("starting printWithCopies", {
    copiesRequested: copies,
    copiesNormalized: n,
    payloadKind: payload?.kind ?? null,
    ticketCode: typeof payload?.ticketCode === "string" ? payload.ticketCode : null,
    plate:
      typeof payload?.vehicle?.plate === "string" ? payload.vehicle.plate : null,
  });

  for (let i = 0; i < n; i++) {
    const copyNumber = i + 1;
    const startedAt = Date.now();

    log("printing copy", {
      copyNumber,
      totalCopies: n,
      payloadKind: payload?.kind ?? null,
    });

    await printUsbTicket(payload);

    log("copy printed", {
      copyNumber,
      totalCopies: n,
      elapsedMs: Date.now() - startedAt,
    });

    await sleep(120);
  }

  log("printWithCopies finished", {
    totalCopies: n,
    payloadKind: payload?.kind ?? null,
  });
}

async function main() {
  log("start", {
    version: "debug-index-v1",
    server: env.SERVER_BASE_URL,
    station: env.STATION_ID,
    agent: env.AGENT_ID,
    waitMs: env.WAIT_MS,
  });

  let consecutiveErrors = 0;
  let loopCount = 0;

  while (true) {
    loopCount++;

    try {
      log("loop tick", {
        loopCount,
        consecutiveErrors,
      });

      const data = await getNextJob();

      if (!data.ok) {
        logError("/next returned ok=false", {
          loopCount,
          message: data.message,
        });

        consecutiveErrors++;
        const backoffMs = Math.min(2000 + consecutiveErrors * 250, 6000);

        log("sleep after /next error", {
          backoffMs,
          consecutiveErrors,
        });

        await sleep(backoffMs);
        continue;
      }

      if (!data.job) {
        consecutiveErrors = 0;
        continue;
      }

      const job = data.job;

      log("starting job processing", {
        jobId: job.id,
        type: job.type,
        stationId: job.stationId,
        copies: job.copies,
        payloadKind: job.payload?.kind ?? null,
      });

      try {
        const printStartedAt = Date.now();

        await printWithCopies(job.payload, job.copies);

        log("print phase completed", {
          jobId: job.id,
          elapsedMs: Date.now() - printStartedAt,
        });

        await ackJob({ jobId: job.id, outcome: "PRINTED" });

        log("job completed successfully", {
          jobId: job.id,
          outcome: "PRINTED",
        });

        consecutiveErrors = 0;
      } catch (printErr) {
        const msg = safeErrMsg(printErr);

        logError("print failed", {
          jobId: job.id,
          errorMessage: msg,
        });

        try {
          await ackJob({
            jobId: job.id,
            outcome: "FAILED",
            errorMessage: msg,
          });

          log("job marked as FAILED", {
            jobId: job.id,
          });
        } catch (ackErr) {
          logError("ack FAILED error", {
            jobId: job.id,
            errorMessage: safeErrMsg(ackErr),
          });
        }

        consecutiveErrors++;
        const backoffMs = Math.min(1500 + consecutiveErrors * 300, 6000);

        log("sleep after print failure", {
          jobId: job.id,
          backoffMs,
          consecutiveErrors,
        });

        await sleep(backoffMs);
      }
    } catch (err) {
      const msg = safeErrMsg(err);

      logError("loop error", {
        loopCount,
        errorMessage: msg,
      });

      consecutiveErrors++;
      const backoffMs = Math.min(1500 + consecutiveErrors * 300, 6000);

      log("sleep after loop error", {
        backoffMs,
        consecutiveErrors,
      });

      await sleep(backoffMs);
    }
  }
}

main().catch((e) => {
  logError("fatal main error", {
    errorMessage: safeErrMsg(e),
  });
  process.exit(1);
});