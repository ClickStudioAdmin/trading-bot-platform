import { english, generateMnemonic, mnemonicToAccount } from "viem/accounts";
import { isAddress } from "viem";

export function createDepositMnemonic(): string {
  return generateMnemonic(english);
}

export function deriveDepositAddress(
  mnemonic: string,
  index: number,
): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error("Derivation index must be a non-negative integer.");
  }
  const account = mnemonicToAccount(mnemonic.trim(), { addressIndex: index });
  return account.address.toLowerCase();
}

export function deriveDepositAccount(mnemonic: string, index: number) {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error("Derivation index must be a non-negative integer.");
  }
  return mnemonicToAccount(mnemonic.trim(), { addressIndex: index });
}

export function normalizeEvmAddress(value: string): string | null {
  const raw = value.trim();
  if (!isAddress(raw, { strict: false })) {
    return null;
  }
  return raw.toLowerCase();
}

export function isEvmAddress(value: unknown): value is string {
  return typeof value === "string" && isAddress(value, { strict: false });
}
