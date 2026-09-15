"use server";

import { getSessionMember } from "@/lib/auth/session";
import { writeEventLog } from "@/lib/logs/write";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  billingPath,
  checkoutCharge,
  checkoutPath,
  decideUpgrade,
  embeddedCardReturnUrl,
  embeddedCheckoutReturnUrl,
  embeddedSwitchToCardReturnUrl,
  hasUsableStripeSubscription,
  switchToCardTrialEnd,
  parseBillingMethod,
  parsePaySubscriptionFromCredit,
  stripeCheckoutBranding,
} from "./billing";
import {
  applyMemberPlanNow,
  getMemberBilling,
  recordStripeInvoice,
  saveBillingMethod,
  saveStripeCustomerIds,
} from "./billing-store";
import { invoiceWriteFromPaid } from "./stripe-apply";
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

function failCheckout(planId: string, error: string): never {
  redirect(checkoutPath({ plan: planId, error }));
  throw new Error(error);
}

function paymentMethodId(value: unknown): string | null {
  if (typeof value === "string" && value) {
    return value;
  }
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" && id ? id : null;
  }
  return null;
}

async function stripeDefaultPaymentMethod(
  stripe: NonNullable<ReturnType<typeof getStripe>>,
  customerId: string | null,
  subscription: { default_payment_method?: unknown } | null,
): Promise<string | null> {
  const fromSub = paymentMethodId(subscription?.default_payment_method);
  if (fromSub) {
    return fromSub;
  }
  if (!customerId) {
    return null;
  }
  const customer = await stripe.customers.retrieve(customerId);
  if ("deleted" in customer && customer.deleted) {
    return null;
  }
  const fromCustomer = paymentMethodId(
    customer.invoice_settings?.default_payment_method,
  );
  if (fromCustomer) {
    return fromCustomer;
  }
  const listed = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
    limit: 1,
  });
  return listed.data[0]?.id ?? null;
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
  redirect(billingPath({ tab: "method", saved: "method" }));
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
  const currentPlan = billing
    ? await getMembershipPlan(billing.planId)
    : { ok: false as const, error: "No plan" };
  const charge = checkoutCharge({
    currentPriceUsd: currentPlan.ok ? currentPlan.plan.priceUsd : 0,
    targetPriceUsd: target.priceUsd,
    periodEnd: billing?.periodEnd ?? null,
  });
  if (charge.kind === "upgrade") {
    return {
      ok: false,
      error:
        "Use the upgrade charge on this page. A new Stripe checkout is only for a first paid plan.",
    };
  }
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
    failCheckout(planId || "", "That plan is not valid.");
  }
  const loaded = await getMembershipPlan(planId);
  if (!loaded.ok) {
    failCheckout(planId, loaded.error);
  }
  const target = loaded.plan;
  const billing = await getMemberBilling(member.id);
  const decision = decideUpgrade({
    currentPlanId: billing?.planId ?? null,
    target,
    method: "stripe",
  });
  if (decision.kind === "current") {
    failCheckout(planId, "You are already on that plan.");
  }
  if (decision.kind === "reject") {
    failCheckout(planId, decision.error);
  }
  if (decision.kind !== "checkout" || !billing) {
    failCheckout(planId, "Choose Card to pay on this page.");
  }
  const stripe = getStripe();
  if (!stripeSecretConfigured() || !stripe) {
    failCheckout(planId, "Stripe is not configured.");
  }
  const priceId = target.stripePriceId ?? "";
  const currentPlan = await getMembershipPlan(billing.planId);
  const charge = checkoutCharge({
    currentPriceUsd: currentPlan.ok ? currentPlan.plan.priceUsd : 0,
    targetPriceUsd: target.priceUsd,
    periodEnd: billing.periodEnd,
  });
  const hasSub = hasUsableStripeSubscription(billing);
  if (charge.kind !== "upgrade" && !hasSub) {
    failCheckout(planId, "Pay with the card form.");
  }
  try {
    const subscription =
      hasSub && billing.stripeSubscriptionId
        ? await stripe.subscriptions.retrieve(billing.stripeSubscriptionId)
        : null;
    const itemId = subscription?.items.data[0]?.id;
    if (hasSub && (!itemId || !priceId)) {
      failCheckout(planId, "Could not update the current Stripe subscription.");
    }
    const dueCents = Math.round(charge.dueUsd * 100);
    if (dueCents >= 1) {
      const paymentMethod = await stripeDefaultPaymentMethod(
        stripe,
        billing.stripeCustomerId,
        subscription,
      );
      if (!billing.stripeCustomerId || !paymentMethod) {
        failCheckout(
          planId,
          "Update your card on Billing → Manage Payment Method, then try again.",
        );
      }
      const intent = await stripe.paymentIntents.create(
        {
          amount: dueCents,
          currency: "usd",
          customer: billing.stripeCustomerId,
          payment_method: paymentMethod,
          confirm: true,
          off_session: true,
          description:
            charge.kind === "upgrade" && charge.basis === "delta"
              ? `Upgrade to ${target.name} — difference from current plan`
              : `Upgrade to ${target.name} — remainder of this cycle`,
          metadata: {
            userId: member.id,
            planId,
            purpose: "upgrade_prorate",
          },
        },
        {
          idempotencyKey: `upgrade-pi:${member.id}:${planId}:${charge.kind === "upgrade" ? charge.periodEnd : "initial"}`,
        },
      );
      if (intent.status !== "succeeded") {
        failCheckout(
          planId,
          "Card payment did not complete. Update the card and try again.",
        );
      }
      const nowSec = Math.floor(Date.now() / 1000);
      const periodEndSec =
        charge.kind === "upgrade"
          ? Math.floor(Date.parse(charge.periodEnd) / 1000)
          : nowSec;
      await recordStripeInvoice(
        member.id,
        planId,
        invoiceWriteFromPaid({
          invoiceId: intent.id,
          amountPaidCents: dueCents,
          periodStart: nowSec,
          periodEnd: periodEndSec,
        }),
      );
    }
    if (hasSub && itemId && priceId && billing.stripeSubscriptionId) {
      await stripe.subscriptions.update(billing.stripeSubscriptionId, {
        items: [{ id: itemId, price: priceId }],
        proration_behavior: "none",
        cancel_at_period_end: false,
        metadata: { userId: member.id, planId },
      });
    }
    const applied = await applyMemberPlanNow({
      userId: member.id,
      planId,
      periodEnd:
        charge.kind === "upgrade" ? charge.periodEnd : billing.periodEnd,
    });
    if (!applied.ok) {
      failCheckout(planId, applied.error);
    }
    const saved = await saveBillingMethod(member.id, "stripe");
    if (!saved.ok) {
      failCheckout(planId, saved.error);
    }
    await writeEventLog({
      scope: "system",
      event: "membership.checkout_started",
      message:
        charge.kind === "upgrade"
          ? "Charged card upgrade remainder and scheduled new monthly price"
          : "Updated Stripe subscription price",
      userId: member.id,
      data: {
        planId,
        subscriptionId: billing.stripeSubscriptionId,
        dueUsd: charge.dueUsd,
        kind: charge.kind,
      },
    });
    revalidatePath("/account/billing");
    revalidatePath("/account/plans");
    redirect(billingPath({ upgraded: "1" }));
  } catch (cause) {
    if (isNextRedirect(cause)) {
      throw cause;
    }
    failCheckout(
      planId,
      cause instanceof Error ? cause.message : "Stripe update failed.",
    );
  }
}

export async function saveCheckoutMethodAction(formData: FormData) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
    return;
  }
  const planId = parsePlanId(String(formData.get("planId") ?? ""));
  const method = parseBillingMethod(formData.get("billingMethod"));
  if (!method) {
    if (planId) {
      failCheckout(planId, "Choose Card or Crypto.");
    }
    fail("Choose Card or Crypto.");
  }
  const paySubscriptionFromCredit = parsePaySubscriptionFromCredit(
    formData.get("paySubscriptionFromCredit"),
  );
  const saved = await saveBillingMethod(member.id, method, {
    paySubscriptionFromCredit,
  });
  if (!saved.ok) {
    if (planId) {
      failCheckout(planId, saved.error);
    }
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
        const message =
          cause instanceof Error ? cause.message : "Stripe update failed.";
        if (planId) {
          failCheckout(planId, message);
        }
        fail(message);
      }
    }
  }
  await writeEventLog({
    scope: "system",
    event: "membership.billing_method",
    message: `Selected ${method} at checkout`,
    userId: member.id,
    data: { method, planId, paySubscriptionFromCredit },
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

export async function createSwitchToCardSecret(): Promise<EmbeddedCheckoutResult> {
  const member = await getSessionMember();
  if (!member) {
    return { ok: false, error: "Sign in to continue." };
  }
  const billing = await getMemberBilling(member.id);
  if (!billing || billing.billingMethod !== "stripe") {
    return {
      ok: false,
      error: "Save Credit Card as your method first.",
    };
  }
  const loaded = await getMembershipPlan(billing.planId);
  if (!loaded.ok) {
    return { ok: false, error: loaded.error };
  }
  const plan = loaded.plan;
  if (plan.priceUsd < 0.01) {
    return { ok: false, error: "Free plans do not need a Stripe subscription." };
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
  try {
    let customerId = billing.stripeCustomerId ?? null;
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
    if (hasUsableStripeSubscription(billing)) {
      const session = await stripe.checkout.sessions.create({
        ui_mode: "embedded_page",
        mode: "setup",
        customer: customerId,
        currency: "usd",
        client_reference_id: member.id,
        redirect_on_completion: "if_required",
        return_url: embeddedSwitchToCardReturnUrl(origin),
        branding_settings: stripeCheckoutBranding(),
        metadata: {
          userId: member.id,
          planId: billing.planId,
          purpose: "switch_to_card",
        },
      });
      const clientSecret = session.client_secret;
      if (!clientSecret) {
        return { ok: false, error: "Stripe did not return a checkout client secret." };
      }
      return { ok: true, clientSecret };
    }
    const priceId = plan.stripePriceId ?? "";
    if (!priceId) {
      return {
        ok: false,
        error: "This plan has no Stripe price yet. Add a price id on Admin → Plans.",
      };
    }
    const trialEnd = switchToCardTrialEnd(billing.periodEnd);
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded_page",
      mode: "subscription",
      customer: customerId,
      client_reference_id: member.id,
      line_items: [{ price: priceId, quantity: 1 }],
      redirect_on_completion: "if_required",
      return_url: embeddedSwitchToCardReturnUrl(origin),
      branding_settings: stripeCheckoutBranding(),
      metadata: {
        userId: member.id,
        planId: billing.planId,
        purpose: "switch_to_card",
      },
      subscription_data: {
        metadata: {
          userId: member.id,
          planId: billing.planId,
          purpose: "switch_to_card",
        },
        ...(trialEnd ? { trial_end: trialEnd } : {}),
      },
    });
    const clientSecret = session.client_secret;
    if (!clientSecret) {
      return { ok: false, error: "Stripe did not return a checkout client secret." };
    }
    await writeEventLog({
      scope: "system",
      event: "membership.checkout_started",
      message: "Started Crypto to Card Stripe checkout",
      userId: member.id,
      data: { planId: billing.planId, sessionId: session.id },
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

export async function createEmbeddedCardSecret(): Promise<EmbeddedCheckoutResult> {
  const member = await getSessionMember();
  if (!member) {
    return { ok: false, error: "Sign in to continue." };
  }
  const billing = await getMemberBilling(member.id);
  if (billing?.billingMethod === "wallet") {
    return {
      ok: false,
      error: "Switch to Credit Card (Stripe) and save the method first.",
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
      mode: "setup",
      customer: customerId,
      currency: "usd",
      client_reference_id: member.id,
      redirect_on_completion: "if_required",
      return_url: embeddedCardReturnUrl(origin),
      branding_settings: stripeCheckoutBranding(),
      metadata: { userId: member.id, purpose: "manage_card" },
    });
    const clientSecret = session.client_secret;
    if (!clientSecret) {
      return { ok: false, error: "Stripe did not return a card client secret." };
    }
    return { ok: true, clientSecret };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Stripe card form failed.",
    };
  }
}
