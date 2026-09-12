import { CopyTextButton } from "@/components/copy-text-button";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { CRYPTO_CREDIT_DEDUCT_LABEL, formatUsd } from "@/lib/membership/billing";
import {
  checkCheckoutDepositAction,
  checkMyDepositAction,
  payPlanWithCreditAction,
} from "@/lib/membership/wallet-actions";
import { explorerAddressUrl, planDeductDecision } from "@/lib/membership/wallet";
import type {
  BillingChain,
  BillingToken,
  DepositAddress,
} from "@/lib/membership/wallet-store";

export function CryptoWalletPanel({
  mainUsd,
  affiliateUsd,
  address,
  addressError,
  chains,
  tokens,
  deductOn,
  useAffiliate,
  planId,
  planPriceUsd,
  checkout,
}: {
  mainUsd: number;
  affiliateUsd: number;
  address: DepositAddress | null;
  addressError: string | null;
  chains: BillingChain[];
  tokens: BillingToken[];
  deductOn: boolean;
  useAffiliate?: boolean;
  planId?: string;
  planPriceUsd?: number;
  checkout?: boolean;
}) {
  const chain = chains[0] ?? null;
  const token =
    tokens.find((row) => row.chainId === chain?.id && row.kind === "stable") ??
    tokens[0] ??
    null;
  const explorer = chain
    ? explorerAddressUrl(chain.explorerUrl, address?.address ?? "")
    : null;
  const canPay =
    typeof planPriceUsd === "number" &&
    planDeductDecision({
      priceUsd: planPriceUsd,
      mainUsd,
      affiliateUsd,
      useAffiliate: useAffiliate === true,
    }).ok;
  const depositLabel = token && chain
    ? `Send ${token.symbol} on ${chain.name}`
    : "Send the listed testnet token to this address";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
            Main Wallet
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
            {formatUsd(mainUsd)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
            Affiliate earnings
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
            {formatUsd(affiliateUsd)}
          </p>
        </div>
      </div>
      <p className="text-sm text-ink-muted">
        Main is unused crypto paid in. Affiliate is commission. Rent always
        debits Main.
      </p>
      {deductOn ? (
        <p className="text-xs text-ink-faint">{CRYPTO_CREDIT_DEDUCT_LABEL} is on.</p>
      ) : null}

      <div id="top-up" className="space-y-2">
        <p className="text-sm font-medium text-ink">{depositLabel}</p>
        {address ? (
          <>
            <p className="break-all rounded-card border border-line bg-surface-raised px-3 py-2 font-mono text-xs text-ink">
              {address.address}
            </p>
            <div className="flex flex-wrap gap-2">
              <CopyTextButton text={address.address} label="Copy address" />
              {explorer ? (
                <a
                  href={explorer}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-control border border-line bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink hover:border-line-strong"
                >
                  Explorer
                </a>
              ) : null}
            </div>
            <p className="text-xs text-ink-faint">
              Same address on every listed EVM chain. Wait for{" "}
              {chain?.confirmations ?? 3} confirmation
              {(chain?.confirmations ?? 3) === 1 ? "" : "s"}, then check for
              the deposit. Stables credit 1:1 USD to Main.
            </p>
          </>
        ) : (
          <p className="text-sm text-warning">
            {addressError ?? "Deposit address is not available yet."}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {checkout && planId ? (
          <form action={checkCheckoutDepositAction}>
            <input type="hidden" name="planId" value={planId} />
            <PendingSubmitButton
              pendingLabel="Checking…"
              successKey="check-deposit"
              className="rounded-control border border-line px-4 py-2 text-sm text-ink hover:border-line-strong"
            >
              Check for deposit
            </PendingSubmitButton>
          </form>
        ) : (
          <form action={checkMyDepositAction}>
            <PendingSubmitButton
              pendingLabel="Checking…"
              successKey="check-deposit"
              className="rounded-control border border-line px-4 py-2 text-sm text-ink hover:border-line-strong"
            >
              Check for deposit
            </PendingSubmitButton>
          </form>
        )}
        {checkout && planId && typeof planPriceUsd === "number" ? (
          <form action={payPlanWithCreditAction}>
            <input type="hidden" name="planId" value={planId} />
            {deductOn ? (
              <input type="hidden" name="paySubscriptionFromCredit" value="1" />
            ) : null}
            <PendingSubmitButton
              pendingLabel="Paying…"
              successKey="pay-credit"
              disabled={!canPay}
              className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink disabled:bg-accent-strong/40"
            >
              Pay with credit
            </PendingSubmitButton>
          </form>
        ) : null}
      </div>
    </div>
  );
}
