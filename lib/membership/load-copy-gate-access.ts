import { listTradingAccounts } from "@/lib/accounts/store";
import { emptyCaps, emptyFeatures, type PlanCaps } from "@/lib/membership/catalog";
import {
  COPY_CAP_KEYS,
  COPY_FEATURE_KEYS,
  cheapestPublicSharePlanName,
  copyCapSnapshot,
  copyFeatureAccessFor,
  copyFeatureAccessList,
  followClickDenial,
  inviteDenial,
  ownerRefusesNewFollower,
  shareSaveDenial,
  type CopyGateAccess,
} from "@/lib/membership/entitlements";
import { getMemberBilling } from "@/lib/membership/billing-store";
import {
  getMembershipPlan,
  listCatalogMembershipPlans,
} from "@/lib/membership/store";
import { ensureMemberTrialGrants } from "@/lib/membership/trial-store";
import { emptyPlanTrials } from "@/lib/membership/trials";

export async function loadCopyGateAccess(
  userId: string,
): Promise<CopyGateAccess> {
  const billing = await getMemberBilling(userId);
  const [planResult, catalog, desks] = await Promise.all([
    billing ? getMembershipPlan(billing.planId) : Promise.resolve(null),
    listCatalogMembershipPlans(),
    listTradingAccounts(userId),
  ]);
  const plan = planResult && planResult.ok ? planResult.plan : null;
  const plans = catalog.ok ? catalog.plans : [];
  let grants: { key: string; endsAt: string }[] = [];
  let trials = plan?.trials ?? emptyPlanTrials();
  let nowMs = Date.now();
  if (plan) {
    const ensured = await ensureMemberTrialGrants({
      userId,
      plan,
      keys: [...COPY_FEATURE_KEYS, ...COPY_CAP_KEYS],
    });
    if (ensured.ok) {
      grants = ensured.grants;
      nowMs = ensured.nowMs;
    } else {
      trials = emptyPlanTrials();
    }
  }
  const features = plan?.features ?? emptyFeatures();
  const caps = plan ? plan.caps : closedCopyCaps();
  const featureRows = copyFeatureAccessList({
    features,
    trials,
    grants,
    nowMs,
    plans,
  });
  const follow = copyFeatureAccessFor(featureRows, "copy_follow");
  const publicShare = copyFeatureAccessFor(featureRows, "copy_catalogue");
  const privateShare = copyFeatureAccessFor(featureRows, "copy_share");
  const capInput = { features, caps, trials, grants, nowMs, plans };
  return {
    follow: follow ?? {
      key: "copy_follow",
      allowed: false,
      message: "Copying other traders' desks is not allowed on your plan.",
      upgradePlan: null,
    },
    publicShare: publicShare ?? {
      key: "copy_catalogue",
      allowed: false,
      message: "Sharing a desk publicly is not allowed on your plan.",
      upgradePlan: null,
    },
    privateShare: privateShare ?? {
      key: "copy_share",
      allowed: false,
      message: "Sharing a desk privately is not allowed on your plan.",
      upgradePlan: null,
    },
    sharingUpgradePlan: cheapestPublicSharePlanName(plans),
    copyCap: {
      ...copyCapSnapshot({ ...capInput, key: "max_copy_follows" }),
      used: desks.filter((desk) => desk.copyOfAccountId).length,
    },
    followerCap: copyCapSnapshot({
      ...capInput,
      key: "max_followers_accepted",
    }),
  };
}

export async function deniedNewCopyMessage(
  userId: string,
): Promise<string | null> {
  const gate = await loadCopyGateAccess(userId);
  return followClickDenial(gate)?.message ?? null;
}

export async function deniedShareListingMessage(
  userId: string,
  input: {
    sharingEnabled: boolean;
    visibility: "public" | "private";
    requestedMax: number | null;
  },
): Promise<string | null> {
  if (!input.sharingEnabled) {
    return null;
  }
  const gate = await loadCopyGateAccess(userId);
  return (
    shareSaveDenial(gate, {
      visibility: input.visibility,
      requestedMax: input.requestedMax,
    })?.message ?? null
  );
}

export async function deniedCopyInviteMessage(
  userId: string,
  followerCount: number,
): Promise<string | null> {
  const gate = await loadCopyGateAccess(userId);
  return inviteDenial(gate, followerCount)?.message ?? null;
}

export async function ownerBlocksNewFollower(input: {
  ownerId: string;
  followerCount: number;
  visibility: "public" | "private";
  alreadyCounted?: boolean;
}): Promise<boolean> {
  const gate = await loadCopyGateAccess(input.ownerId);
  return ownerRefusesNewFollower(gate, {
    followerCount: input.followerCount,
    visibility: input.visibility,
    alreadyCounted: input.alreadyCounted,
  });
}

function closedCopyCaps(): PlanCaps {
  const caps = emptyCaps();
  for (const key of COPY_CAP_KEYS) {
    caps[key] = 0;
  }
  return caps;
}
