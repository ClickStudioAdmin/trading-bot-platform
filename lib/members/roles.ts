import type { MemberRole } from "@/lib/members/form";

export type MembersAreaTab = "members" | "roles";

export type MemberRoleCredential = {
  role: MemberRole;
  label: string;
  credentials: readonly string[];
};

/** Display-only access for each login role. Editing a person stays on the member form. */
export const MEMBER_ROLE_CREDENTIALS: readonly MemberRoleCredential[] = [
  {
    role: "member",
    label: "Member",
    credentials: [
      "Create desks on Beta and Live exchanges.",
      "In Development and Testing exchanges stay hidden, including on desk creation.",
      "One exchange key binds to one desk.",
    ],
  },
  {
    role: "developer",
    label: "Developer",
    credentials: [
      "Create desks on Beta and Live exchanges.",
      "See and use In Development and Testing exchanges and modes.",
      "One exchange key binds to one desk.",
      "The admin area stays closed.",
    ],
  },
  {
    role: "admin",
    label: "Admin",
    credentials: [
      "See and use In Development and Testing exchanges and modes.",
      "Open the admin area, including members, exchanges, plans, and settings.",
      "One exchange key can bind to more than one desk.",
      "Draft membership plans are visible.",
    ],
  },
];

export function parseMembersAreaTab(
  value: string | null | undefined,
): MembersAreaTab {
  return value === "roles" ? "roles" : "members";
}
