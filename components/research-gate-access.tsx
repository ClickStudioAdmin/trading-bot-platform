"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import { DeskTypeRejectBanner } from "@/components/desk-type-reject";
import { IconPlay } from "@/components/icons";
import type {
  ResearchGateAccess,
  ResearchNotice,
} from "@/lib/membership/entitlements";

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

export function ResearchNoticeBanner({
  notice,
  className = "mb-4",
}: {
  notice: ResearchNotice | null;
  className?: string;
}) {
  if (!notice) {
    return null;
  }
  return (
    <div className={className}>
      <DeskTypeRejectBanner access={notice} />
    </div>
  );
}

export function ResearchTrialLines({ lines }: { lines: readonly string[] }) {
  if (lines.length === 0) {
    return null;
  }
  return (
    <div className="mb-3 space-y-1">
      {lines.map((line) => (
        <p key={line} className="text-sm text-warning">
          {line}
        </p>
      ))}
    </div>
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
