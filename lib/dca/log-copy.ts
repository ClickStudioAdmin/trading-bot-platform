export function dcaEntryLabel(clipIndex: number): string {
  return `Entry # ${clipIndex + 1}`;
}

const SYNC_REASON_LABELS: Record<string, string> = {
  rest_grid: "Rest grid order",
  amend_grid: "Amend grid order",
  cancel_grid: "Cancel grid order",
  rest_tp: "Rest take profit",
  rest_sl: "Rest stop loss",
  amend_tp: "Amend take profit",
  amend_sl: "Amend stop loss",
  cancel_tp: "Cancel take profit",
  cancel_sl: "Cancel stop loss",
  cancel_extra_tp: "Cancel extra take profit",
  cancel_extra_sl: "Cancel extra stop loss",
  replace_tp: "Replace take profit",
  replace_sl: "Replace stop loss",
  set_tpsl: "Set take profit / stop",
  set_trailing: "Set trailing stop",
  clear_trailing: "Clear trailing stop",
};

const DECISION_KIND_LABELS: Record<string, string> = {
  arm: "Start met",
  disarm: "Stop-adding trigger",
  clip: "Add order",
  close: "Close",
  end_cycle: "Cycle end",
  stop_adding: "Order cap",
  breakeven: "Move stop to breakeven",
};

export function dcaSyncReasonLabel(reason: string): string | null {
  const known = SYNC_REASON_LABELS[reason];
  if (known) {
    return known;
  }
  if (!/^[a-z][a-z0-9_]*$/.test(reason)) {
    return null;
  }
  return reason
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function dcaDecisionKindLabel(kind: string): string | null {
  return DECISION_KIND_LABELS[kind] ?? null;
}

export function dcaSyncFailedHeadline(input: {
  reason?: string | null;
  clipIndex?: number | null;
}): string {
  const entry =
    input.clipIndex !== null &&
    input.clipIndex !== undefined &&
    Number.isInteger(input.clipIndex) &&
    input.clipIndex >= 0
      ? dcaEntryLabel(input.clipIndex)
      : null;
  if (input.reason === "rest_grid") {
    return entry ? `Could not rest ${entry}` : "Could not rest grid order";
  }
  const label = input.reason ? dcaSyncReasonLabel(input.reason) : null;
  return label ? `Could not ${label.toLowerCase()}` : "Bot sync failed";
}

export function dcaSyncFailedMessage(input: {
  error: string;
  reason: string;
  clipIndex?: number | null;
  maxClips?: number | null;
  limitPrice?: number | null;
  qty?: number | null;
}): string {
  const error = input.error.trim();
  const what = dcaSyncAttemptLine(input);
  if (!what) {
    return error;
  }
  if (!error) {
    return what;
  }
  return `${what} ${error}`;
}

function dcaSyncAttemptLine(input: {
  reason: string;
  clipIndex?: number | null;
  maxClips?: number | null;
  limitPrice?: number | null;
  qty?: number | null;
}): string | null {
  const entry =
    input.clipIndex !== null &&
    input.clipIndex !== undefined &&
    Number.isInteger(input.clipIndex) &&
    input.clipIndex >= 0
      ? dcaEntryLabel(input.clipIndex)
      : null;
  const cap =
    input.maxClips !== null &&
    input.maxClips !== undefined &&
    input.maxClips >= 1
      ? ` of ${Math.floor(input.maxClips)}`
      : "";
  const at = formatLogPrice(input.limitPrice);
  const qty = formatLogQty(input.qty);
  const detail = [at ? `at ${at}` : null, qty ? `qty ${qty}` : null]
    .filter(Boolean)
    .join(", ");
  const suffix = detail ? ` ${detail}` : "";
  if (input.reason === "rest_grid") {
    return `Could not rest ${entry ?? "the next grid order"}${cap}${suffix}.`;
  }
  if (input.reason === "amend_grid") {
    return `Could not amend ${entry ?? "a grid order"}${cap}${suffix}.`;
  }
  const label = dcaSyncReasonLabel(input.reason);
  if (!label) {
    return null;
  }
  return `Could not ${label.toLowerCase()}${entry ? ` (${entry}${cap})` : ""}${suffix}.`;
}

export function dcaDecisionMessage(input: {
  name: string;
  kind: string;
  reason?: string | null;
  clipsFilled?: number | null;
  maxClips?: number | null;
}): string {
  const name = input.name.trim() || "Bot";
  if (input.kind === "clip") {
    const next =
      input.clipsFilled !== null &&
      input.clipsFilled !== undefined &&
      input.clipsFilled >= 0
        ? dcaEntryLabel(input.clipsFilled)
        : "an order";
    const cap =
      input.maxClips !== null &&
      input.maxClips !== undefined &&
      input.maxClips >= 1
        ? ` of ${Math.floor(input.maxClips)}`
        : "";
    return `${name} adding ${next}${cap}.`;
  }
  if (input.kind === "arm") {
    return `${name} start met. Placing the first order.`;
  }
  if (input.kind === "disarm") {
    return `${name} stop-adding trigger met.`;
  }
  if (input.kind === "stop_adding") {
    const cap =
      input.maxClips !== null &&
      input.maxClips !== undefined &&
      input.maxClips >= 1
        ? ` (${Math.floor(input.maxClips)} orders)`
        : "";
    return `${name} hit the order cap${cap}.`;
  }
  if (input.kind === "breakeven") {
    return `${name} moving stop to breakeven.`;
  }
  if (input.kind === "end_cycle") {
    return `${name} cycle ended.`;
  }
  if (input.kind === "close" && input.reason === "take_profit") {
    return `${name} take profit hit. Flattening.`;
  }
  if (input.kind === "close" && input.reason === "stop_loss") {
    return `${name} stop loss hit. Flattening.`;
  }
  return `${name} ${input.kind}.`;
}

function formatLogPrice(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value) || !(value > 0)) {
    return null;
  }
  return String(Number(value.toPrecision(8)));
}

function formatLogQty(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value) || !(value > 0)) {
    return null;
  }
  return String(Number(value.toPrecision(8)));
}
