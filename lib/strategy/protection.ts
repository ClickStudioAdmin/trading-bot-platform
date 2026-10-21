export type ProtectionIs = "protected" | "no_loss";
export type ProtectionAmount = "entire" | "at_least";

/** Open size and the two coverage percents the exit book already stores. */
export type ProtectionReading = {
  openQty: number | null;
  /** Largest single protective stop, including one that would close at a loss. */
  provenPct: number | null;
  /** Largest single protective stop whose price is at or better than entry. */
  noLossProvenPct: number | null;
};

export type ProtectionSpec = {
  is: ProtectionIs;
  amount: ProtectionAmount;
  /** Required when amount is at least. A percent of the open size. */
  pct: number | null;
};

export function parseProtectionIs(value: unknown): ProtectionIs | null {
  const raw = String(value ?? "").trim();
  if (raw === "protected" || raw === "no_loss") {
    return raw;
  }
  return null;
}

export function parseProtectionAmount(value: unknown): ProtectionAmount | null {
  const raw = String(value ?? "").trim();
  if (raw === "entire" || raw === "at_least") {
    return raw;
  }
  return null;
}

export function parseProtectionPct(value: unknown): number | null {
  if (value == null || String(value).trim() === "") {
    return null;
  }
  const pct = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(pct) || !(pct > 0) || pct > 100) {
    return null;
  }
  return pct;
}

export function parseProtectionSpec(raw: unknown): ProtectionSpec | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const is = parseProtectionIs(row.is);
  const amount = parseProtectionAmount(row.amount);
  if (!is || !amount) {
    return null;
  }
  const pct =
    row.pct == null || String(row.pct).trim() === ""
      ? null
      : parseProtectionPct(row.pct);
  if (amount === "at_least" && pct == null) {
    return null;
  }
  if (
    amount === "entire" &&
    row.pct != null &&
    String(row.pct).trim() !== "" &&
    pct == null
  ) {
    return null;
  }
  return { is, amount, pct: amount === "at_least" ? pct : null };
}

/**
 * Flat is never met. Entire position means the largest qualifying stop
 * covers the open size. At least uses that same percent.
 * Protected counts a stop that would close at a loss.
 * Protected - No Loss counts only a stop at or better than entry.
 */
export function protectionMet(input: {
  spec: ProtectionSpec;
  openQty: number | null;
  provenPct: number | null;
  noLossProvenPct?: number | null;
}): boolean {
  if (!(input.openQty != null && input.openQty > 0)) {
    return false;
  }
  const need = input.spec.amount === "entire" ? 100 : input.spec.pct;
  if (need == null || !(need > 0)) {
    return false;
  }
  const covered =
    input.spec.is === "no_loss" ? (input.noLossProvenPct ?? 0) : (input.provenPct ?? 0);
  return covered + 1e-6 >= need;
}

export function protectionReading(
  openQty: number | null,
  book: {
    protective: { provenPct: number | null };
    noLoss: { provenPct: number | null };
  } | null | undefined,
): ProtectionReading {
  return {
    openQty,
    provenPct: book?.protective.provenPct ?? null,
    noLossProvenPct: book?.noLoss.provenPct ?? null,
  };
}

export function protectionIsLabel(is: ProtectionIs): string {
  return is === "no_loss" ? "Protected - No Loss" : "Protected";
}

export function formatProtectionLabel(spec: ProtectionSpec): string {
  const state = protectionIsLabel(spec.is);
  if (spec.amount === "at_least" && spec.pct != null) {
    return `${state}, at least ${spec.pct}%`;
  }
  return `${state}, entire position`;
}
