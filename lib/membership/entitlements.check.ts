import assert from "node:assert/strict";
import {
  emptyCaps,
  emptyFeatures,
  type PlanCaps,
  type PlanFeatures,
} from "@/lib/membership/catalog";
import { emptyPlanTrials, type PlanTrials } from "@/lib/membership/trials";
import {
  allowedDeskTypes,
  capUsageMessage,
  cheapestPublicCapPlanName,
  cheapestPublicPlanName,
  deniedDeskTypeMessage,
  deskTypeAccessList,
  deskTypeRejectLead,
  deskTypeUpgradeMessage,
  gateRejectLead,
  quotaAccessFor,
  templateFeatureAccessFor,
  templateFeatureAccessList,
  templateNotAllowedMessage,
  cheapestPublicSharePlanName,
  copyCapDecision,
  copyCapSnapshot,
  copyFeatureAccessFor,
  copyFeatureAccessList,
  followClickDenial,
  followTrialMessage,
  inviteDenial,
  inviteTrialMessage,
  ownerRefusesNewFollower,
  shareSaveDenial,
  shareTrialLines,
  sharingDeskMessage,
  type CopyGateAccess,
  quotaAccessList,
  quotaKeyAfterBind,
  quotaKeyForDesk,
  quotaRoomMessage,
  type CapUnlockCandidate,
  type UnlockCandidate,
} from "@/lib/membership/entitlements";

const nowMs = Date.parse("2026-10-14T00:00:00.000Z");

function features(on: Partial<PlanFeatures> = {}): PlanFeatures {
  return { ...emptyFeatures(), ...on };
}

function unlock(
  name: string,
  extra: Partial<UnlockCandidate> & { on?: Partial<PlanFeatures> } = {},
): UnlockCandidate {
  return {
    name,
    visibility: extra.visibility ?? "public",
    archivedAt: extra.archivedAt ?? null,
    priceUsd: extra.priceUsd ?? 0,
    sortOrder: extra.sortOrder ?? 0,
    features: features(extra.on),
  };
}

function access(input: {
  on?: Partial<PlanFeatures>;
  trials?: PlanTrials;
  grants?: { key: string; endsAt: string }[];
  plans?: UnlockCandidate[];
}) {
  return deskTypeAccessList({
    features: features(input.on),
    trials: input.trials ?? emptyPlanTrials(),
    grants: input.grants ?? [],
    nowMs,
    plans: input.plans ?? [],
  });
}

function row(
  rows: ReturnType<typeof access>,
  deskType: "dca" | "perps" | "perps_bots" | "cash_and_carry" | "signal_follower",
) {
  const found = rows.find((item) => item.deskType === deskType);
  assert.ok(found);
  return found;
}

const plus = unlock("Plus", { priceUsd: 20, sortOrder: 2, on: { desk_dca: true } });

assert.equal(
  deskTypeUpgradeMessage("dca", "Plus"),
  "DCA desks are not allowed on your plan. Upgrade to Plus to enable it.",
);

const closed = access({ plans: [plus] });
assert.equal(row(closed, "dca").allowed, false);
assert.equal(row(closed, "dca").upgradePlan, "Plus");
assert.equal(
  row(closed, "dca").message,
  "DCA desks are not allowed on your plan. Upgrade to Plus to enable it.",
);
assert.equal(
  deskTypeRejectLead(row(closed, "dca").message ?? "", "Plus"),
  "DCA desks are not allowed on your plan.",
);
assert.equal(row(closed, "perps").allowed, false);
assert.equal(
  row(closed, "perps_bots").message,
  "Perps bots desks are not allowed on your plan.",
);

const included = access({ on: { desk_dca: true }, plans: [plus] });
assert.equal(row(included, "dca").allowed, true);
assert.equal(row(included, "dca").message, null);

const secret = unlock("Secret", {
  visibility: "private",
  priceUsd: 1,
  sortOrder: 0,
  on: { desk_dca: true },
});
const named = access({ plans: [secret, plus] });
assert.equal(
  row(named, "dca").message,
  "DCA desks are not allowed on your plan. Upgrade to Plus to enable it.",
);
assert.equal(
  cheapestPublicPlanName(
    [
      unlock("Archive", {
        priceUsd: 0,
        archivedAt: "2026-01-01T00:00:00.000Z",
        on: { desk_dca: true },
      }),
      unlock("Draft", {
        visibility: "draft",
        priceUsd: 0,
        on: { desk_dca: true },
      }),
      unlock("Pro", { priceUsd: 20, sortOrder: 1, on: { desk_dca: true } }),
      plus,
    ],
    "desk_dca",
  ),
  "Pro",
);

const none = access({ plans: [secret] });
assert.equal(row(none, "dca").upgradePlan, null);
assert.equal(
  row(none, "dca").message,
  "DCA desks are not allowed on your plan.",
);
assert.equal(
  deniedDeskTypeMessage(none, "dca"),
  "DCA desks are not allowed on your plan.",
);
assert.equal(deniedDeskTypeMessage(included, "dca"), null);

const openGrant = access({
  trials: { features: { desk_dca: { days: 14 } }, caps: {} },
  grants: [{ key: "desk_dca", endsAt: "2026-10-28T00:00:00.000Z" }],
});
assert.equal(row(openGrant, "dca").allowed, true);
assert.equal(
  row(openGrant, "dca").message,
  "DCA is in a free trial until 28/10/2026.",
);

const unstarted = access({
  trials: { features: { desk_dca: { days: 14 } }, caps: {} },
});
assert.equal(row(unstarted, "dca").allowed, true);
assert.equal(row(unstarted, "dca").message, "DCA is in a free trial.");

const ended = access({
  trials: { features: { desk_dca: { days: 14 } }, caps: {} },
  grants: [{ key: "desk_dca", endsAt: "2026-10-01T00:00:00.000Z" }],
  plans: [plus],
});
assert.equal(row(ended, "dca").allowed, false);
assert.equal(row(ended, "dca").upgradePlan, "Plus");
assert.equal(
  row(ended, "dca").message,
  "Your free trial of DCA ended on 01/10/2026.",
);
assert.equal(
  deskTypeRejectLead(row(ended, "dca").message ?? "", "Plus"),
  "Your free trial of DCA ended on 01/10/2026.",
);

const includedBeatsTrial = access({
  on: { desk_dca: true },
  trials: { features: { desk_dca: { days: 14 } }, caps: {} },
  grants: [{ key: "desk_dca", endsAt: "2026-10-01T00:00:00.000Z" }],
});
assert.equal(row(includedBeatsTrial, "dca").allowed, true);
assert.equal(row(includedBeatsTrial, "dca").message, null);

assert.deepEqual(allowedDeskTypes(closed), []);
assert.deepEqual(allowedDeskTypes(included), ["dca"]);

console.log("desk type entitlement checks passed");

function caps(extra: Partial<PlanCaps> = {}): PlanCaps {
  return { ...emptyCaps(), ...extra };
}

function capPlan(
  name: string,
  extra: Partial<CapUnlockCandidate> & { cap?: Partial<PlanCaps> } = {},
): CapUnlockCandidate {
  return {
    ...unlock(name, extra),
    caps: caps(extra.cap),
  };
}

function quotas(input: {
  cap?: Partial<PlanCaps>;
  trials?: PlanTrials;
  grants?: { key: string; endsAt: string }[];
  plans?: CapUnlockCandidate[];
  used?: Partial<Record<"max_paper_desks" | "max_demo_desks" | "max_live_env_desks" | "max_bots", number>>;
}) {
  return quotaAccessList({
    caps: caps(input.cap),
    trials: input.trials ?? emptyPlanTrials(),
    grants: input.grants ?? [],
    nowMs,
    plans: input.plans ?? [],
    used: {
      max_paper_desks: 0,
      max_demo_desks: 0,
      max_live_env_desks: 0,
      max_bots: 0,
      ...input.used,
    },
  });
}

const plusPaper = capPlan("Plus", {
  priceUsd: 20,
  sortOrder: 2,
  cap: { max_paper_desks: 5, max_demo_desks: 2, max_live_env_desks: 2, max_bots: 10 },
});

assert.equal(
  capUsageMessage("max_paper_desks", 2, 2, "Plus"),
  "You have hit your maximum of 2 Paper Trading Desks. Upgrade to Plus to add another.",
);
assert.equal(
  gateRejectLead(capUsageMessage("max_paper_desks", 2, 2, "Plus"), "Plus"),
  "You have hit your maximum of 2 Paper Trading Desks.",
);
assert.equal(
  capUsageMessage("max_bots", 0, 0, "Plus"),
  "Bots are not allowed on your plan. Upgrade to Plus to enable it.",
);
assert.equal(
  capUsageMessage("max_demo_desks", 0, 0, null),
  "Exchange Connected - Demo desks are not allowed on your plan.",
);

const fullPaper = quotas({
  cap: { max_paper_desks: 2, max_demo_desks: 1, max_live_env_desks: 0, max_bots: 4 },
  used: { max_paper_desks: 2, max_demo_desks: 1, max_live_env_desks: 0, max_bots: 4 },
  plans: [plusPaper],
});
assert.equal(quotaAccessFor(fullPaper, "max_paper_desks")?.allowed, false);
assert.equal(
  quotaAccessFor(fullPaper, "max_paper_desks")?.message,
  "You have hit your maximum of 2 Paper Trading Desks. Upgrade to Plus to add another.",
);
assert.equal(quotaAccessFor(fullPaper, "max_paper_desks")?.upgradePlan, "Plus");
assert.equal(
  quotaAccessFor(fullPaper, "max_demo_desks")?.message,
  "You have hit your maximum of 1 Exchange Connected - Demo Desk. Upgrade to Plus to add another.",
);
assert.equal(
  quotaAccessFor(fullPaper, "max_live_env_desks")?.message,
  "Exchange Connected - Live desks are not allowed on your plan. Upgrade to Plus to enable it.",
);
assert.equal(
  gateRejectLead(
    quotaAccessFor(fullPaper, "max_live_env_desks")?.message ?? "",
    "Plus",
  ),
  "Exchange Connected - Live desks are not allowed on your plan.",
);
assert.equal(
  quotaAccessFor(fullPaper, "max_bots")?.message,
  "You have hit your maximum of 4 Bots. Upgrade to Plus to add another.",
);

const under = quotas({
  cap: { max_paper_desks: 2 },
  used: { max_paper_desks: 1 },
  plans: [plusPaper],
});
assert.equal(quotaAccessFor(under, "max_paper_desks")?.allowed, true);
assert.equal(
  quotaRoomMessage(quotaAccessFor(under, "max_paper_desks"), 1),
  null,
);
assert.equal(
  quotaRoomMessage(quotaAccessFor(under, "max_paper_desks"), 2),
  "You have hit your maximum of 2 Paper Trading Desks. Upgrade to Plus to add another.",
);

const unlimited = quotas({ cap: { max_bots: null }, used: { max_bots: 40 } });
assert.equal(quotaAccessFor(unlimited, "max_bots")?.allowed, true);
assert.equal(quotaAccessFor(unlimited, "max_bots")?.limit, null);

const secretCap = capPlan("Secret", {
  visibility: "private",
  priceUsd: 1,
  cap: { max_paper_desks: null },
});
const namedCap = quotas({
  cap: { max_paper_desks: 0 },
  plans: [secretCap, plusPaper],
});
assert.equal(quotaAccessFor(namedCap, "max_paper_desks")?.upgradePlan, "Plus");
const noneCap = quotas({
  cap: { max_paper_desks: 0 },
  plans: [secretCap],
});
assert.equal(quotaAccessFor(noneCap, "max_paper_desks")?.upgradePlan, null);
assert.equal(
  quotaAccessFor(noneCap, "max_paper_desks")?.message,
  "Paper Trading desks are not allowed on your plan.",
);
assert.equal(
  cheapestPublicCapPlanName(
    [
      capPlan("Archive", {
        priceUsd: 0,
        archivedAt: "2026-01-01T00:00:00.000Z",
        cap: { max_paper_desks: null },
      }),
      capPlan("Draft", {
        visibility: "draft",
        priceUsd: 0,
        cap: { max_paper_desks: null },
      }),
      capPlan("Pro", { priceUsd: 20, sortOrder: 1, cap: { max_paper_desks: 3 } }),
      plusPaper,
    ],
    "max_paper_desks",
    2,
  ),
  "Pro",
);
assert.equal(
  cheapestPublicCapPlanName([plusPaper], "max_paper_desks", 5),
  null,
);

const openCap = quotas({
  cap: { max_paper_desks: 1 },
  trials: { features: {}, caps: { max_paper_desks: { days: 14, limit: 3 } } },
  grants: [{ key: "max_paper_desks", endsAt: "2026-10-28T00:00:00.000Z" }],
  used: { max_paper_desks: 1 },
});
assert.equal(quotaAccessFor(openCap, "max_paper_desks")?.allowed, true);
assert.equal(quotaAccessFor(openCap, "max_paper_desks")?.limit, 3);
assert.equal(
  quotaAccessFor(openCap, "max_paper_desks")?.message,
  "Paper Trading is in a free trial until 28/10/2026.",
);

const endedCap = quotas({
  cap: { max_paper_desks: 1 },
  trials: { features: {}, caps: { max_paper_desks: { days: 14, limit: 3 } } },
  grants: [{ key: "max_paper_desks", endsAt: "2026-10-01T00:00:00.000Z" }],
  used: { max_paper_desks: 1 },
  plans: [plusPaper],
});
assert.equal(quotaAccessFor(endedCap, "max_paper_desks")?.allowed, false);
assert.equal(
  quotaAccessFor(endedCap, "max_paper_desks")?.message,
  "Your free trial of Paper Trading ended on 01/10/2026.",
);
assert.equal(quotaAccessFor(endedCap, "max_paper_desks")?.upgradePlan, "Plus");

assert.equal(
  quotaKeyForDesk({ mode: "paper", venueEnvironment: null }),
  "max_paper_desks",
);
assert.equal(
  quotaKeyForDesk({ mode: "live", venueEnvironment: "demo" }),
  "max_demo_desks",
);
assert.equal(
  quotaKeyForDesk({ mode: "live", venueEnvironment: "testnet" }),
  "max_demo_desks",
);
assert.equal(
  quotaKeyForDesk({ mode: "live", venueEnvironment: null }),
  "max_live_env_desks",
);
assert.equal(
  quotaKeyAfterBind({ currentEnvironment: null, nextEnvironment: "demo" }),
  "max_demo_desks",
);
assert.equal(
  quotaKeyAfterBind({ currentEnvironment: null, nextEnvironment: "live" }),
  null,
);
assert.equal(
  quotaKeyAfterBind({ currentEnvironment: "demo", nextEnvironment: "live" }),
  "max_live_env_desks",
);

console.log("quota entitlement checks passed");

const templatePlus = unlock("Plus", {
  priceUsd: 20,
  sortOrder: 2,
  on: {
    extras_templates: true,
    extras_share_templates: true,
    extras_import_export_templates: true,
  },
});

function templateRows(input: {
  on?: Partial<PlanFeatures>;
  trials?: PlanTrials;
  grants?: { key: string; endsAt: string }[];
  plans?: UnlockCandidate[];
}) {
  return templateFeatureAccessList({
    features: features(input.on),
    trials: input.trials ?? emptyPlanTrials(),
    grants: input.grants ?? [],
    nowMs,
    plans: input.plans ?? [],
  });
}

assert.equal(
  templateNotAllowedMessage("extras_templates", "Plus"),
  "Saving templates is not allowed on your plan. Upgrade to Plus to enable it.",
);
assert.equal(
  gateRejectLead(
    templateNotAllowedMessage("extras_templates", "Plus"),
    "Plus",
  ),
  "Saving templates is not allowed on your plan.",
);
assert.equal(
  templateNotAllowedMessage("extras_share_templates", "Plus"),
  "Sharing templates is not allowed on your plan. Upgrade to Plus to enable it.",
);
assert.equal(
  templateNotAllowedMessage("extras_import_export_templates", null),
  "Importing and exporting templates is not allowed on your plan.",
);

const templateClosed = templateRows({ plans: [templatePlus] });
assert.equal(
  templateFeatureAccessFor(templateClosed, "extras_templates")?.allowed,
  false,
);
assert.equal(
  templateFeatureAccessFor(templateClosed, "extras_templates")?.message,
  "Saving templates is not allowed on your plan. Upgrade to Plus to enable it.",
);
assert.equal(
  templateFeatureAccessFor(templateClosed, "extras_templates")?.upgradePlan,
  "Plus",
);
assert.equal(
  templateFeatureAccessFor(templateClosed, "extras_share_templates")?.message,
  "Sharing templates is not allowed on your plan. Upgrade to Plus to enable it.",
);
assert.equal(
  templateFeatureAccessFor(templateClosed, "extras_import_export_templates")
    ?.message,
  "Importing and exporting templates is not allowed on your plan. Upgrade to Plus to enable it.",
);

const templateSecret = unlock("Secret", {
  visibility: "private",
  priceUsd: 1,
  on: { extras_templates: true },
});
assert.equal(
  templateFeatureAccessFor(
    templateRows({ plans: [templateSecret] }),
    "extras_templates",
  )?.upgradePlan,
  null,
);
assert.equal(
  templateFeatureAccessFor(
    templateRows({ plans: [templateSecret] }),
    "extras_templates",
  )?.message,
  "Saving templates is not allowed on your plan.",
);
assert.equal(
  templateFeatureAccessFor(
    templateRows({ plans: [templateSecret, templatePlus] }),
    "extras_templates",
  )?.upgradePlan,
  "Plus",
);

const templateOpen = templateRows({
  trials: { features: { extras_templates: { days: 14 } }, caps: {} },
  grants: [{ key: "extras_templates", endsAt: "2026-10-28T00:00:00.000Z" }],
  plans: [templatePlus],
});
assert.equal(
  templateFeatureAccessFor(templateOpen, "extras_templates")?.allowed,
  true,
);
assert.equal(
  templateFeatureAccessFor(templateOpen, "extras_templates")?.message,
  "Saving templates is in a free trial until 28/10/2026.",
);

const templateEnded = templateRows({
  trials: { features: { extras_share_templates: { days: 14 } }, caps: {} },
  grants: [
    { key: "extras_share_templates", endsAt: "2026-10-01T00:00:00.000Z" },
  ],
  plans: [templatePlus],
});
assert.equal(
  templateFeatureAccessFor(templateEnded, "extras_share_templates")?.allowed,
  false,
);
assert.equal(
  templateFeatureAccessFor(templateEnded, "extras_share_templates")?.message,
  "Your free trial of sharing templates ended on 01/10/2026.",
);
assert.equal(
  templateFeatureAccessFor(templateEnded, "extras_share_templates")?.upgradePlan,
  "Plus",
);
assert.equal(
  templateFeatureAccessFor(
    templateRows({ on: { extras_import_export_templates: true } }),
    "extras_import_export_templates",
  )?.allowed,
  true,
);

console.log("template feature entitlement checks passed");

const copyPlus: CapUnlockCandidate = {
  ...unlock("Plus", {
    priceUsd: 20,
    sortOrder: 2,
    on: {
      copy_follow: true,
      copy_catalogue: true,
      copy_share: true,
    },
  }),
  caps: {
    ...emptyCaps(),
    max_copy_follows: 5,
    max_followers_accepted: 10,
  },
};

function copyGate(input: {
  on?: Partial<PlanFeatures>;
  caps?: Partial<PlanCaps>;
  trials?: PlanTrials;
  grants?: { key: string; endsAt: string }[];
  plans?: CapUnlockCandidate[];
  used?: number;
}): CopyGateAccess {
  const planFeatures = features(input.on);
  const caps = { ...emptyCaps(), ...input.caps };
  const plans = input.plans ?? [copyPlus];
  const grants = input.grants ?? [];
  const trials = input.trials ?? emptyPlanTrials();
  const rows = copyFeatureAccessList({
    features: planFeatures,
    trials,
    grants,
    nowMs,
    plans,
  });
  const capInput = {
    features: planFeatures,
    caps,
    trials,
    grants,
    nowMs,
    plans,
  };
  const follow = copyFeatureAccessFor(rows, "copy_follow");
  const publicShare = copyFeatureAccessFor(rows, "copy_catalogue");
  const privateShare = copyFeatureAccessFor(rows, "copy_share");
  assert.ok(follow && publicShare && privateShare);
  return {
    follow,
    publicShare,
    privateShare,
    sharingUpgradePlan: cheapestPublicSharePlanName(plans),
    copyCap: {
      ...copyCapSnapshot({ ...capInput, key: "max_copy_follows" }),
      used: input.used ?? 0,
    },
    followerCap: copyCapSnapshot({
      ...capInput,
      key: "max_followers_accepted",
    }),
  };
}

const copyingLine =
  "Copying other traders' desks is not allowed on your plan. Upgrade to Plus to enable it.";
assert.equal(
  followClickDenial(copyGate({ caps: { max_copy_follows: 0 } }))?.message,
  copyingLine,
);
assert.equal(
  gateRejectLead(copyingLine, "Plus"),
  "Copying other traders' desks is not allowed on your plan.",
);
assert.equal(
  followClickDenial(
    copyGate({
      on: { copy_follow: true },
      caps: { max_copy_follows: 2 },
      used: 2,
    }),
  )?.message,
  "You have hit your maximum of 2 Desk Copies. Upgrade to Plus to add another.",
);
assert.equal(
  followClickDenial(
    copyGate({
      on: { copy_follow: true },
      caps: { max_copy_follows: 1 },
      used: 1,
    }),
  )?.message,
  "You have hit your maximum of 1 Desk Copy. Upgrade to Plus to add another.",
);
assert.equal(
  followClickDenial(
    copyGate({
      caps: { max_copy_follows: 0, max_followers_accepted: 0 },
      used: 0,
    }),
  )?.message,
  copyingLine,
);

const secretCopy: CapUnlockCandidate = {
  ...unlock("Secret", {
    visibility: "private",
    priceUsd: 1,
    on: { copy_follow: true, copy_catalogue: true, copy_share: true },
  }),
  caps: {
    ...emptyCaps(),
    max_copy_follows: 99,
    max_followers_accepted: 99,
  },
};
assert.equal(
  followClickDenial(copyGate({ plans: [secretCopy] }))?.upgradePlan,
  null,
);
assert.equal(
  followClickDenial(copyGate({ plans: [secretCopy] }))?.message,
  "Copying other traders' desks is not allowed on your plan.",
);

const copyOpen = copyGate({
  trials: { features: { copy_follow: { days: 14 } }, caps: {} },
  grants: [{ key: "copy_follow", endsAt: "2026-10-28T00:00:00.000Z" }],
});
assert.equal(followClickDenial(copyOpen), null);
assert.equal(
  followTrialMessage(copyOpen),
  "Copying other traders' desks is in a free trial until 28/10/2026.",
);

const copyEnded = copyGate({
  trials: { features: { copy_follow: { days: 14 } }, caps: {} },
  grants: [{ key: "copy_follow", endsAt: "2026-10-01T00:00:00.000Z" }],
});
assert.equal(
  followClickDenial(copyEnded)?.message,
  "Your free trial of copying other traders' desks ended on 01/10/2026.",
);

const copiesTrial = copyGate({
  on: { copy_follow: true },
  caps: { max_copy_follows: 1 },
  used: 1,
  trials: { features: {}, caps: { max_copy_follows: { days: 14, limit: 3 } } },
  grants: [{ key: "max_copy_follows", endsAt: "2026-10-28T00:00:00.000Z" }],
});
assert.equal(followClickDenial(copiesTrial), null);
assert.equal(
  followTrialMessage(copiesTrial),
  "Desk Copies are in a free trial until 28/10/2026.",
);
const copiesEnded = copyGate({
  on: { copy_follow: true },
  caps: { max_copy_follows: 1 },
  used: 1,
  trials: { features: {}, caps: { max_copy_follows: { days: 14, limit: 3 } } },
  grants: [{ key: "max_copy_follows", endsAt: "2026-10-01T00:00:00.000Z" }],
});
assert.equal(
  followClickDenial(copiesEnded)?.message,
  "Your free trial of desk copies ended on 01/10/2026.",
);

const shareOff = copyGate({
  caps: { max_followers_accepted: 5 },
});
assert.equal(
  shareSaveDenial(shareOff, { visibility: "public", requestedMax: 9 })?.message,
  "Sharing this desk is not allowed on your plan. Upgrade to Plus to enable it.",
);
assert.equal(
  shareSaveDenial(shareOff, { visibility: "private", requestedMax: null })
    ?.message,
  sharingDeskMessage("Plus"),
);
assert.equal(shareTrialLines(shareOff).length, 0);

const publicOnly = copyGate({
  on: { copy_catalogue: true },
  caps: { max_followers_accepted: 5 },
});
assert.equal(
  shareSaveDenial(publicOnly, { visibility: "private", requestedMax: 2 })
    ?.message,
  "Sharing a desk privately is not allowed on your plan. Upgrade to Plus to enable it.",
);
assert.equal(
  shareSaveDenial(publicOnly, { visibility: "public", requestedMax: null })
    ?.message,
  "You have hit your maximum of 5 followers. Upgrade to Plus to add another.",
);
assert.equal(
  shareSaveDenial(publicOnly, { visibility: "public", requestedMax: 5 }),
  null,
);
assert.equal(
  inviteDenial(publicOnly, 0)?.message,
  "Sharing a desk privately is not allowed on your plan. Upgrade to Plus to enable it.",
);

const followersClosed = copyGate({
  on: { copy_catalogue: true, copy_share: true },
  caps: { max_followers_accepted: 0 },
});
assert.equal(
  shareSaveDenial(followersClosed, { visibility: "private", requestedMax: 1 })
    ?.message,
  "Followers are not allowed on your plan. Upgrade to Plus to enable it.",
);
assert.equal(
  inviteDenial(followersClosed, 0)?.message,
  "Followers are not allowed on your plan. Upgrade to Plus to enable it.",
);
assert.equal(
  inviteDenial(
    copyGate({
      on: { copy_share: true },
      caps: { max_followers_accepted: 1 },
    }),
    1,
  )?.message,
  "You have hit your maximum of 1 follower. Upgrade to Plus to add another.",
);

const followerTrial = copyGate({
  on: { copy_share: true, copy_catalogue: true },
  caps: { max_followers_accepted: 1 },
  trials: {
    features: {},
    caps: { max_followers_accepted: { days: 14, limit: 4 } },
  },
  grants: [{ key: "max_followers_accepted", endsAt: "2026-10-28T00:00:00.000Z" }],
});
assert.equal(
  shareSaveDenial(followerTrial, { visibility: "public", requestedMax: 4 }),
  null,
);
assert.equal(
  inviteTrialMessage(followerTrial, 1),
  "Followers are in a free trial until 28/10/2026.",
);
assert.equal(
  copyCapSnapshot({
    key: "max_followers_accepted",
    features: features(),
    caps: { ...emptyCaps(), max_followers_accepted: 1 },
    trials: {
      features: {},
      caps: { max_followers_accepted: { days: 14, limit: 4 } },
    },
    grants: [],
    nowMs,
    plans: [copyPlus],
  }).trialLimit,
  null,
);

assert.equal(
  ownerRefusesNewFollower(publicOnly, {
    followerCount: 0,
    visibility: "public",
  }),
  false,
);
assert.equal(
  ownerRefusesNewFollower(shareOff, {
    followerCount: 0,
    visibility: "public",
  }),
  true,
);
assert.equal(
  ownerRefusesNewFollower(followersClosed, {
    followerCount: 0,
    visibility: "private",
  }),
  true,
);
assert.equal(
  ownerRefusesNewFollower(
    copyGate({
      on: { copy_catalogue: true, copy_share: true },
      caps: { max_followers_accepted: 1 },
    }),
    { followerCount: 1, visibility: "public", alreadyCounted: true },
  ),
  false,
);
assert.equal(
  copyCapDecision(
    copyGate({
      on: { copy_follow: true },
      caps: { max_copy_follows: 2 },
      used: 2,
      trials: { features: {}, caps: { max_copy_follows: { days: 14, limit: 4 } } },
      grants: [{ key: "max_copy_follows", endsAt: "2026-10-01T00:00:00.000Z" }],
    }).copyCap,
    { used: 2, adding: 0, requestedMax: null },
  ).message,
  "You have hit your maximum of 2 Desk Copies. Upgrade to Plus to add another.",
);

console.log("copy gate entitlement checks passed");
