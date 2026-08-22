import { emailIsListedAdmin } from "@/lib/admin/emails";
import { getSessionMember, type SessionMember } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export type AdminUser = {
  id: string;
  email: string | null;
};

export { emailIsListedAdmin, listedAdminEmails } from "@/lib/admin/emails";

export function memberIsAdmin(member: SessionMember): boolean {
  return member.role === "admin" || emailIsListedAdmin(member.email);
}

export async function getAdminUser(): Promise<AdminUser | null> {
  const member = await getSessionMember();
  if (!member || !memberIsAdmin(member)) {
    return null;
  }
  return { id: member.id, email: member.email };
}

export async function requireAdmin(): Promise<AdminUser> {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  if (!memberIsAdmin(member)) {
    redirect("/strategies");
  }
  return { id: member.id, email: member.email };
}
