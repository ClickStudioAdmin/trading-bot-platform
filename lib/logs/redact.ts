const SECRET_KEY = /secret|password|token|key|authorization|cookie/i;
const MAX_DEPTH = 4;
const MAX_STRING = 400;

export function redactLogData(
  value: unknown,
  depth = 0,
): Record<string, unknown> {
  const redacted = redactValue(value, depth);
  if (redacted && typeof redacted === "object" && !Array.isArray(redacted)) {
    return redacted as Record<string, unknown>;
  }
  return { value: redacted };
}

function redactValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) {
    return "[truncated]";
  }
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redactValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEY.test(key) ? "[redacted]" : redactValue(item, depth + 1);
    }
    return out;
  }
  return String(value);
}

export function isSafeEventName(event: string): boolean {
  return /^[a-z][a-z0-9._-]{0,63}$/.test(event);
}
