"use client";

import type { ReactNode } from "react";

export function PageHeading({
  overline,
  title,
  as = "h1",
  className = "mb-6",
  actions,
  titleAside,
  tour,
}: {
  overline?: string;
  title: string;
  as?: "h1" | "h2";
  className?: string;
  actions?: ReactNode;
  titleAside?: ReactNode;
  tour?: string;
}) {
  const headingClass = `font-semibold tracking-tight ${
    overline ? "mt-2" : ""
  } ${as === "h2" ? "text-xl" : "text-2xl"}`;
  const heading =
    as === "h2" ? (
      <h2 className={headingClass}>{title}</h2>
    ) : (
      <h1 className={headingClass}>{title}</h1>
    );

  return (
    <div
      data-tour={tour}
      className={`flex items-end justify-between gap-3 ${className}`.trim()}
    >
      <div className="min-w-0">
        {overline ? (
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
            {overline}
          </p>
        ) : null}
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {heading}
          {titleAside}
        </div>
      </div>
      {actions ? (
        <div className="mb-0.5 flex shrink-0 flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
