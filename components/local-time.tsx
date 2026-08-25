"use client";

import {
  formatLocalTime,
  formatUtcDateTime,
  parseDisplayTime,
  type DisplayTimeMode,
} from "@/lib/time/display";

export function LocalTime({
  at,
  mode = "datetime",
  className,
}: {
  at: number | string | null | undefined;
  mode?: DisplayTimeMode;
  className?: string;
}) {
  const ms = parseDisplayTime(at);
  if (ms === null) {
    return <span className={className}>—</span>;
  }
  return (
    <time
      dateTime={new Date(ms).toISOString()}
      title={formatUtcDateTime(ms)}
      suppressHydrationWarning
      className={className}
    >
      {formatLocalTime(ms, mode)}
    </time>
  );
}
