import { fromByteaParam, toByteaParam } from "@/lib/exchanges/connections";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  billingCredentialsConfigured,
  decryptBillingGasSecret,
  decryptBillingSecret,
  encryptBillingGasSecret,
  encryptBillingSecret,
} from "./billing-encrypt";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { createDepositMnemonic, deriveDepositAddress } from "./hd";
import { DEFAULT_GAS_LOW_ETH, parseGasLowEth } from "./gas-drip";
import {
  billingChainEnvironment,
  bookBalancesFromEntries,
  inferWalletBook,
  parseTokenKind,
  walletInvoiceExternalId,
  WALLET_PERIOD_MS,
  type BillingChainEnvironment,
  type TokenKind,
  type WalletBookBalances,
} from "./wallet";

export type BillingChain = {
  id: string;
  slug: string;
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string | null;
  environment: BillingChainEnvironment;
  confirmations: number;
  adminAddress: string | null;
  affiliatePayouts: boolean;
  lastScannedBlock: number | null;
  sortOrder: number;
};

export type BillingToken = {
  id: string;
  chainId: string;
  symbol: string;
  contractAddress: string;
  decimals: number;
  kind: TokenKind;
};

export type DepositAddress = {
  userId: string;
  address: string;
  derivationIndex: number;
};

export type HdSeedStatus = {
  configured: boolean;
  keyReady: boolean;
  createdAt: string | null;
};

export type GasWalletStatus = {
  configured: boolean;
  keyReady: boolean;
  address: string | null;
  createdAt: string | null;
  lowEth: string;
};

type ChainRow = {
  id: string;
  slug: string;
  name: string;
  chain_id: number;
  rpc_url: string;
  explorer_url: string | null;
  environment: string;
  confirmations: number;
  admin_address: string | null;
  affiliate_payouts?: boolean | null;
  last_scanned_block: number | string | null;
  sort_order: number;
};

type TokenRow = {
  id: string;
  chain_id: string;
  symbol: string;
  contract_address: string;
  decimals: number;
  kind: string;
};

function mapChain(row: ChainRow): BillingChain {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    chainId: Number(row.chain_id),
    rpcUrl: row.rpc_url,
    explorerUrl: row.explorer_url,
    environment: row.environment === "production" ? "production" : "development",
    confirmations: Number(row.confirmations),
    adminAddress: row.admin_address ? row.admin_address.toLowerCase() : null,
    affiliatePayouts: row.affiliate_payouts === true,
    lastScannedBlock:
      row.last_scanned_block === null || row.last_scanned_block === undefined
        ? null
        : Number(row.last_scanned_block),
    sortOrder: Number(row.sort_order),
  };
}

function mapToken(row: TokenRow): BillingToken | null {
  const kind = parseTokenKind(row.kind);
  if (!kind) {
    return null;
  }
  return {
    id: row.id,
    chainId: row.chain_id,
    symbol: row.symbol,
    contractAddress: row.contract_address.toLowerCase(),
    decimals: Number(row.decimals),
    kind,
  };
}

export async function walletBookBalances(
  userId: string,
): Promise<WalletBookBalances> {
  const empty: WalletBookBalances = { main: 0, affiliate: 0 };
  const supabase = createServiceClient();
  if (!supabase || !userId) {
    return empty;
  }
  const full = await supabase
    .from("membership_wallet_entries")
    .select("kind, amount_usd, book")
    .eq("user_id", userId);
  if (!full.error) {
    return bookBalancesFromEntries(
      (full.data ?? []).map((row) => ({
        kind: String(row.kind),
        amountUsd: Number(row.amount_usd),
        book: typeof row.book === "string" ? row.book : null,
      })),
    );
  }
  const core = await supabase
    .from("membership_wallet_entries")
    .select("kind, amount_usd")
    .eq("user_id", userId);
  return bookBalancesFromEntries(
    (core.data ?? []).map((row) => ({
      kind: String(row.kind),
      amountUsd: Number(row.amount_usd),
      book: inferWalletBook(String(row.kind), null),
    })),
  );
}

export async function walletCreditUsd(userId: string): Promise<number> {
  const books = await walletBookBalances(userId);
  return books.main;
}

const CHAIN_COLUMNS =
  "id, slug, name, chain_id, rpc_url, explorer_url, environment, confirmations, admin_address, last_scanned_block, sort_order";
const CHAIN_COLUMNS_FULL = `${CHAIN_COLUMNS}, affiliate_payouts`;

async function selectBillingChains(
  environment?: BillingChainEnvironment,
): Promise<BillingChain[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const full = supabase.from("membership_billing_chains").select(CHAIN_COLUMNS_FULL);
  const scoped = environment ? full.eq("environment", environment) : full;
  const { data, error } = environment
    ? await scoped.order("sort_order", { ascending: true })
    : await scoped
        .order("environment", { ascending: true })
        .order("sort_order", { ascending: true });
  if (!error && data) {
    return data.map((row) => mapChain(row as ChainRow));
  }
  const core = supabase.from("membership_billing_chains").select(CHAIN_COLUMNS);
  const coreScoped = environment ? core.eq("environment", environment) : core;
  const retry = environment
    ? await coreScoped.order("sort_order", { ascending: true })
    : await coreScoped
        .order("environment", { ascending: true })
        .order("sort_order", { ascending: true });
  if (retry.error || !retry.data) {
    return [];
  }
  return retry.data.map((row) => mapChain(row as ChainRow));
}

export async function listBillingChains(
  environment: BillingChainEnvironment = billingChainEnvironment(),
): Promise<BillingChain[]> {
  return selectBillingChains(environment);
}

export async function listAllBillingChains(): Promise<BillingChain[]> {
  return selectBillingChains();
}

export async function listAffiliatePayoutChains(
  environment: BillingChainEnvironment = billingChainEnvironment(),
): Promise<BillingChain[]> {
  return (await listBillingChains(environment)).filter(
    (chain) => chain.affiliatePayouts,
  );
}

export async function listBillingTokens(
  chainIds: string[],
): Promise<BillingToken[]> {
  const supabase = createServiceClient();
  if (!supabase || chainIds.length === 0) {
    return [];
  }
  const { data, error } = await supabase
    .from("membership_billing_tokens")
    .select("id, chain_id, symbol, contract_address, decimals, kind")
    .in("chain_id", chainIds)
    .order("symbol", { ascending: true });
  if (error || !data) {
    return [];
  }
  return data
    .map((row) => mapToken(row as TokenRow))
    .filter((row): row is BillingToken => row !== null);
}

export async function getHdSeedStatus(): Promise<HdSeedStatus> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { configured: false, keyReady: billingCredentialsConfigured(), createdAt: null };
  }
  const { data } = await supabase
    .from("platform_settings")
    .select("billing_hd_ciphertext, billing_hd_created_at")
    .eq("id", "tbp")
    .maybeSingle();
  return {
    configured: Boolean(
      data && fromByteaParam((data as { billing_hd_ciphertext?: unknown }).billing_hd_ciphertext),
    ),
    keyReady: billingCredentialsConfigured(),
    createdAt:
      typeof (data as { billing_hd_created_at?: unknown } | null)?.billing_hd_created_at ===
      "string"
        ? String((data as { billing_hd_created_at: string }).billing_hd_created_at)
        : null,
  };
}

export async function loadDepositMnemonic(): Promise<string | null> {
  const supabase = createServiceClient();
  if (!supabase || !billingCredentialsConfigured()) {
    return null;
  }
  const { data } = await supabase
    .from("platform_settings")
    .select("billing_hd_ciphertext, billing_hd_nonce")
    .eq("id", "tbp")
    .maybeSingle();
  if (!data) {
    return null;
  }
  const ciphertext = fromByteaParam(
    (data as { billing_hd_ciphertext?: unknown }).billing_hd_ciphertext,
  );
  const nonce = fromByteaParam((data as { billing_hd_nonce?: unknown }).billing_hd_nonce);
  if (!ciphertext || !nonce) {
    return null;
  }
  const secret = decryptBillingSecret(ciphertext, nonce);
  const mnemonic = secret?.mnemonic?.trim() ?? "";
  return mnemonic || null;
}

export async function createDepositHdSeed(): Promise<
  { ok: true; mnemonic: string } | { ok: false; error: string }
> {
  if (!billingCredentialsConfigured()) {
    return {
      ok: false,
      error:
        "Add BILLING_CREDENTIALS_KEY (64 hex) to this environment, then restart the app.",
    };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const status = await getHdSeedStatus();
  if (status.configured) {
    return { ok: false, error: "A deposit HD seed is already stored." };
  }
  const mnemonic = createDepositMnemonic();
  const sealed = encryptBillingSecret({ mnemonic });
  const { error } = await supabase
    .from("platform_settings")
    .update({
      billing_hd_ciphertext: toByteaParam(sealed.ciphertext),
      billing_hd_nonce: toByteaParam(sealed.nonce),
      billing_hd_created_at: new Date().toISOString(),
    })
    .eq("id", "tbp");
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, mnemonic };
}

export async function getGasWalletStatus(): Promise<GasWalletStatus> {
  const supabase = createServiceClient();
  if (!supabase) {
    return {
      configured: false,
      keyReady: billingCredentialsConfigured(),
      address: null,
      createdAt: null,
      lowEth: DEFAULT_GAS_LOW_ETH,
    };
  }
  const full = await supabase
    .from("platform_settings")
    .select(
      "billing_gas_ciphertext, billing_gas_address, billing_gas_created_at, billing_gas_low_eth",
    )
    .eq("id", "tbp")
    .maybeSingle();
  const { data } = full.error
    ? await supabase
        .from("platform_settings")
        .select("billing_gas_ciphertext, billing_gas_address, billing_gas_created_at")
        .eq("id", "tbp")
        .maybeSingle()
    : full;
  const address =
    typeof (data as { billing_gas_address?: unknown } | null)?.billing_gas_address ===
    "string"
      ? String((data as { billing_gas_address: string }).billing_gas_address)
      : null;
  return {
    configured: Boolean(
      data &&
        (fromByteaParam((data as { billing_gas_ciphertext?: unknown }).billing_gas_ciphertext) ||
          address),
    ),
    keyReady: billingCredentialsConfigured(),
    address,
    createdAt:
      typeof (data as { billing_gas_created_at?: unknown } | null)?.billing_gas_created_at ===
      "string"
        ? String((data as { billing_gas_created_at: string }).billing_gas_created_at)
        : null,
    lowEth:
      parseGasLowEth(
        (data as { billing_gas_low_eth?: unknown } | null)?.billing_gas_low_eth,
      ) ?? DEFAULT_GAS_LOW_ETH,
  };
}

export async function updateGasLowEth(
  lowEth: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = parseGasLowEth(lowEth);
  if (!parsed) {
    return { ok: false, error: "Low ETH level must be between 0 and 10." };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error } = await supabase
    .from("platform_settings")
    .update({ billing_gas_low_eth: Number(parsed) })
    .eq("id", "tbp");
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function loadGasPrivateKey(): Promise<Hex | null> {
  const supabase = createServiceClient();
  if (!supabase || !billingCredentialsConfigured()) {
    return null;
  }
  const { data } = await supabase
    .from("platform_settings")
    .select("billing_gas_ciphertext, billing_gas_nonce")
    .eq("id", "tbp")
    .maybeSingle();
  if (!data) {
    return null;
  }
  const ciphertext = fromByteaParam(
    (data as { billing_gas_ciphertext?: unknown }).billing_gas_ciphertext,
  );
  const nonce = fromByteaParam((data as { billing_gas_nonce?: unknown }).billing_gas_nonce);
  if (!ciphertext || !nonce) {
    return null;
  }
  const secret = decryptBillingGasSecret(ciphertext, nonce);
  const privateKey = secret?.privateKey?.trim() ?? "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    return null;
  }
  return privateKey as Hex;
}

export async function createGasWallet(): Promise<
  { ok: true; address: string; privateKey: string } | { ok: false; error: string }
> {
  if (!billingCredentialsConfigured()) {
    return {
      ok: false,
      error:
        "Add BILLING_CREDENTIALS_KEY (64 hex) to this environment, then restart the app.",
    };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const status = await getGasWalletStatus();
  if (status.configured) {
    return { ok: false, error: "A gas wallet is already stored." };
  }
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const address = account.address.toLowerCase();
  const sealed = encryptBillingGasSecret({ privateKey });
  const { error } = await supabase
    .from("platform_settings")
    .update({
      billing_gas_ciphertext: toByteaParam(sealed.ciphertext),
      billing_gas_nonce: toByteaParam(sealed.nonce),
      billing_gas_address: address,
      billing_gas_created_at: new Date().toISOString(),
    })
    .eq("id", "tbp");
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, address, privateKey };
}

export async function getDepositAddress(
  userId: string,
): Promise<DepositAddress | null> {
  const supabase = createServiceClient();
  if (!supabase || !userId) {
    return null;
  }
  const { data, error } = await supabase
    .from("membership_deposit_addresses")
    .select("user_id, address, derivation_index")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return {
    userId: String(data.user_id),
    address: String(data.address).toLowerCase(),
    derivationIndex: Number(data.derivation_index),
  };
}

export async function listDepositAddresses(): Promise<DepositAddress[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("membership_deposit_addresses")
    .select("user_id, address, derivation_index");
  if (error || !data) {
    return [];
  }
  return data.map((row) => ({
    userId: String(row.user_id),
    address: String(row.address).toLowerCase(),
    derivationIndex: Number(row.derivation_index),
  }));
}

export async function ensureDepositAddress(
  userId: string,
): Promise<
  { ok: true; address: DepositAddress } | { ok: false; error: string }
> {
  const existing = await getDepositAddress(userId);
  if (existing) {
    return { ok: true, address: existing };
  }
  const mnemonic = await loadDepositMnemonic();
  if (!mnemonic) {
    return {
      ok: false,
      error: "Deposit addresses are not ready. An admin must create the HD seed first.",
    };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { data: latest } = await supabase
    .from("membership_deposit_addresses")
    .select("derivation_index")
    .order("derivation_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextIndex =
    latest && Number.isInteger(Number(latest.derivation_index))
      ? Number(latest.derivation_index) + 1
      : 0;
  const address = deriveDepositAddress(mnemonic, nextIndex);
  const { error } = await supabase.from("membership_deposit_addresses").insert({
    user_id: userId,
    address,
    derivation_index: nextIndex,
  });
  if (error) {
    if (error.code === "23505") {
      const raced = await getDepositAddress(userId);
      if (raced) {
        return { ok: true, address: raced };
      }
    }
    return { ok: false, error: error.message };
  }
  return {
    ok: true,
    address: { userId, address, derivationIndex: nextIndex },
  };
}

export async function updateBillingChain(input: {
  id: string;
  name: string;
  rpcUrl: string;
  explorerUrl: string | null;
  confirmations: number;
  adminAddress: string | null;
  affiliatePayouts: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const update: Record<string, unknown> = {
    name: input.name,
    rpc_url: input.rpcUrl,
    explorer_url: input.explorerUrl,
    confirmations: input.confirmations,
    admin_address: input.adminAddress,
    affiliate_payouts: input.affiliatePayouts,
  };
  let { error } = await supabase
    .from("membership_billing_chains")
    .update(update)
    .eq("id", input.id);
  if (error && "affiliate_payouts" in update) {
    delete update.affiliate_payouts;
    const retry = await supabase
      .from("membership_billing_chains")
      .update(update)
      .eq("id", input.id);
    error = retry.error;
  }
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function updateBillingToken(input: {
  id: string;
  symbol: string;
  contractAddress: string;
  decimals: number;
  kind: TokenKind;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error } = await supabase
    .from("membership_billing_tokens")
    .update({
      symbol: input.symbol,
      contract_address: input.contractAddress,
      decimals: input.decimals,
      kind: input.kind,
    })
    .eq("id", input.id);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function markChainScanned(
  chainId: string,
  blockNumber: bigint,
): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) {
    return;
  }
  await supabase
    .from("membership_billing_chains")
    .update({ last_scanned_block: Number(blockNumber) })
    .eq("id", chainId);
}

export async function markDepositSwept(
  chainId: string,
  txHash: string,
  logIndex: number,
  sweepTxHash: string,
): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) {
    return;
  }
  await supabase
    .from("membership_deposit_txs")
    .update({ sweep_tx_hash: sweepTxHash.toLowerCase() })
    .eq("chain_id", chainId)
    .eq("tx_hash", txHash.toLowerCase())
    .eq("log_index", logIndex);
}

export type UnsweptDepositCredit = {
  chainId: string;
  count: number;
  amountUsd: number;
};

export async function listUnsweptDepositCredits(): Promise<
  UnsweptDepositCredit[]
> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("membership_deposit_txs")
    .select("chain_id, amount_usd")
    .is("sweep_tx_hash", null);
  if (error || !data) {
    return [];
  }
  const byChain = new Map<string, UnsweptDepositCredit>();
  for (const row of data) {
    const chainId = String(row.chain_id);
    const amountUsd = Number(row.amount_usd);
    const current = byChain.get(chainId) ?? {
      chainId,
      count: 0,
      amountUsd: 0,
    };
    current.count += 1;
    current.amountUsd += Number.isFinite(amountUsd) ? amountUsd : 0;
    byChain.set(chainId, current);
  }
  return [...byChain.values()];
}

export async function creditOnChainDeposit(input: {
  userId: string;
  chainId: string;
  tokenId: string;
  txHash: string;
  logIndex: number;
  fromAddress: string;
  toAddress: string;
  tokenAmount: string;
  amountUsd: number;
  blockNumber: bigint;
}): Promise<{ ok: true; entryId: string | null } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { data, error } = await supabase.rpc("credit_membership_deposit", {
    p_user_id: input.userId,
    p_chain_id: input.chainId,
    p_token_id: input.tokenId,
    p_tx_hash: input.txHash,
    p_log_index: input.logIndex,
    p_from_address: input.fromAddress,
    p_to_address: input.toAddress,
    p_token_amount: input.tokenAmount,
    p_amount_usd: input.amountUsd,
    p_block_number: Number(input.blockNumber),
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, entryId: typeof data === "string" ? data : null };
}

export async function payPlanFromWallet(input: {
  userId: string;
  planId: string;
  amountUsd: number;
  transferUsd: number;
  setEnroll: boolean;
  nowMs?: number;
}): Promise<{ ok: true; invoiceId: string } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const now = input.nowMs ?? Date.now();
  const periodStart = new Date(now).toISOString();
  const periodEnd = new Date(now + WALLET_PERIOD_MS).toISOString();
  const { data, error } = await supabase.rpc("pay_membership_from_wallet", {
    p_user_id: input.userId,
    p_plan_id: input.planId,
    p_amount_usd: input.amountUsd,
    p_transfer_usd: input.transferUsd,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_external_id: walletInvoiceExternalId(input.userId, periodStart),
    p_set_enroll: input.setEnroll,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  if (typeof data !== "string" || !data) {
    return { ok: false, error: "Wallet payment did not return an invoice." };
  }
  return { ok: true, invoiceId: data };
}

export type MemberDepositContext = {
  books: WalletBookBalances;
  address: DepositAddress | null;
  addressError: string | null;
  chains: BillingChain[];
  tokens: BillingToken[];
  hdReady: boolean;
};

export async function loadMemberDepositContext(
  userId: string,
): Promise<MemberDepositContext> {
  const [books, hd, chains] = await Promise.all([
    walletBookBalances(userId),
    getHdSeedStatus(),
    listBillingChains(),
  ]);
  const tokens = await listBillingTokens(chains.map((chain) => chain.id));
  if (!hd.configured) {
    return {
      books,
      address: null,
      addressError: hd.keyReady
        ? "Deposit addresses are not ready yet."
        : "Deposit addresses are not configured on this environment.",
      chains,
      tokens,
      hdReady: false,
    };
  }
  const ensured = await ensureDepositAddress(userId);
  return {
    books,
    address: ensured.ok ? ensured.address : null,
    addressError: ensured.ok ? null : ensured.error,
    chains,
    tokens,
    hdReady: true,
  };
}
