"use client";

import { createContext, useContext, type ReactNode } from "react";
import { FreeTrialBadges } from "@/components/plan-trial-hint";
import {
  templateFeatureAccessFor,
  type TemplateFeatureAccess,
  type TemplateFeatureKey,
} from "@/lib/membership/entitlements";

const TemplateFeatureAccessContext = createContext<TemplateFeatureAccess[]>([]);

export function TemplateFeatureAccessProvider({
  access,
  children,
}: {
  access: TemplateFeatureAccess[];
  children: ReactNode;
}) {
  return (
    <TemplateFeatureAccessContext.Provider value={access}>
      {children}
    </TemplateFeatureAccessContext.Provider>
  );
}

export function useTemplateFeatureAccess(): TemplateFeatureAccess[] {
  return useContext(TemplateFeatureAccessContext);
}

export function useTemplateFeatureGate(active: boolean) {
  const access = useTemplateFeatureAccess();

  function reveal(key: TemplateFeatureKey): TemplateFeatureAccess | null {
    if (!active) {
      return null;
    }
    const row = templateFeatureAccessFor(access, key);
    if (!row || row.allowed || !row.message) {
      return null;
    }
    return row;
  }

  const trials = active
    ? access.filter((row) => row.allowed && row.message)
    : [];

  return { reveal, trials, access };
}

export function TemplateFeatureGateNotices({
  trials,
}: {
  trials: readonly TemplateFeatureAccess[];
}) {
  return (
    <FreeTrialBadges
      messages={trials.flatMap((row) => (row.message ? [row.message] : []))}
      className="mb-4 flex flex-wrap items-center gap-2"
    />
  );
}
