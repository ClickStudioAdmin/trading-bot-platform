import {
  DEFAULT_USABLE_BOOK_SHARE,
} from "@/lib/opportunities/capacity";
import { asNullableNumber } from "@/lib/paper/rows";
import { getSessionContext } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type EngineSettings = {
  share: number;
  reduceOnly: boolean;
};

const SETTINGS_SELECT =
  "account_id, user_id, enabled, reduce_only, usable_book_share";
const SETTINGS_SELECT_FALLBACK =
  "account_id, user_id, enabled, usable_book_share";

export function parseReduceOnly(value: unknown): boolean {
  return value === "on" || value === true || value === "true";
}

export async function selectPaperEngineSettings(
  supabase: SupabaseClient,
  filter?: { accountId?: string; accountIds?: string[] },
): Promise<Record<string, unknown>[]> {
  const run = (columns: string) => {
    let query = supabase.from("paper_engine_settings").select(columns);
    if (filter?.accountId) {
      query = query.eq("account_id", filter.accountId);
    } else if (filter?.accountIds && filter.accountIds.length > 0) {
      query = query.in("account_id", filter.accountIds);
    }
    return query;
  };
  const full = await run(SETTINGS_SELECT);
  if (!full.error) {
    return (full.data ?? []) as unknown as Record<string, unknown>[];
  }
  const fallback = await run(SETTINGS_SELECT_FALLBACK);
  return (fallback.data ?? []) as unknown as Record<string, unknown>[];
}

export async function loadEngineSettings(): Promise<EngineSettings> {
  try {
    const session = await getSessionContext();
    const supabase = createServiceClient();
    if (!session || !supabase) {
      return {
        share: DEFAULT_USABLE_BOOK_SHARE,
        reduceOnly: false,
      };
    }

    const rows = await selectPaperEngineSettings(supabase, {
      accountId: session.account.id,
    });
    const data = rows[0];
    if (!data) {
      return {
        share: DEFAULT_USABLE_BOOK_SHARE,
        reduceOnly: false,
      };
    }

    const share = asNullableNumber(data.usable_book_share);
    return {
      share:
        share !== null && share > 0 && share <= 1
          ? share
          : DEFAULT_USABLE_BOOK_SHARE,
      reduceOnly: Boolean(data.reduce_only),
    };
  } catch {
    return {
      share: DEFAULT_USABLE_BOOK_SHARE,
      reduceOnly: false,
    };
  }
}

export async function loadUsableBookShare(): Promise<number> {
  const settings = await loadEngineSettings();
  return settings.share;
}
