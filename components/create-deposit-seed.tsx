"use client";

import { useState } from "react";
import { CopyTextButton } from "@/components/copy-text-button";
import { createDepositHdSeedAction } from "@/lib/membership/wallet-actions";

export function CreateDepositSeed() {
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (mnemonic) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-warning">
          Write this seed down now. It is not shown again. The app only keeps
          the encrypted copy.
        </p>
        <p className="break-words rounded-card border border-line bg-surface-raised px-3 py-2 font-mono text-sm text-ink">
          {mnemonic}
        </p>
        <CopyTextButton text={mnemonic} label="Copy seed" />
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
          void createDepositHdSeedAction().then((result) => {
            setPending(false);
            if (result.ok) {
              setMnemonic(result.mnemonic);
            } else {
              setError(result.error);
            }
          });
        }}
        className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create deposit seed"}
      </button>
    </div>
  );
}
