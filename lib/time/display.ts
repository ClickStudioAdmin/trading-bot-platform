export type DisplayTimeMode = "date" | "datetime" | "datetime-short";

export function parseDisplayTime(
  at: number | string | null | undefined,
): number | null {
  if (at === null || at === undefined || at === "") {
    return null;
  }
  const ms = typeof at === "number" ? at : Date.parse(at);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatUtcDateTime(ms: number): string {
  return `${new Date(ms).toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

export function formatLocalDate(ms: number): string {
  const date = new Date(ms);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatAuDateUtc(ms: number): string {
  const date = new Date(ms);
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
}

export function formatLocalDateTime(ms: number): string {
  const date = new Date(ms);
  return `${formatLocalDate(ms)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatLocalDateTimeShort(ms: number): string {
  const date = new Date(ms);
  return `${formatLocalDate(ms)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatLocalTime(
  ms: number,
  mode: DisplayTimeMode = "datetime",
): string {
  if (mode === "date") {
    return formatLocalDate(ms);
  }
  if (mode === "datetime-short") {
    return formatLocalDateTimeShort(ms);
  }
  return formatLocalDateTime(ms);
}
