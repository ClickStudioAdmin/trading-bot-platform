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

function joinEnglishList(items: readonly string[]): string {
  if (items.length <= 1) {
    return items[0] ?? "";
  }
  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** One setup-choice line for every closed desk type. */
export function bundledDeskTypeDenial(
  rows: readonly DeskTypeAccess[],
): Pick<DeskTypeAccess, "allowed" | "message" | "upgradePlan"> | null {
  const denied = DESK_TYPE_ORDER.flatMap((deskType) => {
    const row = rows.find((item) => item.deskType === deskType);
    return row && !row.allowed && row.message ? [row] : [];
  });
  if (denied.length === 0) {
    return null;
  }
  if (denied.length === 1) {
    const only = denied[0];
    return {
      allowed: false,
      message: only.message,
      upgradePlan: only.upgradePlan,
    };
  }
  const plans = new Set(denied.map((row) => row.upgradePlan));
  const upgradePlan = plans.size === 1 ? denied[0].upgradePlan : null;
  const names = joinEnglishList(denied.map((row) => formatDeskType(row.deskType)));
  const standard = denied.every(
    (row) => row.message === deskTypeUpgradeMessage(row.deskType, row.upgradePlan),
  );
  if (standard) {
    return {
      allowed: false,
      message: notAllowedOnPlanMessage(`${names} desks`, upgradePlan),
      upgradePlan,
    };
  }
  const leads = denied.map((row) => gateRejectLead(row.message ?? "", row.upgradePlan));
  return {
    allowed: false,
    message: upgradePlan
      ? `${leads.join(" ")} Upgrade to ${upgradePlan} to enable it.`
      : leads.join(" "),
    upgradePlan,
  };
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

export const RESEARCH_FEATURE_KEYS = [
  "research_backtest",
  "research_backtest_attach_templates",
  "replay_backtests",
  "replay_chart_indicators",
  "replay_strategy_optimization",
] as const;

export type ResearchFeatureKey = (typeof RESEARCH_FEATURE_KEYS)[number];

const RESEARCH_ACTIVITY: Record<ResearchFeatureKey, string> = {
  research_backtest: "Backtesting",
  research_backtest_attach_templates: "Attaching results to a bot template",
  replay_backtests: "Replaying backtests",
  replay_chart_indicators: "Adding chart indicators",
  replay_strategy_optimization: "Strategy optimization",
};

export const RESEARCH_CAP_KEYS = [
  "max_stored_backtests",
  "max_backtest_years",
] as const;

export type ResearchCapKey = (typeof RESEARCH_CAP_KEYS)[number];

/** Same year length the backtest APR uses. A window of exactly this many milliseconds fits. */
export const BACKTEST_YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

export type ResearchFeatureAccess = {
  key: ResearchFeatureKey;
  allowed: boolean;
  message: string | null;
  upgradePlan: string | null;
};

export type ResearchCapSnapshot = {
  key: ResearchCapKey;
  standing: number | null;
  trialLimit: number | null;
  phase: "active" | "ended" | null;
  trialEndsOn: string | null;
  upgradePlan: string | null;
  limit: number | null;
};

export type ResearchGateAccess = {
  backtest: ResearchFeatureAccess;
  attach: ResearchFeatureAccess;
  replay: ResearchFeatureAccess;
  indicators: ResearchFeatureAccess;
  optimize: ResearchFeatureAccess;
  saved: ResearchCapSnapshot & { used: number };
  years: ResearchCapSnapshot;
  /** False when the owned-run count could not be read. Caps then fail closed on the server. */
  savedCountOk: boolean;
};

export type ResearchNotice = {
  allowed: false;
  message: string;
  upgradePlan: string | null;
};

export function researchActivity(key: ResearchFeatureKey): string {
  return RESEARCH_ACTIVITY[key];
}

export function researchFeatureAccessList(input: {
  features: PlanFeatures;
  trials: PlanTrials;
  grants: readonly { key: string; endsAt: string }[];
  nowMs: number;
  plans: readonly UnlockCandidate[];
}): ResearchFeatureAccess[] {
  return RESEARCH_FEATURE_KEYS.map((key) =>
    decideResearchFeature({ ...input, key }),
  );
}

export function researchGateAccess(input: {
  features: PlanFeatures;
  caps: PlanCaps;
  trials: PlanTrials;
  grants: readonly { key: string; endsAt: string }[];
  nowMs: number;
  plans: readonly CapUnlockCandidate[];
  savedUsed: number;
  savedCountOk?: boolean;
}): ResearchGateAccess {
  const rows = researchFeatureAccessList(input);
  const feature = (key: ResearchFeatureKey) =>
    rows.find((row) => row.key === key) ?? {
      key,
      allowed: false,
      message: researchNotAllowedMessage(key, null),
      upgradePlan: null,
    };
  const capInput = {
    features: input.features,
    caps: input.caps,
    trials: input.trials,
    grants: input.grants,
    nowMs: input.nowMs,
    plans: input.plans,
  };
  return {
    backtest: feature("research_backtest"),
    attach: feature("research_backtest_attach_templates"),
    replay: feature("replay_backtests"),
    indicators: feature("replay_chart_indicators"),
    optimize: feature("replay_strategy_optimization"),
    saved: {
      ...researchCapSnapshot({ ...capInput, key: "max_stored_backtests" }),
      used: input.savedUsed,
    },
    years: researchCapSnapshot({ ...capInput, key: "max_backtest_years" }),
    savedCountOk: input.savedCountOk ?? true,
  };
}

export function researchCapSnapshot(input: {
  key: ResearchCapKey;
  features: PlanFeatures;
  caps: PlanCaps;
  trials: PlanTrials;
  grants: readonly { key: string; endsAt: string }[];
  nowMs: number;
  plans: readonly CapUnlockCandidate[];
}): ResearchCapSnapshot {
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
    limit,
  };
}

export function backtestSpanFitsYears(
  fromMs: number,
  toMs: number,
  years: number,
): boolean {
  if (!(years > 0)) {
    return false;
  }
  const span = toMs - fromMs;
  if (!Number.isFinite(span) || span < 0) {
    return false;
  }
  return span <= years * BACKTEST_YEAR_MS;
}

export function backtestCreateDenial(
  gate: ResearchGateAccess,
): ResearchNotice | null {
  return featureNotice(gate.backtest);
}

export function attachClickDenial(
  gate: ResearchGateAccess,
): ResearchNotice | null {
  return featureNotice(gate.attach);
}

export function replayClickDenial(
  gate: ResearchGateAccess,
): ResearchNotice | null {
  return featureNotice(gate.backtest) ?? featureNotice(gate.replay);
}

export function indicatorAddDenial(
  gate: ResearchGateAccess,
): ResearchNotice | null {
  return featureNotice(gate.indicators);
}

export function optimizeClickDenial(
  gate: ResearchGateAccess,
): ResearchNotice | null {
  return featureNotice(gate.optimize);
}

export function queueBacktestDenial(
  gate: ResearchGateAccess,
  input: { variant: boolean; adding: number; fromMs: number; toMs: number },
): ResearchNotice | null {
  const notices = newBacktestPageNotices(gate, input);
  return notices[0] ?? null;
}

/** Banners for the new backtest page. Backtesting off hides the cap lines. */
export function newBacktestPageNotices(
  gate: ResearchGateAccess,
  input: { variant?: boolean; adding: number; fromMs: number; toMs: number },
): ResearchNotice[] {
  const blocked = featureNotice(gate.backtest);
  if (blocked) {
    return [blocked];
  }
  if (input.variant) {
    const optimize = featureNotice(gate.optimize);
    if (optimize) {
      return [optimize];
    }
  }
  const notices: ResearchNotice[] = [];
  const saved = savedBacktestDecision(gate, input.adding);
  if (!saved.allowed && saved.message) {
    notices.push({
      allowed: false,
      message: saved.message,
      upgradePlan: saved.upgradePlan,
    });
  }
  const years = backtestYearsDecision(gate, input.fromMs, input.toMs);
  if (!years.allowed && years.message) {
    notices.push({
      allowed: false,
      message: years.message,
      upgradePlan: years.upgradePlan,
    });
  }
  return notices;
}

export function savedBacktestDecision(
  gate: ResearchGateAccess,
  adding: number,
): { allowed: boolean; message: string | null; upgradePlan: string | null } {
  return capCountDecision(gate.saved, adding, {
    open: "Saved Backtests",
    ended: "saved backtests",
    closed: savedBacktestClosedMessage,
  });
}

export function backtestYearsDecision(
  gate: ResearchGateAccess,
  fromMs: number,
  toMs: number,
): { allowed: boolean; message: string | null; upgradePlan: string | null } {
  const snapshot = gate.years;
  const open = yearsTrialOpen(snapshot);
  const limit = snapshot.limit;
  if (limit == null || backtestSpanFitsYears(fromMs, toMs, limit)) {
    return { allowed: true, message: open, upgradePlan: null };
  }
  const withinTrial =
    snapshot.trialLimit != null &&
    backtestSpanFitsYears(fromMs, toMs, snapshot.trialLimit);
  if (snapshot.phase === "ended" && withinTrial && snapshot.trialEndsOn) {
    return {
      allowed: false,
      message: `Your free trial of backtest timeframe ended on ${snapshot.trialEndsOn}.`,
      upgradePlan: snapshot.upgradePlan,
    };
  }
  return {
    allowed: false,
    message: yearsClosedMessage(limit, snapshot.upgradePlan),
    upgradePlan: snapshot.upgradePlan,
  };
}

export function backtestYearsHint(gate: ResearchGateAccess): string | null {
  const limit = gate.years.limit;
  if (limit == null || limit <= 0) {
    return null;
  }
  return yearsAvailableMessage(limit);
}

export function researchTrialLine(
  row: ResearchFeatureAccess,
): string | null {
  return row.allowed && row.message ? row.message : null;
}

export function queueTrialLines(
  gate: ResearchGateAccess,
  input: { variant: boolean; adding: number; fromMs: number; toMs: number },
): string[] {
  if (queueBacktestDenial(gate, input)) {
    return [];
  }
  const lines: string[] = [];
  const backtest = researchTrialLine(gate.backtest);
  if (backtest) {
    lines.push(backtest);
  }
  if (input.variant) {
    const optimize = researchTrialLine(gate.optimize);
    if (optimize) {
      lines.push(optimize);
    }
  }
  const saved = savedBacktestDecision(gate, input.adding);
  if (saved.allowed && saved.message) {
    lines.push(saved.message);
  }
  const years = backtestYearsDecision(gate, input.fromMs, input.toMs);
  if (years.allowed && years.message) {
    lines.push(years.message);
  }
  return lines;
}

export function backtestListTrialLines(gate: ResearchGateAccess): string[] {
  const lines: string[] = [];
  const backtest = researchTrialLine(gate.backtest);
  if (backtest) {
    lines.push(backtest);
  }
  if (gate.backtest.allowed) {
    const replay = researchTrialLine(gate.replay);
    if (replay) {
      lines.push(replay);
    }
  }
  return lines;
}

function featureNotice(
  row: ResearchFeatureAccess,
): ResearchNotice | null {
  if (row.allowed || !row.message) {
    return null;
  }
  return {
    allowed: false,
    message: row.message,
    upgradePlan: row.upgradePlan,
  };
}

function researchNotAllowedMessage(
  key: ResearchFeatureKey,
  planName: string | null,
): string {
  const lead = `${researchActivity(key)} is not allowed on your plan.`;
  if (!planName) {
    return lead;
  }
  return `${lead} Upgrade to ${planName} to enable it.`;
}

function decideResearchFeature(input: {
  key: ResearchFeatureKey;
  features: PlanFeatures;
  trials: PlanTrials;
  grants: readonly { key: string; endsAt: string }[];
  nowMs: number;
  plans: readonly UnlockCandidate[];
}): ResearchFeatureAccess {
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
        ? `${researchActivity(input.key)} is in a free trial until ${formatAuDateUtc(Date.parse(grant.endsAt))}.`
        : `${researchActivity(input.key)} is in a free trial.`,
      upgradePlan: null,
    };
  }
  if (grant && phase === "ended") {
    return {
      key: input.key,
      allowed: false,
      message: `Your free trial of ${researchActivity(input.key).toLowerCase()} ended on ${formatAuDateUtc(Date.parse(grant.endsAt))}.`,
      upgradePlan,
    };
  }
  return {
    key: input.key,
    allowed: false,
    message: researchNotAllowedMessage(input.key, upgradePlan),
    upgradePlan,
  };
}

function capCountDecision(
  snapshot: ResearchCapSnapshot & { used: number },
  adding: number,
  copy: {
    open: string;
    ended: string;
    closed: (limit: number, plan: string | null) => string;
  },
): { allowed: boolean; message: string | null; upgradePlan: string | null } {
  const open =
    snapshot.phase === "active" && snapshot.trialLimit != null
      ? snapshot.trialEndsOn
        ? `${copy.open} are in a free trial until ${snapshot.trialEndsOn}.`
        : `${copy.open} are in a free trial.`
      : null;
  const limit = snapshot.limit;
  if (limit == null || snapshot.used + adding <= limit) {
    return { allowed: true, message: open, upgradePlan: null };
  }
  const withinTrial =
    snapshot.trialLimit != null && snapshot.used + adding <= snapshot.trialLimit;
  if (snapshot.phase === "ended" && withinTrial && snapshot.trialEndsOn) {
    return {
      allowed: false,
      message: `Your free trial of ${copy.ended} ended on ${snapshot.trialEndsOn}.`,
      upgradePlan: snapshot.upgradePlan,
    };
  }
  return {
    allowed: false,
    message: copy.closed(limit, snapshot.upgradePlan),
    upgradePlan: snapshot.upgradePlan,
  };
}

function savedBacktestClosedMessage(
  limit: number,
  planName: string | null,
): string {
  if (limit <= 0) {
    return researchNotAllowedMessage("research_backtest", planName);
  }
  const noun = limit === 1 ? "Saved Backtest" : "Saved Backtests";
  const lead = `You have hit your maximum of ${limit} ${noun}.`;
  if (!planName) {
    return lead;
  }
  return `${lead} Upgrade to ${planName} to add another.`;
}

function yearsAvailableMessage(limit: number): string {
  const noun = limit === 1 ? "year" : "years";
  return `Maximum of ${limit} ${noun} available on your plan.`;
}

function yearsClosedMessage(limit: number, planName: string | null): string {
  if (limit <= 0) {
    return researchNotAllowedMessage("research_backtest", planName);
  }
  const lead = `${yearsAvailableMessage(limit)}`;
  if (!planName) {
    return lead;
  }
  return `${lead} Upgrade to ${planName} to enable it.`;
}

function yearsTrialOpen(snapshot: ResearchCapSnapshot): string | null {
  if (snapshot.phase !== "active" || snapshot.trialLimit == null) {
    return null;
  }
  if (!snapshot.trialEndsOn) {
    return "Backtest timeframe is in a free trial.";
  }
  return `Backtest timeframe is in a free trial until ${snapshot.trialEndsOn}.`;
}
