import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { saveAdminSettings } from "@/lib/admin/actions";
import { loadAutoTickEnabled } from "@/lib/admin/settings";
import { loadCopyPlatformSettings } from "@/lib/copy/settings";
import { firstSearchValue } from "@/lib/paper/open";

export const metadata: Metadata = {
  title: "Admin settings",
  description: "System settings for Trading Bot Platform.",
};

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const saved = firstSearchValue(params.saved) === "1";
  const error = firstSearchValue(params.error);
  const copyDaysError = error === "copy-days";
  const copyFollowersError = error === "copy-followers";
  const [autoTick, copySettings] = await Promise.all([
    loadAutoTickEnabled(),
    loadCopyPlatformSettings(),
  ]);

  return (
    <div>
      <PageHeading overline="Admin" title="Settings" />
      <p className="-mt-4 text-sm text-ink-muted">
        Desk-wide knobs. Members and logs stay in the menu.
      </p>
      {saved ? (
        <p className="mt-4 text-sm text-success">Settings saved.</p>
      ) : null}
      {copyDaysError ? (
        <p className="mt-4 text-sm text-danger">
          Minimum activity days must be a whole number, zero or more.
        </p>
      ) : null}
      {copyFollowersError ? (
        <p className="mt-4 text-sm text-danger">
          Default maximum copy traders must be 1 or more, or empty for no
          cap.
        </p>
      ) : null}
      <form
        action={saveAdminSettings}
        className="mt-6 max-w-lg space-y-4 rounded-card border border-line bg-surface p-5"
      >
        <label className="block text-sm text-ink">
          Copy trading — minimum activity days
          <input
            type="number"
            name="copyMinActivityDays"
            min={0}
            step={1}
            required
            defaultValue={copySettings.minActivityDays}
            className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
          />
          <span className="mt-1 block text-xs text-ink-muted">
            A connected desk needs a first venue fill at least this many days
            ago before it can be shared. Default 90. Use 0 while testing.
          </span>
        </label>
        <label className="block text-sm text-ink">
          Copy trading — default maximum copy traders
          <input
            type="number"
            name="copyMaxFollowersDefault"
            min={1}
            step={1}
            defaultValue={copySettings.maxFollowersDefault ?? ""}
            placeholder="No cap"
            className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
          />
          <span className="mt-1 block text-xs text-ink-muted">
            Pre-fills Maximum copy traders on a new share. The desk can
            change it. Empty means new shares start with no cap.
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="autoTick"
            defaultChecked={autoTick}
            className="mt-0.5"
          />
          <span>
            Auto tick
            <span className="mt-1 block text-xs text-ink-muted">
              Off by default. Fly is the clock. Turn this on only to nudge
              Vercel every 5 seconds while an admin tab is open.
            </span>
          </span>
        </label>
        <PendingSubmitButton
          pendingLabel="Saving…"
          successKey="save-admin-settings"
          className="rounded-control bg-accent-strong px-3 py-1.5 text-xs font-medium text-ink"
        >
          Save settings
        </PendingSubmitButton>
      </form>
    </div>
  );
}
