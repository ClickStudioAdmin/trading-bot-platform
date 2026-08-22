"use server";

import { createServiceClient } from "@/lib/supabase/admin";
import { createUserClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createUserClient();

  if (!supabase) {
    redirect(
      "/sign-in?error=Auth%20is%20not%20configured.%20Set%20NEXT_PUBLIC_SUPABASE_URL%20and%20NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  const service = createServiceClient();
  if (service && data.user) {
    const { data: member } = await service
      .from("members")
      .select("status")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (member?.status === "disabled") {
      await supabase.auth.signOut();
      redirect("/sign-in?error=This%20account%20is%20disabled.");
    }
  }

  redirect("/strategies/cash-and-carry");
}

export async function signOut() {
  const supabase = await createUserClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/sign-in");
}
