import type { Metadata } from "next";
import { CopyTextButton } from "@/components/copy-text-button";
import { CreateDepositSeed } from "@/components/create-deposit-seed";
import { CreateGasWallet } from "@/components/create-gas-wallet";
import { RevealGasWallet } from "@/components/reveal-gas-wallet";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { billingChainEnvironment } from "@/lib/membership/wallet";
import {
  saveBillingChainAction,
  saveBillingTokenAction,
  scanBillingDepositsAction,
} from "@/lib/membership/wallet-actions";
import { BILLING_FIELD_CLASS } from "@/lib/membership/wallet-form";
import {
  getGasWalletStatus,
  getHdSeedStatus,
  listAllBillingChains,
  listBillingTokens,
  listDepositAddresses,
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
  const [hd, gas, chains, addresses] = await Promise.all([
    getHdSeedStatus(),
    getGasWalletStatus(),
    listAllBillingChains(),
    listDepositAddresses(),
  ]);
  const tokens = await listBillingTokens(chains.map((chain) => chain.id));
  const env = billingChainEnvironment();
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
          <div className="mt-3 space-y-2">
            <p className="break-all rounded-card border border-line bg-surface-raised px-3 py-2 font-mono text-xs text-ink">
              {gas.address}
            </p>
            <CopyTextButton text={gas.address} label="Copy address" />
            <p className="text-xs text-ink-faint">
              Send {env === "production" ? "ETH" : "testnet ETH"} here on each
              listed chain so drips and sweeps can run. There is no seed
              phrase — backup is the private key.
            </p>
          </div>
        ) : null}
        {gas.configured ? <RevealGasWallet /> : null}
        {!gas.configured ? (
          <div className="mt-4">
            <CreateGasWallet />
          </div>
        ) : null}
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
