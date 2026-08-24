import { createHmac } from "node:crypto";

export function bybitSignPayload(input: {
  timestamp: string;
  apiKey: string;
  recvWindow: string;
  query: string;
}): string {
  return `${input.timestamp}${input.apiKey}${input.recvWindow}${input.query}`;
}

export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}
