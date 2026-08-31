import { createServiceClient } from "@/lib/supabase/admin";
import {
  parseTraderLogoPath,
  TRADER_LOGO_BUCKET,
  TRADER_LOGO_TYPES,
} from "./model";

function mimeForExt(ext: string): string | null {
  for (const [mime, mapped] of Object.entries(TRADER_LOGO_TYPES)) {
    if (mapped === ext) {
      return mime;
    }
  }
  return null;
}

export function traderLogoPublicUrl(
  path: string | null | undefined,
  updatedAt?: string | null,
): string | null {
  const parsed = parseTraderLogoPath(path);
  if (!parsed.ok || !parsed.path) {
    return null;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data } = supabase.storage
    .from(TRADER_LOGO_BUCKET)
    .getPublicUrl(parsed.path);
  const url = data.publicUrl?.trim();
  if (!url) {
    return null;
  }
  if (!updatedAt) {
    return url;
  }
  const stamp = encodeURIComponent(updatedAt);
  return url.includes("?") ? `${url}&t=${stamp}` : `${url}?t=${stamp}`;
}

export async function uploadTraderLogo(input: {
  userId: string;
  file: File;
  ext: string;
  previousPath: string | null;
}): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const mime = mimeForExt(input.ext);
  if (!mime) {
    return { ok: false, error: "Use a PNG, JPG, or WebP image." };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const path = `${input.userId}/logo.${input.ext}`;
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const { error } = await supabase.storage
    .from(TRADER_LOGO_BUCKET)
    .upload(path, bytes, {
      contentType: mime,
      upsert: true,
    });
  if (error) {
    return { ok: false, error: "Could not save the trader logo." };
  }
  if (input.previousPath && input.previousPath !== path) {
    await supabase.storage
      .from(TRADER_LOGO_BUCKET)
      .remove([input.previousPath]);
  }
  return { ok: true, path };
}

export async function removeTraderLogo(
  path: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = parseTraderLogoPath(path);
  if (!parsed.ok || !parsed.path) {
    return { ok: true };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error } = await supabase.storage
    .from(TRADER_LOGO_BUCKET)
    .remove([parsed.path]);
  if (error) {
    return { ok: false, error: "Could not remove the trader logo." };
  }
  return { ok: true };
}
