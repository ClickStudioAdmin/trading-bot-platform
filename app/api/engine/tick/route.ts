import { authorizeCronSecret } from "@/lib/engine/cron";
import { runPaperEngineTick } from "@/lib/engine/tick";

export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "Tick is not configured." }, { status: 503 });
  }
  if (!authorizeCronSecret(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await runPaperEngineTick({ maxMs: 50_000 });
    return Response.json(result);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Tick failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
