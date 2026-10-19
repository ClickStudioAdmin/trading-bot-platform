"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import {
  ClickGateNotice,
  useClickGate,
} from "@/components/click-gate-notice";
import type { PositionBuilderAccess } from "@/lib/membership/entitlements";

const allow: PositionBuilderAccess = {
  allowed: true,
  message: null,
  upgradePlan: null,
};

const PositionBuilderGateContext = createContext<(anchor: HTMLElement) => boolean>(
  () => false,
);

export function PositionBuilderAccessProvider({
  access,
  active,
  children,
}: {
  access: PositionBuilderAccess | null;
  active: boolean;
  children: ReactNode;
}) {
  const gate = access ?? allow;
  const clickGate = useClickGate();
  const block = useCallback(
    (anchor: HTMLElement) => {
      if (!active || gate.allowed || !gate.message) {
        return false;
      }
      clickGate.show(
        { message: gate.message, upgradePlan: gate.upgradePlan },
        anchor,
      );
      return true;
    },
    [active, clickGate, gate.allowed, gate.message, gate.upgradePlan],
  );
  return (
    <PositionBuilderGateContext.Provider value={block}>
      {children}
      <ClickGateNotice
        access={clickGate.notice}
        anchorRef={clickGate.anchorRef}
        generation={clickGate.generation}
        onDismiss={clickGate.hide}
      />
    </PositionBuilderGateContext.Provider>
  );
}

/** True when the click was stopped and the gate is showing. */
export function usePositionBuilderAddBlocked() {
  return useContext(PositionBuilderGateContext);
}
