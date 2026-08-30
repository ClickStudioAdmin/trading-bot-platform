import { handleFuturesWebhook } from "@/lib/futures/webhook-handle";

export const maxDuration = 60;

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  let rawBody: unknown = null;
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      rawBody = await request.json();
    } else {
      rawBody = await request.text();
    }
  } catch {
    return Response.json(
      { ok: false, error: "Send a JSON body." },
      { status: 400 },
    );
  }

  try {
    const result = await handleFuturesWebhook({ token, rawBody });
    return Response.json(result.body, { status: result.status });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Webhook failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
