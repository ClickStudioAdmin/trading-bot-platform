import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";

export function normalizeAddress(raw: unknown): string | null {
  const value = String(raw ?? "").trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    return null;
  }
  return value.toLowerCase();
}

export function agentAddressFromPrivateKey(raw: unknown): string | null {
  const hex = String(raw ?? "")
    .trim()
    .replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    return null;
  }
  const secret = Uint8Array.from(
    hex.match(/.{2}/g)?.map((part) => Number.parseInt(part, 16)) ?? [],
  );
  if (secret.length !== 32) {
    return null;
  }
  const publicKey = secp256k1.getPublicKey(secret, false);
  const hash = keccak_256(publicKey.slice(1));
  const address = Array.from(hash.slice(12), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `0x${address}`;
}

export function hyperliquidFingerprint(agentAddress: string): string | null {
  const address = normalizeAddress(agentAddress);
  if (!address) {
    return null;
  }
  return address.slice(-4);
}
