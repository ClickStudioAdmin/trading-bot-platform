"use client";

import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";
import {
  quotaAccessFor,
  type QuotaAccess,
} from "@/lib/membership/entitlements";

const QuotaAccessContext = createContext<QuotaAccess[]>([]);

export function QuotaAccessProvider({
  access,
  children,
}: {
  access: QuotaAccess[];
  children: ReactNode;
}) {
  return (
    <QuotaAccessContext.Provider value={access}>
      {children}
    </QuotaAccessContext.Provider>
  );
}

export function useQuotaAccess(): QuotaAccess[] {
  return useContext(QuotaAccessContext);
}

export function NewBotLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  const row = quotaAccessFor(useQuotaAccess(), "max_bots");
  if (row && !row.allowed) {
    return (
      <button
        type="button"
        disabled
        title={row.message ?? undefined}
        className={`inline-flex cursor-not-allowed items-center opacity-40 ${className}`}
      >
        {children}
      </button>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
