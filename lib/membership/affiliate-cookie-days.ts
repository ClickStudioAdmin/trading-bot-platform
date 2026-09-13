import { createServiceClient } from "@/lib/supabase/admin";
import {
  AFFILIATE_COOKIE_DAYS_DEFAULT,
  parseAffiliateCookieDays,
} from "./affiliate";

let cache: { days: number; at: number } | null = null;

export function rememberAffiliateCookieDays(days: number): number {
  cache = { days, at: Date.now() };
  return days;
}

export async function loadAffiliateCookieDays(): Promise<number> {
  if (cache && Date.now() - cache.at < 60_000) {
    return cache.days;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return rememberAffiliateCookieDays(AFFILIATE_COOKIE_DAYS_DEFAULT);
  }
  const { data, error } = await supabase
    .from("platform_settings")
    .select("affiliate_cookie_days")
    .eq("id", "tbp")
    .maybeSingle();
  if (error || !data) {
    return rememberAffiliateCookieDays(AFFILIATE_COOKIE_DAYS_DEFAULT);
  }
  const parsed = parseAffiliateCookieDays(
    (data as { affiliate_cookie_days?: unknown }).affiliate_cookie_days,
  );
  return rememberAffiliateCookieDays(
    parsed.ok ? parsed.days : AFFILIATE_COOKIE_DAYS_DEFAULT,
  );
}
