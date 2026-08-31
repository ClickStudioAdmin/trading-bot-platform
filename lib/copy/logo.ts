import { createServiceClient } from "@/lib/supabase/admin";
import {
  DESK_LOGO_BUCKET,
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

function ownedLogoPublicUrl(
  bucket: string,
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
  const { data } = supabase.storage.from(bucket).getPublicUrl(parsed.path);
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

async function uploadOwnedLogo(input: {
  bucket: string;
  ownerId: string;
  file: File;
  ext: string;
  previousPath: string | null;
  error: string;
}): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const mime = mimeForExt(input.ext);
  if (!mime) {
    return { ok: false, error: "Use a PNG, JPG, or WebP image." };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const path = `${input.ownerId}/logo.${input.ext}`;
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const { error } = await supabase.storage.from(input.bucket).upload(path, bytes, {
    contentType: mime,
    upsert: true,
  });
  if (error) {
    return { ok: false, error: input.error };
  }
  if (input.previousPath && input.previousPath !== path) {
    await supabase.storage.from(input.bucket).remove([input.previousPath]);
  }
  return { ok: true, path };
}

async function removeOwnedLogo(
  bucket: string,
  path: string | null,
  error: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = parseTraderLogoPath(path);
  if (!parsed.ok || !parsed.path) {
    return { ok: true };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error: removed } = await supabase.storage
    .from(bucket)
    .remove([parsed.path]);
  if (removed) {
    return { ok: false, error };
  }
  return { ok: true };
}

export function traderLogoPublicUrl(
  path: string | null | undefined,
  updatedAt?: string | null,
): string | null {
  return ownedLogoPublicUrl(TRADER_LOGO_BUCKET, path, updatedAt);
}

export async function uploadTraderLogo(input: {
  userId: string;
  file: File;
  ext: string;
  previousPath: string | null;
}): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  return uploadOwnedLogo({
    bucket: TRADER_LOGO_BUCKET,
    ownerId: input.userId,
    file: input.file,
    ext: input.ext,
    previousPath: input.previousPath,
    error: "Could not save the trader logo.",
  });
}

export async function removeTraderLogo(
  path: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return removeOwnedLogo(
    TRADER_LOGO_BUCKET,
    path,
    "Could not remove the trader logo.",
  );
}

export function deskLogoPublicUrl(
  path: string | null | undefined,
  updatedAt?: string | null,
): string | null {
  return ownedLogoPublicUrl(DESK_LOGO_BUCKET, path, updatedAt);
}

export async function uploadDeskLogo(input: {
  accountId: string;
  file: File;
  ext: string;
  previousPath: string | null;
}): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  return uploadOwnedLogo({
    bucket: DESK_LOGO_BUCKET,
    ownerId: input.accountId,
    file: input.file,
    ext: input.ext,
    previousPath: input.previousPath,
    error: "Could not save the desk logo.",
  });
}

export async function removeDeskLogo(
  path: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return removeOwnedLogo(
    DESK_LOGO_BUCKET,
    path,
    "Could not remove the desk logo.",
  );
}
