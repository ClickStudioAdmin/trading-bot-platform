import {
  AUTOMATED_DESK_TYPES,
  MANUAL_DESK_TYPES,
  deskDisplayMode,
  formatDeskType,
  type DeskType,
  type TradingAccountMode,
} from "@/lib/accounts/model";
import {
  PLAN_CAP_LABELS,
  emptyCaps,
  emptyFeatures,
  planIsArchived,
  planIsPublic,
  type PlanCapKey,
  type PlanCaps,
  type PlanFeatureKey,
  type PlanFeatures,
  type PlanVisibility,
} from "@/lib/membership/catalog";
import {
  capTrialOffer,
  effectiveCap,
  featureAccess,
  featureTrialOffer,
  trialPhase,
  type PlanTrials,
} from "@/lib/membership/trials";
import { formatAuDateUtc } from "@/lib/time/display";

export const DESK_TYPE_FEATURES: Record<DeskType, PlanFeatureKey> = {
  cash_and_carry: "desk_cash_and_carry",
  perps: "desk_perps",
  perps_bots: "desk_perps_bots",
  signal_follower: "desk_signal_follower",
  dca: "desk_dca",
};

export const DESK_TYPE_FEATURE_KEYS: PlanFeatureKey[] = Object.values(
  DESK_TYPE_FEATURES,
);

export type DeskTypeAccess = {
  deskType: DeskType;
  allowed: boolean;
  message: string | null;
  /** Cheapest public plan that includes this type, when the type is closed. */
  upgradePlan: string | null;
};

export type UnlockCandidate = {
  name: string;
  visibility: PlanVisibility;
  archivedAt: string | null;
  priceUsd: number;
  sortOrder: number;
  features: PlanFeatures;
};

const DESK_TYPE_ORDER: DeskType[] = [
  ...AUTOMATED_DESK_TYPES,
  ...MANUAL_DESK_TYPES,
];

export function cheapestPublicPlanName(
  plans: readonly UnlockCandidate[],
  key: PlanFeatureKey,
): string | null {
  const ranked = plans
    .filter(
      (plan) =>
        planIsPublic(plan) &&
        !planIsArchived(plan) &&
        plan.features[key] === true,
    )
    .slice()
    .sort(
      (left, right) =>
        left.priceUsd - right.priceUsd ||
        left.sortOrder - right.sortOrder ||
        left.name.localeCompare(right.name),
    );
  return ranked[0]?.name ?? null;
}

export function gateRejectLead(
  message: string,
  upgradePlan: string | null,
): string {
  if (!upgradePlan) {
    return message;
  }
  for (const tail of [" to enable it.", " to add another."]) {
    const cta = ` Upgrade to ${upgradePlan}${tail}`;
    if (message.endsWith(cta)) {
      return message.slice(0, -cta.length);
    }
  }
  return message;
}

export function deskTypeRejectLead(
  message: string,
  upgradePlan: string | null,
): string {
  return gateRejectLead(message, upgradePlan);
}

export function notAllowedOnPlanMessage(
  subject: string,
  planName: string | null,
): string {
  const lead = `${subject} are not allowed on your plan.`;
  if (!planName) {
    return lead;
  }
  return `${lead} Upgrade to ${planName} to enable it.`;
}

export function deskTypeUpgradeMessage(
  deskType: DeskType,
  planName: string | null,
): string {
  return notAllowedOnPlanMessage(`${formatDeskType(deskType)} desks`, planName);
}

export function deskTypeTrialEndedMessage(
  deskType: DeskType,
  endedOn: string,
): string {
  return `Your free trial of ${formatDeskType(deskType)} ended on ${endedOn}.`;
}

export function deskTypeTrialOpenMessage(
  deskType: DeskType,
  until: string,
): string {
  return `${formatDeskType(deskType)} is in a free trial until ${until}.`;
}

export function deskTypeAccessList(input: {
  features: PlanFeatures;
  trials: PlanTrials;
  grants: readonly { key: string; endsAt: string }[];
  nowMs: number;
  plans: readonly UnlockCandidate[];
}): DeskTypeAccess[] {
  return DESK_TYPE_ORDER.map((deskType) =>
    decideDeskType({ ...input, deskType }),
  );
}

export function allowedDeskTypes(
  access: readonly DeskTypeAccess[],
): DeskType[] {
  const allowed = new Set(
    access.filter((row) => row.allowed).map((row) => row.deskType),
  );
  return DESK_TYPE_ORDER.filter((deskType) => allowed.has(deskType));
}

export function deskTypeAccessFor(
  access: readonly DeskTypeAccess[],
  deskType: DeskType,
): DeskTypeAccess | null {
  return access.find((row) => row.deskType === deskType) ?? null;
}

export function deniedDeskTypeMessage(
  access: readonly DeskTypeAccess[],
  deskType: DeskType,
): string | null {
  const row = deskTypeAccessFor(access, deskType);
  if (!row || row.allowed) {
    return null;
  }
  return row.message ?? deskTypeUpgradeMessage(deskType, null);
}

function decideDeskType(input: {
  deskType: DeskType;
  features: PlanFeatures;
  trials: PlanTrials;
  grants: readonly { key: string; endsAt: string }[];
  nowMs: number;
  plans: readonly UnlockCandidate[];
}): DeskTypeAccess {
  const key = DESK_TYPE_FEATURES[input.deskType];
  const upgradePlan = cheapestPublicPlanName(input.plans, key);
  if (input.features[key]) {
    return {
      deskType: input.deskType,
      allowed: true,
      message: null,
      upgradePlan: null,
    };
  }
  const offer = featureTrialOffer(
    { features: input.features, caps: emptyCaps(), trials: input.trials },
    key,
  );
  const grant = input.grants.find((row) => row.key === key) ?? null;
  const phase = grant ? trialPhase(grant.endsAt, input.nowMs) : null;
  const access = featureAccess({
    included: false,
    phase: phase ?? (offer ? "active" : null),
  });
  if (access === "trial") {
    return {
      deskType: input.deskType,
      allowed: true,
      message: grant
        ? deskTypeTrialOpenMessage(
            input.deskType,
            formatAuDateUtc(Date.parse(grant.endsAt)),
          )
        : `${formatDeskType(input.deskType)} is in a free trial.`,
      upgradePlan: null,
    };
  }
  if (grant && phase === "ended") {
    return {
      deskType: input.deskType,
      allowed: false,
      message: deskTypeTrialEndedMessage(
        input.deskType,
        formatAuDateUtc(Date.parse(grant.endsAt)),
      ),
      upgradePlan,
    };
  }
  return {
    deskType: input.deskType,
    allowed: false,
    message: deskTypeUpgradeMessage(input.deskType, upgradePlan),
    upgradePlan,
  };
}

export const TEMPLATE_FEATURE_KEYS = [
  "extras_templates",
  "extras_share_templates",
  "extras_import_export_templates",
] as const;

export type TemplateFeatureKey = (typeof TEMPLATE_FEATURE_KEYS)[number];

const TEMPLATE_ACTIVITY: Record<TemplateFeatureKey, string> = {
  extras_templates: "Saving templates",
  extras_share_templates: "Sharing templates",
  extras_import_export_templates: "Importing and exporting templates",
};

export type TemplateFeatureAccess = {
  key: TemplateFeatureKey;
  allowed: boolean;
  message: string | null;
  upgradePlan: string | null;
};

export function templateActivity(key: TemplateFeatureKey): string {
  return TEMPLATE_ACTIVITY[key];
}

export function templateNotAllowedMessage(
  key: TemplateFeatureKey,
  planName: string | null,
): string {
  const lead = `${templateActivity(key)} is not allowed on your plan.`;
  if (!planName) {
    return lead;
  }
  return `${lead} Upgrade to ${planName} to enable it.`;
}

export function templateTrialEndedMessage(
  key: TemplateFeatureKey,
  endedOn: string,
): string {
  return `Your free trial of ${templateActivity(key).toLowerCase()} ended on ${endedOn}.`;
}

export function templateTrialOpenMessage(
  key: TemplateFeatureKey,
  until: string,
): string {
  return `${templateActivity(key)} is in a free trial until ${until}.`;
}

export function templateFeatureAccessList(input: {
  features: PlanFeatures;
  trials: PlanTrials;
  grants: readonly { key: string; endsAt: string }[];
  nowMs: number;
  plans: readonly UnlockCandidate[];
}): TemplateFeatureAccess[] {
  return TEMPLATE_FEATURE_KEYS.map((key) =>
    decideTemplateFeature({ ...input, key }),
  );
}

export function templateFeatureAccessFor(
  access: readonly TemplateFeatureAccess[],
  key: TemplateFeatureKey,
): TemplateFeatureAccess | null {
  return access.find((row) => row.key === key) ?? null;
}

function decideTemplateFeature(input: {
  key: TemplateFeatureKey;
  features: PlanFeatures;
  trials: PlanTrials;
  grants: readonly { key: string; endsAt: string }[];
  nowMs: number;
  plans: readonly UnlockCandidate[];
}): TemplateFeatureAccess {
  const upgradePlan = cheapestPublicPlanName(input.plans, input.key);
  if (input.features[input.key]) {
    return {
      key: input.key,
      allowed: true,
      message: null,
      upgradePlan: null,
    };
  }
  const offer = featureTrialOffer(
    { features: input.features, caps: emptyCaps(), trials: input.trials },
    input.key,
  );
  const grant = input.grants.find((row) => row.key === input.key) ?? null;
  const phase = grant ? trialPhase(grant.endsAt, input.nowMs) : null;
  const access = featureAccess({
    included: false,
    phase: phase ?? (offer ? "active" : null),
  });
  if (access === "trial") {
    return {
      key: input.key,
      allowed: true,
      message: grant
        ? templateTrialOpenMessage(
            input.key,
            formatAuDateUtc(Date.parse(grant.endsAt)),
          )
        : `${templateActivity(input.key)} is in a free trial.`,
      upgradePlan: null,
    };
  }
  if (grant && phase === "ended") {
    return {
      key: input.key,
      allowed: false,
      message: templateTrialEndedMessage(
        input.key,
        formatAuDateUtc(Date.parse(grant.endsAt)),
      ),
      upgradePlan,
    };
  }
  return {
    key: input.key,
    allowed: false,
    message: templateNotAllowedMessage(input.key, upgradePlan),
    upgradePlan,
  };
}

export const COPY_FEATURE_KEYS = [
  "copy_follow",
  "copy_catalogue",
  "copy_share",
] as const;

export type CopyFeatureKey = (typeof COPY_FEATURE_KEYS)[number];

const COPY_ACTIVITY: Record<CopyFeatureKey, string> = {
  copy_follow: "Copying other traders' desks",
  copy_catalogue: "Sharing a desk publicly",
  copy_share: "Sharing a desk privately",
};

export const COPY_CAP_KEYS = [
  "max_copy_follows",
  "max_followers_accepted",
] as const;

export type CopyCapKey = (typeof COPY_CAP_KEYS)[number];

const COPY_CAP_NOUN: Record<CopyCapKey, { one: string; many: string }> = {
  max_copy_follows: { one: "Desk Copy", many: "Desk Copies" },
  max_followers_accepted: { one: "follower", many: "followers" },
};

const COPY_CAP_TRIAL: Record<CopyCapKey, string> = {
  max_copy_follows: "Desk Copies",
  max_followers_accepted: "Followers",
};

export type CopyFeatureAccess = {
  key: CopyFeatureKey;
  allowed: boolean;
  message: string | null;
  upgradePlan: string | null;
};

export type CopyCapSnapshot = {
  key: CopyCapKey;
  standing: number | null;
  trialLimit: number | null;
  phase: "active" | "ended" | null;
  trialEndsOn: string | null;
  upgradePlan: string | null;
};

export type CopyGateAccess = {
  follow: CopyFeatureAccess;
  publicShare: CopyFeatureAccess;
  privateShare: CopyFeatureAccess;
  sharingUpgradePlan: string | null;
  copyCap: CopyCapSnapshot & { used: number };
  followerCap: CopyCapSnapshot;
};

export type CopyNotice = {
  allowed: false;
  message: string;
  upgradePlan: string | null;
};

export function copyActivity(key: CopyFeatureKey): string {
  return COPY_ACTIVITY[key];
}

export function sharingDeskMessage(planName: string | null): string {
  const lead = "Sharing this desk is not allowed on your plan.";
  if (!planName) {
    return lead;
  }
  return `${lead} Upgrade to ${planName} to enable it.`;
}

export function copyFeatureAccessList(input: {
  features: PlanFeatures;
  trials: PlanTrials;
  grants: readonly { key: string; endsAt: string }[];
  nowMs: number;
  plans: readonly UnlockCandidate[];
}): CopyFeatureAccess[] {
  return COPY_FEATURE_KEYS.map((key) => decideCopyFeature({ ...input, key }));
}

export function copyFeatureAccessFor(
  access: readonly CopyFeatureAccess[],
  key: CopyFeatureKey,
): CopyFeatureAccess | null {
  return access.find((row) => row.key === key) ?? null;
}

export function cheapestPublicSharePlanName(
  plans: readonly UnlockCandidate[],
): string | null {
  const ranked = plans
    .filter(
      (plan) =>
        planIsPublic(plan) &&
        !planIsArchived(plan) &&
        (plan.features.copy_catalogue === true ||
          plan.features.copy_share === true),
    )
    .slice()
    .sort(
      (left, right) =>
        left.priceUsd - right.priceUsd ||
        left.sortOrder - right.sortOrder ||
        left.name.localeCompare(right.name),
    );
  return ranked[0]?.name ?? null;
}

export function copyCapSnapshot(input: {
  key: CopyCapKey;
  features: PlanFeatures;
  caps: PlanCaps;
  trials: PlanTrials;
  grants: readonly { key: string; endsAt: string }[];
  nowMs: number;
  plans: readonly CapUnlockCandidate[];
}): CopyCapSnapshot {
  const standing = input.caps[input.key];
  const offer = capTrialOffer(
    { features: input.features, caps: input.caps, trials: input.trials },
    input.key,
  );
  const grant = input.grants.find((row) => row.key === input.key) ?? null;
  const phase = grant
    ? trialPhase(grant.endsAt, input.nowMs)
    : offer
      ? "active"
      : null;
  const limit = effectiveCap({ standing, offer, phase });
  return {
    key: input.key,
    standing,
    trialLimit: offer?.limit ?? null,
    phase: phase === "active" || phase === "ended" ? phase : null,
    trialEndsOn: grant ? formatAuDateUtc(Date.parse(grant.endsAt)) : null,
    upgradePlan:
      limit == null
        ? null
        : cheapestPublicCapPlanName(input.plans, input.key, limit),
  };
}

export function copyCapDecision(
  snapshot: CopyCapSnapshot,
  input: { used: number; adding?: number; requestedMax?: number | null },
): { allowed: boolean; message: string | null } {
  const adding = input.adding ?? 0;
  const offer =
    snapshot.trialLimit == null
      ? null
      : { key: snapshot.key, days: 1, limit: snapshot.trialLimit };
  const limit = effectiveCap({
    standing: snapshot.standing,
    offer,
    phase: snapshot.phase,
  });
  const openMessage =
    snapshot.phase === "active" && snapshot.trialLimit != null
      ? snapshot.trialEndsOn
        ? `${COPY_CAP_TRIAL[snapshot.key]} are in a free trial until ${snapshot.trialEndsOn}.`
        : `${COPY_CAP_TRIAL[snapshot.key]} are in a free trial.`
      : null;
  if (limit == null) {
    return { allowed: true, message: openMessage };
  }
  const requestedTooHigh =
    input.requestedMax !== undefined &&
    (input.requestedMax == null || input.requestedMax > limit);
  const countTooHigh = input.used + adding > limit;
  if (!requestedTooHigh && !countTooHigh) {
    return { allowed: true, message: openMessage };
  }
  const withinTrial =
    snapshot.trialLimit != null &&
    input.used + adding <= snapshot.trialLimit &&
    (input.requestedMax === undefined ||
      (input.requestedMax != null && input.requestedMax <= snapshot.trialLimit));
  if (snapshot.phase === "ended" && withinTrial && snapshot.trialEndsOn) {
    return {
      allowed: false,
      message: `Your free trial of ${COPY_CAP_TRIAL[snapshot.key].toLowerCase()} ended on ${snapshot.trialEndsOn}.`,
    };
  }
  return {
    allowed: false,
    message: copyCapClosedMessage(snapshot.key, limit, snapshot.upgradePlan),
  };
}

export function followClickDenial(gate: CopyGateAccess): CopyNotice | null {
  if (!gate.follow.allowed && gate.follow.message) {
    return {
      allowed: false,
      message: gate.follow.message,
      upgradePlan: gate.follow.upgradePlan,
    };
  }
  const decision = copyCapDecision(gate.copyCap, {
    used: gate.copyCap.used,
    adding: 1,
  });
  if (!decision.allowed && decision.message) {
    return {
      allowed: false,
      message: decision.message,
      upgradePlan: gate.copyCap.upgradePlan,
    };
  }
  return null;
}

export function followTrialMessage(gate: CopyGateAccess): string | null {
  if (followClickDenial(gate)) {
    return null;
  }
  if (gate.follow.allowed && gate.follow.message) {
    return gate.follow.message;
  }
  const decision = copyCapDecision(gate.copyCap, {
    used: gate.copyCap.used,
    adding: 1,
  });
  return decision.allowed ? decision.message : null;
}

export function shareSaveDenial(
  gate: CopyGateAccess,
  input: { visibility: "public" | "private"; requestedMax: number | null },
): CopyNotice | null {
  if (!gate.publicShare.allowed && !gate.privateShare.allowed) {
    return {
      allowed: false,
      message: sharingDeskMessage(gate.sharingUpgradePlan),
      upgradePlan: gate.sharingUpgradePlan,
    };
  }
  const row = input.visibility === "public" ? gate.publicShare : gate.privateShare;
  if (!row.allowed && row.message) {
    return {
      allowed: false,
      message: row.message,
      upgradePlan: row.upgradePlan,
    };
  }
  const decision = copyCapDecision(gate.followerCap, {
    used: 0,
    adding: 0,
    requestedMax: input.requestedMax,
  });
  if (!decision.allowed && decision.message) {
    return {
      allowed: false,
      message: decision.message,
      upgradePlan: gate.followerCap.upgradePlan,
    };
  }
  return null;
}

export function inviteDenial(
  gate: CopyGateAccess,
  followerCount: number,
): CopyNotice | null {
  if (!gate.publicShare.allowed && !gate.privateShare.allowed) {
    return {
      allowed: false,
      message: sharingDeskMessage(gate.sharingUpgradePlan),
      upgradePlan: gate.sharingUpgradePlan,
    };
  }
  if (!gate.privateShare.allowed && gate.privateShare.message) {
    return {
      allowed: false,
      message: gate.privateShare.message,
      upgradePlan: gate.privateShare.upgradePlan,
    };
  }
  const decision = copyCapDecision(gate.followerCap, {
    used: followerCount,
    adding: 1,
  });
  if (!decision.allowed && decision.message) {
    return {
      allowed: false,
      message: decision.message,
      upgradePlan: gate.followerCap.upgradePlan,
    };
  }
  return null;
}

export function ownerRefusesNewFollower(
  gate: CopyGateAccess,
  input: {
    followerCount: number;
    visibility: "public" | "private";
    alreadyCounted?: boolean;
  },
): boolean {
  if (!gate.publicShare.allowed && !gate.privateShare.allowed) {
    return true;
  }
  const row = input.visibility === "public" ? gate.publicShare : gate.privateShare;
  if (!row.allowed) {
    return true;
  }
  return !copyCapDecision(gate.followerCap, {
    used: input.followerCount,
    adding: input.alreadyCounted ? 0 : 1,
  }).allowed;
}

export function shareTrialLines(gate: CopyGateAccess): string[] {
  const lines: string[] = [];
  if (gate.publicShare.allowed && gate.publicShare.message) {
    lines.push(gate.publicShare.message);
  }
  if (gate.privateShare.allowed && gate.privateShare.message) {
    lines.push(gate.privateShare.message);
  }
  if (gate.publicShare.allowed || gate.privateShare.allowed) {
    const decision = copyCapDecision(gate.followerCap, { used: 0, adding: 0 });
    if (decision.allowed && decision.message) {
      lines.push(decision.message);
    }
  }
  return lines;
}

export function inviteTrialMessage(
  gate: CopyGateAccess,
  followerCount: number,
): string | null {
  if (!gate.privateShare.allowed) {
    return null;
  }
  if (gate.privateShare.message) {
    return gate.privateShare.message;
  }
  const decision = copyCapDecision(gate.followerCap, {
    used: followerCount,
    adding: 1,
  });
  return decision.allowed ? decision.message : null;
}

function copyCapClosedMessage(
  key: CopyCapKey,
  limit: number,
  planName: string | null,
): string {
  if (limit === 0) {
    if (key === "max_copy_follows") {
      return copyNotAllowedMessage("copy_follow", planName);
    }
    const lead = "Followers are not allowed on your plan.";
    if (!planName) {
      return lead;
    }
    return `${lead} Upgrade to ${planName} to enable it.`;
  }
  const noun =
    limit === 1 ? COPY_CAP_NOUN[key].one : COPY_CAP_NOUN[key].many;
  const lead = `You have hit your maximum of ${limit} ${noun}.`;
  if (!planName) {
    return lead;
  }
  return `${lead} Upgrade to ${planName} to add another.`;
}

function copyNotAllowedMessage(
  key: CopyFeatureKey,
  planName: string | null,
): string {
  const lead = `${copyActivity(key)} is not allowed on your plan.`;
  if (!planName) {
    return lead;
  }
  return `${lead} Upgrade to ${planName} to enable it.`;
}

function decideCopyFeature(input: {
  key: CopyFeatureKey;
  features: PlanFeatures;
  trials: PlanTrials;
  grants: readonly { key: string; endsAt: string }[];
  nowMs: number;
  plans: readonly UnlockCandidate[];
}): CopyFeatureAccess {
  const upgradePlan = cheapestPublicPlanName(input.plans, input.key);
  if (input.features[input.key]) {
    return {
      key: input.key,
      allowed: true,
      message: null,
      upgradePlan: null,
    };
  }
  const offer = featureTrialOffer(
    { features: input.features, caps: emptyCaps(), trials: input.trials },
    input.key,
  );
  const grant = input.grants.find((row) => row.key === input.key) ?? null;
  const phase = grant ? trialPhase(grant.endsAt, input.nowMs) : null;
  const access = featureAccess({
    included: false,
    phase: phase ?? (offer ? "active" : null),
  });
  if (access === "trial") {
    return {
      key: input.key,
      allowed: true,
      message: grant
        ? `${copyActivity(input.key)} is in a free trial until ${formatAuDateUtc(Date.parse(grant.endsAt))}.`
        : `${copyActivity(input.key)} is in a free trial.`,
      upgradePlan: null,
    };
  }
  if (grant && phase === "ended") {
    return {
      key: input.key,
      allowed: false,
      message: `Your free trial of ${copyActivity(input.key).toLowerCase()} ended on ${formatAuDateUtc(Date.parse(grant.endsAt))}.`,
      upgradePlan,
    };
  }
  return {
    key: input.key,
    allowed: false,
    message: copyNotAllowedMessage(input.key, upgradePlan),
    upgradePlan,
  };
}

export const QUOTA_CAP_KEYS = [
  "max_paper_desks",
  "max_demo_desks",
  "max_live_env_desks",
  "max_bots",
] as const;

export type QuotaCapKey = (typeof QUOTA_CAP_KEYS)[number];

export const DESK_QUOTA_KEYS: readonly QuotaCapKey[] = [
  "max_paper_desks",
  "max_demo_desks",
  "max_live_env_desks",
];

const QUOTA_CLOSED_SUBJECT: Record<QuotaCapKey, string> = {
  max_paper_desks: "Paper Trading desks",
  max_demo_desks: "Exchange Connected - Demo desks",
  max_live_env_desks: "Exchange Connected - Live desks",
  max_bots: "Bots",
};

const QUOTA_NOUN: Record<QuotaCapKey, { one: string; many: string }> = {
  max_paper_desks: { one: "Paper Trading Desk", many: "Paper Trading Desks" },
  max_demo_desks: {
    one: "Exchange Connected - Demo Desk",
    many: "Exchange Connected - Demo Desks",
  },
  max_live_env_desks: {
    one: "Exchange Connected - Live Desk",
    many: "Exchange Connected - Live Desks",
  },
  max_bots: { one: "Bot", many: "Bots" },
};

export type CapUnlockCandidate = UnlockCandidate & {
  caps: PlanCaps;
};

export type QuotaAccess = {
  key: QuotaCapKey;
  allowed: boolean;
  message: string | null;
  upgradePlan: string | null;
  used: number;
  limit: number | null;
};

export function quotaNoun(key: QuotaCapKey, count = 2): string {
  const noun = QUOTA_NOUN[key];
  return count === 1 ? noun.one : noun.many;
}

export function capUsageMessage(
  key: QuotaCapKey,
  _used: number,
  limit: number,
  planName: string | null,
): string {
  if (limit === 0) {
    return notAllowedOnPlanMessage(QUOTA_CLOSED_SUBJECT[key], planName);
  }
  const lead = `You have hit your maximum of ${limit} ${quotaNoun(key, limit)}.`;
  if (!planName) {
    return lead;
  }
  return `${lead} Upgrade to ${planName} to add another.`;
}

export function quotaTrialEndedMessage(key: QuotaCapKey, endedOn: string): string {
  return `Your free trial of ${PLAN_CAP_LABELS[key]} ended on ${endedOn}.`;
}

export function quotaTrialOpenMessage(key: QuotaCapKey, until: string): string {
  return `${PLAN_CAP_LABELS[key]} is in a free trial until ${until}.`;
}

export function cheapestPublicCapPlanName(
  plans: readonly CapUnlockCandidate[],
  key: PlanCapKey,
  used: number,
): string | null {
  const ranked = plans
    .filter((plan) => {
      if (!planIsPublic(plan) || planIsArchived(plan)) {
        return false;
      }
      const cap = plan.caps[key];
      return cap == null || cap > used;
    })
    .slice()
    .sort(
      (left, right) =>
        left.priceUsd - right.priceUsd ||
        left.sortOrder - right.sortOrder ||
        left.name.localeCompare(right.name),
    );
  return ranked[0]?.name ?? null;
}

export function quotaKeyForDesk(input: {
  mode: TradingAccountMode;
  venueEnvironment: string | null;
}): QuotaCapKey {
  const display = deskDisplayMode(input);
  if (display === "paper") {
    return "max_paper_desks";
  }
  if (display === "demo") {
    return "max_demo_desks";
  }
  return "max_live_env_desks";
}

export function quotaKeyAfterBind(input: {
  currentEnvironment: string | null;
  nextEnvironment: string | null;
}): QuotaCapKey | null {
  const before = deskDisplayMode({
    mode: "live",
    venueEnvironment: input.currentEnvironment,
  });
  const after = deskDisplayMode({
    mode: "live",
    venueEnvironment: input.nextEnvironment,
  });
  if (before === after) {
    return null;
  }
  return quotaKeyForDesk({
    mode: "live",
    venueEnvironment: input.nextEnvironment,
  });
}

export function quotaAccessList(input: {
  caps: PlanCaps;
  trials: PlanTrials;
  grants: readonly { key: string; endsAt: string }[];
  nowMs: number;
  plans: readonly CapUnlockCandidate[];
  used: Readonly<Record<QuotaCapKey, number>>;
}): QuotaAccess[] {
  return QUOTA_CAP_KEYS.map((key) =>
    decideQuota({ ...input, key, used: input.used[key] }),
  );
}

export function quotaAccessFor(
  access: readonly QuotaAccess[],
  key: QuotaCapKey,
): QuotaAccess | null {
  return access.find((row) => row.key === key) ?? null;
}

export function quotaRoomMessage(
  row: QuotaAccess | null,
  adding = 1,
): string | null {
  if (!row || adding <= 0) {
    return null;
  }
  if (row.limit == null || row.used + adding <= row.limit) {
    return null;
  }
  if (!row.allowed && row.message) {
    return row.message;
  }
  return capUsageMessage(row.key, row.used, row.limit, row.upgradePlan);
}

function decideQuota(input: {
  key: QuotaCapKey;
  caps: PlanCaps;
  trials: PlanTrials;
  grants: readonly { key: string; endsAt: string }[];
  nowMs: number;
  plans: readonly CapUnlockCandidate[];
  used: number;
}): QuotaAccess {
  const standing = input.caps[input.key];
  const offer = capTrialOffer(
    { features: emptyFeatures(), caps: input.caps, trials: input.trials },
    input.key,
  );
  const grant = input.grants.find((row) => row.key === input.key) ?? null;
  const phase = grant
    ? trialPhase(grant.endsAt, input.nowMs)
    : offer
      ? "active"
      : null;
  const limit = effectiveCap({
    standing,
    offer,
    phase,
  });
  const upgradePlan = cheapestPublicCapPlanName(
    input.plans,
    input.key,
    input.used,
  );
  const base = {
    key: input.key,
    used: input.used,
    limit,
    upgradePlan,
  };
  if (limit == null || input.used + 1 <= limit) {
    const open =
      offer && phase === "active"
        ? grant
          ? quotaTrialOpenMessage(
              input.key,
              formatAuDateUtc(Date.parse(grant.endsAt)),
            )
          : `${PLAN_CAP_LABELS[input.key]} is in a free trial.`
        : null;
    return {
      ...base,
      allowed: true,
      message: open,
    };
  }
  if (
    grant &&
    phase === "ended" &&
    offer?.limit != null &&
    input.used < offer.limit
  ) {
    return {
      ...base,
      allowed: false,
      message: quotaTrialEndedMessage(
        input.key,
        formatAuDateUtc(Date.parse(grant.endsAt)),
      ),
    };
  }
  return {
    ...base,
    allowed: false,
    message: capUsageMessage(input.key, input.used, limit, upgradePlan),
  };
}
