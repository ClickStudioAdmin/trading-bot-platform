import { createServer } from "node:http";
import { runEngineCycle } from "./cycle";
import { hasArmedIndicatorStarts } from "./hot-desks";
import {
  ENGINE_INDICATOR_LOOP_MS,
  ENGINE_LOOP_MS,
  engineLoopMs,
} from "./lease";
import { engineWorkerId } from "./lease-store";
import { writeEventLog } from "@/lib/logs/write";
import { createServiceClient } from "@/lib/supabase/admin";

function envMs(name: string, fallback: number): number {
  return Math.max(
    5_000,
    Number.parseInt(String(process.env[name] ?? ""), 10) || fallback,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main(): Promise<void> {
  process.env.TBP_ENGINE_WORKER = "1";
  const workerId = engineWorkerId();
  const idleMs = envMs("ENGINE_LOOP_MS", ENGINE_LOOP_MS);
  const indicatorMs = envMs("ENGINE_INDICATOR_LOOP_MS", ENGINE_INDICATOR_LOOP_MS);
  const port = Number.parseInt(String(process.env.PORT ?? "8080"), 10) || 8080;
  console.log(
    `engine worker boot ${workerId} loopMs=${idleMs} indicatorMs=${indicatorMs}`,
  );
  if (!createServiceClient()) {
    console.error(
      "engine worker missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
  }).listen(port);
  await writeEventLog({
    scope: "system",
    event: "engine.tick",
    message: `Engine worker ${workerId} started.`,
    data: { workerId, loopMs: idleMs, indicatorMs },
  });
  console.log(`engine worker started ${workerId}`);
  for (;;) {
    const indicatorArmed = await hasArmedIndicatorStarts();
    const loopMs = engineLoopMs({
      indicatorArmed,
      idleMs,
      indicatorMs,
    });
    const started = Date.now();
    try {
      const stats = await runEngineCycle({
        silent: true,
        workerId,
        maxMs: Math.max(5_000, loopMs - 2_000),
      });
      console.log(
        `engine cycle desks=${stats.desks} loopMs=${loopMs} scanned=${stats.scanned ? 1 : 0} tickers=${stats.tickers ? 1 : 0} opened=${stats.opened} closed=${stats.closed}`,
      );
    } catch (cause) {
      console.error("engine loop failed", cause);
      await writeEventLog({
        level: "error",
        scope: "system",
        event: "engine.tick",
        message: cause instanceof Error ? cause.message : "Engine loop failed",
        data: { workerId },
      });
    }
    const wait = loopMs - (Date.now() - started);
    if (wait > 0) {
      await sleep(wait);
    }
  }
}

main().catch((cause) => {
  console.error(cause);
  process.exit(1);
});
