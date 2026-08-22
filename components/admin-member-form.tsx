import { emailIsListedAdmin } from "@/lib/admin/emails";
import { createMember, updateMember } from "@/lib/members/actions";
import type { MemberFormValues } from "@/lib/members/form";

export function AdminMemberForm({
  mode,
  memberId,
  values,
}: {
  mode: "create" | "edit";
  memberId?: number;
  values: MemberFormValues;
}) {
  const locked = emailIsListedAdmin(values.email);
  const action = mode === "create" ? createMember : updateMember;

  return (
    <form action={action} className="mt-6 max-w-xl space-y-4">
      {memberId !== undefined ? (
        <input type="hidden" name="memberId" value={memberId} />
      ) : null}
      <label className="block text-xs text-ink-muted" htmlFor="name">
        Name
        <input
          id="name"
          name="name"
          defaultValue={values.name}
          required
          maxLength={80}
          className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
        />
      </label>
      <label className="block text-xs text-ink-muted" htmlFor="email">
        Email
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={values.email}
          required
          readOnly={locked}
          className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none read-only:text-ink-muted"
        />
      </label>
      <label className="block text-xs text-ink-muted" htmlFor="password">
        {mode === "create" ? "Password" : "New password"}
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required={mode === "create"}
          minLength={mode === "create" ? 8 : undefined}
          className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
        />
        <span className="mt-1 block text-xs text-ink-faint">
          {mode === "create"
            ? "At least 8 characters. This is the desk password."
            : "Leave blank to keep the current password."}
        </span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-ink-muted" htmlFor="role">
          Role
          <select
            id="role"
            name="role"
            defaultValue={values.role}
            disabled={locked}
            className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label className="block text-xs text-ink-muted" htmlFor="status">
          Status
          <select
            id="status"
            name="status"
            defaultValue={values.status}
            disabled={locked}
            className="mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
          >
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
      </div>
      {locked ? (
        <>
          <input type="hidden" name="role" value="admin" />
          <input type="hidden" name="status" value="active" />
        </>
      ) : null}
      <button
        type="submit"
        className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
      >
        {mode === "create" ? "Create member" : "Save member"}
      </button>
    </form>
  );
}
