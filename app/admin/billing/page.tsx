import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminInvoicesTable } from "@/components/admin-invoices-table";
import { AdminPayoutQueue } from "@/components/admin-payout-queue";
import { CopyTextButton } from "@/components/copy-text-button";
import { CreateDepositSeed } from "@/components/create-deposit-seed";
import { CreateGasWallet } from "@/components/create-gas-wallet";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { formatUsd, parseInvoiceStatus } from "@/lib/membership/billing";
import { listAdminInvoices } from "@/lib/membership/billing-store";
import {
  parsePayoutFileStatus,
  parsePayoutStatus,
} from "@/lib/membership/affiliate";
import {
  listPayoutFiles,
  listPayouts,
  loadAdminPayoutQueueStats,
} from "@/lib/membership/affiliate-store";
import {
  listAdminWalletSnapshots,
  listDepositSweepSnapshots,
} from "@/lib/membership/billing-balances";
import { formatTokenAmountDisplay } from "@/lib/membership/gas-drip";
import { billingChainEnvironment } from "@/lib/membership/wallet";
import {
  gasExplorerAddressUrl,
  listGasWalletBalances,
} from "@/lib/membership/gas-monitor";
import { scanBillingDepositsAction } from "@/lib/membership/wallet-actions";
import {
  getGasWalletStatus,
  getHdSeedStatus,
  listAllBillingChains,
  listBillingTokens,
  listDepositAddresses,
  listUnsweptDepositCredits,
} from "@/lib/membership/wallet-store";
import { NavBadge } from "@/components/nav-badge";
import {
  adminBillingTabCounts,
  loadAdminNotificationChrome,
} from "@/lib/notifications/badges";
import { firstSearchValue } from "@/lib/paper/open";

export const metadata: Metadata = {
  title: "Billing & Wallets",
  description: "Deposit chains, tokens, and HD seed.",
};

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = firstSearchValue(params.error);
  const scanned = firstSearchValue(params.scanned) === "1";
  const credited = firstSearchValue(params.credited);
  const saved = firstSearchValue(params.saved);
  const fileCount = firstSearchValue(params.count);
  const requestedTab = firstSearchValue(params.tab);
  const tab =
    requestedTab === "withdrawals"
      ? "withdrawals"
      : requestedTab === "invoices"
        ? "invoices"
        : "overview";
  const env = billingChainEnvironment();
  const overview =
    tab === "overview"
      ? await loadAdminBillingOverview(env)
      : null;
  const withdrawals =
    tab === "withdrawals"
      ? await Promise.all([
          listPayouts(80, "main"),
          listPayoutFiles(80, "main"),
          loadAdminPayoutQueueStats("main"),
        ])
      : null;
  const invoiceStatus = parseInvoiceStatus(firstSearchValue(params.status)) ?? "";
  const invoiceQ = (firstSearchValue(params.q) ?? "").trim();
  const fileStatus = parsePayoutFileStatus(firstSearchValue(params.fileStatus)) ?? "";
  const fileQ = (firstSearchValue(params.fileQ) ?? "").trim();
  const payoutStatus = parsePayoutStatus(firstSearchValue(params.payoutStatus)) ?? "";
  const invoices =
    tab === "invoices" ? await listAdminInvoices() : [];
  const invoiceRows = invoiceStatus
    ? invoices.filter((invoice) => invoice.status === invoiceStatus)
    : invoices;
  const hd = overview?.hd;
  const gas = overview?.gas;
  const gasBalances = overview?.gasBalances ?? [];
  const adminWallets = overview?.adminWallets ?? [];
  const depositSweeps = overview?.depositSweeps ?? [];
  const addresses = overview?.addresses ?? [];
  const [payouts, files, stats] = withdrawals ?? [[], [], null];
  const tabCounts = adminBillingTabCounts(
    (await loadAdminNotificationChrome()).actions,
  );

  return (
    <div>
      <PageHeading overline="Admin" title="Billing & Wallets" />
      <nav
        aria-label="Billing and Wallets"
        className="mt-5 flex flex-wrap border-b border-line"
      >
        <TabLink
          href="/admin/billing"
          selected={tab === "overview"}
          count={tabCounts.overview}
        >
          Overview
        </TabLink>
        <TabLink
          href="/admin/billing?tab=invoices"
          selected={tab === "invoices"}
          count={tabCounts.invoices}
        >
          Invoices
        </TabLink>
        <TabLink
          href="/admin/billing?tab=withdrawals"
          selected={tab === "withdrawals"}
          count={tabCounts.withdrawals}
        >
          Wallet withdrawal requests
        </TabLink>
      </nav>
      {error ? (
        <p className="mt-6 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-6 text-sm text-success">
          {saved === "files"
            ? `Generated ${fileCount || "the"} withdrawal list${fileCount === "1" ? "" : "s"}.`
            : saved === "rejected"
              ? "Withdrawal rejected."
              : saved === "file-paid"
                ? "Withdrawal file marked paid."
                : saved === "paid"
                  ? "Withdrawal marked paid."
                  : saved === "approved"
                    ? "Withdrawal approved."
                    : "Saved."}
        </p>
      ) : null}
      {tab === "invoices" ? (
        invoices.length === 0 && !invoiceStatus && !invoiceQ ? (
          <p className="mt-6 text-sm text-ink-muted">No invoices yet.</p>
        ) : (
          <div className="mt-6">
            <AdminInvoicesTable
              invoices={invoiceRows}
              status={invoiceStatus}
              q={invoiceQ}
            />
          </div>
        )
      ) : null}
      {tab === "withdrawals" && stats ? (
        <>
          <p className="mt-6 text-sm text-ink-muted">
            Generate a withdrawal list per chain for your airdrop tool. That
            marks the requests pending. After you send USDT, mark the file
            paid. Members request leftover Main Wallet credit from Billing.
          </p>
          <AdminPayoutQueue
            book="main"
            stats={stats}
            files={files}
            payouts={payouts}
            fileStatus={fileStatus}
            fileQ={fileQ}
            payoutStatus={payoutStatus}
            keep={{ tab: "withdrawals" }}
          />
        </>
      ) : null}
      {tab === "overview" && scanned ? (
        <p className="mt-6 text-sm text-success">
          Deposit scan finished
          {credited ? ` · ${credited} credited` : ""}.
        </p>
      ) : null}

      {tab === "overview" && hd && gas ? (
      <>
      {!hd.configured ? (
        <section className="mt-6 rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-semibold tracking-tight">Deposit HD seed</h2>
          <p className="mt-2 text-sm text-ink-muted">
            One encrypted mnemonic derives a unique address per member. Needed
            once per environment. Needs{" "}
            <code className="text-ink">BILLING_CREDENTIALS_KEY</code>.
          </p>
          <p className="mt-3 text-sm text-ink">
            No seed yet.{" "}
            {hd.keyReady ? "Encryption key is set." : "Encryption key is missing."}
          </p>
          <div className="mt-4">
            <CreateDepositSeed />
          </div>
        </section>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">Admin wallets</h2>
        <p className="mt-2 text-sm text-ink-muted">
          On-chain balances at the public receive address. Swept USDT lands
          here. Keys stay with you.
        </p>
        {adminWallets.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            No listed chains in this environment yet.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {adminWallets.map((row) => (
              <WalletChainCard
                key={row.chainId}
                title={row.chainName}
                address={row.address}
                explorerUrl={row.explorerUrl}
                empty={
                  row.address
                    ? null
                    : "Set the admin receive address on Settings."
                }
              >
                {row.address ? <WalletAssetRows assets={row.assets} /> : null}
              </WalletChainCard>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">Gas wallet</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Dedicated hot wallet. The system drips ETH from here onto a deposit
          address before sweeping USDT to the admin receive address. Not the
          admin payout wallet.
        </p>
        {gas.address ? (
          <div className="mt-4 space-y-4">
            {gasBalances.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No listed chains in this environment yet.
              </p>
            ) : (
              gasBalances.map((row) => (
                <WalletChainCard
                  key={row.chainId}
                  title={row.name}
                  address={gas.address}
                  explorerUrl={row.explorerUrl}
                >
                  <WalletAssetRows
                    assets={[
                      {
                        symbol: "ETH",
                        amount: row.balanceEth,
                        error: row.error,
                        warn: row.low,
                        note: row.low
                          ? `Low · at or below ${gas.lowEth} ETH`
                          : null,
                      },
                    ]}
                  />
                </WalletChainCard>
              ))
            )}
            <p className="text-hint text-ink-faint">
              Send {env === "production" ? "ETH" : "testnet ETH"} to this
              address on each listed chain so drips and sweeps can run. Low ETH
              level is on Settings.
            </p>
          </div>
        ) : null}
        {!gas.configured ? (
          <div className="mt-4">
            <CreateGasWallet />
          </div>
        ) : null}
      </section>
      </div>

      <section className="mt-6 rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">
          Deposit wallets
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Snapshot of issued member addresses. Leftover on-chain balances are
          not yet swept to the admin wallet.
        </p>
        <p className="mt-3 text-sm text-ink">
          {addresses.length} issued address
          {addresses.length === 1 ? "" : "es"}.
        </p>
        {depositSweeps.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            No listed chains in this environment yet.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {depositSweeps.map((row) => (
              <WalletChainCard
                key={row.chainId}
                title={row.chainName}
                detail={`${row.leftoverWallets} with leftover${
                  row.failed > 0 ? ` · ${row.failed} unread` : ""
                }`}
              >
                <WalletAssetRows
                  assets={row.assets.map((asset) => ({
                    ...asset,
                    warn: Boolean(asset.amount && asset.amount !== "0"),
                    note:
                      asset.amount && asset.amount !== "0"
                        ? asset.symbol === "ETH"
                          ? "leftover"
                          : "yet to be swept"
                        : null,
                  }))}
                />
                <p className="mt-2 text-hint text-ink-faint">
                  {row.creditedUnsweptCount === 0
                    ? "No credited deposits waiting on a sweep hash."
                    : `${row.creditedUnsweptCount} credited deposit${
                        row.creditedUnsweptCount === 1 ? "" : "s"
                      } still missing a sweep hash · ${formatUsd(row.creditedUnsweptUsd)}`}
                </p>
              </WalletChainCard>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-card border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Scan deposits</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Public RPC watch for listed tokens into known deposit addresses.
            </p>
          </div>
          <form action={scanBillingDepositsAction}>
            <PendingSubmitButton
              pendingLabel="Scanning…"
              className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
            >
              Scan deposits
            </PendingSubmitButton>
          </form>
        </div>
      </section>
      </>
      ) : null}

    </div>
  );
}

async function loadAdminBillingOverview(env: ReturnType<typeof billingChainEnvironment>) {
  const [hd, gas, chains, addresses, unswept] = await Promise.all([
    getHdSeedStatus(),
    getGasWalletStatus(),
    listAllBillingChains(),
    listDepositAddresses(),
    listUnsweptDepositCredits(),
  ]);
  const tokens = await listBillingTokens(chains.map((chain) => chain.id));
  const envChains = chains.filter((chain) => chain.environment === env);
  const [gasBalances, adminWallets, depositSweeps] = await Promise.all([
    gas.address
      ? listGasWalletBalances(gas.address, envChains, gas.lowEth)
      : Promise.resolve([]),
    listAdminWalletSnapshots(envChains, tokens),
    listDepositSweepSnapshots(envChains, tokens, addresses, unswept),
  ]);
  return {
    hd,
    gas,
    addresses,
    gasBalances,
    adminWallets,
    depositSweeps,
  };
}

function TabLink({
  href,
  selected,
  count = 0,
  children,
}: {
  href: string;
  selected: boolean;
  count?: number;
  children: string;
}) {
  return (
    <Link
      href={href}
      className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm ${
        selected
          ? "border-accent text-ink"
          : "border-transparent text-ink-muted hover:text-ink"
      }`}
    >
      {children}
      <NavBadge count={count} />
    </Link>
  );
}

type WalletAssetRow = {
  symbol: string;
  amount: string | null;
  error: string | null;
  warn?: boolean;
  note?: string | null;
};

function WalletChainCard({
  title,
  detail,
  address,
  explorerUrl,
  empty,
  children,
}: {
  title: string;
  detail?: string;
  address?: string | null;
  explorerUrl?: string | null;
  empty?: string | null;
  children?: ReactNode;
}) {
  const explorer = address
    ? gasExplorerAddressUrl(explorerUrl ?? null, address)
    : null;
  return (
    <div className="rounded-card border border-line bg-surface-raised p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-ink">{title}</p>
        {detail ? <p className="text-hint text-ink-faint">{detail}</p> : null}
      </div>
      {address ? (
        <div className="mt-2 space-y-2">
          <p className="break-all font-mono text-xs text-ink">{address}</p>
          <div className="flex flex-wrap items-center gap-2">
            <CopyTextButton text={address} label="Copy address" />
            {explorer ? (
              <a
                href={explorer}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent hover:underline"
              >
                Explorer
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
      {empty ? <p className="mt-2 text-sm text-warning">{empty}</p> : null}
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}

function WalletAssetRows({ assets }: { assets: WalletAssetRow[] }) {
  if (assets.length === 0) {
    return null;
  }
  return (
    <ul className="divide-y divide-line rounded-card border border-line">
      {assets.map((asset) => (
        <li
          key={asset.symbol}
          className="flex items-center justify-between gap-3 px-3 py-2"
        >
          <p className="text-sm text-ink-muted">{asset.symbol}</p>
          <div className="text-right">
            {asset.error ? (
              <p className="text-sm text-warning">{asset.error}</p>
            ) : (
              <>
                <p className="text-sm tabular-nums text-ink">
                  {formatTokenAmountDisplay(asset.amount ?? "0")} {asset.symbol}
                </p>
                {asset.note ? (
                  <p className="mt-0.5 text-xs text-warning">{asset.note}</p>
                ) : null}
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
