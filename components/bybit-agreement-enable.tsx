"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  bybitAgreementKindTitle,
  type BybitAgreementKind,
} from "@/lib/exchanges/agreement";
import { enableBybitAgreement } from "@/lib/exchanges/agreement-actions";

export function BybitAgreementEnables({
  connectionId,
  kinds,
}: {
  connectionId: string;
  kinds: readonly BybitAgreementKind[];
}) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState("");
  const [error, setError] = useState("");
  const [pending, startEnable] = useTransition();

  if (kinds.length === 0) {
    return null;
  }

  function enable(kind: BybitAgreementKind) {
    setError("");
    setPendingKey(kind);
    startEnable(async () => {
      const result = await enableBybitAgreement({
        connectionId,
        kind,
      });
      setPendingKey("");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {kinds.map((kind) => {
        const title = bybitAgreementKindTitle(kind);
        const busy = pending && pendingKey === kind;
        return (
          <div
            key={kind}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
          >
            <p className="min-w-0 text-hint text-warning">
              {title} need a Bybit agreement. Sign on Bybit, then enable them
              here.
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={() => enable(kind)}
              className="shrink-0 rounded-control border border-line px-2 py-0.5 text-xs text-ink hover:border-line-strong disabled:opacity-40"
            >
              {busy ? "Enabling…" : `Enable ${title.toLowerCase()}`}
            </button>
          </div>
        );
      })}
      {error ? <p className="text-hint text-danger">{error}</p> : null}
    </div>
  );
}
