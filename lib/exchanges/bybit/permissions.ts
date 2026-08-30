export type BybitApiKeyInfo = {
  readOnly?: number;
  permissions?: {
    ContractTrade?: unknown;
    Spot?: unknown;
    Wallet?: unknown;
    Derivatives?: unknown;
    Options?: unknown;
  };
};

function permissionList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

function hasNamed(list: string[], name: string): boolean {
  const needle = name.toLowerCase();
  return list.some((item) => item.toLowerCase() === needle);
}

export function judgeBybitApiKey(
  info: BybitApiKeyInfo,
): { ok: true } | { ok: false; error: string } {
  const wallet = permissionList(info.permissions?.Wallet);
  if (hasNamed(wallet, "Withdraw")) {
    return {
      ok: false,
      error:
        "That key can withdraw. Use a trade-only key with no withdrawal permission.",
    };
  }
  if (Number(info.readOnly) === 1) {
    return {
      ok: false,
      error: "That key is read-only. Use a trade key.",
    };
  }
  const spot = permissionList(info.permissions?.Spot);
  const contract = permissionList(info.permissions?.ContractTrade);
  const derivatives = permissionList(info.permissions?.Derivatives);
  const options = permissionList(info.permissions?.Options);
  const canTrade =
    hasNamed(spot, "SpotTrade") ||
    hasNamed(contract, "Order") ||
    hasNamed(contract, "Position") ||
    hasNamed(derivatives, "DerivativesTrade") ||
    hasNamed(options, "OptionsTrade");
  if (!canTrade) {
    return {
      ok: false,
      error:
        "That key cannot trade. Enable spot or derivatives trade permission.",
    };
  }
  return { ok: true };
}
