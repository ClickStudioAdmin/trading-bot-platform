import { emailIsListedAdmin } from "@/lib/admin/emails";

export type MemberRole = "member" | "admin";
export type MemberStatus = "active" | "disabled";

export type MemberFormValues = {
  name: string;
  email: string;
  password: string;
  role: MemberRole;
  status: MemberStatus;
};

export type ParsedMemberForm =
  | { ok: true; values: MemberFormValues }
  | { ok: false; error: string };

export function parseMemberForm(
  formData: FormData,
  mode: "create" | "edit",
): ParsedMemberForm {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const roleRaw = String(formData.get("role") ?? "");
  const statusRaw = String(formData.get("status") ?? "");

  if (name.length < 1 || name.length > 80) {
    return { ok: false, error: "Enter a name up to 80 characters." };
  }
  if (!isEmail(email)) {
    return { ok: false, error: "Enter a valid email." };
  }
  if (mode === "create" && password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (mode === "edit" && password.length > 0 && password.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters." };
  }
  if (roleRaw !== "member" && roleRaw !== "admin") {
    return { ok: false, error: "Choose a role." };
  }
  if (statusRaw !== "active" && statusRaw !== "disabled") {
    return { ok: false, error: "Choose a status." };
  }

  let role: MemberRole = roleRaw;
  let status: MemberStatus = statusRaw;
  if (emailIsListedAdmin(email)) {
    role = "admin";
    status = "active";
  }

  return {
    ok: true,
    values: { name, email, password, role, status },
  };
}

export function parseOwnProfile(
  formData: FormData,
): { ok: true; name: string } | { ok: false; error: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 80) {
    return { ok: false, error: "Enter a name up to 80 characters." };
  }
  return { ok: true, name };
}

export function parseOwnPasswordChange(
  formData: FormData,
):
  | { ok: true; current: string; next: string }
  | { ok: false; error: string } {
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (current.length < 1) {
    return { ok: false, error: "Enter your current password." };
  }
  if (next.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters." };
  }
  if (next !== confirm) {
    return { ok: false, error: "New password and confirmation do not match." };
  }
  if (current === next) {
    return { ok: false, error: "Choose a different password." };
  }
  return { ok: true, current, next };
}

export function parseMemberId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 160;
}
