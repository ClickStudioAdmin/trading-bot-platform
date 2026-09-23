"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  bybitAgreementKindTitle,
  type BybitAgreementKind,
} from "@/lib/exchanges/agreement";
import {
  enableBybitAgreement,
  enableBybitAgreementGroups,
} from "@/lib/exchanges/agreement-actions";

export function BybitAgreementEnables({
  connectionId,
  kinds,
  selectedKinds = [],
  onToggleKind,
  persist = "connection",
  layout = "stack",
}: {
  connectionId?: string;
  kinds: readonly BybitAgreementKind[];
  selectedKinds?: readonly BybitAgreementKind[];
  onToggleKind?: (kind: BybitAgreementKind) => void;
  persist?: "connection" | "login";
  layout?: "stack" | "wide";
}) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState("");
  const [error, setError] = useState("");
  const [pending, startEnable] = useTransition();

  if (kinds.length === 0) {
    return null;
  }

  function enable(kind: BybitAgreementKind) {
    if (persist === "login") {
      if (selectedKinds.includes(kind)) {
        return;
      }
      setError("");
      setPendingKey(kind);
      startEnable(async () => {
        const result = await enableBybitAgreementGroups({ kind });
        setPendingKey("");
        if (!result.ok && result.reason !== "needs-connection") {
          setError(result.error);
          return;
        }
        onToggleKind?.(kind);
        if (result.ok) {
          router.refresh();
        }
      });
      return;
    }
    if (!connectionId) {
      onToggleKind?.(kind);
      return;
    }
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
    <div
      className={
        layout === "wide"
          ? "mt-2 grid gap-4 sm:grid-cols-2"
          : "mt-2 max-w-52 space-y-2"
      }
    >
      {kinds.map((kind) => (
        <AgreementChoice
          key={kind}
          title={bybitAgreementKindTitle(kind)}
          pending={pending && pendingKey === kind}
          enabled={selectedKinds.includes(kind)}
          wide={layout === "wide"}
          onEnable={() => enable(kind)}
        />
      ))}
      {error ? <p className="text-hint text-danger">{error}</p> : null}
    </div>
  );
}

function AgreementChoice({
  title,
  pending,
  enabled = false,
  wide = false,
  onEnable,
}: {
  title: string;
  pending: boolean;
  enabled?: boolean;
  wide?: boolean;
  onEnable: () => void;
}) {
  const label = enabled
    ? "Enabled"
    : pending
      ? "Enabling…"
      : `Enable ${title.toLowerCase()}`;
  return (
    <div
      className={wide ? "flex h-full flex-col justify-between gap-2" : undefined}
    >
      <p className="min-w-0 flex-1 whitespace-normal text-hint text-warning">
        {title} need a Bybit agreement. Sign on Bybit, then enable them here.
      </p>
      <button
        type="button"
        disabled={pending || enabled}
        aria-pressed={enabled}
        onClick={onEnable}
        className={`rounded-control border border-line px-2 py-0.5 text-xs text-ink hover:border-line-strong disabled:opacity-40 ${
          wide
            ? "self-start whitespace-nowrap"
            : "mt-1 whitespace-normal text-left"
        }`}
      >
        {label}
      </button>
    </div>
  );
}
