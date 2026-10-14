"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ClickGateNotice, useClickGate } from "@/components/click-gate-notice";
import { FreeTrialBadges } from "@/components/plan-trial-hint";
import { IconPlay } from "@/components/icons";
import {
  replayClickDenial,
  researchTrialLine,
  type ResearchGateAccess,
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
  const gate = useResearchGateAccess();
  const router = useRouter();
  const clickGate = useClickGate();
  const lines: string[] = [];
  if (gate?.backtest.allowed) {
    const backtest = researchTrialLine(gate.backtest);
    if (backtest) {
      lines.push(backtest);
    }
  }
  return (
    <div className="flex max-w-xl flex-col items-stretch gap-2">
      <ClickGateNotice
        access={clickGate.notice}
        anchorRef={clickGate.anchorRef}
        generation={clickGate.generation}
        onDismiss={clickGate.hide}
      />
      <ResearchTrialLines lines={lines} />
      <button
        type="button"
        onClick={(event) => {
          const denial = gate ? replayClickDenial(gate) : null;
          if (denial) {
            clickGate.show(denial, event.currentTarget);
            return;
          }
          clickGate.hide();
          router.push(href);
        }}
        className="inline-flex shrink-0 items-center gap-2 self-end rounded-control bg-accent-strong px-4 py-2 text-base font-medium text-ink hover:bg-accent"
      >
        <IconPlay size={28} className="ml-0.5 size-7 fill-current" />
        Replay
      </button>
    </div>
  );
}
