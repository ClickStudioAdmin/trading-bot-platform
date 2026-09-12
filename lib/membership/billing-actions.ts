"use server";

import { getSessionMember } from "@/lib/auth/session";
import { writeEventLog } from "@/lib/logs/write";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  billingPath,
  checkoutPath,
  decideUpgrade,
  parseBillingMethod,
  parsePaySubscriptionFromCredit,
} from "./billing";
import {
  getMemberBilling,
  saveBillingMethod,
  saveStripeCustomerIds,
} from "./billing-store";
import { parsePlanId } from "./form";
import { getMembershipPlan } from "./store";
import { billingOrigin, getStripe, stripeSecretConfigured } from "./stripe";

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

export async function continueUpgradeAction(formData: FormData) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
    return;
  }
  const planId = parsePlanId(String(formData.get("planId") ?? ""));
  if (!planId) {
    redirect("/account/plans");
    return;
  }
  const method = parseBillingMethod(formData.get("billingMethod"));
  if (!method) {
    redirect(
      checkoutPath({
        plan: planId,
        error: "Choose Card or Crypto.",
      }),
    );
    return;
  }
  const paySubscriptionFromCredit = parsePaySubscriptionFromCredit(
    formData.get("paySubscriptionFromCredit"),
  );
  const loaded = await getMembershipPlan(planId);
  if (!loaded.ok) {
    redirect(checkoutPath({ plan: planId, error: loaded.error }));
    return;
  }
  const target = loaded.plan;
  const billing = await getMemberBilling(member.id);
  const decision = decideUpgrade({
    currentPlanId: billing?.planId ?? null,
    target,
    method,
  });
  const saved = await saveBillingMethod(member.id, method, {
    paySubscriptionFromCredit,
  });
  if (!saved.ok) {
    redirect(checkoutPath({ plan: planId, error: saved.error }));
    return;
  }
  if (decision.kind === "current") {
    redirect(
      checkoutPath({ plan: planId, error: "You are already on that plan." }),
    );
    return;
  }
  if (decision.kind === "need_method") {
    redirect(
      checkoutPath({
        plan: planId,
        error: "Choose Card or Crypto.",
      }),
    );
    return;
  }
  if (decision.kind === "reject") {
    redirect(checkoutPath({ plan: planId, error: decision.error }));
    return;
  }
  if (decision.kind === "wallet_shell") {
    await writeEventLog({
      scope: "system",
      event: "membership.billing_method",
      message: "Selected Crypto for upgrade",
      userId: member.id,
      data: { method, planId, paySubscriptionFromCredit },
    });
    revalidatePath("/account/billing");
    revalidatePath("/account/billing/checkout");
    redirect(checkoutPath({ plan: planId, notice: "wallet" }));
    return;
  }
  const stripe = getStripe();
  const origin = await billingOrigin();
  if (!stripeSecretConfigured() || !stripe || !origin) {
    redirect(
      checkoutPath({
        plan: planId,
        error:
          "Stripe is not configured. Add STRIPE_SECRET_KEY and APP_BASE_URL on this environment.",
      }),
    );
    return;
  }
  const priceId = target.stripePriceId ?? "";
  try {
    if (
      billing?.stripeSubscriptionId &&
      (billing.subscriptionStatus === "active" ||
        billing.subscriptionStatus === "past_due")
    ) {
      const subscription = await stripe.subscriptions.retrieve(
        billing.stripeSubscriptionId,
      );
      const itemId = subscription.items.data[0]?.id;
      if (!itemId || !priceId) {
        redirect(
          checkoutPath({
            plan: planId,
            error: "Could not update the current Stripe subscription.",
          }),
        );
        return;
      }
      await stripe.subscriptions.update(billing.stripeSubscriptionId, {
        items: [{ id: itemId, price: priceId }],
        proration_behavior: "create_prorations",
        cancel_at_period_end: false,
        metadata: { userId: member.id, planId },
      });
      await writeEventLog({
        scope: "system",
        event: "membership.checkout_started",
        message: "Updated Stripe subscription price",
        userId: member.id,
        data: { planId, subscriptionId: billing.stripeSubscriptionId },
      });
      revalidatePath("/account/billing");
      redirect(billingPath({ upgraded: "1" }));
      return;
    }
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
      mode: "subscription",
      customer: customerId,
      client_reference_id: member.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/account/billing?checkout=success`,
      cancel_url: `${origin}${checkoutPath({ plan: planId, checkout: "cancel" })}`,
      metadata: { userId: member.id, planId },
      subscription_data: {
        metadata: { userId: member.id, planId },
      },
    });
    const checkoutUrl = session.url;
    if (!checkoutUrl) {
      redirect(
        checkoutPath({
          plan: planId,
          error: "Stripe did not return a checkout URL.",
        }),
      );
      return;
    }
    await writeEventLog({
      scope: "system",
      event: "membership.checkout_started",
      message: "Started Stripe checkout",
      userId: member.id,
      data: { planId, sessionId: session.id },
    });
    redirect(checkoutUrl);
  } catch (cause) {
    if (isNextRedirect(cause)) {
      throw cause;
    }
    redirect(
      checkoutPath({
        plan: planId,
        error:
          cause instanceof Error ? cause.message : "Stripe checkout failed.",
      }),
    );
  }
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
