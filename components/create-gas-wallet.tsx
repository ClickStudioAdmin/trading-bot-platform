"use client";

import { useState } from "react";
import { CopyTextButton } from "@/components/copy-text-button";
import { createGasWalletAction } from "@/lib/membership/wallet-actions";

export function CreateGasWallet() {
  const [created, setCreated] = useState<{
    address: string;
    privateKey: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (created) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-warning">
          Fund this public address with ETH on each listed chain. Write the
          private key down now. It is not shown again.
        </p>
        <p className="break-all rounded-card border border-line bg-surface-raised px-3 py-2 font-mono text-xs text-ink">
          {created.address}
        </p>
        <CopyTextButton text={created.address} label="Copy address" />
        <p className="break-all rounded-card border border-line bg-surface-raised px-3 py-2 font-mono text-xs text-ink">
          {created.privateKey}
        </p>
        <CopyTextButton text={created.privateKey} label="Copy private key" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setPending(true);
          setError(null);
          void createGasWalletAction().then((result) => {
            setPending(false);
            if (result.ok) {
              setCreated({
                address: result.address,
                privateKey: result.privateKey,
              });
            } else {
              setError(result.error);
            }
          });
        }}
        className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create gas wallet"}
      </button>
    </div>
  );
}
