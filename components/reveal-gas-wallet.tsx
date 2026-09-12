"use client";

import { useState } from "react";
import { useConfirmDialog } from "@/components/confirm-modal";
import { CopyTextButton } from "@/components/copy-text-button";
import { revealGasWalletAction } from "@/lib/membership/wallet-actions";

export function RevealGasWallet() {
  const { confirm, dialog } = useConfirmDialog();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onReveal() {
    const ok = await confirm({
      title: "Show gas wallet private key?",
      message:
        "Anyone with this key can spend the ETH on the gas wallet. Write it down offline, then hide it.",
      confirmLabel: "Show key",
      danger: true,
    });
    if (!ok) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await revealGasWalletAction();
    setPending(false);
    if (result.ok) {
      setRevealed(result.privateKey);
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      {dialog}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {revealed ? (
        <div className="space-y-3">
          <p className="text-sm text-warning">
            There is no seed phrase. This hex private key is the backup. Hide
            it after you write it down.
          </p>
          <p className="break-all rounded-card border border-line bg-surface-raised px-3 py-2 font-mono text-xs text-ink">
            {revealed}
          </p>
          <div className="flex flex-wrap gap-2">
            <CopyTextButton text={revealed} label="Copy private key" />
            <button
              type="button"
              onClick={() => setRevealed(null)}
              className="rounded-control border border-line bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink hover:border-line-strong"
            >
              Hide
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => void onReveal()}
          className="rounded-control border border-line px-4 py-2 text-sm text-ink hover:border-line-strong disabled:opacity-50"
        >
          {pending ? "Decrypting…" : "Show private key"}
        </button>
      )}
    </div>
  );
}
