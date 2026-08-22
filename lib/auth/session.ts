import { cookies } from "next/headers";
import {
  parseSessionToken,
  SESSION_COOKIE,
  SESSION_DAYS,
  sessionSecret,
  signSessionToken,
} from "@/lib/auth/token";
import type { MemberRole, MemberStatus } from "@/lib/members/form";
import { createServiceClient } from "@/lib/supabase/admin";

export type SessionMember = {
  id: string;
  email: string;
  name: string;
  role: MemberRole;
  status: MemberStatus;
};

export async function getSessionMember(): Promise<SessionMember | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  const parsed = parseSessionToken(token);
  if (!parsed) {
    return null;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("members")
    .select("user_id, email, name, role, status")
    .eq("user_id", parsed.userId)
    .maybeSingle();
  if (error || !data || data.status === "disabled") {
    return null;
  }
  return {
    id: String(data.user_id),
    email: String(data.email),
    name: String(data.name),
    role: data.role === "admin" ? "admin" : "member",
    status: data.status === "disabled" ? "disabled" : "active",
  };
}

export async function createSession(userId: string): Promise<void> {
  if (!sessionSecret()) {
    throw new Error("Session secret is not configured.");
  }
  const expiresAtMs = Date.now() + SESSION_DAYS * 86_400_000;
  const store = await cookies();
  store.set(SESSION_COOKIE, signSessionToken(userId, expiresAtMs), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAtMs),
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
