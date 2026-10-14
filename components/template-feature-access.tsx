"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { DeskTypeRejectBanner } from "@/components/desk-type-reject";
import {
  TEMPLATE_FEATURE_KEYS,
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
  const [revealed, setRevealed] = useState<TemplateFeatureKey[]>([]);

  function reveal(key: TemplateFeatureKey): boolean {
    if (!active) {
      return false;
    }
    const row = templateFeatureAccessFor(access, key);
    if (!row || row.allowed) {
      return false;
    }
    setRevealed((current) =>
      current.includes(key) ? current : [...current, key],
    );
    return true;
  }

  const denied = TEMPLATE_FEATURE_KEYS.flatMap((key) => {
    if (!revealed.includes(key)) {
      return [];
    }
    const row = templateFeatureAccessFor(access, key);
    return row && !row.allowed ? [row] : [];
  });
  const trials = active
    ? access.filter((row) => row.allowed && row.message)
    : [];

  return { reveal, denied, trials, revealed, access };
}

export function TemplateFeatureGateNotices({
  denied,
  trials,
}: {
  denied: readonly TemplateFeatureAccess[];
  trials: readonly TemplateFeatureAccess[];
}) {
  if (denied.length === 0 && trials.length === 0) {
    return null;
  }
  return (
    <div className="mb-4 space-y-3">
      {denied.map((row) => (
        <DeskTypeRejectBanner key={row.key} access={row} />
      ))}
      {trials.map((row) => (
        <p key={row.key} className="text-sm text-warning">
          {row.message}
        </p>
      ))}
    </div>
  );
}
