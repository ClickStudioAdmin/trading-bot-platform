import { createServiceClient } from "@/lib/supabase/admin";

export const DEFAULT_SYSTEM_FROM =
  "Trading Bot Platform <system@alphadesks.app>";
export const DEFAULT_TEST_INBOX = "system@alphadesks.app";

const MAILBOX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseMailbox(value: unknown): string | null {
  const email = String(value ?? "")
    .trim()
    .toLowerCase();
  if (
    email.length < 3 ||
    email.length > 160 ||
    email.includes("<") ||
    email.includes(">") ||
    !MAILBOX.test(email)
  ) {
    return null;
  }
  return email;
}

export function parseEmailFrom(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (raw.length < 3 || raw.length > 200) {
    return null;
  }
  const angled = raw.match(/^(.+?)\s*<([^<>]+)>$/);
  if (angled) {
    const name = angled[1].trim();
    const email = parseMailbox(angled[2]);
    if (!name || name.length > 80 || !email) {
      return null;
    }
    return `${name} <${email}>`;
  }
  return parseMailbox(raw);
}

export function resolveEmailFrom(input: {
  stored?: string | null;
  env?: string | null;
}): string {
  return (
    parseEmailFrom(input.stored) ??
    parseEmailFrom(input.env) ??
    DEFAULT_SYSTEM_FROM
  );
}

export async function loadStoredEmailFrom(): Promise<string | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("platform_settings")
    .select("email_from")
    .eq("id", "tbp")
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return parseEmailFrom((data as { email_from?: unknown }).email_from);
}

export async function resolvePlatformEmailFrom(): Promise<string> {
  return resolveEmailFrom({
    stored: await loadStoredEmailFrom(),
    env: process.env.EMAIL_FROM,
  });
}

export async function saveEmailFrom(
  value: string,
): Promise<{ ok: true; from: string } | { ok: false; error: string }> {
  const from = parseEmailFrom(value);
  if (!from) {
    return { ok: false, error: "Enter a From address, for example Name <you@domain>." };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error } = await supabase.from("platform_settings").upsert({
    id: "tbp",
    email_from: from,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    return { ok: false, error: "Could not save the From address." };
  }
  return { ok: true, from };
}
