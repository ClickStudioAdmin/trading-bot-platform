import { createServer } from "node:http";
import { runEngineCycle } from "./cycle";
import { engineWorkerId } from "./lease-store";
import { writeEventLog } from "@/lib/logs/write";
import { createServiceClient } from "@/lib/supabase/admin";

const LOOP_MS = Math.max(
  5_000,
  Number.parseInt(String(process.env.ENGINE_LOOP_MS ?? "20000"), 10) || 20_000,
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main(): Promise<void> {
  process.env.TBP_ENGINE_WORKER = "1";
  const workerId = engineWorkerId();
  const port = Number.parseInt(String(process.env.PORT ?? "8080"), 10) || 8080;
  console.log(`engine worker boot ${workerId} loopMs=${LOOP_MS}`);
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
    data: { workerId, loopMs: LOOP_MS },
  });
  console.log(`engine worker started ${workerId}`);
  for (;;) {
    const started = Date.now();
    try {
      const stats = await runEngineCycle({
        silent: true,
        workerId,
        maxMs: Math.max(5_000, LOOP_MS - 2_000),
      });
      console.log(
        `engine cycle desks=${stats.desks} opened=${stats.opened} closed=${stats.closed}`,
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
    const wait = LOOP_MS - (Date.now() - started);
    if (wait > 0) {
      await sleep(wait);
    }
  }
}

main().catch((cause) => {
  console.error(cause);
  process.exit(1);
});
