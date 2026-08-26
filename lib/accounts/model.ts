export type TradingAccountMode = "paper" | "live";
export type DeskType = "cash_and_carry" | "perps" | "signal_follower";

export const DEFAULT_ACCOUNT_NAME = "Demo Account";
export const DEFAULT_DESK_TYPE: DeskType = "cash_and_carry";

export type TradingAccount = {
  id: string;
  userId: string;
  name: string;
  mode: TradingAccountMode;
  deskType: DeskType;
  createdAtMs: number;
};

export function parseAccountMode(value: unknown): TradingAccountMode {
  return value === "live" ? "live" : "paper";
}

export function parseDeskType(value: unknown): DeskType {
  if (value === "perps" || value === "signal_follower") {
    return value;
  }
  return "cash_and_carry";
}

export function parseDeskTypeChoice(
  value: unknown,
): { ok: true; deskType: DeskType } | { ok: false; error: string } {
  const raw = String(value ?? "").trim();
  if (
    raw === "cash_and_carry" ||
    raw === "perps" ||
    raw === "signal_follower"
  ) {
    return { ok: true, deskType: raw };
  }
  return { ok: false, error: "Choose a desk type." };
}

export function formatDeskType(deskType: DeskType): string {
  if (deskType === "perps") {
    return "Perps";
  }
  if (deskType === "signal_follower") {
    return "TradingView Strategy";
  }
  return "Cash and Carry";
}

export function formatDeskTypeChoice(deskType: DeskType): string {
  if (deskType === "perps") {
    return "Perps (buy / sell / close one USDT perpetual)";
  }
  if (deskType === "signal_follower") {
    return "TradingView Strategy (alerts send buy / sell / close)";
  }
  return "Cash and Carry (spot + dated future)";
}

export function deskHomePath(deskType: DeskType): string {
  return deskType === "cash_and_carry"
    ? "/strategies/cash-and-carry"
    : "/strategies/futures";
}

export function deskUsesCashAndCarry(deskType: DeskType): boolean {
  return deskType === "cash_and_carry";
}

export function deskUsesPerpsUi(deskType: DeskType): boolean {
  return deskType === "perps" || deskType === "signal_follower";
}

export function deskAllowsManualPerpTicket(deskType: DeskType): boolean {
  return deskType === "perps";
}

export function deskAllowsSignalWebhooks(deskType: DeskType): boolean {
  return deskType === "perps";
}

export function parseAccountName(
  value: unknown,
): { ok: true; name: string } | { ok: false; error: string } {
  const name = String(value ?? "").trim();
  if (name.length < 1 || name.length > 40) {
    return { ok: false, error: "Name must be 1 to 40 characters." };
  }
  return { ok: true, name };
}

export function parseTradingAccountRow(
  row: Record<string, unknown>,
): TradingAccount {
  const created = new Date(String(row.created_at ?? "")).getTime();
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name).trim(),
    mode: parseAccountMode(row.mode),
    deskType: parseDeskType(row.desk_type),
    createdAtMs: Number.isFinite(created) ? created : 0,
  };
}

export function pickDefaultAccount(
  accounts: TradingAccount[],
): TradingAccount | null {
  return accounts.find((account) => account.mode === "paper") ?? accounts[0] ?? null;
}

export function pickSwitchAfterDelete(
  remaining: TradingAccount[],
  requestedId: unknown,
): TradingAccount | null {
  const id = String(requestedId ?? "").trim();
  return remaining.find((account) => account.id === id) ?? pickDefaultAccount(remaining);
}

export function formatAccountMode(mode: TradingAccountMode): string {
  return mode === "live" ? "Connected Exchange" : "Paper Trading";
}

export function formatAccountModeChoice(mode: TradingAccountMode): string {
  return mode === "live"
    ? "Connected Exchange (uses a connected exchange)"
    : "Paper Trading (uses live market data - no real trades)";
}

export type AccountDeleteBlock = "last" | "open" | "automations";
export type ConnectionRemoveBlock = "in_use";
export type StrategyDetachBlock = "open" | "automations";

export function accountDeleteBlockers(input: {
  accountCount: number;
  openCount: number;
  automationsRunning: boolean;
  mode: TradingAccountMode;
}): AccountDeleteBlock[] {
  const blocks: AccountDeleteBlock[] = [];
  if (input.accountCount <= 1) {
    blocks.push("last");
  }
  if (input.openCount > 0) {
    blocks.push("open");
  }
  if (input.automationsRunning) {
    blocks.push("automations");
  }
  return blocks;
}

export function formatDeleteBlockers(
  blocks: readonly AccountDeleteBlock[],
): string {
  const parts: string[] = [];
  if (blocks.includes("last")) {
    parts.push("Keep at least one desk");
  }
  const open = blocks.includes("open");
  const automations = blocks.includes("automations");
  if (open && automations) {
    parts.push("Disable automations and exit all positions first");
  } else if (open) {
    parts.push("Exit all positions first");
  } else if (automations) {
    parts.push("Disable automations first");
  }
  return parts.join(" · ");
}

export function formatAccountUsageStatus(input: {
  openCount: number;
  automationsRunning: boolean;
  reduceOnly?: boolean;
}): string {
  const parts: string[] = [];
  if (input.openCount > 0) {
    parts.push(
      input.openCount === 1
        ? "1 Open position"
        : `${input.openCount} Open positions`,
    );
  }
  if (input.automationsRunning) {
    parts.push("Automations on");
  }
  if (input.reduceOnly) {
    parts.push("Reduce only");
  }
  return parts.join(" - ");
}

export function connectionRemoveBlockers(input: {
  inUse: boolean;
}): ConnectionRemoveBlock[] {
  return input.inUse ? ["in_use"] : [];
}

export function formatConnectionRemoveBlockers(
  blocks: ConnectionRemoveBlock[],
): string {
  if (blocks.includes("in_use")) {
    return "Detach this key from every desk in Desk Settings first";
  }
  return "";
}

export function strategyDetachBlockers(input: {
  openCount: number;
  automationsRunning: boolean;
}): StrategyDetachBlock[] {
  const blocks: StrategyDetachBlock[] = [];
  if (input.openCount > 0) {
    blocks.push("open");
  }
  if (input.automationsRunning) {
    blocks.push("automations");
  }
  return blocks;
}

export function formatStrategyDetachBlockers(
  blocks: StrategyDetachBlock[],
): string {
  return formatDeleteBlockers(blocks);
}
