import { listedAdminEmails } from "@/lib/admin/emails";
import { createServiceClient } from "@/lib/supabase/admin";

export async function loadOperatorEmails(): Promise<string[]> {
  const seen = new Set<string>();
  for (const email of listedAdminEmails()) {
    const trimmed = email.trim().toLowerCase();
    if (trimmed.includes("@")) {
      seen.add(trimmed);
    }
  }
  const supabase = createServiceClient();
  if (supabase) {
    const { data } = await supabase
      .from("members")
      .select("email")
      .eq("role", "admin")
      .eq("status", "active");
    for (const row of data ?? []) {
      const email = String(row.email ?? "")
        .trim()
        .toLowerCase();
      if (email.includes("@")) {
        seen.add(email);
      }
    }
  }
  return [...seen];
}
