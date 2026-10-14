"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DeskTypeAccess } from "@/lib/membership/entitlements";

const DeskTypeAccessContext = createContext<DeskTypeAccess[]>([]);

export function DeskTypeAccessProvider({
  access,
  children,
}: {
  access: DeskTypeAccess[];
  children: ReactNode;
}) {
  return (
    <DeskTypeAccessContext.Provider value={access}>
      {children}
    </DeskTypeAccessContext.Provider>
  );
}

export function useDeskTypeAccess(): DeskTypeAccess[] {
  return useContext(DeskTypeAccessContext);
}
