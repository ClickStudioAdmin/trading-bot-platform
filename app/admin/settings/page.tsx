import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { saveAdminSettings, saveAutoTickAction } from "@/lib/admin/actions";
import { loadAutoTickEnabled } from "@/lib/admin/settings";
import { loadCopyPlatformSettings } from "@/lib/copy/settings";
import { billingChainEnvironment } from "@/lib/membership/wallet";
import {
  saveBillingChainAction,
  saveBillingTokenAction,
  saveGasLowEthAction,
} from "@/lib/membership/wallet-actions";
import { BILLING_FIELD_CLASS } from "@/lib/membership/wallet-form";
import {
  getGasWalletStatus,
  listAllBillingChains,
  listBillingTokens,
} from "@/lib/membership/wallet-store";
import { firstSearchValue } from "@/lib/paper/open";

export const metadata: Metadata = {
  title: "Admin settings",
  description: "System settings for Trading Bot Platform.",
};

const SETTINGS_TABS = ["general", "copy", "crypto"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

function parseSettingsTab(value: string | undefined): SettingsTab {
  return SETTINGS_TABS.includes(value as SettingsTab)
    ? (value as SettingsTab)
    : "general";
}

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tab = parseSettingsTab(firstSearchValue(params.tab) ?? "general");
  const saved = firstSearchValue(params.saved);
  const error = firstSearchValue(params.error);
  const copyDaysError = error === "copy-days";
  const copyFollowersError = error === "copy-followers";
  const copyFollowersCeilingError = error === "copy-followers-ceiling";
  const copyFollowersRangeError = error === "copy-followers-range";
  const [autoTick, copySettings, gas, chains] = await Promise.all([
    tab === "general" ? loadAutoTickEnabled() : Promise.resolve(false),
    tab === "copy"
      ? loadCopyPlatformSettings()
      : Promise.resolve({
          minActivityDays: 90,
          maxFollowersDefault: null,
          maxFollowersCeiling: null,
        }),
    tab === "crypto"
      ? getGasWalletStatus()
      : Promise.resolve({
          configured: false,
          keyReady: false,
          address: null,
          createdAt: null,
          lowEth: "0.005",
        }),
    tab === "crypto" ? listAllBillingChains() : Promise.resolve([]),
  ]);
  const tokens =
    tab === "crypto"
      ? await listBillingTokens(chains.map((chain) => chain.id))
      : [];
  const env = billingChainEnvironment();

  return (
    <div>
      <PageHeading overline="Admin" title="Settings" />
      <p className="-mt-4 text-sm text-ink-muted">
        Desk-wide knobs. Members and logs stay in the menu.
      </p>
      <nav aria-label="Settings" className="mt-5 flex border-b border-line">
        <TabLink href="/admin/settings" selected={tab === "general"}>
          General
        </TabLink>
        <TabLink href="/admin/settings?tab=copy" selected={tab === "copy"}>
          Copy Trading
        </TabLink>
        <TabLink href="/admin/settings?tab=crypto" selected={tab === "crypto"}>
          Crypto Wallets & Chains
        </TabLink>
      </nav>

      {tab === "general" ? (
        <>
          {saved === "1" ? (
            <p className="mt-6 text-sm text-success">Settings saved.</p>
          ) : null}
          <form
            action={saveAutoTickAction}
            className="mt-6 max-w-lg space-y-4 rounded-card border border-line bg-surface p-5"
          >
            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="autoTick"
                defaultChecked={autoTick}
                className="mt-0.5"
              />
              <span>
                Auto tick
                <span className="mt-1 block text-xs text-ink-muted">
                  Off by default. Fly is the clock. Turn this on only to nudge
                  Vercel every 5 seconds while an admin tab is open.
                </span>
              </span>
            </label>
            <PendingSubmitButton
              pendingLabel="Saving…"
              successKey="save-auto-tick"
              className="rounded-control bg-accent-strong px-3 py-1.5 text-xs font-medium text-ink"
            >
              Save settings
            </PendingSubmitButton>
          </form>
        </>
      ) : null}

      {tab === "copy" ? (
        <>
          {saved === "1" ? (
            <p className="mt-6 text-sm text-success">Settings saved.</p>
          ) : null}
          {copyDaysError ? (
            <p className="mt-6 text-sm text-danger">
              Minimum activity days must be a whole number, zero or more.
            </p>
          ) : null}
          {copyFollowersError ? (
            <p className="mt-6 text-sm text-danger">
              Default maximum copy traders must be 1 or more, or empty.
            </p>
          ) : null}
          {copyFollowersCeilingError ? (
            <p className="mt-6 text-sm text-danger">
              Platform maximum copy traders must be 1 or more, or empty.
            </p>
          ) : null}
          {copyFollowersRangeError ? (
            <p className="mt-6 text-sm text-danger">
              Default maximum copy traders cannot be above the platform
              maximum.
            </p>
          ) : null}
          <form
            action={saveAdminSettings}
            className="mt-6 max-w-lg space-y-4 rounded-card border border-line bg-surface p-5"
          >
            <label className="block text-sm text-ink">
              Minimum activity days
              <input
                type="number"
                name="copyMinActivityDays"
                min={0}
                step={1}
                required
                defaultValue={copySettings.minActivityDays}
                className={BILLING_FIELD_CLASS}
              />
              <span className="mt-1 block text-xs text-ink-muted">
                A connected desk needs a first venue fill at least this many
                days ago before it can be shared. Default 90. Use 0 while
                testing.
              </span>
            </label>
            <label className="block text-sm text-ink">
              Default maximum copy traders
              <input
                type="number"
                name="copyMaxFollowersDefault"
                min={1}
                step={1}
                defaultValue={copySettings.maxFollowersDefault ?? ""}
                placeholder="No cap"
                className={BILLING_FIELD_CLASS}
              />
              <span className="mt-1 block text-xs text-ink-muted">
                Pre-fills Maximum copy traders on a new share. If the platform
                maximum is empty, this number is also the hard cap.
              </span>
            </label>
            <label className="block text-sm text-ink">
              Platform maximum copy traders
              <input
                type="number"
                name="copyMaxFollowersCeiling"
                min={1}
                step={1}
                defaultValue={copySettings.maxFollowersCeiling ?? ""}
                placeholder="Same as default"
                className={BILLING_FIELD_CLASS}
              />
              <span className="mt-1 block text-xs text-ink-muted">
                Hard cap. A desk cannot save a higher number. Empty uses the
                default as the cap, or no cap if both are empty.
              </span>
            </label>
            <PendingSubmitButton
              pendingLabel="Saving…"
              successKey="save-admin-settings"
              className="rounded-control bg-accent-strong px-3 py-1.5 text-xs font-medium text-ink"
            >
              Save settings
            </PendingSubmitButton>
          </form>
        </>
      ) : null}

      {tab === "crypto" ? (
        <>
          {saved === "gaslow" ? (
            <p className="mt-6 text-sm text-success">Low ETH level saved.</p>
          ) : null}
          {saved === "chain" ? (
            <p className="mt-6 text-sm text-success">Chain saved.</p>
          ) : null}
          {saved === "token" ? (
            <p className="mt-6 text-sm text-success">Token saved.</p>
          ) : null}
          {error &&
          error !== "copy-days" &&
          error !== "copy-followers" &&
          error !== "copy-followers-ceiling" &&
          error !== "copy-followers-range" ? (
            <p className="mt-6 text-sm text-danger">{error}</p>
          ) : null}
          <section className="mt-6 rounded-card border border-line bg-surface p-5">
            <h2 className="text-lg font-semibold tracking-tight">Gas wallet</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Low ETH watermark for drips. Balances stay on Billing & Wallets.
            </p>
            <form
              action={saveGasLowEthAction}
              className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end"
            >
              <label className="block text-sm text-ink">
                Low ETH level
                <input
                  name="lowEth"
                  required
                  defaultValue={gas.lowEth}
                  inputMode="decimal"
                  className={BILLING_FIELD_CLASS}
                />
                <span className="mt-1 block text-xs text-ink-muted">
                  Warn on Billing & Wallets when a listed chain is at or below
                  this amount. Default 0.005 ETH.
                </span>
              </label>
              <PendingSubmitButton
                pendingLabel="Saving…"
                className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
              >
                Save level
              </PendingSubmitButton>
            </form>
          </section>
          <p className="mt-8 text-sm text-ink-muted">
            Deposit rails for this environment ({env}). Develop uses testnets.
            Production uses mainnets.
          </p>
          {chains.length === 0 ? (
            <p className="mt-4 text-sm text-warning">
              No billing chains yet. Push{" "}
              <code className="text-ink">develop</code> so the wallet migration
              can seed Arbitrum Sepolia.
            </p>
          ) : null}
          {chains.map((chain) => {
            const chainTokens = tokens.filter(
              (token) => token.chainId === chain.id,
            );
            return (
              <section
                key={chain.id}
                className="mt-6 space-y-5 rounded-card border border-line bg-surface p-5"
              >
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    {chain.name}
                  </h2>
                  <p className="mt-1 text-xs text-ink-faint">
                    {chain.environment} · chain id {chain.chainId} · last scanned{" "}
                    {chain.lastScannedBlock ?? "—"}
                  </p>
                </div>
                <form
                  action={saveBillingChainAction}
                  className="grid gap-4 md:grid-cols-2"
                >
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
                        className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
                      >
                        Save token
                      </PendingSubmitButton>
                    </div>
                  </form>
                ))}
              </section>
            );
          })}
        </>
      ) : null}
    </div>
  );
}

function TabLink({
  href,
  selected,
  children,
}: {
  href: string;
  selected: boolean;
  children: string;
}) {
  return (
    <Link
      href={href}
      className={`-mb-px border-b-2 px-3 py-2 text-sm ${
        selected
          ? "border-accent text-ink"
          : "border-transparent text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
