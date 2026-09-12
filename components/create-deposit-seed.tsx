"use client";

import { useState } from "react";
import { useConfirmDialog } from "@/components/confirm-modal";
import { CopyTextButton } from "@/components/copy-text-button";
import {
  createDepositHdSeedAction,
  replaceDepositHdSeedAction,
  revealDepositHdSeedAction,
} from "@/lib/membership/wallet-actions";

export function CreateDepositSeed({
  configured,
  addressCount,
}: {
  configured: boolean;
  addressCount: number;
}) {
  const { confirm, dialog } = useConfirmDialog();
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"create" | "reveal" | "replace" | null>(
    null,
  );
  const canReplace = configured && addressCount === 0;

  async function run(
    kind: "create" | "reveal" | "replace",
    action: () => Promise<
      { ok: true; mnemonic: string } | { ok: false; error: string }
    >,
  ) {
    setPending(kind);
    setError(null);
    const result = await action();
    setPending(null);
    if (result.ok) {
      setMnemonic(result.mnemonic);
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-3">
      {dialog}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {mnemonic ? (
        <div className="space-y-3">
          <p className="text-sm text-warning">
            Copy this phrase now and keep it offline. Anyone with it can
            derive every member deposit address and sweep those funds.
          </p>
          <p className="break-words rounded-card border border-line bg-surface-raised px-3 py-2 font-mono text-sm text-ink">
            {mnemonic}
          </p>
          <CopyTextButton text={mnemonic} label="Copy seed" />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {!configured ? (
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => {
              void run("create", createDepositHdSeedAction);
            }}
            className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink disabled:opacity-50"
          >
            {pending === "create" ? "Creating…" : "Create deposit seed"}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => {
              void (async () => {
                const ok = await confirm({
                  title: "Show deposit seed",
                  message:
                    "This decrypts the stored phrase on this screen so you can copy a backup. Do not leave it visible.",
                  confirmLabel: "Show seed",
                });
                if (ok) {
                  await run("reveal", revealDepositHdSeedAction);
                }
              })();
            }}
            className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink disabled:opacity-50"
          >
            {pending === "reveal" ? "Showing…" : "Show backup phrase"}
          </button>
        )}
        {canReplace ? (
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => {
              void (async () => {
                const ok = await confirm({
                  title: "Replace deposit seed",
                  message:
                    "This creates a new phrase and discards the stored one. Only safe because no member addresses have been issued yet.",
                  confirmLabel: "Replace seed",
                  danger: true,
                });
                if (ok) {
                  await run("replace", replaceDepositHdSeedAction);
                }
              })();
            }}
            className="rounded-control border border-line px-4 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-50"
          >
            {pending === "replace" ? "Replacing…" : "Replace unused seed"}
          </button>
        ) : null}
      </div>
      {configured && addressCount > 0 ? (
        <p className="text-xs text-ink-faint">
          The seed cannot be replaced after member addresses are issued. Use
          Show backup phrase and store a copy offline.
        </p>
      ) : null}
    </div>
  );
}
