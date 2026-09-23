"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { refreshOpportunityScan } from "@/lib/opportunities/refresh-action";

export function OpportunityBookRefresh({ stale }: { stale: boolean }) {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (!stale || started.current) {
      return;
    }
    started.current = true;
    let cancelled = false;
    void refreshOpportunityScan()
      .then((saved) => {
        if (!cancelled && saved) {
          router.refresh();
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router, stale]);

  return null;
}
