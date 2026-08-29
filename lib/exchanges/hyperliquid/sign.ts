import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { encodeMsgpack } from "./msgpack";

export type L1Signature = {
  r: string;
  s: string;
  v: number;
};

export type L1Action = {
  type: string;
  [key: string]: unknown;
};

const ZERO_ADDRESS = new Uint8Array(20);
const DOMAIN_TYPE_HASH = keccak_256(
  new TextEncoder().encode(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
  ),
);
const AGENT_TYPE_HASH = keccak_256(
  new TextEncoder().encode("Agent(string source,bytes32 connectionId)"),
);
const DOMAIN_NAME_HASH = keccak_256(new TextEncoder().encode("Exchange"));
const DOMAIN_VERSION_HASH = keccak_256(new TextEncoder().encode("1"));

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/i, "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function encodeUint256(value: number): Uint8Array {
  const hex = BigInt(value).toString(16).padStart(64, "0");
  return hexToBytes(hex);
}

function encodeAddress(address: Uint8Array): Uint8Array {
  const out = new Uint8Array(32);
  out.set(address, 12);
  return out;
}

function uint64Bytes(value: number): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, BigInt(value));
  return out;
}

export function parseAgentSecret(raw: unknown): Uint8Array | null {
  const hex = String(raw ?? "")
    .trim()
    .replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    return null;
  }
  return hexToBytes(hex);
}

export function createL1ActionHash(input: {
  action: L1Action | Record<string, unknown>;
  nonce: number;
  vaultAddress?: string;
  expiresAfter?: number;
}): string {
  const actionBytes = encodeMsgpack(input.action as never);
  const nonceBytes = uint64Bytes(input.nonce);
  const vaultBytes = input.vaultAddress
    ? concat([Uint8Array.of(1), hexToBytes(input.vaultAddress)])
    : Uint8Array.of(0);
  const expiresBytes =
    input.expiresAfter === undefined
      ? new Uint8Array()
      : concat([Uint8Array.of(0), uint64Bytes(input.expiresAfter)]);
  const hash = keccak_256(
    concat([actionBytes, nonceBytes, vaultBytes, expiresBytes]),
  );
  return `0x${bytesToHex(hash)}`;
}

function domainSeparator(): Uint8Array {
  return keccak_256(
    concat([
      DOMAIN_TYPE_HASH,
      DOMAIN_NAME_HASH,
      DOMAIN_VERSION_HASH,
      encodeUint256(1337),
      encodeAddress(ZERO_ADDRESS),
    ]),
  );
}

function agentStructHash(source: string, connectionId: Uint8Array): Uint8Array {
  return keccak_256(
    concat([
      AGENT_TYPE_HASH,
      keccak_256(new TextEncoder().encode(source)),
      connectionId,
    ]),
  );
}

export function eip712Digest(source: string, connectionIdHex: string): Uint8Array {
  const structHash = agentStructHash(source, hexToBytes(connectionIdHex));
  return keccak_256(
    concat([Uint8Array.of(0x19, 0x01), domainSeparator(), structHash]),
  );
}

export function signL1Action(input: {
  agentKey: string;
  action: L1Action | Record<string, unknown>;
  nonce: number;
  isMainnet: boolean;
  vaultAddress?: string;
  expiresAfter?: number;
}): L1Signature | { error: string } {
  const secret = parseAgentSecret(input.agentKey);
  if (!secret) {
    return { error: "Agent private key is not a valid key." };
  }
  const connectionId = createL1ActionHash({
    action: input.action,
    nonce: input.nonce,
    vaultAddress: input.vaultAddress,
    expiresAfter: input.expiresAfter,
  });
  const digest = eip712Digest(input.isMainnet ? "a" : "b", connectionId);
  const recovered = secp256k1.sign(digest, secret, {
    prehash: false,
    lowS: true,
    format: "recovered",
  });
  const recovery = recovered[0];
  const r = recovered.slice(1, 33);
  const s = recovered.slice(33, 65);
  return {
    r: `0x${bytesToHex(r)}`,
    s: `0x${bytesToHex(s)}`,
    v: 27 + recovery,
  };
}

const lastNonce = new Map<string, number>();

export function nextActionNonce(agentAddress: string): number {
  const now = Date.now();
  const previous = lastNonce.get(agentAddress) ?? 0;
  const nonce = now > previous ? now : previous + 1;
  lastNonce.set(agentAddress, nonce);
  return nonce;
}
