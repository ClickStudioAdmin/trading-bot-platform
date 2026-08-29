import { parseDeskType } from "@/lib/accounts/model";
import { createServiceClient } from "@/lib/supabase/admin";

export type EngineDeskKinds = {
  cashAndCarry: boolean;
  linear: boolean;
};

export function deskKindsFromTypes(
  types: readonly (string | null | undefined)[],
): EngineDeskKinds {
  let cashAndCarry = false;
  let linear = false;
  for (const raw of types) {
    const deskType = parseDeskType(raw);
    if (deskType === "cash_and_carry") {
      cashAndCarry = true;
    }
    if (deskType === "perps" || deskType === "dca") {
      linear = true;
    }
    if (cashAndCarry && linear) {
      break;
    }
  }
  return { cashAndCarry, linear };
}

export function mergeHotAccountIds(
  ...groups: readonly (readonly (string | null | undefined)[])[]
): string[] {
  const ids = new Set<string>();
  for (const group of groups) {
    for (const raw of group) {
      const id = String(raw ?? "").trim();
      if (id) {
        ids.add(id);
      }
    }
  }
  return [...ids].sort();
}

export async function listHotEngineAccountIds(): Promise<string[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const [open, armed, automations] = await Promise.all([
    supabase
      .from("futures_positions")
      .select("account_id")
      .eq("status", "open"),
    supabase
      .from("dca_playbooks")
      .select("account_id")
      .or("long_status.eq.armed,short_status.eq.armed"),
    supabase
      .from("futures_automation_rules")
      .select("account_id")
      .eq("mode", "active"),
  ]);
  return mergeHotAccountIds(
    (open.data ?? []).map((row) =>
      String((row as { account_id?: string }).account_id ?? ""),
    ),
    (armed.data ?? []).map((row) =>
      String((row as { account_id?: string }).account_id ?? ""),
    ),
    (automations.data ?? []).map((row) =>
      String((row as { account_id?: string }).account_id ?? ""),
    ),
  );
}

export async function listEngineDeskKinds(): Promise<EngineDeskKinds> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { cashAndCarry: false, linear: false };
  }
  const { data, error } = await supabase
    .from("trading_accounts")
    .select("desk_type");
  if (error) {
    console.error("engine desk kinds", error.message);
    return { cashAndCarry: true, linear: true };
  }
  return deskKindsFromTypes(
    (data ?? []).map((row) =>
      String((row as { desk_type?: unknown }).desk_type ?? ""),
    ),
  );
}
