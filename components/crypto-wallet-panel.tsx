"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import QRCode from "qrcode";
import { CopyTextButton } from "@/components/copy-text-button";
import {
  ButtonBusyIcon,
  PendingSubmitButton,
} from "@/components/pending-submit-button";
import { formatUsd } from "@/lib/membership/billing";
import { payoutStatusLabel } from "@/lib/membership/affiliate";
import {
  checkCheckoutDepositAction,
  checkMyDepositAction,
  payPlanWithCreditAction,
  requestMainWalletWithdrawAction,
} from "@/lib/membership/wallet-actions";
import { BILLING_FIELD_CLASS } from "@/lib/membership/wallet-form";
import {
  accountBalanceCoversNextCycle,
  accountShortfallUsd,
  creditedDepositsNotice,
  methodTopUpShortfall,
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

export function useLiveMainWallet(fallbackUsd: number): LiveMainWalletValue {
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
            ? creditedDepositsNotice(result.credited)
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

function DepositAddressQr({ value }: { value: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void QRCode.toString(value, {
      type: "svg",
      margin: 1,
      width: 144,
      errorCorrectionLevel: "M",
      color: { dark: "#0B0E14", light: "#F4F6F8" },
    }).then((markup) => {
      if (!cancelled) {
        setSvg(markup);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [value]);
  if (!svg) {
    return (
      <div
        className="size-36 shrink-0 rounded-control border border-line bg-ink"
        aria-hidden
      />
    );
  }
  return (
    <div
      className="size-36 shrink-0 overflow-hidden rounded-control border border-line bg-ink [&_svg]:block [&_svg]:size-full"
      role="img"
      aria-label="Deposit address QR code"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function TopUpWallet({
  address,
  addressError,
  chains,
  tokens,
  checkout,
  revealAddress = true,
  heading = "Top up Account Balance",
  showCheck = true,
  instructions,
  dueUsd,
  cycleDueUsd,
  showBalance = true,
}: {
  address: DepositAddress | null;
  addressError: string | null;
  chains: BillingChain[];
  tokens: BillingToken[];
  planId?: string;
  checkout?: boolean;
  revealAddress?: boolean;
  heading?: string | null;
  showCheck?: boolean;
  instructions?: string;
  dueUsd?: number;
  cycleDueUsd?: number;
  showBalance?: boolean;
}) {
  const live = useLiveMainWallet(0);
  const shortForCycle =
    typeof cycleDueUsd === "number" &&
    !accountBalanceCoversNextCycle(live.mainUsd, cycleDueUsd);
  const chain = chains[0] ?? null;
  const token =
    tokens.find((row) => row.chainId === chain?.id && row.kind === "stable") ??
    tokens[0] ??
    null;
  return (
    <div id="top-up" className="space-y-3">
      {heading ? (
        <h2 className="text-lg font-semibold tracking-tight">{heading}</h2>
      ) : null}
      {!revealAddress ? (
        <p className="text-sm text-ink-muted">
          Save Crypto as your method to see your deposit address.
        </p>
      ) : (
        <>
      {address ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1 space-y-3">
            <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-3 text-sm">
              {showBalance ? (
                <>
                  <dt className="text-ink-muted">Current Balance:</dt>
                  <dd className="tabular-nums text-ink">
                    {formatUsd(live.mainUsd)}
                  </dd>
                </>
              ) : null}
              {typeof dueUsd === "number" ? (
                <>
                  <dt className="text-ink-muted">Amount due:</dt>
                  <dd className="tabular-nums text-ink">{formatUsd(dueUsd)}</dd>
                </>
              ) : null}
              <dt className="text-ink-muted">Network:</dt>
              <dd className="text-ink">{chain?.name ?? "—"}</dd>
              <dt className="text-ink-muted">Token:</dt>
              <dd className="text-ink">{token?.symbol ?? "—"}</dd>
              <dt className="text-ink-muted">Address:</dt>
              <dd className="min-w-0">
                <p className="break-all rounded-control border border-line bg-canvas px-3 py-2 font-mono text-xs text-ink">
                  {address.address}
                </p>
              </dd>
            </dl>
            <CopyTextButton text={address.address} label="Copy address" />
          </div>
          <DepositAddressQr value={address.address} />
        </div>
      ) : (
        <p className="text-sm text-warning">
          {addressError ?? "Deposit address is not available yet."}
        </p>
      )}
      {shortForCycle && typeof cycleDueUsd === "number" ? (
        <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          {methodTopUpShortfall(cycleDueUsd)}
        </p>
      ) : null}
      {instructions ? (
        <p className="text-sm text-ink-muted">{instructions}</p>
      ) : null}
      {showCheck ? <CheckDepositButton checkout={checkout} /> : null}
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
  hideBalance = false,
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
  hideBalance?: boolean;
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
  const shortUsd =
    checkout && typeof planPriceUsd === "number"
      ? accountShortfallUsd(planPriceUsd, shownMainUsd)
      : 0;
  const withdrawLive = withdraw
    ? { ...withdraw, mainUsd: shownMainUsd }
    : undefined;

  const books = (
    <div className="space-y-4">
        {hideBalance ? null : checkout ? (
          <>
            <h2 className="text-lg font-semibold tracking-tight">
              Pay with Account Balance
            </h2>
            <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-3 text-sm">
              <dt className="text-ink-muted">Current balance:</dt>
              <dd className="tabular-nums text-ink">
                {formatUsd(shownMainUsd)}
              </dd>
              {typeof planPriceUsd === "number" ? (
                <>
                  <dt className="text-ink-muted">Amount due:</dt>
                  <dd className="tabular-nums text-ink">
                    {formatUsd(planPriceUsd)}
                  </dd>
                </>
              ) : null}
              {shortUsd >= 0.01 ? (
                <>
                  <dt className="text-ink-muted">Account shortfall:</dt>
                  <dd className="tabular-nums text-ink">
                    {formatUsd(shortUsd)}
                  </dd>
                </>
              ) : null}
            </dl>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold tracking-tight">
              Wallet balance
            </h2>
            <p className="text-2xl font-semibold tabular-nums tracking-tight">
              {formatUsd(shownMainUsd)}
            </p>
          </>
        )}
        {mainShort ? (
          <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            Account Balance does not have enough to pay for the upgrade. Top up
            your Account Balance below.
          </p>
        ) : null}
        {checkout && canPay && planId && typeof planPriceUsd === "number" ? (
          <form action={payPlanWithCreditAction}>
            <input type="hidden" name="planId" value={planId} />
            {deductOn ? (
              <input type="hidden" name="paySubscriptionFromCredit" value="1" />
            ) : null}
            <PendingSubmitButton
              pendingLabel="Paying…"
              successKey="pay-credit"
              className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
            >
              Pay from account balance and confirm upgrade
            </PendingSubmitButton>
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
  const canWithdraw = withdraw.withdraw.ok && withdraw.chains.length > 0;
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Request withdraw</h2>
      {!withdraw.withdraw.ok ? (
        <p className="text-sm text-warning">{withdraw.withdraw.reason}</p>
      ) : null}
      {withdraw.withdraw.ok && withdraw.chains.length === 0 ? (
        <p className="text-sm text-warning">
          Withdrawals are not enabled on any chain yet. An admin can tick this
          on Settings → Crypto.
        </p>
      ) : null}
      <form action={requestMainWalletWithdrawAction} className="space-y-3">
        <label className="block text-sm text-ink">
          Chain
          <select
            name="network"
            disabled={!canWithdraw}
            className={BILLING_FIELD_CLASS}
            defaultValue={withdraw.chains[0]?.slug ?? ""}
          >
            {withdraw.chains.map((chain) => (
              <option key={chain.id} value={chain.slug}>
                {chain.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-ink">
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
        <label className="block text-sm text-ink">
          Address
          <input
            name="address"
            type="text"
            required
            disabled={!canWithdraw}
            autoComplete="off"
            spellCheck={false}
            placeholder="0x…"
            className={`${BILLING_FIELD_CLASS} font-mono text-xs`}
          />
        </label>
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
