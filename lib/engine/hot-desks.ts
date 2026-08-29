import { createServiceClient } from "@/lib/supabase/admin";

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
