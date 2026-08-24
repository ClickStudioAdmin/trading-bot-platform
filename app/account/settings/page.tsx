import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { changeOwnPassword, updateOwnProfile } from "@/lib/members/actions";
import { firstSearchValue } from "@/lib/paper/open";
import { getSessionMember } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Settings",
  description: "Desk profile and password.",
};

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await getSessionMember();
  if (!member) {
    redirect("/sign-in");
  }
  const params = await searchParams;
  const error = firstSearchValue(params.error);
  const saved = firstSearchValue(params.saved);

  return (
    <div>
      <PageHeading title="Settings" />
      <p className="-mt-4 mb-6 text-sm text-ink-muted">
        Your desk login. Sub-accounts and exchange keys stay on their own
        pages.
      </p>
      {error ? (
        <p className="mb-6 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved === "profile" ? (
        <p className="mb-6 text-sm text-success">Profile saved.</p>
      ) : null}
      {saved === "password" ? (
        <p className="mb-6 text-sm text-success">Password changed.</p>
      ) : null}

      <form
        action={updateOwnProfile}
        className="space-y-4 rounded-card border border-line bg-surface p-5"
      >
        <h2 className="text-lg font-semibold tracking-tight">Profile</h2>
        <label className="block text-xs text-ink-muted">
          Name
          <input
            name="name"
            defaultValue={member.name}
            required
            maxLength={80}
            autoComplete="name"
            className={fieldClass}
          />
        </label>
        <label className="block text-xs text-ink-muted">
          Email
          <input
            type="email"
            value={member.email}
            readOnly
            autoComplete="username"
            className={`${fieldClass} text-ink-muted`}
          />
          <span className="mt-1 block text-xs text-ink-faint">
            Email is the login. An admin can change it from Members.
          </span>
        </label>
        <PendingSubmitButton
          pendingLabel="Saving…"
          successKey="save-profile"
          className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
        >
          Save profile
        </PendingSubmitButton>
      </form>

      <form
        action={changeOwnPassword}
        className="mt-6 space-y-4 rounded-card border border-line bg-surface p-5"
      >
        <h2 className="text-lg font-semibold tracking-tight">Password</h2>
        <label className="block text-xs text-ink-muted">
          Current password
          <input
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            className={fieldClass}
          />
        </label>
        <label className="block text-xs text-ink-muted">
          New password
          <input
            name="newPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={fieldClass}
          />
        </label>
        <label className="block text-xs text-ink-muted">
          Confirm new password
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={fieldClass}
          />
          <span className="mt-1 block text-xs text-ink-faint">
            At least 8 characters.
          </span>
        </label>
        <PendingSubmitButton
          pendingLabel="Saving…"
          successKey="save-password"
          className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
        >
          Change password
        </PendingSubmitButton>
      </form>
    </div>
  );
}
