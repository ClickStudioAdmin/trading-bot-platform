"use server";

import { requireAdmin } from "@/lib/admin/access";
import { getSessionMember } from "@/lib/auth/session";
import { writeEventLog } from "@/lib/logs/write";
import {
  AFFILIATE_PAYOUT_COIN,
  enrollState,
  parseAffiliateHoldDays,
  parseAffiliateMaxDepth,
  parseAffiliateMinPayout,
  parseDowngradeGraceDays,
  parsePayoutAddress,
  parsePayoutNetwork,
  parseUsdtNetworks,
  withdrawDecision,
} from "./affiliate";
import { parseUuid } from "./wallet-form";
import {
  approvePayout,
  listPayableCommissions,
  loadAffiliateSettings,
  loadMemberEnroll,
  markPayoutPaid,
  rejectPayout,
  releaseDueCommissions,
  requestUsdtPayout,
  saveAffiliateSettings,
} from "./affiliate-store";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function adminFail(error: string): never {
  redirect(`/admin/affiliates?error=${encodeURIComponent(error)}`);
}

function portalFail(error: string): never {
  redirect(`/account/affiliates?error=${encodeURIComponent(error)}`);
}

export async function saveAffiliateSettingsAction(formData: FormData) {
  await requireAdmin();
  const depth = parseAffiliateMaxDepth(formData.get("maxDepth"));
  if (!depth.ok) {
    adminFail(depth.error);
  }
  const hold = parseAffiliateHoldDays(formData.get("holdDays"));
  if (!hold.ok) {
    adminFail(hold.error);
  }
  const min = parseAffiliateMinPayout(formData.get("minPayoutUsd"));
  if (!min.ok) {
    adminFail(min.error);
  }
  const networks = parseUsdtNetworks(formData.get("usdtNetworks"));
  if (!networks.ok) {
    adminFail(networks.error);
  }
  const grace = parseDowngradeGraceDays(formData.get("downgradeGraceDays"));
  if (!grace.ok) {
    adminFail(grace.error);
  }
  const saved = await saveAffiliateSettings({
    maxDepth: depth.depth,
    holdDays: hold.days,
    minPayoutUsd: min.usd,
    payoutCoin: AFFILIATE_PAYOUT_COIN,
    usdtNetworks: networks.networks,
    downgradeGraceDays: grace.days,
  });
  if (!saved.ok) {
    adminFail(saved.error);
  }
  await writeEventLog({
    scope: "system",
    event: "membership.affiliate_settings",
    message: "Saved affiliate program settings",
    data: {
      maxDepth: depth.depth,
      holdDays: hold.days,
      minPayoutUsd: min.usd,
    },
  });
  revalidatePath("/admin/affiliates");
  revalidatePath("/account/affiliates");
  redirect("/admin/affiliates?saved=1");
}

export async function approvePayoutAction(formData: FormData) {
  const admin = await requireAdmin();
  const payoutId = parseUuid(formData.get("payoutId"));
  if (!payoutId) {
    adminFail("Missing payout.");
  }
  const saved = await approvePayout(payoutId);
  if (!saved.ok) {
    adminFail(saved.error);
  }
  await writeEventLog({
    scope: "system",
    event: "membership.payout_approved",
    message: "Approved an affiliate payout",
    userId: admin.id,
    data: { payoutId },
  });
  revalidatePath("/admin/affiliates");
  redirect("/admin/affiliates?saved=approved");
}

export async function rejectPayoutAction(formData: FormData) {
  const admin = await requireAdmin();
  const payoutId = parseUuid(formData.get("payoutId"));
  if (!payoutId) {
    adminFail("Missing payout.");
  }
  const saved = await rejectPayout(payoutId);
  if (!saved.ok) {
    adminFail(saved.error);
  }
  await writeEventLog({
    scope: "system",
    event: "membership.payout_rejected",
    message: "Rejected an affiliate payout",
    userId: admin.id,
    data: { payoutId },
  });
  revalidatePath("/admin/affiliates");
  revalidatePath("/account/affiliates");
  redirect("/admin/affiliates?saved=rejected");
}

export async function markPayoutPaidAction(formData: FormData) {
  const admin = await requireAdmin();
  const payoutId = parseUuid(formData.get("payoutId"));
  if (!payoutId) {
    adminFail("Missing payout.");
  }
  const externalId = String(formData.get("externalId") ?? "").trim() || null;
  const saved = await markPayoutPaid(payoutId, externalId);
  if (!saved.ok) {
    adminFail(saved.error);
  }
  await writeEventLog({
    scope: "system",
    event: "membership.payout_paid",
    message: "Marked an affiliate payout paid",
    userId: admin.id,
    data: { payoutId, externalId },
  });
  revalidatePath("/admin/affiliates");
  revalidatePath("/account/affiliates");
  redirect("/admin/affiliates?saved=paid");
}

export async function requestAffiliatePayoutAction(formData: FormData) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  await releaseDueCommissions();
  const settings = await loadAffiliateSettings();
  const network = parsePayoutNetwork(
    formData.get("network"),
    settings.usdtNetworks,
  );
  if (!network.ok) {
    portalFail(network.error);
  }
  const address = parsePayoutAddress(formData.get("address"));
  if (!address.ok) {
    portalFail(address.error);
  }
  const enroll = await loadMemberEnroll(member.id);
  const payable = await listPayableCommissions(member.id);
  const payableUsd = payable.reduce((sum, row) => sum + row.amountUsd, 0);
  const allowed = withdrawDecision({
    enrollState: enrollState({
      currentEnroll: enroll.currentEnroll,
      lastEnrollPlanId: enroll.lastEnrollPlanId,
    }),
    arrears: enroll.arrears,
    payableUsd,
    minPayoutUsd: settings.minPayoutUsd,
  });
  if (!allowed.ok) {
    portalFail(allowed.reason);
  }
  const requested = await requestUsdtPayout({
    userId: member.id,
    network: network.network,
    address: address.address,
  });
  if (!requested.ok) {
    portalFail(requested.error);
  }
  await writeEventLog({
    scope: "system",
    event: "membership.payout_requested",
    message: "Requested a USDT affiliate payout",
    userId: member.id,
    data: { payoutId: requested.payoutId, network: network.network },
  });
  revalidatePath("/account/affiliates");
  revalidatePath("/admin/affiliates");
  redirect("/account/affiliates?saved=withdraw");
}
