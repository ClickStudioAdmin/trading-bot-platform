import Link from "next/link";
import type { NotificationNotice } from "@/lib/notifications/copy";
import {
  MEMBER_EMAIL_FOOTER,
  MEMBER_NOTIFICATIONS_PATH,
} from "@/lib/notifications/email";
import { DEFAULT_PLATFORM_NAME } from "@/lib/platform/brand";

export function NoticeEmail({
  notice,
  footer,
  logoUrl,
  brand = DEFAULT_PLATFORM_NAME,
}: {
  notice: NotificationNotice;
  footer?: string;
  logoUrl?: string | null;
  brand?: string;
}) {
  return (
    <div
      className="w-full rounded-card border p-5"
      style={{
        background: "#ffffff",
        borderColor: "#e5e7eb",
        color: "#111827",
      }}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className="mb-3 h-8 w-auto max-w-[96px] object-contain"
        />
      ) : null}
      <p
        className="text-xs uppercase tracking-[0.12em]"
        style={{ color: "#6b7280" }}
      >
        {brand}
      </p>
      <h3 className="mt-3 text-base font-semibold" style={{ color: "#111827" }}>
        {notice.subject}
      </h3>
      {notice.paragraphs.map((paragraph) => (
        <p
          key={paragraph}
          className="mt-2 text-sm"
          style={{ color: "#4b5563" }}
        >
          {paragraph}
        </p>
      ))}
      <p className="mt-4">
        <span
          className="inline-block rounded-control px-3 py-1.5 text-sm font-medium"
          style={{ background: "#8b6cf6", color: "#ffffff" }}
        >
          {notice.actionLabel}
        </span>
      </p>
      {footer === MEMBER_EMAIL_FOOTER ? (
        <p className="mt-4 text-xs" style={{ color: "#6b7280" }}>
          You can modify your email preferences on Account Settings →{" "}
          <Link
            href={MEMBER_NOTIFICATIONS_PATH}
            className="underline"
            style={{ color: "#8b6cf6" }}
          >
            Notifications
          </Link>
          .
        </p>
      ) : footer ? (
        <p className="mt-4 text-xs" style={{ color: "#6b7280" }}>
          {footer}
        </p>
      ) : null}
    </div>
  );
}
