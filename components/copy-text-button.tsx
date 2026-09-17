"use client";

import { useState } from "react";
import { IconCheck, IconCopy } from "@/components/icons";
import { TABLE_BTN_ICON, TableIconAction } from "@/components/table-chrome";

export function CopyTextButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <TableIconAction
      label={copied ? "Copied" : label}
      detail={
        copied ? "Copied to the clipboard." : "Copy this to the clipboard."
      }
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? (
        <IconCheck {...TABLE_BTN_ICON} />
      ) : (
        <IconCopy {...TABLE_BTN_ICON} />
      )}
    </TableIconAction>
  );
}
