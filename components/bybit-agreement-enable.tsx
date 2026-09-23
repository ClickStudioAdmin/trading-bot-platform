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
  symbols = [],
  selectedKinds = [],
  onToggleKind,
}: {
  connectionId?: string;
  kinds: readonly BybitAgreementKind[];
  symbols?: readonly string[];
  selectedKinds?: readonly BybitAgreementKind[];
  onToggleKind?: (kind: BybitAgreementKind) => void;
}) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState("");
  const [error, setError] = useState("");
  const [pending, startEnable] = useTransition();

  if (kinds.length === 0 && symbols.length === 0) {
    return null;
  }

  function enable(input: { kind?: BybitAgreementKind; symbol?: string }) {
    if (!connectionId) {
      if (input.kind) {
        onToggleKind?.(input.kind);
      }
      return;
    }
    const key = input.kind ?? input.symbol ?? "";
    setError("");
    setPendingKey(key);
    startEnable(async () => {
      const result = await enableBybitAgreement({
        connectionId,
        kind: input.kind,
        symbol: input.symbol,
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
    <div className="mt-2 space-y-2">
      {kinds.map((kind) => (
        <AgreementChoice
          key={kind}
          title={bybitAgreementKindTitle(kind)}
          pending={pending && pendingKey === kind}
          enabled={selectedKinds.includes(kind)}
          onEnable={() => enable({ kind })}
        />
      ))}
      {symbols.map((symbol) => (
        <AgreementChoice
          key={symbol}
          title={symbol}
          single
          pending={pending && pendingKey === symbol}
          onEnable={() => enable({ symbol })}
        />
      ))}
      {error ? <p className="text-hint text-danger">{error}</p> : null}
    </div>
  );
}

function AgreementChoice({
  title,
  single = false,
  pending,
  enabled = false,
  onEnable,
}: {
  title: string;
  single?: boolean;
  pending: boolean;
  enabled?: boolean;
  onEnable: () => void;
}) {
  const label = enabled
    ? "Enabled"
    : pending
      ? "Enabling…"
      : single
        ? "Enable this contract"
        : `Enable ${title.toLowerCase()}`;
  return (
    <div>
      <p className="text-hint text-warning">
        {single
          ? `${title} needs a Bybit agreement. Sign on Bybit, then enable it here.`
          : `${title} need a Bybit agreement. Sign on Bybit, then enable them here.`}
      </p>
      <button
        type="button"
        disabled={pending}
        aria-pressed={enabled}
        onClick={onEnable}
        className="mt-1 rounded-control border border-line px-2 py-0.5 text-xs text-ink hover:border-line-strong disabled:opacity-40"
      >
        {label}
      </button>
    </div>
  );
}
