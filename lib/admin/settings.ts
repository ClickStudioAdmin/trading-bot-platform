import { cookies } from "next/headers";

export const AUTO_TICK_COOKIE = "tbp_auto_tick";

export function parseAutoTickEnabled(value: unknown): boolean {
  return String(value ?? "1") !== "0";
}

export async function loadAutoTickEnabled(): Promise<boolean> {
  const store = await cookies();
  return parseAutoTickEnabled(store.get(AUTO_TICK_COOKIE)?.value);
}
