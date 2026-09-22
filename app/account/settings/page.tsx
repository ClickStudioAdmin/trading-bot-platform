import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { LogoFileField } from "@/components/logo-file-field";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { saveTraderProfileAction } from "@/lib/copy/actions";
import { loadTraderProfile } from "@/lib/copy/profile";
import {
  COPY_FOLLOWING_UNAVAILABLE,
  TRADER_ALIAS_MAX,
  TRADER_BIO_MAX,
} from "@/lib/copy/model";
import { loadInboundCopyInvites } from "@/lib/copy/shares";
import { changeOwnPassword, updateOwnProfile } from "@/lib/members/actions";
import { saveMemberNotificationPrefsAction } from "@/lib/notifications/actions";
import { memberSettingGroups } from "@/lib/notifications/settings";
import { loadNotificationPreferences } from "@/lib/notifications/store";
import { firstSearchValue } from "@/lib/paper/open";
import { getSessionMember, readRecoveryCodesFlash } from "@/lib/auth/session";
import { totpOtpauthUrl } from "@/lib/auth/totp";
import { loadPlatformName } from "@/lib/platform/brand";
import { totpQrSvg } from "@/lib/auth/totp-qr";
import {
  decryptMemberTotpSecret,
  loadMemberTotp,
  memberTotpEnabled,
} from "@/lib/auth/totp-store";
import { MemberNotificationSettingsForm } from "@/components/notification-settings-form";
import { TotpSettings } from "@/components/totp-settings";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Profile & Settings",
  description: "Desk profile, password, Google Authenticator, and notifications.",
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
  const rawTab = firstSearchValue(params.tab);
  const tab =
    rawTab === "password" ||
    rawTab === "security" ||
    saved === "password" ||
    saved === "2fa" ||
    saved === "2fa-off" ||
    firstSearchValue(params.enroll) === "1"
      ? "password"
      : rawTab === "notifications" || saved === "notifications"
        ? "notifications"
        : "profile";
  const showPlatformSettings = member.platformMember;
  const trader =
    tab === "profile" && showPlatformSettings
      ? await loadTraderProfile(member.id)
      : null;
  const invites =
    tab === "profile" && showPlatformSettings
      ? await loadInboundCopyInvites(member.id)
      : [];

  return (
    <div>
      <PageHeading title="Profile & Settings" />
      <nav
        aria-label="Settings"
        className="mt-5 flex flex-wrap border-b border-line"
      >
        <TabLink href="/account/settings" selected={tab === "profile"}>
          Profile
        </TabLink>
        <TabLink
          href="/account/settings?tab=password"
          selected={tab === "password"}
        >
          Password & Security
        </TabLink>
        <TabLink
          href="/account/settings?tab=notifications"
          selected={tab === "notifications"}
        >
          Notifications
        </TabLink>
      </nav>
      {error ? (
        <p className="mt-6 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error === "notifications"
            ? "Could not save notification settings."
            : error}
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
      {saved === "2fa" ? (
        <p className="mt-6 text-sm text-success">
          2FA is on.
        </p>
      ) : null}
      {saved === "2fa-off" ? (
        <p className="mt-6 text-sm text-success">
          2FA is off.
        </p>
      ) : null}
      {saved === "notifications" ? (
        <p className="mt-6 text-sm text-success">Notification settings saved.</p>
      ) : null}

      {tab === "notifications" ? (
        <NotificationSettingsTab
          affiliateOnly={!showPlatformSettings}
          userId={member.id}
        />
      ) : tab === "password" ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
          <form
            action={changeOwnPassword}
            className="space-y-4 rounded-card border border-line bg-surface p-5"
          >
            <div>
              <p className="text-lg font-semibold tracking-tight">Password</p>
              <p className="mt-1 text-xs text-ink-muted">
                Change the password for this login.
              </p>
            </div>
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
              <span className="mt-1 block text-hint text-ink-faint">
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
          <SecuritySettingsTab email={member.email} userId={member.id} />
        </div>
      ) : (
        <>
        <div
          className={
            showPlatformSettings
              ? "mt-6 grid gap-6 lg:grid-cols-2 lg:items-start"
              : "mt-6"
          }
        >
        <form
          action={updateOwnProfile}
          className="space-y-4 rounded-card border border-line bg-surface p-5"
        >
          <div>
            <p className="text-lg font-semibold tracking-tight">Account Holder</p>
            <p className="mt-1 text-xs text-ink-muted">
              Name and login email for this account.
            </p>
          </div>
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
            <span className="mt-1 block text-hint text-ink-faint">
              Email is the login. An admin can change it from Members.
            </span>
          </label>
          <div>
            <PendingSubmitButton
              pendingLabel="Saving…"
              successKey="save-profile"
              className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
            >
              Save profile
            </PendingSubmitButton>
          </div>
        </form>
        {showPlatformSettings ? (
        <form
          action={saveTraderProfileAction}
          className="space-y-4 rounded-card border border-line bg-surface p-5"
        >
          <div>
            <p className="text-lg font-semibold tracking-tight">Trader Profile</p>
            <p className="mt-1 text-xs text-ink-muted">
              Required before you share a desk. Other members see this alias
              and logo, never your email. This is not your affiliate alias —
              that lives on Affiliates → Settings.
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
            <span className="mt-1 block text-hint text-ink-faint">
              2–32 characters. Letters, numbers, spaces, _ and -. Start with a letter.
            </span>
          </label>
          <div>
            <p className="text-xs text-ink-muted">Logo</p>
            <LogoFileField
              name="logo"
              currentUrl={trader?.logoUrl ?? null}
              removeName={trader?.logoPath ? "removeLogo" : undefined}
              hint="Optional. Square PNG, JPG, or WebP. 1 MB max."
            />
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
            <span className="mt-1 block text-hint text-ink-faint">
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
        ) : null}
        </div>
        {showPlatformSettings && invites.length > 0 ? (
          <section className="mt-6 space-y-3 rounded-card border border-line bg-surface p-5">
            <div>
              <p className="text-lg font-semibold tracking-tight">Copy invites</p>
              <p className="mt-1 text-xs text-ink-muted">
                Private grants to follow another desk. They also appear on{" "}
                <Link href="/account/copy" className="text-accent">
                  Copy desks
                </Link>
                . Creating a copy desk is next.
              </p>
            </div>
            <ul className="space-y-2">
              {invites.map((row) => (
                <li
                  key={row.share.id}
                  className="rounded-control border border-line px-3 py-2"
                >
                  <p className="text-sm text-ink">
                    {row.traderAlias ?? "Trader"} · {row.parentName}
                  </p>
                  <p className="mt-1 text-hint text-ink-faint">
                    {row.share.status === "active" ? "Following" : "Invited"}
                    {row.sharingEnabled
                      ? ""
                      : ` · ${COPY_FOLLOWING_UNAVAILABLE}`}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        </>
      )}
    </div>
  );
}

async function SecuritySettingsTab({
  email,
  userId,
}: {
  email: string;
  userId: string;
}) {
  const totp = await loadMemberTotp(userId);
  const enabled = memberTotpEnabled(totp);
  const recoveryCodes = await readRecoveryCodesFlash();
  const pendingSecret =
    !enabled && totp ? decryptMemberTotpSecret(totp) : null;
  const issuer = await loadPlatformName();
  const pending =
    pendingSecret != null
      ? {
          secret: pendingSecret,
          qrSvg: await totpQrSvg(totpOtpauthUrl(email, pendingSecret, issuer)),
        }
      : null;
  return (
    <TotpSettings
      enabled={enabled}
      pending={pending}
      recoveryCodes={recoveryCodes}
    />
  );
}

async function NotificationSettingsTab({
  affiliateOnly,
  userId,
}: {
  affiliateOnly: boolean;
  userId: string;
}) {
  const prefs = await loadNotificationPreferences(userId);
  return (
    <MemberNotificationSettingsForm
      groups={memberSettingGroups(affiliateOnly)}
      prefs={prefs}
      action={saveMemberNotificationPrefsAction}
    />
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
