import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { saveAdminSettings } from "@/lib/admin/actions";
import { loadAutoTickEnabled } from "@/lib/admin/settings";
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
  const autoTick = await loadAutoTickEnabled();

  return (
    <div>
      <PageHeading overline="Admin" title="Settings" />
      <p className="-mt-4 text-sm text-ink-muted">
        Desk-wide knobs. Members and logs stay in the menu.
      </p>
      {saved ? (
        <p className="mt-4 text-sm text-success">Settings saved.</p>
      ) : null}
      <form
        action={saveAdminSettings}
        className="mt-6 max-w-lg space-y-4 rounded-card border border-line bg-surface p-5"
      >
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
              Run the engine every 5 seconds while an admin tab is open. Turn
              this off to use only the header Tick button and the 5-minute
              GitHub job.
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
