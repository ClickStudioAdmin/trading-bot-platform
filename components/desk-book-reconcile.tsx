"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { reconcileDeskBookAction } from "@/lib/futures/reconcile-action";

const QUIET_MS = 20_000;
const lastStarted = new Map<string, number>();

export function DeskBookReconcile({ accountId }: { accountId: string }) {
  const router = useRouter();

  useEffect(() => {
    const last = lastStarted.get(accountId) ?? 0;
    if (Date.now() - last < QUIET_MS) {
      return;
    }
    lastStarted.set(accountId, Date.now());
    let cancelled = false;
    void reconcileDeskBookAction()
      .then((changed) => {
        if (!cancelled && changed > 0) {
          router.refresh();
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accountId, router]);

  return null;
}
