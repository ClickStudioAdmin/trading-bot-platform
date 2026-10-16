import { DESK_CLOSE_RETENTION_MONTHS } from "@/lib/accounts/close";
import {
  ENGINE_BILLING_DEPOSIT_SCAN_KEY,
  ENGINE_BILLING_DEPOSIT_TTL_SECONDS,
  ENGINE_DESK_CLOSE_RETENTION_SCAN_KEY,
  ENGINE_DESK_CLOSE_RETENTION_TTL_SECONDS,
  ENGINE_EVENT_LOG_RETENTION_SCAN_KEY,
  ENGINE_EVENT_LOG_RETENTION_TTL_SECONDS,
  ENGINE_LOOP_MS,
  ENGINE_SCAN_KEY,
  ENGINE_SCAN_TTL_SECONDS,
} from "@/lib/engine/lease";
import {
  EVENT_LOG_RETENTION_BATCH,
  EVENT_LOG_RETENTION_DAYS,
} from "@/lib/logs/retention";

export type SystemJob = {
  id: string;
  name: string;
  runs: string;
  cadence: string;
  detail: string;
  leaves: string;
};

const loopSeconds = Math.round(ENGINE_LOOP_MS / 1000);
const logLeaseMinutes = Math.round(ENGINE_EVENT_LOG_RETENTION_TTL_SECONDS / 60);
const closeLeaseMinutes = Math.round(
  ENGINE_DESK_CLOSE_RETENTION_TTL_SECONDS / 60,
);

/** Maintenance work the platform runs. Deploys are not in this list. */
export const SYSTEM_JOBS: readonly SystemJob[] = [
  {
    id: "desk-tick",
    name: "Desk tick",
    runs: "Fly engine worker. The same cycle runs from POST /api/engine/tick and the admin footer Tick.",
    cadence: `About every ${loopSeconds} seconds. A hot book (open futures row, armed or stop-adding DCA, or an active Perps recipe) uses the faster indicator loop. Up to 3 desks at once.`,
    detail:
      "Claims desks with a Postgres lease, hot desks first, then idle books. One worker owns a desk until the lease ends. Paper desks use the in-app ledger. Live desks talk to the venue from the worker, not the browser. While a hot loop still has time left, percent stops and take profits are checked again from the ticker.",
    leaves:
      "Closed source desks, and copy desks of a closed source, are not claimed. A disabled DCA bot with no open position is not walked. Auto tick stays off until an admin turns it on.",
  },
  {
    id: "market-scan",
    name: "Public market scan",
    runs: "Fly engine cycle, before desks are claimed.",
    cadence: `Scan lease ${ENGINE_SCAN_KEY}, ${ENGINE_SCAN_TTL_SECONDS} seconds. One worker wins the lease.`,
    detail:
      "Loads the shared cash-and-carry opportunity scan when any cash-and-carry desk exists, and one linear ticker snapshot when any Perps, Perps bots, or DCA desk exists. Later desks in that cycle reuse the snapshot.",
    leaves: "Does not place orders. Does not read private exchange keys.",
  },
  {
    id: "backtest-drain",
    name: "Queued backtest",
    runs: "Fly engine worker, on its own loop. A tick cycle also takes one queued run when time remains.",
    cadence:
      "The worker keeps draining. An empty queue waits 5 seconds. The tick path runs at most one study per cycle.",
    detail:
      "Runs the next queued backtest study. The worker allows a longer bar budget than the tick path.",
    leaves: "Does not start a study the member did not queue.",
  },
  {
    id: "deposit-watch",
    name: "Deposit watch and sweep",
    runs: "End of an engine cycle, when the cycle still has time.",
    cadence: `Scan lease ${ENGINE_BILLING_DEPOSIT_SCAN_KEY}, ${ENGINE_BILLING_DEPOSIT_TTL_SECONDS} seconds.`,
    detail:
      "Scans membership deposit addresses, credits Account Balance, and sweeps the tokens to the treasury. A failed sweep notifies operators. The same pass checks operator gas wallets and can send the gas-low notice.",
    leaves:
      "A credited deposit stays credited when the sweep fails. Gas notices do not stop the deposit watch.",
  },
  {
    id: "membership-invoices",
    name: "Membership invoices",
    runs: "End of an engine cycle, when the cycle still has time.",
    cadence:
      "Every cycle that reaches it. There is no separate scan lease. Renewal rows use a stable id, so a second pass does not issue the same period twice.",
    detail:
      "Issues a renewal invoice when a Stripe or wallet subscription period is due, then collects open wallet invoices from Account Balance.",
    leaves: "Does not charge a card from this pass. Card collect stays with Stripe.",
  },
  {
    id: "commission-release",
    name: "Affiliate commission release",
    runs: "End of an engine cycle, when the cycle still has time.",
    cadence: "Every cycle that reaches it. A commission leaves hold when hold_until has passed.",
    detail:
      "Moves pending affiliate commission onto the payable book and writes the wallet entry once.",
    leaves: "Does not send a payout. Payouts stay in the admin queue until someone marks them paid.",
  },
  {
    id: "event-log-purge",
    name: "Activity log purge",
    runs: "End of an engine cycle, when the cycle still has time.",
    cadence: `Scan lease ${ENGINE_EVENT_LOG_RETENTION_SCAN_KEY}, ${logLeaseMinutes} minutes. At most ${EVENT_LOG_RETENTION_BATCH.toLocaleString("en-US")} rows each pass.`,
    detail: `Deletes event_logs older than ${EVENT_LOG_RETENTION_DAYS} days, oldest first, using the created_at index. One machine holds the lease so a desk tick is not blocked. Writes an engine.logs_purged event when rows are removed.`,
    leaves:
      "Inbox, positions, orders, and billing ledgers are not part of this purge. Members can still read their own remaining logs. Admins can read every remaining row.",
  },
  {
    id: "closed-desk-retention",
    name: "Closed desk retention",
    runs: "End of an engine cycle, when the cycle still has time.",
    cadence: `Scan lease ${ENGINE_DESK_CLOSE_RETENTION_SCAN_KEY}, ${closeLeaseMinutes} minutes. One closed source desk per pass.`,
    detail: `Six months after the owner closes a source desk, this removes every copy desk still pointing at it, including a follower’s last desk, then removes the hidden parent row. Copy history stays until that pass. Writes engine.desks_purged when a parent is removed. Retention is ${DESK_CLOSE_RETENTION_MONTHS} calendar months from closed_at.`,
    leaves:
      "The owner’s close does not delete the parent on day one. A follower can remove their own closed copy sooner when it is flat and it is not their only desk. The owner’s own “keep at least one desk” rule still applies to that owner’s close.",
  },
  {
    id: "supabase-keepalive",
    name: "Database keepalive",
    runs: "GitHub Actions workflow keepalive-supabase.yml, on the development and production projects.",
    cadence: "Cron 0 12 */3 * * (every 3 days at 12:00 UTC). It can also be run by hand.",
    detail:
      "Opens a short database connection so a quiet Supabase project is less likely to pause.",
    leaves: "Does not apply migrations and does not change rows.",
  },
  {
    id: "manual-engine-tick",
    name: "Manual engine tick",
    runs: "GitHub Actions workflow paper-engine-tick.yml.",
    cadence: "Manual only. The scheduled GitHub POST is off. Fly is the scheduler.",
    detail:
      "POSTs the same tick the Fly worker runs, with the cron secret. Desk leases stop that run and a Fly worker from placing the same order twice.",
    leaves: "Vercel Cron does not run the engine.",
  },
];

export function systemJobIds(): string[] {
  return SYSTEM_JOBS.map((job) => job.id);
}
