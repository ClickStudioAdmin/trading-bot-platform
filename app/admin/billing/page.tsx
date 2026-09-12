import type { Metadata } from "next";
import { CopyTextButton } from "@/components/copy-text-button";
import { CreateDepositSeed } from "@/components/create-deposit-seed";
import { CreateGasWallet } from "@/components/create-gas-wallet";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { formatUsd } from "@/lib/membership/billing";
import {
  listAdminWalletSnapshots,
  listDepositSweepSnapshots,
} from "@/lib/membership/billing-balances";
import { billingChainEnvironment } from "@/lib/membership/wallet";
import {
  gasExplorerAddressUrl,
  listGasWalletBalances,
} from "@/lib/membership/gas-monitor";
import {
  saveBillingChainAction,
  saveBillingTokenAction,
  saveGasLowEthAction,
  scanBillingDepositsAction,
} from "@/lib/membership/wallet-actions";
import { BILLING_FIELD_CLASS } from "@/lib/membership/wallet-form";
import {
  getGasWalletStatus,
  getHdSeedStatus,
  listAllBillingChains,
  listBillingTokens,
  listDepositAddresses,
  listUnsweptDepositCredits,
} from "@/lib/membership/wallet-store";
import { firstSearchValue } from "@/lib/paper/open";
import { formatLocalDate, parseDisplayTime } from "@/lib/time/display";

export const metadata: Metadata = {
  title: "Billing",
  description: "Deposit chains, tokens, and HD seed.",
};

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = firstSearchValue(params.error);
  const saved = firstSearchValue(params.saved);
  const scanned = firstSearchValue(params.scanned) === "1";
  const credited = firstSearchValue(params.credited);
  const [hd, gas, chains, addresses, unswept] = await Promise.all([
    getHdSeedStatus(),
    getGasWalletStatus(),
    listAllBillingChains(),
    listDepositAddresses(),
    listUnsweptDepositCredits(),
  ]);
  const tokens = await listBillingTokens(chains.map((chain) => chain.id));
  const env = billingChainEnvironment();
  const envChains = chains.filter((chain) => chain.environment === env);
  const [gasBalances, adminWallets, depositSweeps] = await Promise.all([
    gas.address
      ? listGasWalletBalances(gas.address, envChains, gas.lowEth)
      : Promise.resolve([]),
    listAdminWalletSnapshots(envChains, tokens),
    listDepositSweepSnapshots(envChains, tokens, addresses, unswept),
  ]);
  const gasLow = gasBalances.some((row) => row.low);
  const createdAt = parseDisplayTime(hd.createdAt);
  const gasCreatedAt = parseDisplayTime(gas.createdAt);

  return (
    <div>
      <PageHeading overline="Admin" title="Billing" />
      <p className="-mt-4 max-w-2xl text-sm text-ink-muted">
        EVM deposit rails. This environment is{" "}
        <span className="text-ink">{env}</span>. Develop uses testnets.
        Production uses mainnets. The admin wallet seed is never stored —
        only the public receive address. Sweeps drip gas from a dedicated
        encrypted wallet, not from the admin payout wallet.
      </p>
      {error ? (
        <p className="mt-6 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved === "chain" ? (
        <p className="mt-6 text-sm text-success">Chain saved.</p>
      ) : null}
      {saved === "token" ? (
        <p className="mt-6 text-sm text-success">Token saved.</p>
      ) : null}
      {saved === "gaslow" ? (
        <p className="mt-6 text-sm text-success">Low ETH level saved.</p>
      ) : null}
      {scanned ? (
        <p className="mt-6 text-sm text-success">
          Deposit scan finished
          {credited ? ` · ${credited} credited` : ""}.
        </p>
      ) : null}

      <section className="mt-6 rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">Deposit HD seed</h2>
        <p className="mt-2 text-sm text-ink-muted">
          One encrypted mnemonic derives a unique address per member. Needs{" "}
          <code className="text-ink">BILLING_CREDENTIALS_KEY</code>.
        </p>
        <p className="mt-3 text-sm text-ink">
          {hd.configured
            ? `Seed stored${createdAt ? ` · ${formatLocalDate(createdAt)}` : ""}.`
            : "No seed yet."}{" "}
          {hd.keyReady ? "Encryption key is set." : "Encryption key is missing."}
        </p>
        <p className="mt-2 text-xs text-ink-faint">
          {addresses.length} member address
          {addresses.length === 1 ? "" : "es"} issued.
        </p>
        {!hd.configured ? (
          <div className="mt-4">
            <CreateDepositSeed />
          </div>
        ) : null}
      </section>

      <section className="mt-6 rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">Gas wallet</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Dedicated hot wallet. The system drips ETH from here onto a deposit
          address before sweeping USDT to the admin receive address. Not the
          admin payout wallet.
        </p>
        <p className="mt-3 text-sm text-ink">
          {gas.configured
            ? `Wallet stored${gasCreatedAt ? ` · ${formatLocalDate(gasCreatedAt)}` : ""}.`
            : "No gas wallet yet."}{" "}
          {gas.keyReady ? "Encryption key is set." : "Encryption key is missing."}
        </p>
        {gas.address ? (
          <div className="mt-3 space-y-4">
            {gasLow ? (
              <p className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                Gas wallet ETH is at or below {gas.lowEth} ETH on at least one
                listed chain. Send {env === "production" ? "ETH" : "testnet ETH"}{" "}
                to this address.
              </p>
            ) : null}
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                Public address
              </p>
              <p className="break-all rounded-card border border-line bg-surface-raised px-3 py-2 font-mono text-xs text-ink">
                {gas.address}
              </p>
              <CopyTextButton text={gas.address} label="Copy address" />
              <p className="text-xs text-ink-faint">
                Send {env === "production" ? "ETH" : "testnet ETH"} here on each
                listed chain so drips and sweeps can run.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                ETH balance
              </p>
              {gasBalances.length === 0 ? (
                <p className="mt-2 text-sm text-ink-muted">
                  No listed chains in this environment yet.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-line rounded-card border border-line">
                  {gasBalances.map((row) => {
                    const explorer = gasExplorerAddressUrl(
                      row.explorerUrl,
                      gas.address ?? "",
                    );
                    return (
                      <li
                        key={row.chainId}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm text-ink">{row.name}</p>
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
                        <div className="text-right">
                          {row.error ? (
                            <p className="text-sm text-warning">{row.error}</p>
                          ) : (
                            <p
                              className={`text-sm tabular-nums ${row.low ? "text-warning" : "text-ink"}`}
                            >
                              {row.balanceEth} ETH
                            </p>
                          )}
                          {row.low ? (
                            <p className="text-xs text-warning">
                              Low · at or below {gas.lowEth} ETH
                            </p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <form action={saveGasLowEthAction} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <label className="block text-sm text-ink">
                Low ETH level
                <input
                  name="lowEth"
                  required
                  defaultValue={gas.lowEth}
                  inputMode="decimal"
                  className={BILLING_FIELD_CLASS}
                />
                <span className="mt-1 block text-xs text-ink-faint">
                  Warn when a listed chain is at or below this amount. Default
                  0.005 ETH.
                </span>
              </label>
              <PendingSubmitButton
                pendingLabel="Saving…"
                className="rounded-control border border-line px-4 py-2 text-sm text-ink hover:border-line-strong"
              >
                Save level
              </PendingSubmitButton>
            </form>
          </div>
        ) : null}
        {!gas.configured ? (
          <div className="mt-4">
            <CreateGasWallet />
          </div>
        ) : null}
      </section>

      <section className="mt-6 rounded-card border border-line bg-surface p-5">
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
            {adminWallets.map((row) => {
              const explorer = row.address
                ? gasExplorerAddressUrl(row.explorerUrl, row.address)
                : null;
              return (
                <div
                  key={row.chainId}
                  className="rounded-card border border-line bg-surface-raised p-4"
                >
                  <p className="text-sm font-medium text-ink">{row.chainName}</p>
                  {row.address ? (
                    <div className="mt-2 space-y-2">
                      <p className="break-all font-mono text-xs text-ink">
                        {row.address}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <CopyTextButton
                          text={row.address}
                          label="Copy address"
                        />
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
                      <ul className="divide-y divide-line rounded-card border border-line">
                        {row.assets.map((asset) => (
                          <li
                            key={asset.symbol}
                            className="flex items-center justify-between gap-3 px-3 py-2"
                          >
                            <p className="text-sm text-ink-muted">{asset.symbol}</p>
                            {asset.error ? (
                              <p className="text-sm text-warning">{asset.error}</p>
                            ) : (
                              <p className="text-sm tabular-nums text-ink">
                                {asset.amount} {asset.symbol}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-warning">
                      Set the admin receive address on this chain below.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

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
          <ul className="mt-4 divide-y divide-line rounded-card border border-line">
            {depositSweeps.map((row) => (
              <li key={row.chainId} className="space-y-2 px-3 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{row.chainName}</p>
                  <p className="text-xs text-ink-faint">
                    {row.leftoverWallets} with leftover
                    {row.failed > 0 ? ` · ${row.failed} unread` : ""}
                  </p>
                </div>
                {row.assets.map((asset) => (
                  <div
                    key={asset.symbol}
                    className="flex items-center justify-between gap-3"
                  >
                    <p className="text-sm text-ink-muted">{asset.symbol}</p>
                    {asset.error ? (
                      <p className="text-sm text-warning">{asset.error}</p>
                    ) : (
                      <p
                        className={`text-sm tabular-nums ${
                          asset.amount && asset.amount !== "0"
                            ? "text-warning"
                            : "text-ink"
                        }`}
                      >
                        {asset.amount} {asset.symbol}
                        {asset.amount && asset.amount !== "0"
                          ? asset.symbol === "ETH"
                            ? " leftover"
                            : " yet to be swept"
                          : ""}
                      </p>
                    )}
                  </div>
                ))}
                <p className="text-xs text-ink-faint">
                  {row.creditedUnsweptCount === 0
                    ? "No credited deposits waiting on a sweep hash."
                    : `${row.creditedUnsweptCount} credited deposit${
                        row.creditedUnsweptCount === 1 ? "" : "s"
                      } still missing a sweep hash · ${formatUsd(row.creditedUnsweptUsd)}`}
                </p>
              </li>
            ))}
          </ul>
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

      {chains.length === 0 ? (
        <p className="mt-6 text-sm text-warning">
          No billing chains yet. Push <code className="text-ink">develop</code>{" "}
          so the wallet migration can seed Arbitrum Sepolia.
        </p>
      ) : null}

      {chains.map((chain) => {
        const chainTokens = tokens.filter((token) => token.chainId === chain.id);
        return (
          <section
            key={chain.id}
            className="mt-6 space-y-5 rounded-card border border-line bg-surface p-5"
          >
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{chain.name}</h2>
              <p className="mt-1 text-xs text-ink-faint">
                {chain.environment} · chain id {chain.chainId} · last scanned{" "}
                {chain.lastScannedBlock ?? "—"}
              </p>
            </div>
            <form action={saveBillingChainAction} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="chainId" value={chain.id} />
              <label className="block text-sm text-ink">
                Name
                <input
                  name="name"
                  required
                  defaultValue={chain.name}
                  className={BILLING_FIELD_CLASS}
                />
              </label>
              <label className="block text-sm text-ink">
                Confirmations
                <input
                  name="confirmations"
                  type="number"
                  min={1}
                  max={128}
                  required
                  defaultValue={chain.confirmations}
                  className={BILLING_FIELD_CLASS}
                />
              </label>
              <label className="block text-sm text-ink md:col-span-2">
                Public RPC
                <input
                  name="rpcUrl"
                  required
                  defaultValue={chain.rpcUrl}
                  className={BILLING_FIELD_CLASS}
                />
              </label>
              <label className="block text-sm text-ink md:col-span-2">
                Explorer URL
                <input
                  name="explorerUrl"
                  defaultValue={chain.explorerUrl ?? ""}
                  className={BILLING_FIELD_CLASS}
                />
              </label>
              <label className="block text-sm text-ink md:col-span-2">
                Admin receive address (public only)
                <input
                  name="adminAddress"
                  placeholder="0x…"
                  defaultValue={chain.adminAddress ?? ""}
                  className={BILLING_FIELD_CLASS}
                />
              </label>
              <div>
                <PendingSubmitButton
                  pendingLabel="Saving…"
                  className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
                >
                  Save chain
                </PendingSubmitButton>
              </div>
            </form>

            {chainTokens.map((token) => (
              <form
                key={token.id}
                action={saveBillingTokenAction}
                className="grid gap-4 border-t border-line pt-5 md:grid-cols-2"
              >
                <input type="hidden" name="tokenId" value={token.id} />
                <label className="block text-sm text-ink">
                  Symbol
                  <input
                    name="symbol"
                    required
                    defaultValue={token.symbol}
                    className={BILLING_FIELD_CLASS}
                  />
                </label>
                <label className="block text-sm text-ink">
                  Decimals
                  <input
                    name="decimals"
                    type="number"
                    min={0}
                    max={36}
                    required
                    defaultValue={token.decimals}
                    className={BILLING_FIELD_CLASS}
                  />
                </label>
                <label className="block text-sm text-ink md:col-span-2">
                  Contract
                  <input
                    name="contractAddress"
                    required
                    defaultValue={token.contractAddress}
                    className={BILLING_FIELD_CLASS}
                  />
                </label>
                <label className="block text-sm text-ink">
                  Kind
                  <select
                    name="kind"
                    defaultValue={token.kind}
                    className={BILLING_FIELD_CLASS}
                  >
                    <option value="stable">Stable (1:1 USD)</option>
                    <option value="wbtc">WBTC</option>
                    <option value="native">Native</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <div className="flex items-end">
                  <PendingSubmitButton
                    pendingLabel="Saving…"
                    className="rounded-control border border-line px-4 py-2 text-sm text-ink hover:border-line-strong"
                  >
                    Save token
                  </PendingSubmitButton>
                </div>
              </form>
            ))}
          </section>
        );
      })}
    </div>
  );
}
