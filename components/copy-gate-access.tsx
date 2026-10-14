"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
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

export function CopyFollowTrialLine({
  className = "text-sm text-warning",
}: {
  className?: string;
}) {
  const gate = useCopyGateAccess();
  const message = gate ? followTrialMessage(gate) : null;
  if (!message) {
    return null;
  }
  return <p className={className}>{message}</p>;
}

export function CopyShareTrialLines() {
  const gate = useCopyGateAccess();
  const lines = gate ? shareTrialLines(gate) : [];
  if (lines.length === 0) {
    return null;
  }
  return (
    <div className="space-y-1">
      {lines.map((line) => (
        <p key={line} className="text-sm text-warning">
          {line}
        </p>
      ))}
    </div>
  );
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
  return <p className="text-sm text-warning">{message}</p>;
}
