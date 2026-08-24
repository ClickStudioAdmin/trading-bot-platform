export type TradingAccountMode = "paper" | "live";

export const DEFAULT_ACCOUNT_NAME = "Demo Account";

export type TradingAccount = {
  id: string;
  userId: string;
  name: string;
  mode: TradingAccountMode;
  createdAtMs: number;
};

export function parseAccountMode(value: unknown): TradingAccountMode {
  return value === "live" ? "live" : "paper";
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
    createdAtMs: Number.isFinite(created) ? created : 0,
  };
}

export function pickDefaultAccount(
  accounts: TradingAccount[],
): TradingAccount | null {
  return accounts.find((account) => account.mode === "paper") ?? accounts[0] ?? null;
}

export function formatAccountMode(mode: TradingAccountMode): string {
  return mode === "live" ? "Live" : "Paper";
}

export type AccountDeleteBlock = "last" | "open" | "automations";
export type ConnectionRemoveBlock = "open" | "automations";

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

export function formatDeleteBlockers(blocks: AccountDeleteBlock[]): string {
  const parts: string[] = [];
  if (blocks.includes("last")) {
    parts.push("Keep at least one account");
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
  openCount: number;
  automationsRunning: boolean;
}): ConnectionRemoveBlock[] {
  const blocks: ConnectionRemoveBlock[] = [];
  if (input.openCount > 0) {
    blocks.push("open");
  }
  if (input.automationsRunning) {
    blocks.push("automations");
  }
  return blocks;
}

export function formatConnectionRemoveBlockers(
  blocks: ConnectionRemoveBlock[],
): string {
  return blocks
    .map((block) => {
      if (block === "open") {
        return "Close or flatten open positions first";
      }
      return "Turn off automations first";
    })
    .join(" · ");
}
