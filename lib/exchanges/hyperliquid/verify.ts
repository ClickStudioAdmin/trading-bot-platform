import {
  agentAddressFromPrivateKey,
  normalizeAddress,
} from "./agent";
import { hyperliquidInfoUrl } from "./host";

export { hyperliquidInfoUrl } from "./host";

export async function verifyHyperliquidCredentials(
  environmentId: string,
  credentials: Record<string, string>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const account = normalizeAddress(credentials.accountAddress);
  const agent = agentAddressFromPrivateKey(credentials.agentKey);
  if (!account) {
    return { ok: false, error: "Account address must be a 0x wallet address." };
  }
  if (!agent) {
    return { ok: false, error: "Agent private key is not a valid key." };
  }
  if (account === agent) {
    return {
      ok: false,
      error: "Use an approved agent key, not the account key.",
    };
  }
  const url = hyperliquidInfoUrl(environmentId);
  if (!url) {
    return { ok: false, error: "Unknown Hyperliquid network." };
  }
  let agents: unknown;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "extraAgents", user: account }),
    });
    if (!res.ok) {
      return { ok: false, error: "Could not reach Hyperliquid." };
    }
    agents = await res.json();
  } catch {
    return { ok: false, error: "Could not reach Hyperliquid." };
  }
  if (!Array.isArray(agents)) {
    return { ok: false, error: "Could not read Hyperliquid agents." };
  }
  const approved = agents.some((row) => {
    const address = normalizeAddress(
      row && typeof row === "object"
        ? (row as { address?: unknown }).address
        : null,
    );
    return address === agent;
  });
  if (!approved) {
    return {
      ok: false,
      error:
        "That agent is not approved for this account on this network. Approve it in Hyperliquid first.",
    };
  }
  return { ok: true };
}
