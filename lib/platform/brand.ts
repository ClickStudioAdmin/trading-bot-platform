import {
  parsePlatformLogoPath,
  platformLogoPublicUrl,
  removePlatformLogo,
  uploadPlatformLogo,
} from "@/lib/copy/logo";
import {
  TRADER_LOGO_MAX_BYTES,
  TRADER_LOGO_TYPES,
} from "@/lib/copy/model";
import {
  DEFAULT_SYSTEM_FROM,
  emailFromMailbox,
  parseEmailFrom,
  parsePlatformLogoUrl,
} from "@/lib/notifications/email-from";
import { createServiceClient } from "@/lib/supabase/admin";

export const DEFAULT_PLATFORM_NAME = "Trading Bot Platform";

export type PlatformBrand = {
  name: string;
  from: string;
  mailbox: string;
  logoPath: string | null;
  logoUrl: string | null;
};

export function parsePlatformName(value: unknown): string | null {
  const name = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 80) {
    return null;
  }
  if (/[<>:]/.test(name)) {
    return null;
  }
  return name;
}

export function parsePlatformLogoUpload(value: {
  name?: unknown;
  type?: unknown;
  size?: unknown;
} | null): { ok: true; ext: string | null } | { ok: false; error: string } {
  if (value == null) {
    return { ok: true, ext: null };
  }
  const name = String(value.name ?? "").trim();
  const type = String(value.type ?? "").trim().toLowerCase();
  const size = Number(value.size ?? 0);
  if (!name && (!Number.isFinite(size) || size <= 0)) {
    return { ok: true, ext: null };
  }
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: true, ext: null };
  }
  if (size > TRADER_LOGO_MAX_BYTES) {
    return { ok: false, error: "Platform logo must be 1 MB or smaller." };
  }
  const ext = TRADER_LOGO_TYPES[type as keyof typeof TRADER_LOGO_TYPES];
  if (!ext) {
    return { ok: false, error: "Use a PNG, JPG, or WebP image." };
  }
  return { ok: true, ext };
}

export function composeEmailFrom(
  name: string,
  fromOrMailbox: string | null | undefined,
): string {
  const parsed = parseEmailFrom(fromOrMailbox);
  const mailbox = emailFromMailbox(parsed ?? DEFAULT_SYSTEM_FROM);
  return `${name} <${mailbox}>`;
}

type PlatformSettingsRow = {
  platform_name?: unknown;
  email_from?: unknown;
  platform_logo_path?: unknown;
  platform_logo_url?: unknown;
  updated_at?: unknown;
};

export async function loadPlatformBrand(): Promise<PlatformBrand> {
  const fallback: PlatformBrand = {
    name: DEFAULT_PLATFORM_NAME,
    from: DEFAULT_SYSTEM_FROM,
    mailbox: emailFromMailbox(DEFAULT_SYSTEM_FROM),
    logoPath: null,
    logoUrl: null,
  };
  const supabase = createServiceClient();
  if (!supabase) {
    return fallback;
  }
  const { data, error } = await supabase
    .from("platform_settings")
    .select(
      "platform_name, email_from, platform_logo_path, platform_logo_url, updated_at",
    )
    .eq("id", "tbp")
    .maybeSingle();
  if (error || !data) {
    return fallback;
  }
  const row = data as PlatformSettingsRow;
  const name =
    parsePlatformName(row.platform_name) ?? DEFAULT_PLATFORM_NAME;
  const storedFrom = parseEmailFrom(row.email_from);
  const from = composeEmailFrom(name, storedFrom ?? process.env.EMAIL_FROM);
  const parsedLogo = parsePlatformLogoPath(row.platform_logo_path);
  const logoPath = parsedLogo.ok ? parsedLogo.path : null;
  const updatedAt =
    typeof row.updated_at === "string" ? row.updated_at : null;
  return {
    name,
    from,
    mailbox: emailFromMailbox(from),
    logoPath,
    logoUrl:
      platformLogoPublicUrl(logoPath, updatedAt) ??
      parsePlatformLogoUrl(row.platform_logo_url),
  };
}

export async function loadPlatformName(): Promise<string> {
  return (await loadPlatformBrand()).name;
}

export async function loadPlatformLogoUrl(): Promise<string | null> {
  return (await loadPlatformBrand()).logoUrl;
}

export async function savePlatformIdentity(input: {
  name: unknown;
  emailFrom: unknown;
  file: File | null;
  removeLogo: boolean;
}): Promise<
  | { ok: true; brand: PlatformBrand }
  | { ok: false; error: string; field: "name" | "email-from" | "platform-logo" }
> {
  const name = parsePlatformName(input.name);
  if (!name) {
    return {
      ok: false,
      field: "name",
      error:
        "Enter a platform name, 1–80 characters, without : < or >.",
    };
  }
  const mailbox = parseEmailFrom(input.emailFrom);
  if (!mailbox) {
    return {
      ok: false,
      field: "email-from",
      error: "Enter a From address, for example you@domain.",
    };
  }
  const from = composeEmailFrom(name, mailbox);
  const existing = await loadPlatformBrand();
  const upload = parsePlatformLogoUpload(
    input.file instanceof File ? input.file : null,
  );
  if (!upload.ok) {
    return { ok: false, field: "platform-logo", error: upload.error };
  }
  let logoPath = existing.logoPath;
  if (upload.ext && input.file instanceof File) {
    const stored = await uploadPlatformLogo({
      file: input.file,
      ext: upload.ext,
      previousPath: logoPath,
    });
    if (!stored.ok) {
      return { ok: false, field: "platform-logo", error: stored.error };
    }
    logoPath = stored.path;
  } else if (input.removeLogo && logoPath) {
    const removed = await removePlatformLogo(logoPath);
    if (!removed.ok) {
      return { ok: false, field: "platform-logo", error: removed.error };
    }
    logoPath = null;
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return {
      ok: false,
      field: "email-from",
      error: "Database is not configured.",
    };
  }
  const { error } = await supabase.from("platform_settings").upsert({
    id: "tbp",
    platform_name: name,
    email_from: from,
    platform_logo_path: logoPath,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    return {
      ok: false,
      field: "email-from",
      error: "Could not save platform settings.",
    };
  }
  return { ok: true, brand: await loadPlatformBrand() };
}
