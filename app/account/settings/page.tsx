import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { saveTraderProfileAction } from "@/lib/copy/actions";
import { loadTraderProfile } from "@/lib/copy/profile";
import {
  TRADER_ALIAS_MAX,
  TRADER_BIO_MAX,
} from "@/lib/copy/model";
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
  const tab =
    firstSearchValue(params.tab) === "password" || saved === "password"
      ? "password"
      : "profile";
  const trader =
    tab === "profile" ? await loadTraderProfile(member.id) : null;

  return (
    <div>
      <PageHeading title="Settings" />
      <p className="-mt-4 text-sm text-ink-muted">
        Your desk login. Sub-accounts and exchange keys stay on their own
        pages.
      </p>
      <nav
        aria-label="Settings"
        className="mt-5 flex border-b border-line"
      >
        <TabLink href="/account/settings" selected={tab === "profile"}>
          Profile
        </TabLink>
        <TabLink
          href="/account/settings?tab=password"
          selected={tab === "password"}
        >
          Password
        </TabLink>
      </nav>
      {error ? (
        <p className="mt-6 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved === "profile" ? (
        <p className="mt-6 text-sm text-success">Profile saved.</p>
      ) : null}
      {saved === "trader" ? (
        <p className="mt-6 text-sm text-success">Trader profile saved.</p>
      ) : null}
      {saved === "password" ? (
        <p className="mt-6 text-sm text-success">Password changed.</p>
      ) : null}

      {tab === "password" ? (
        <form
          action={changeOwnPassword}
          className="mt-6 space-y-4 rounded-card border border-line bg-surface p-5"
        >
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
      ) : (
        <>
        <form
          action={updateOwnProfile}
          className="mt-6 space-y-4 rounded-card border border-line bg-surface p-5"
        >
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
          action={saveTraderProfileAction}
          className="mt-6 space-y-4 rounded-card border border-line bg-surface p-5"
        >
          <div>
            <p className="text-sm text-ink">Trader profile</p>
            <p className="mt-1 text-xs text-ink-muted">
              Required before you share a desk. Other members see this alias
              and logo, never your email.
            </p>
          </div>
          <label className="block text-xs text-ink-muted">
            Alias
            <input
              name="alias"
              defaultValue={trader?.alias ?? ""}
              required
              minLength={2}
              maxLength={TRADER_ALIAS_MAX}
              autoComplete="nickname"
              className={fieldClass}
            />
            <span className="mt-1 block text-xs text-ink-faint">
              2–32 characters. Letters, numbers, spaces, _ and -. Start with a letter.
            </span>
          </label>
          <div>
            <p className="text-xs text-ink-muted">Logo</p>
            <div className="mt-1 flex items-center gap-3">
              {trader?.logoUrl ? (
                // Public trader mark stored in Supabase Storage.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={trader.logoUrl}
                  alt=""
                  width={56}
                  height={56}
                  className="size-14 shrink-0 rounded-card border border-line object-cover"
                />
              ) : (
                <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-card border border-line bg-canvas text-[11px] text-ink-faint">
                  None
                </span>
              )}
              <div className="min-w-0 flex-1">
                <input
                  type="file"
                  name="logo"
                  accept="image/png,image/jpeg,image/webp"
                  className="w-full text-sm text-ink file:mr-3 file:rounded-control file:border-0 file:bg-surface-raised file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-line"
                />
                <p className="mt-1 text-xs text-ink-faint">
                  Optional. Square PNG, JPG, or WebP. 1 MB max.
                </p>
              </div>
            </div>
            {trader?.logoPath ? (
              <label className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
                <input type="checkbox" name="removeLogo" className="mt-0.5" />
                Remove logo
              </label>
            ) : null}
          </div>
          <label className="block text-xs text-ink-muted">
            Bio
            <textarea
              name="bio"
              defaultValue={trader?.bio ?? ""}
              maxLength={TRADER_BIO_MAX}
              rows={3}
              className={fieldClass}
            />
            <span className="mt-1 block text-xs text-ink-faint">
              Optional. {TRADER_BIO_MAX} characters.
            </span>
          </label>
          <PendingSubmitButton
            pendingLabel="Saving…"
            successKey="save-trader-profile"
            className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
          >
            Save trader profile
          </PendingSubmitButton>
        </form>
        </>
      )}
    </div>
  );
}

function TabLink({
  href,
  selected,
  children,
}: {
  href: string;
  selected: boolean;
  children: string;
}) {
  return (
    <Link
      href={href}
      className={`-mb-px border-b-2 px-3 py-2 text-sm ${
        selected
          ? "border-accent text-ink"
          : "border-transparent text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
