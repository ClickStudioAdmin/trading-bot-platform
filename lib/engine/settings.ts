import {
  DEFAULT_USABLE_BOOK_SHARE,
} from "@/lib/opportunities/capacity";
import { asNullableNumber } from "@/lib/paper/rows";
import { getSessionContext } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";

export async function loadUsableBookShare(): Promise<number> {
  try {
    const session = await getSessionContext();
    const supabase = createServiceClient();
    if (!session || !supabase) {
      return DEFAULT_USABLE_BOOK_SHARE;
    }

    const { data, error } = await supabase
      .from("paper_engine_settings")
      .select("usable_book_share")
      .eq("account_id", session.account.id)
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_USABLE_BOOK_SHARE;
    }

    const share = asNullableNumber(data.usable_book_share);
    if (share === null || !(share > 0) || share > 1) {
      return DEFAULT_USABLE_BOOK_SHARE;
    }
    return share;
  } catch {
    return DEFAULT_USABLE_BOOK_SHARE;
  }
}
