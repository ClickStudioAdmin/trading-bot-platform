import type { Metadata } from "next";
import Link from "next/link";
import { NoticeEmail } from "@/components/notice-email";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getAdminUser } from "@/lib/admin/access";
import { sendTestEmailAction } from "@/lib/notifications/actions";
import { isOperatorNotificationId } from "@/lib/notifications/catalog";
import { sampleNotice } from "@/lib/notifications/copy";
import { MEMBER_EMAIL_FOOTER } from "@/lib/notifications/email";
import {
  loadPlatformLogoUrl,
  resolvePlatformEmailFrom,
} from "@/lib/notifications/email-from";
import {
  adminSettingGroups,
  NOTIFICATION_HINTS,
  NOTIFICATION_LABELS,
} from "@/lib/notifications/settings";
import { BILLING_FIELD_CLASS } from "@/lib/membership/wallet-form";
import { firstSearchValue } from "@/lib/paper/open";

export const metadata: Metadata = {
  title: "Email templates",
  description: "Locked transactional email copy.",
};

export default async function AdminEmailTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sent = firstSearchValue(params.sent) === "1";
  const error = firstSearchValue(params.error);
  const [from, admin, logoUrl] = await Promise.all([
    resolvePlatformEmailFrom(),
    getAdminUser(),
    loadPlatformLogoUrl(),
  ]);
  const groups = adminSettingGroups();
  const defaultTo = admin?.email ?? "";

  return (
    <div>
      <PageHeading overline="Admin" title="Email templates" />
      <p className="-mt-4 text-sm text-ink-muted">
        Locked copy. On/off switches stay on{" "}
        <Link
          href="/admin/settings?tab=notifications"
          className="text-accent hover:text-accent-strong"
        >
          Settings → Notifications & Alerts
        </Link>
        . Admin emails never write a member inbox row.
      </p>
      {sent ? (
        <p className="mt-6 text-sm text-success">Test email sent.</p>
      ) : null}
      {error === "to" ? (
        <p className="mt-6 text-sm text-danger">Enter a valid email address.</p>
      ) : null}
      {error === "template" ? (
        <p className="mt-6 text-sm text-danger">Choose a template.</p>
      ) : null}
      {error === "unconfigured" ? (
        <p className="mt-6 text-sm text-danger">
          Resend is not configured. Set RESEND_API_KEY on this environment.
        </p>
      ) : null}
      {error === "send" ? (
        <p className="mt-6 text-sm text-danger">
          Resend rejected the send. Check the From address and API key.
        </p>
      ) : null}
      <section className="mt-6 w-full rounded-card border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold tracking-tight">Send test email</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Sends the sample preview. Does not write an inbox row. From is{" "}
          <span className="text-ink">{from}</span>. Change that on{" "}
          <Link
            href="/admin/settings"
            className="text-accent hover:text-accent-strong"
          >
            Settings
          </Link>
          .
        </p>
        <form
          action={sendTestEmailAction}
          className="mt-4 flex flex-wrap items-end gap-3"
        >
          <label className="min-w-[12rem] flex-1 text-sm text-ink">
            Send to
            <input
              name="to"
              type="email"
              required
              defaultValue={defaultTo}
              autoComplete="email"
              className={BILLING_FIELD_CLASS}
            />
          </label>
          <label className="min-w-[12rem] flex-1 text-sm text-ink">
            Template
            <select
              name="templateId"
              required
              className={BILLING_FIELD_CLASS}
              defaultValue={groups[0]?.ids[0] ?? ""}
            >
              {groups.map((group) => (
                <optgroup key={group.id} label={group.label}>
                  {group.ids.map((id) => (
                    <option key={id} value={id}>
                      {NOTIFICATION_LABELS[id]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <PendingSubmitButton
            pendingLabel="Sending…"
            successKey="send-test-email"
            className="shrink-0 rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
          >
            Send test email
          </PendingSubmitButton>
        </form>
      </section>
      <div className="mt-8 space-y-8">
        {groups.map((group) => (
          <section key={group.id}>
            <h2 className="text-lg font-semibold tracking-tight">{group.label}</h2>
            <div className="mt-4 space-y-4">
              {group.ids.map((id) => (
                <article
                  key={id}
                  className="rounded-card border border-line bg-surface p-5"
                >
                  <p className="text-sm font-semibold text-ink">
                    {NOTIFICATION_LABELS[id]}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {NOTIFICATION_HINTS[id]}
                  </p>
                  <div className="mt-4">
                    <NoticeEmail
                      notice={sampleNotice(id)}
                      logoUrl={logoUrl}
                      footer={
                        isOperatorNotificationId(id)
                          ? undefined
                          : MEMBER_EMAIL_FOOTER
                      }
                    />
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
