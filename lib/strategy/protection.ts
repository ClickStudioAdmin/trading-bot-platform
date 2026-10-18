export type ProtectionIs = "protected" | "unprotected";
export type ProtectionAmount = "entire" | "at_least";

export type ProtectionSpec = {
  is: ProtectionIs;
  amount: ProtectionAmount;
  /** Required when amount is at least. A percent of the open size. */
  pct: number | null;
};

export function parseProtectionIs(value: unknown): ProtectionIs | null {
  const raw = String(value ?? "").trim();
  if (raw === "protected" || raw === "unprotected") {
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
 * Flat is never met. Entire position means the largest protective stop
 * covers the open size. At least uses that same percent.
 */
export function protectionMet(input: {
  spec: ProtectionSpec;
  openQty: number | null;
  provenPct: number | null;
}): boolean {
  if (!(input.openQty != null && input.openQty > 0)) {
    return false;
  }
  const need = input.spec.amount === "entire" ? 100 : input.spec.pct;
  if (need == null || !(need > 0)) {
    return false;
  }
  const covered = (input.provenPct ?? 0) + 1e-6 >= need;
  return input.spec.is === "protected" ? covered : !covered;
}

export function formatProtectionLabel(spec: ProtectionSpec): string {
  const state = spec.is === "unprotected" ? "Not protected" : "Protected";
  if (spec.amount === "at_least" && spec.pct != null) {
    return `${state}, at least ${spec.pct}%`;
  }
  return `${state}, entire position`;
}
