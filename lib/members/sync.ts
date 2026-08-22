import { emailIsListedAdmin } from "@/lib/admin/emails";
import { createServiceClient } from "@/lib/supabase/admin";

export async function ensureMemberRow(input: {
  userId: string;
  email: string | null;
  name?: string | null;
}): Promise<void> {
  if (!input.email) {
    return;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return;
  }
  const email = input.email.trim().toLowerCase();
  const now = new Date().toISOString();
  await supabase.from("members").upsert(
    {
      user_id: input.userId,
      email,
      name: memberDisplayName(email, input.name),
      role: emailIsListedAdmin(email) ? "admin" : "member",
      status: "active",
      created_at: now,
      updated_at: now,
    },
    { onConflict: "user_id", ignoreDuplicates: true },
  );
}

export async function syncMembersFromAuth(): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) {
    return;
  }

  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (error || !data?.users) {
    return;
  }

  for (const user of data.users) {
    const name =
      typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null;
    await ensureMemberRow({
      userId: user.id,
      email: user.email ?? null,
      name,
    });
  }
}

export function memberDisplayName(email: string, name?: string | null): string {
  const trimmed = name?.trim() ?? "";
  if (trimmed) {
    return trimmed.slice(0, 80);
  }
  const local = email.split("@")[0]?.trim() ?? "";
  return (local || "Member").slice(0, 80);
}
