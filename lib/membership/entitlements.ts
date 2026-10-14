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
