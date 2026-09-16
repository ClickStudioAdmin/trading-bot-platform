import type { Metadata } from "next";
import Link from "next/link";
import { NoticeEmail } from "@/components/notice-email";
import { PageHeading } from "@/components/page-heading";
import { isOperatorNotificationId } from "@/lib/notifications/catalog";
import { sampleNotice } from "@/lib/notifications/copy";
import { MEMBER_EMAIL_FOOTER } from "@/lib/notifications/email";
import {
  adminSettingGroups,
  NOTIFICATION_HINTS,
  NOTIFICATION_LABELS,
} from "@/lib/notifications/settings";

export const metadata: Metadata = {
  title: "Email templates",
  description: "Locked transactional email copy.",
};

export default function AdminEmailTemplatesPage() {
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
      <div className="mt-8 space-y-8">
        {adminSettingGroups().map((group) => (
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
