"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CreateAccountForm } from "@/components/create-account-form";
import { switchTradingAccount } from "@/lib/accounts/actions";
import {
  formatAccountMode,
  formatDeskType,
  type TradingAccount,
} from "@/lib/accounts/model";
import type { ExchangeConnection } from "@/lib/exchanges/connections";

export function DeskSwitcher({
  current,
  desks,
  connections,
}: {
  current: TradingAccount;
  desks: TradingAccount[];
  connections: ExchangeConnection[];
}) {
  const rootRef = useRef<HTMLDetailsElement>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    function closeMenu() {
      if (rootRef.current) {
        rootRef.current.open = false;
      }
    }
    function onPointerDown(event: PointerEvent) {
      const root = rootRef.current;
      if (!root?.open) {
        return;
      }
      if (!root.contains(event.target as Node)) {
        closeMenu();
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !creating) {
        closeMenu();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [creating]);

  function openCreate() {
    if (rootRef.current) {
      rootRef.current.open = false;
    }
    setCreating(true);
  }

  return (
    <>
      <details ref={rootRef} className="relative min-w-0">
        <summary
          aria-haspopup="menu"
          aria-label={`Desk: ${current.name}`}
          className="flex max-w-[11rem] cursor-pointer list-none items-center gap-1.5 rounded-control border border-line px-3 py-1.5 text-sm text-ink hover:bg-surface-raised sm:max-w-[16rem] [&::-webkit-details-marker]:hidden"
        >
          <span className="truncate">{current.name}</span>
          <svg
            viewBox="0 0 12 12"
            className="size-3 shrink-0 text-ink-faint"
            aria-hidden
          >
            <path
              d="M3 4.5 6 8l3-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </summary>
        <div className="absolute left-1/2 z-30 mt-2 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 rounded-card border border-line bg-surface p-2">
          <p className="px-3 pt-1.5 pb-1 text-[11px] uppercase tracking-[0.08em] text-ink-faint">
            Desks
          </p>
          <div className="panel-scroll space-y-0.5">
            {desks.map((desk) => {
              const meta = `${formatDeskType(desk.deskType)} · ${formatAccountMode(desk.mode)}`;
              const currentDesk = desk.id === current.id;
              const body = (
                <>
                  <span className="block truncate text-sm text-ink">
                    {desk.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-faint">
                    {meta}
                  </span>
                </>
              );
              if (currentDesk) {
                return (
                  <p
                    key={desk.id}
                    className="rounded-control bg-surface-raised px-3 py-2.5"
                  >
                    {body}
                  </p>
                );
              }
              return (
                <form key={desk.id} action={switchTradingAccount}>
                  <input type="hidden" name="accountId" value={desk.id} />
                  <button
                    type="submit"
                    className="w-full rounded-control px-3 py-2.5 text-left text-ink-muted hover:bg-surface-raised hover:text-ink"
                  >
                    {body}
                  </button>
                </form>
              );
            })}
          </div>
          <div className="my-1.5 border-t border-line" />
          <button
            type="button"
            onClick={openCreate}
            className="block w-full rounded-control px-3 py-2 text-left text-sm text-accent hover:bg-surface-raised hover:text-accent-strong"
          >
            Create new desk
          </button>
          <Link
            href="/account/sub-accounts"
            className="block rounded-control px-3 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
          >
            Manage desks
          </Link>
        </div>
      </details>
      {creating ? (
        <CreateDeskDialog
          connections={connections}
          onClose={() => setCreating(false)}
        />
      ) : null}
    </>
  );
}

function CreateDeskDialog({
  connections,
  onClose,
}: {
  connections: ExchangeConnection[];
  onClose: () => void;
}) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/70 p-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-lg rounded-card border border-line bg-surface p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            New desk
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:text-ink"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <CreateAccountForm
          connections={connections}
          embedded
          onCancel={onClose}
        />
      </div>
    </div>,
    document.body,
  );
}
