import Link from "next/link";
import { switchTradingAccount } from "@/lib/accounts/actions";
import {
  formatAccountMode,
  type TradingAccount,
} from "@/lib/accounts/model";

export function AccountSwitcher({
  current,
  accounts,
  othersRunning,
}: {
  current: TradingAccount;
  accounts: TradingAccount[];
  othersRunning: TradingAccount[];
}) {
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-control border border-line px-2 py-1 hover:bg-surface-raised [&::-webkit-details-marker]:hidden">
        <span className="max-w-[8rem] truncate text-sm">{current.name}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] ${
            current.mode === "live"
              ? "bg-warning/15 text-warning"
              : "bg-accent/15 text-accent"
          }`}
        >
          {formatAccountMode(current.mode)}
        </span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-64 rounded-card border border-line bg-surface p-2">
        <p className="px-2 py-1 text-[11px] uppercase tracking-[0.08em] text-ink-faint">
          Accounts
        </p>
        {accounts.map((account) =>
          account.id === current.id ? (
            <p
              key={account.id}
              className="rounded-control bg-surface-raised px-2 py-2 text-sm"
            >
              {account.name}
              <span className="ml-2 text-xs text-ink-faint">
                {formatAccountMode(account.mode)}
              </span>
            </p>
          ) : (
            <form key={account.id} action={switchTradingAccount}>
              <input type="hidden" name="accountId" value={account.id} />
              <button
                type="submit"
                className="flex w-full items-center justify-between rounded-control px-2 py-2 text-left text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
              >
                <span>{account.name}</span>
                <span className="text-xs text-ink-faint">
                  {formatAccountMode(account.mode)}
                </span>
              </button>
            </form>
          ),
        )}
        <Link
          href="/accounts/new"
          className="mt-1 block rounded-control px-2 py-2 text-sm text-accent hover:bg-surface-raised"
        >
          New account
        </Link>
        {othersRunning.length > 0 ? (
          <p className="mt-2 px-2 text-xs text-warning">
            Other paper accounts still running:{" "}
            {othersRunning.map((account) => account.name).join(", ")}
          </p>
        ) : null}
      </div>
    </details>
  );
}
