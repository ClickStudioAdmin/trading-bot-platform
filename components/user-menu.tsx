"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { switchTradingAccount } from "@/lib/accounts/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  formatAccountMode,
  type TradingAccount,
} from "@/lib/accounts/model";
import { signOut } from "@/lib/auth/actions";

export function UserMenu({
  name,
  current,
  accounts,
}: {
  name: string | null;
  current?: TradingAccount;
  accounts?: TradingAccount[];
}) {
  const rootRef = useRef<HTMLDetailsElement>(null);

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
      if (event.key === "Escape") {
        closeMenu();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!name) {
    return (
      <Link
        href="/sign-in"
        className="rounded-control bg-accent-strong px-3 py-1.5 text-sm font-medium text-ink"
      >
        Sign in
      </Link>
    );
  }

  const initial = name.slice(0, 1).toUpperCase();
  const books = accounts ?? [];

  return (
    <details ref={rootRef} className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-control border border-line px-2 py-1 hover:bg-surface-raised [&::-webkit-details-marker]:hidden">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
          {initial}
        </span>
        <span className="hidden max-w-[10rem] truncate text-sm text-ink-muted sm:inline">
          {name}
        </span>
        {current ? (
          <>
            <span
              className="hidden h-4 w-px bg-line sm:block"
              aria-hidden
            />
            <span className="hidden max-w-[7rem] truncate text-xs text-ink-faint sm:inline">
              {current.name}
            </span>
          </>
        ) : null}
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-72 rounded-card border border-line bg-surface p-2 shadow-none">
        <p className="truncate px-2 py-2 text-xs text-ink-faint">{name}</p>
        {current ? (
          <>
            <p className="px-2 pt-1 text-[11px] uppercase tracking-[0.08em] text-ink-faint">
              Accounts
            </p>
            {books.map((account) =>
              account.id === current.id ? (
                <p
                  key={account.id}
                  className="flex w-full items-center justify-between rounded-control bg-surface-raised px-2 py-2 text-sm"
                >
                  <span>{account.name}</span>
                  <span className="text-xs text-ink-faint">
                    {formatAccountMode(account.mode)}
                  </span>
                </p>
              ) : (
                <form key={account.id} action={switchTradingAccount}>
                  <input type="hidden" name="accountId" value={account.id} />
                  <PendingSubmitButton
                    pendingLabel="Switching…"
                    className="flex w-full items-center justify-between rounded-control px-2 py-2 text-left text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
                  >
                    <span>{account.name}</span>
                    <span className="text-xs text-ink-faint">
                      {formatAccountMode(account.mode)}
                    </span>
                  </PendingSubmitButton>
                </form>
              ),
            )}
            <Link
              href="/account"
              className="mt-1 block rounded-control px-2 py-2 text-sm text-accent hover:bg-surface-raised"
            >
              Manage sub-accounts
            </Link>
            <Link
              href="/account/settings"
              className="block rounded-control px-2 py-2 text-sm text-accent hover:bg-surface-raised"
            >
              Settings
            </Link>
            <div className="my-1 border-t border-line" />
          </>
        ) : null}
        <form action={signOut}>
          <PendingSubmitButton
            pendingLabel="Signing out…"
            className="w-full rounded-control px-2 py-2 text-left text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
          >
            Sign out
          </PendingSubmitButton>
        </form>
      </div>
    </details>
  );
}