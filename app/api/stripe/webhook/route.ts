import { constructStripeEvent } from "@/lib/membership/stripe";
import { handleStripeEvent } from "@/lib/membership/stripe-webhook";

export const maxDuration = 30;

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  let event;
  try {
    event = constructStripeEvent(rawBody, signature);
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Invalid Stripe signature.";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
  try {
    const result = await handleStripeEvent(event);
    if (!result.ok) {
      return Response.json(
        { ok: false, error: result.error },
        { status: result.status ?? 500 },
      );
    }
    return Response.json({ ok: true });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Webhook failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
