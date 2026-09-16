import { writeEventLog } from "@/lib/logs/write";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  resetPasswordNotice,
  sendAuthEmail,
  verifyEmailNotice,
} from "./email";
import {
  consumeEmailToken,
  issueEmailToken,
  type EmailTokenPurpose,
} from "./email-tokens";

export async function markEmailVerified(userId: string): Promise<boolean> {
  const supabase = createServiceClient();
  if (!supabase) {
    return false;
  }
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("members")
    .update({ email_verified_at: now, updated_at: now })
    .eq("user_id", userId)
    .is("email_verified_at", null);
  return !error;
}

export async function sendMemberAuthLink(
  userId: string,
  email: string,
  purpose: EmailTokenPurpose,
): Promise<"sent" | "rate_limited" | "failed"> {
  const issued = await issueEmailToken(userId, purpose);
  if (!issued) {
    return "failed";
  }
  if ("rateLimited" in issued) {
    return "rate_limited";
  }
  const notice =
    purpose === "verify"
      ? verifyEmailNotice(issued.raw)
      : resetPasswordNotice(issued.raw);
  const sent = await sendAuthEmail({ to: email, notice });
  await writeEventLog({
    scope: "system",
    event:
      purpose === "verify" ? "member.verify_email_sent" : "member.reset_email_sent",
    message:
      purpose === "verify"
        ? "Sent email confirmation link"
        : "Sent password reset link",
    userId,
    data: { email, status: sent.ok ? "sent" : sent.error },
  });
  return sent.ok ? "sent" : "failed";
}

export async function consumeMemberAuthLink(
  raw: string,
  purpose: EmailTokenPurpose,
): Promise<{ userId: string } | null> {
  return consumeEmailToken(raw, purpose);
}
