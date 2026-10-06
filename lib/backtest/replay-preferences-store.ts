import { createServiceClient } from "@/lib/supabase/admin";
import {
  parseReplayViewPreferences,
  type ReplayViewPreferences,
} from "@/lib/backtest/replay-preferences";

export async function loadReplayViewPreferences(
  userId: string,
): Promise<ReplayViewPreferences | null> {
  const supabase = createServiceClient();
  if (!supabase || !userId) {
    return null;
  }
  const { data, error } = await supabase
    .from("replay_view_preferences")
    .select(
      "positions_right, chart_appearance, indicator_styles, reference_indicators, reference_inputs",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return parseReplayViewPreferences({
    positionsRight: data.positions_right === true,
    chartAppearance: data.chart_appearance,
    indicatorStyles: data.indicator_styles,
    referenceIndicators: data.reference_indicators,
    referenceInputs: data.reference_inputs,
  });
}

export async function saveReplayViewPreferences(
  userId: string,
  raw: unknown,
): Promise<boolean> {
  const supabase = createServiceClient();
  if (!supabase || !userId) {
    return false;
  }
  const prefs = parseReplayViewPreferences(raw);
  const { error } = await supabase.from("replay_view_preferences").upsert(
    {
      user_id: userId,
      positions_right: prefs.positionsRight,
      chart_appearance: prefs.chartAppearance,
      indicator_styles: prefs.indicatorStyles,
      reference_indicators: prefs.referenceIndicators,
      reference_inputs: prefs.referenceInputs,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  return !error;
}
