import type { MemberRole, MemberStatus } from "@/lib/members/form";

export type MemberRow = {
  id: number;
  userId: string;
  email: string;
  name: string;
  role: MemberRole;
  status: MemberStatus;
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
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
