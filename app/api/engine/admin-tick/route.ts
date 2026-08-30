import { getAdminUser } from "@/lib/admin/access";
import { runPaperEngineTick } from "@/lib/engine/tick";
import { writeEventLog } from "@/lib/logs/write";

export const maxDuration = 60;

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const auto = new URL(request.url).searchParams.get("auto") === "1";

  try {
    const result = await runPaperEngineTick({ silent: auto, maxMs: 50_000 });
    if (!auto) {
      await writeEventLog({
        scope: "system",
        event: "engine.tick_admin",
        message: `Admin ran a paper tick: opened ${result.opened}, added ${result.added}, closed ${result.closed}, clipped ${result.clipped}`,
        userId: admin.id,
        strategy: "cash-and-carry",
        data: result,
      });
    }
    return Response.json(result);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Tick failed";
    await writeEventLog({
      level: "error",
      scope: "system",
      event: "engine.tick_admin",
      message,
      userId: admin.id,
      strategy: "cash-and-carry",
    });
    return Response.json({ error: message }, { status: 500 });
  }
}
