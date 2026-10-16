import { createServer } from "node:http";
import { writeEventLog } from "@/lib/logs/write";
import { createServiceClient } from "@/lib/supabase/admin";
import { engineWorkerId } from "./lease-store";
import { drainBacktestQueue } from "./backtest-drain";

async function main(): Promise<void> {
  process.env.TBP_ENGINE_WORKER = "1";
  process.env.TBP_BACKTEST_WORKER = "1";
  const workerId = engineWorkerId();
  const port = Number.parseInt(String(process.env.PORT ?? "8080"), 10) || 8080;
  console.log(`backtest worker boot ${workerId}`);
  if (!createServiceClient()) {
    console.error(
      "backtest worker missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
  }).listen(port);
  await writeEventLog({
    scope: "system",
    event: "engine.tick",
    message: `Backtest worker ${workerId} started.`,
    data: { workerId },
  });
  console.log(`backtest worker started ${workerId}`);
  await drainBacktestQueue(workerId);
}

main().catch((cause) => {
  console.error(cause);
  process.exit(1);
});
