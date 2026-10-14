import {
  AUTOMATED_DESK_TYPES,
  MANUAL_DESK_TYPES,
  formatDeskType,
  type DeskType,
} from "@/lib/accounts/model";
import {
  emptyCaps,
  planIsArchived,
  planIsPublic,
  type PlanFeatureKey,
  type PlanFeatures,
  type PlanVisibility,
} from "@/lib/membership/catalog";
import {
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

export function deskTypeUpgradeMessage(
  deskType: DeskType,
  planName: string | null,
): string {
  const label = formatDeskType(deskType);
  if (!planName) {
    return `${label} desks are not allowed on your plan.`;
  }
  return `${label} desks are not allowed on your plan. Upgrade to ${planName} to enable it.`;
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
  if (input.features[key]) {
    return { deskType: input.deskType, allowed: true, message: null };
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
    };
  }
  return {
    deskType: input.deskType,
    allowed: false,
    message: deskTypeUpgradeMessage(
      input.deskType,
      cheapestPublicPlanName(input.plans, key),
    ),
  };
}
