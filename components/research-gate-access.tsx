"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import { FreeTrialBadges } from "@/components/plan-trial-hint";
import { IconPlay } from "@/components/icons";
import type { ResearchGateAccess } from "@/lib/membership/entitlements";

const ResearchGateContext = createContext<ResearchGateAccess | null>(null);

export function ResearchGateProvider({
  access,
  children,
}: {
  access: ResearchGateAccess | null;
  children: ReactNode;
}) {
  return (
    <ResearchGateContext.Provider value={access}>
      {children}
    </ResearchGateContext.Provider>
  );
}

export function useResearchGateAccess(): ResearchGateAccess | null {
  return useContext(ResearchGateContext);
}

export function ResearchTrialLines({ lines }: { lines: readonly string[] }) {
  if (lines.length === 0) {
    return null;
  }
  return (
    <FreeTrialBadges
      messages={lines}
      className="mb-3 flex flex-wrap items-center gap-2"
    />
  );
}

export function ResearchReplayButton({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-2 rounded-control bg-accent-strong px-4 py-2 text-base font-medium text-ink hover:bg-accent"
    >
      <IconPlay size={28} className="ml-0.5 size-7 fill-current" />
      Replay
    </Link>
  );
}
