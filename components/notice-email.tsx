import type { NotificationNotice } from "@/lib/notifications/copy";

export function NoticeEmail({
  notice,
  footer,
}: {
  notice: NotificationNotice;
  footer?: string;
}) {
  return (
    <div className="rounded-card border border-line bg-canvas p-5">
      <p className="text-xs uppercase tracking-[0.12em] text-ink-faint">
        Trading Bot Platform
      </p>
      <h3 className="mt-3 text-base font-semibold text-ink">{notice.subject}</h3>
      {notice.paragraphs.map((paragraph) => (
        <p key={paragraph} className="mt-2 text-sm text-ink-muted">
          {paragraph}
        </p>
      ))}
      <p className="mt-4">
        <span className="inline-block rounded-control bg-accent-strong px-3 py-1.5 text-sm font-medium text-ink">
          {notice.actionLabel}
        </span>
      </p>
      {footer ? (
        <p className="mt-4 text-xs text-ink-faint">{footer}</p>
      ) : null}
    </div>
  );
}
