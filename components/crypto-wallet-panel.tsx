"use client";

import Link from "next/link";
import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { CopyTextButton } from "@/components/copy-text-button";
import {
  ButtonBusyIcon,
  PendingSubmitButton,
} from "@/components/pending-submit-button";
import { formatUsd } from "@/lib/membership/billing";
import {
  payoutStatusLabel,
  shortenPayoutAddress,
} from "@/lib/membership/affiliate";
import {
  checkCheckoutDepositAction,
  checkMyDepositAction,
  payPlanWithCreditAction,
  requestMainWalletWithdrawAction,
} from "@/lib/membership/wallet-actions";
import { BILLING_FIELD_CLASS } from "@/lib/membership/wallet-form";
import {
  explorerAddressUrl,
  planDeductDecision,
  roundUsd,
} from "@/lib/membership/wallet";
import type {
  BillingChain,
  BillingToken,
  DepositAddress,
  MainWalletWithdrawContext,
} from "@/lib/membership/wallet-store";

type LiveMainWalletValue = {
  mainUsd: number;
  setMainUsd: (usd: number) => void;
  notice: string | null;
  noticeOk: boolean;
  error: string | null;
  setStatus: (status: {
    notice?: string | null;
    noticeOk?: boolean;
    error?: string | null;
  }) => void;
};

const LiveMainWalletContext = createContext<LiveMainWalletValue | null>(null);

export function LiveMainWallet({
  initialMainUsd,
  children,
}: {
  initialMainUsd: number;
  children: ReactNode;
}) {
  const [mainUsd, setMainUsd] = useState(initialMainUsd);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeOk, setNoticeOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <LiveMainWalletContext.Provider
      value={{
        mainUsd,
        setMainUsd,
        notice,
        noticeOk,
        error,
        setStatus: (status) => {
          setNotice(status.notice ?? null);
          setNoticeOk(status.noticeOk === true);
          setError(status.error ?? null);
        },
      }}
    >
      {children}
    </LiveMainWalletContext.Provider>
  );
}

function useLiveMainWallet(fallbackUsd: number): LiveMainWalletValue {
  const live = useContext(LiveMainWalletContext);
  return (
    live ?? {
      mainUsd: fallbackUsd,
      setMainUsd: () => {},
      notice: null,
      noticeOk: false,
      error: null,
      setStatus: () => {},
    }
  );
}

function CheckDepositButton({ checkout }: { checkout?: boolean }) {
  const live = useLiveMainWallet(0);
  const [busy, setBusy] = useState(false);
  async function onClick() {
    if (busy) {
      return;
    }
    setBusy(true);
    live.setStatus({});
    try {
      const result = checkout
        ? await checkCheckoutDepositAction()
        : await checkMyDepositAction();
      if (typeof result.mainUsd === "number") {
        live.setMainUsd(result.mainUsd);
      }
      if (!result.ok) {
        live.setStatus({ error: result.error });
        return;
      }
      live.setStatus({
        notice:
          result.credited > 0
            ? `Credited ${result.credited} deposit${result.credited === 1 ? "" : "s"} to Main.`
            : "No new confirmed deposits in the recent window.",
        noticeOk: result.credited > 0,
      });
    } catch {
      live.setStatus({ error: "Could not check for deposits." });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        onClick={() => void onClick()}
        className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink disabled:opacity-50"
      >
        <span className="inline-flex items-center gap-2">
          {busy ? <ButtonBusyIcon /> : null}
          {busy ? "Checking…" : "Check for deposit"}
        </span>
      </button>
      {live.error ? (
        <p className="text-sm text-danger" role="alert">
          {live.error}
        </p>
      ) : null}
      {live.notice ? (
        <p
          className={`text-sm ${live.noticeOk ? "text-success" : "text-ink-muted"}`}
          role="status"
        >
          {live.notice}
        </p>
      ) : null}
    </div>
  );
}

export function TopUpWallet({
  address,
  addressError,
  chains,
  tokens,
  checkout,
  revealAddress = true,
}: {
  address: DepositAddress | null;
  addressError: string | null;
  chains: BillingChain[];
  tokens: BillingToken[];
  planId?: string;
  checkout?: boolean;
  revealAddress?: boolean;
}) {
  const chain = chains[0] ?? null;
  const token =
    tokens.find((row) => row.chainId === chain?.id && row.kind === "stable") ??
    tokens[0] ??
    null;
  const explorer = chain
    ? explorerAddressUrl(chain.explorerUrl, address?.address ?? "")
    : null;
  const depositLabel =
    token && chain
      ? `Send ${token.symbol} on ${chain.name}`
      : "Send the listed testnet token to this address";

  return (
    <div id="top-up" className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Top up Main Wallet</h2>
      {!revealAddress ? (
        <p className="text-sm text-ink-muted">
          Save Crypto as your method to see your deposit address.
        </p>
      ) : (
        <>
      <p className="text-sm text-ink-muted">{depositLabel}</p>
      {address ? (
        <>
          <p className="break-all rounded-control border border-line bg-canvas px-3 py-2 font-mono text-xs text-ink">
            {address.address}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <CopyTextButton text={address.address} label="Copy address" />
            {explorer ? (
              <a
                href={explorer}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent hover:underline"
              >
                Go to Explorer
              </a>
            ) : null}
          </div>
          <p className="text-xs text-ink-faint">
            Same address on every listed EVM chain. Wait for{" "}
            {chain?.confirmations ?? 3} confirmation
            {(chain?.confirmations ?? 3) === 1 ? "" : "s"}, then check for the
            deposit. Stables credit 1:1 USD to Main.
          </p>
        </>
      ) : (
        <p className="text-sm text-warning">
          {addressError ?? "Deposit address is not available yet."}
        </p>
      )}
      <CheckDepositButton checkout={checkout} />
        </>
      )}
    </div>
  );
}

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
  affiliateNote,
  booksOnly,
  payEnabled = true,
  withdraw,
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
  affiliateNote?: boolean;
  booksOnly?: boolean;
  payEnabled?: boolean;
  withdraw?: MainWalletWithdrawContext;
}) {
  const live = useLiveMainWallet(mainUsd);
  const shownMainUsd = live.mainUsd;
  const canPay =
    payEnabled &&
    typeof planPriceUsd === "number" &&
    planDeductDecision({
      priceUsd: planPriceUsd,
      mainUsd: shownMainUsd,
      affiliateUsd,
      useAffiliate: useAffiliate === true,
    }).ok;
  const mainShort =
    checkout &&
    typeof planPriceUsd === "number" &&
    roundUsd(shownMainUsd) + 1e-9 < roundUsd(planPriceUsd);
  const withdrawLive = withdraw
    ? { ...withdraw, mainUsd: shownMainUsd }
    : undefined;

  const books = (
    <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Wallet balance</h2>
        <p className="text-2xl font-semibold tabular-nums tracking-tight">
          {formatUsd(shownMainUsd)}
        </p>
        {mainShort ? (
          <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            Main Wallet does not have enough to pay this plan. Use Top up Main
            Wallet below to send USDT, then check for the deposit.
          </p>
        ) : null}
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
            {!payEnabled ? (
              <p className="mt-2 text-xs text-ink-faint">
                Save Crypto as your method to pay with credit.
              </p>
            ) : null}
          </form>
        ) : null}
        {withdrawLive ? (
          <MainWalletWithdrawForm withdraw={withdrawLive} />
        ) : null}
    </div>
  );

  if (booksOnly) {
    return books;
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      {books}
      <TopUpWallet
        address={address}
        addressError={addressError}
        chains={chains}
        tokens={tokens}
        planId={planId}
        checkout={checkout}
      />
    </div>
  );
}

function MainWalletWithdrawForm({
  withdraw,
}: {
  withdraw: MainWalletWithdrawContext;
}) {
  const hasAddress = Boolean(withdraw.address);
  const canWithdraw =
    withdraw.withdraw.ok && withdraw.chains.length > 0 && hasAddress;
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <h3 className="text-sm font-medium text-ink">Request withdraw</h3>
      <p className="text-xs text-ink-muted">
        USDT from Main Wallet. Chain and address are saved on{" "}
        <Link href="/affiliates?tab=settings" className="text-accent hover:underline">
          Affiliates → Settings
        </Link>
        .
      </p>
      {!withdraw.withdraw.ok ? (
        <p className="text-sm text-warning">{withdraw.withdraw.reason}</p>
      ) : null}
      {withdraw.withdraw.ok && withdraw.chains.length === 0 ? (
        <p className="text-sm text-warning">
          Withdrawals are not enabled on any chain yet. An admin can tick this
          on Settings → Crypto.
        </p>
      ) : null}
      {withdraw.withdraw.ok && withdraw.chains.length > 0 && !hasAddress ? (
        <p className="text-sm text-warning">
          Save a payout address on Affiliates → Settings first.
        </p>
      ) : null}
      <form
        action={requestMainWalletWithdrawAction}
        className="flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="address" value={withdraw.address ?? ""} />
        <label className="w-44 shrink-0 text-sm text-ink">
          Chain
          <select
            name="network"
            disabled={!canWithdraw}
            className={BILLING_FIELD_CLASS}
            defaultValue={withdraw.network ?? withdraw.chains[0]?.slug ?? ""}
          >
            {withdraw.chains.map((chain) => (
              <option key={chain.id} value={chain.slug}>
                {chain.name}
              </option>
            ))}
          </select>
        </label>
        <label className="w-32 shrink-0 text-sm text-ink">
          Amount
          <input
            name="amountUsd"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={withdraw.minPayoutUsd}
            max={withdraw.mainUsd}
            disabled={!canWithdraw}
            placeholder="0.00"
            className={BILLING_FIELD_CLASS}
          />
        </label>
        <div className="min-w-[10rem] text-sm text-ink">
          Address
          <p
            className="mt-1 rounded-control border border-line bg-canvas px-3 py-2 font-mono text-xs text-ink"
            title={withdraw.address ?? undefined}
          >
            {shortenPayoutAddress(withdraw.address)}
          </p>
        </div>
        <PendingSubmitButton
          pendingLabel="Requesting…"
          disabled={!canWithdraw}
          className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink disabled:bg-accent-strong/40"
        >
          Request withdraw
        </PendingSubmitButton>
      </form>
      {withdraw.pending.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium text-ink">Pending withdrawals</h3>
          <ul className="mt-2 space-y-2">
            {withdraw.pending.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
              >
                <span className="tabular-nums text-ink">
                  {formatUsd(row.amountUsd)}
                </span>
                <span className="text-ink-muted">
                  {payoutStatusLabel(row.status)}
                  {row.network ? ` · ${row.network}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
