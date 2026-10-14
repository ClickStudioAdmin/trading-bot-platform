"use client";

import { createContext, useContext, type ReactNode } from "react";
import { PlanGateNotices } from "@/components/desk-type-reject";
import { FreeTrialBadge, FreeTrialBadges } from "@/components/plan-trial-hint";
import type { DeskType } from "@/lib/accounts/model";
import {
  DESK_QUOTA_KEYS,
  followClickDenial,
  followTrialMessage,
  inviteTrialMessage,
  shareTrialLines,
  type CopyGateAccess,
} from "@/lib/membership/entitlements";

const CopyGateContext = createContext<CopyGateAccess | null>(null);

export function CopyGateProvider({
  access,
  children,
}: {
  access: CopyGateAccess | null;
  children: ReactNode;
}) {
  return (
    <CopyGateContext.Provider value={access}>{children}</CopyGateContext.Provider>
  );
}

export function useCopyGateAccess(): CopyGateAccess | null {
  return useContext(CopyGateContext);
}

export function CopyDeskPageNotices({ deskType }: { deskType: DeskType }) {
  const gate = useCopyGateAccess();
  const denial = gate ? followClickDenial(gate) : null;
  return (
    <PlanGateNotices
      deskTypes={[deskType]}
      quotaKeys={DESK_QUOTA_KEYS}
      extras={denial ? [denial] : []}
    />
  );
}

export function CopyFollowTrialLine() {
  const gate = useCopyGateAccess();
  const message = gate ? followTrialMessage(gate) : null;
  if (!message) {
    return null;
  }
  return <FreeTrialBadge message={message} />;
}

export function CopyShareTrialLines() {
  const gate = useCopyGateAccess();
  const lines = gate ? shareTrialLines(gate) : [];
  if (lines.length === 0) {
    return null;
  }
  return <FreeTrialBadges messages={lines} />;
}

export function CopyInviteTrialLine({
  followerCount,
}: {
  followerCount: number;
}) {
  const gate = useCopyGateAccess();
  const message = gate ? inviteTrialMessage(gate, followerCount) : null;
  if (!message) {
    return null;
  }
  return <FreeTrialBadge message={message} />;
}
