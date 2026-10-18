"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DESK_CREATED_REDIRECT_SECONDS,
  deskCreatedRedirectLabel,
  type DeskCreateOrigin,
} from "@/lib/accounts/model";

const primaryClass =
  "inline-flex items-center rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink hover:bg-accent";
const secondaryClass =
  "inline-flex items-center rounded-control border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink hover:border-line-strong";

export function DeskCreatedNotice({
  origin,
  deskHref,
  manageHref,
  starterError,
}: {
  origin: DeskCreateOrigin | null;
  deskHref: string;
  manageHref: string;
  starterError?: string | null;
}) {
  const router = useRouter();
  const [seconds, setSeconds] = useState(DESK_CREATED_REDIRECT_SECONDS);
  const sidebar = origin === "sidebar";

  useEffect(() => {
    if (!sidebar) {
      return;
    }
    let left = DESK_CREATED_REDIRECT_SECONDS;
    const timer = window.setInterval(() => {
      left -= 1;
      setSeconds(left);
      if (left <= 0) {
        window.clearInterval(timer);
        router.replace(deskHref);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [deskHref, router, sidebar]);

  return (
    <div className="rounded-card border border-success/30 bg-success/10 p-5">
      <p className="text-sm text-success">Desk created.</p>
      {starterError ? (
        <p className="mt-3 text-sm text-danger">{starterError}</p>
      ) : null}
      {sidebar ? (
        <p className="mt-3 text-sm text-ink" aria-live="polite">
          {deskCreatedRedirectLabel(seconds)}
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={deskHref} className={primaryClass}>
            Go to new desk
          </Link>
          <Link href={manageHref} className={secondaryClass}>
            Go to Manage Desks Page
          </Link>
        </div>
      )}
    </div>
  );
}
