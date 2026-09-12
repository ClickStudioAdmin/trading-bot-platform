"use server";

import { getSessionMember } from "@/lib/auth/session";
import { writeEventLog } from "@/lib/logs/write";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  billingPath,
  decideUpgrade,
  embeddedCheckoutReturnUrl,
  hasUsableStripeSubscription,
  parseBillingMethod,
  parsePaySubscriptionFromCredit,
  stripeCheckoutBranding,
} from "./billing";
import {
  getMemberBilling,
  saveBillingMethod,
  saveStripeCustomerIds,
} from "./billing-store";
import { parsePlanId } from "./form";
import { getMembershipPlan } from "./store";
import { billingOrigin, getStripe, stripeSecretConfigured } from "./stripe";

export type EmbeddedCheckoutResult =
  | { ok: true; clientSecret: string }
  | { ok: false; error: string };

function fail(
  error: string,
  extra: Record<string, string | undefined> = {},
): never {
  redirect(billingPath({ ...extra, error }));
  throw new Error(error);
}

export async function setBillingMethodAction(formData: FormData) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
    return;
  }
  const method = parseBillingMethod(formData.get("billingMethod"));
  if (!method) {
    fail("Choose Card or Crypto.");
  }
  const paySubscriptionFromCredit = parsePaySubscriptionFromCredit(
    formData.get("paySubscriptionFromCredit"),
  );
  const saved = await saveBillingMethod(member.id, method, {
    paySubscriptionFromCredit,
  });
  if (!saved.ok) {
    fail(saved.error);
  }
  const billing = await getMemberBilling(member.id);
  if (billing?.stripeSubscriptionId && stripeSecretConfigured()) {
    const stripe = getStripe();
    if (stripe) {
      try {
        await stripe.subscriptions.update(billing.stripeSubscriptionId, {
          cancel_at_period_end: method === "wallet",
        });
      } catch (cause) {
        fail(cause instanceof Error ? cause.message : "Stripe update failed.");
      }
    }
  }
  await writeEventLog({
    scope: "system",
    event: "membership.billing_method",
    message: `Set collection method to ${method}`,
    userId: member.id,
    data: { method, paySubscriptionFromCredit },
  });
  revalidatePath("/account/billing");
  redirect(billingPath({ saved: "method" }));
}

export async function createEmbeddedCheckoutSecret(
  planIdRaw: string,
): Promise<EmbeddedCheckoutResult> {
  const member = await getSessionMember();
  if (!member) {
    return { ok: false, error: "Sign in to continue." };
  }
  const planId = parsePlanId(planIdRaw);
  if (!planId) {
    return { ok: false, error: "That plan is not valid." };
  }
  const loaded = await getMembershipPlan(planId);
  if (!loaded.ok) {
    return { ok: false, error: loaded.error };
  }
  const target = loaded.plan;
  const billing = await getMemberBilling(member.id);
  const decision = decideUpgrade({
    currentPlanId: billing?.planId ?? null,
    target,
    method: "stripe",
  });
  if (decision.kind === "current") {
    return { ok: false, error: "You are already on that plan." };
  }
  if (decision.kind === "reject") {
    return { ok: false, error: decision.error };
  }
  if (decision.kind !== "checkout") {
    return { ok: false, error: "Choose Card to use the Stripe form." };
  }
  const saved = await saveBillingMethod(member.id, "stripe");
  if (!saved.ok) {
    return { ok: false, error: saved.error };
  }
  if (billing && hasUsableStripeSubscription(billing)) {
    return {
      ok: false,
      error: "This login already has a Stripe subscription. Confirm the plan change.",
    };
  }
  const stripe = getStripe();
  const origin = await billingOrigin();
  if (!stripeSecretConfigured() || !stripe || !origin) {
    return {
      ok: false,
      error:
        "Stripe is not configured. Add STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, and APP_BASE_URL on this environment.",
    };
  }
  const priceId = target.stripePriceId ?? "";
  if (!priceId) {
    return {
      ok: false,
      error: "This plan has no Stripe price yet. Add a price id on Admin → Plans.",
    };
  }
  try {
    let customerId = billing?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: member.email,
        name: member.name,
        metadata: { userId: member.id },
      });
      customerId = customer.id;
      await saveStripeCustomerIds({
        userId: member.id,
        stripeCustomerId: customerId,
      });
    }
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded_page",
      mode: "subscription",
      customer: customerId,
      client_reference_id: member.id,
      line_items: [{ price: priceId, quantity: 1 }],
      redirect_on_completion: "if_required",
      return_url: embeddedCheckoutReturnUrl(origin),
      branding_settings: stripeCheckoutBranding(),
      metadata: { userId: member.id, planId },
      subscription_data: {
        metadata: { userId: member.id, planId },
      },
    });
    const clientSecret = session.client_secret;
    if (!clientSecret) {
      return { ok: false, error: "Stripe did not return a checkout client secret." };
    }
    await writeEventLog({
      scope: "system",
      event: "membership.checkout_started",
      message: "Started on-site Stripe checkout",
      userId: member.id,
      data: { planId, sessionId: session.id },
    });
    return { ok: true, clientSecret };
  } catch (cause) {
    return {
      ok: false,
      error:
        cause instanceof Error ? cause.message : "Stripe checkout failed.",
    };
  }
}

export async function confirmStripePlanChangeAction(formData: FormData) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
    return;
  }
  const planId = parsePlanId(String(formData.get("planId") ?? ""));
  if (!planId) {
    fail("That plan is not valid.");
  }
  const loaded = await getMembershipPlan(planId);
  if (!loaded.ok) {
    fail(loaded.error);
  }
  const target = loaded.plan;
  const billing = await getMemberBilling(member.id);
  const decision = decideUpgrade({
    currentPlanId: billing?.planId ?? null,
    target,
    method: "stripe",
  });
  if (decision.kind === "current") {
    fail("You are already on that plan.");
  }
  if (decision.kind === "reject") {
    fail(decision.error);
  }
  if (decision.kind !== "checkout" || !billing || !hasUsableStripeSubscription(billing)) {
    fail("No Stripe subscription to update. Pay with the card form.");
  }
  const stripe = getStripe();
  if (!stripeSecretConfigured() || !stripe) {
    fail("Stripe is not configured.");
  }
  const priceId = target.stripePriceId ?? "";
  try {
    const subscription = await stripe.subscriptions.retrieve(
      billing.stripeSubscriptionId as string,
    );
    const itemId = subscription.items.data[0]?.id;
    if (!itemId || !priceId) {
      fail("Could not update the current Stripe subscription.");
    }
    await stripe.subscriptions.update(billing.stripeSubscriptionId as string, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: "create_prorations",
      cancel_at_period_end: false,
      metadata: { userId: member.id, planId },
    });
    const saved = await saveBillingMethod(member.id, "stripe");
    if (!saved.ok) {
      fail(saved.error);
    }
    await writeEventLog({
      scope: "system",
      event: "membership.checkout_started",
      message: "Updated Stripe subscription price",
      userId: member.id,
      data: { planId, subscriptionId: billing.stripeSubscriptionId },
    });
    revalidatePath("/account/billing");
    redirect(billingPath({ upgraded: "1" }));
  } catch (cause) {
    if (isNextRedirect(cause)) {
      throw cause;
    }
    fail(cause instanceof Error ? cause.message : "Stripe update failed.");
  }
}

export async function saveCheckoutCryptoAction(formData: FormData) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
    return;
  }
  const planId = parsePlanId(String(formData.get("planId") ?? ""));
  const paySubscriptionFromCredit = parsePaySubscriptionFromCredit(
    formData.get("paySubscriptionFromCredit"),
  );
  const saved = await saveBillingMethod(member.id, "wallet", {
    paySubscriptionFromCredit,
  });
  if (!saved.ok) {
    fail(saved.error, planId ? { plan: planId } : {});
  }
  const billing = await getMemberBilling(member.id);
  if (billing?.stripeSubscriptionId && stripeSecretConfigured()) {
    const stripe = getStripe();
    if (stripe) {
      try {
        await stripe.subscriptions.update(billing.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
      } catch (cause) {
        fail(
          cause instanceof Error ? cause.message : "Stripe update failed.",
          planId ? { plan: planId } : {},
        );
      }
    }
  }
  await writeEventLog({
    scope: "system",
    event: "membership.billing_method",
    message: "Selected Crypto for upgrade",
    userId: member.id,
    data: { method: "wallet", planId, paySubscriptionFromCredit },
  });
  revalidatePath("/account/billing");
  revalidatePath("/account/billing/checkout");
}

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

export async function openCustomerPortalAction() {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
    return;
  }
  const billing = await getMemberBilling(member.id);
  if (!billing?.stripeCustomerId) {
    fail("No card customer yet. Upgrade with Card first.");
  }
  const stripe = getStripe();
  const origin = await billingOrigin();
  if (!stripe || !origin) {
    fail("Stripe is not configured.");
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: billing.stripeCustomerId,
    return_url: `${origin}/account/billing`,
  });
  if (!session.url) {
    fail("Stripe did not return a portal URL.");
  }
  redirect(session.url);
}
