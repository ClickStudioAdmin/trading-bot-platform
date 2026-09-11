import type { MemberRole, MemberStatus } from "@/lib/members/form";

export type MemberRow = {
  id: number;
  userId: string;
  email: string;
  name: string;
  role: MemberRole;
  status: MemberStatus;
  planId: string;
  createdAt: string;
  updatedAt: string;
};

export function parseMemberRow(row: Record<string, unknown>): MemberRow {
  const role = row.role === "admin" ? "admin" : "member";
  const status = row.status === "disabled" ? "disabled" : "active";
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    email: String(row.email),
    name: String(row.name),
    role,
    status,
    planId: typeof row.plan_id === "string" ? row.plan_id : "",
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
