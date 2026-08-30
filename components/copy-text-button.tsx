"use client";

import { useState } from "react";

export function CopyTextButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="rounded-control border border-line bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink hover:border-line-strong"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
