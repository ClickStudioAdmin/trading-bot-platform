import type { NotificationNotice } from "@/lib/notifications/copy";

export function NoticeEmail({
  notice,
  footer,
  logoUrl,
}: {
  notice: NotificationNotice;
  footer?: string;
  logoUrl?: string | null;
}) {
  return (
    <div
      className="rounded-card border p-5"
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
          className="mb-3 h-10 w-auto max-w-[140px] object-contain"
        />
      ) : null}
      <p
        className="text-xs uppercase tracking-[0.12em]"
        style={{ color: "#6b7280" }}
      >
        Trading Bot Platform
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
      {footer ? (
        <p className="mt-4 text-xs" style={{ color: "#6b7280" }}>
          {footer}
        </p>
      ) : null}
    </div>
  );
}
