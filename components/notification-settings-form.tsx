import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  emailDefaultOn,
  notificationIsDisabled,
  type NotificationId,
} from "@/lib/notifications/catalog";
import type { NotificationPreferences } from "@/lib/notifications/store";
import {
  emailSwitchLockedOn,
  notificationAudience,
  NOTIFICATION_HINTS,
  NOTIFICATION_LABELS,
  type NotificationSettingGroup,
} from "@/lib/notifications/settings";

export function MemberNotificationSettingsForm({
  groups,
  prefs,
  action,
}: {
  groups: NotificationSettingGroup[];
  prefs: NotificationPreferences;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="mt-6 space-y-6">
      {groups.map((group) => (
        <section
          key={group.id}
          className="rounded-card border border-line bg-surface p-5"
        >
          <h2 className="text-sm font-semibold text-ink">{group.label}</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.12em] text-ink-faint">
                  <th className="pb-2 font-medium">Notice</th>
                  <th className="w-20 pb-2 text-center font-medium">Email</th>
                  <th className="w-20 pb-2 text-center font-medium">In-app</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {group.ids.map((id) => (
                  <SettingRow
                    key={id}
                    id={id}
                    emailOn={
                      emailSwitchLockedOn(id) ||
                      !notificationIsDisabled(prefs.disabledEmails, id)
                    }
                    inAppOn={!notificationIsDisabled(prefs.disabledInApp, id)}
                    showInApp
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <PendingSubmitButton
        pendingLabel="Saving…"
        successKey="save-member-notifications"
        className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
      >
        Save notifications
      </PendingSubmitButton>
    </form>
  );
}

export function AdminNotificationSettingsForm({
  groups,
  disabledEmails,
  action,
}: {
  groups: NotificationSettingGroup[];
  disabledEmails: string[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="mt-6 space-y-6">
      <p className="text-sm text-ink-muted">
        Off stops every outbound email for that notice, including members who
        left it on. In-app rows are not platform-killed. Operators never get an
        inbox row.
      </p>
      {groups.map((group) => (
        <section
          key={group.id}
          className="rounded-card border border-line bg-surface p-5"
        >
          <h2 className="text-sm font-semibold text-ink">{group.label}</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.12em] text-ink-faint">
                  <th className="pb-2 font-medium">Notice</th>
                  <th className="w-28 pb-2 font-medium">Sent to</th>
                  <th className="w-20 pb-2 text-center font-medium">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {group.ids.map((id) => (
                  <SettingRow
                    key={id}
                    id={id}
                    emailOn={!notificationIsDisabled(disabledEmails, id)}
                    inAppOn
                    showInApp={false}
                    sentTo={
                      notificationAudience(id) === "operator"
                        ? "Operators"
                        : "Member"
                    }
                    emailDefault={emailDefaultOn(id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <PendingSubmitButton
        pendingLabel="Saving…"
        successKey="save-admin-notifications"
        className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
      >
        Save notifications
      </PendingSubmitButton>
    </form>
  );
}

function SettingRow({
  id,
  emailOn,
  inAppOn,
  showInApp,
  sentTo,
  emailDefault,
}: {
  id: NotificationId;
  emailOn: boolean;
  inAppOn: boolean;
  showInApp: boolean;
  sentTo?: string;
  emailDefault?: boolean;
}) {
  const locked = emailSwitchLockedOn(id);
  return (
    <tr>
      <td className="py-3 pr-4">
        <p className="text-ink">{NOTIFICATION_LABELS[id]}</p>
        <p className="mt-1 text-xs text-ink-faint">{NOTIFICATION_HINTS[id]}</p>
        {emailDefault === false ? (
          <p className="mt-1 text-xs text-ink-faint">Email defaults off.</p>
        ) : null}
      </td>
      {sentTo ? (
        <td className="py-3 pr-4 text-xs text-ink-muted">{sentTo}</td>
      ) : null}
      <td className="py-3 text-center">
        <input
          type="checkbox"
          name="email"
          value={id}
          defaultChecked={emailOn}
          disabled={locked && !sentTo}
          className="align-middle"
        />
        {locked && !sentTo ? (
          <input type="hidden" name="email" value={id} />
        ) : null}
      </td>
      {showInApp ? (
        <td className="py-3 text-center">
          <input
            type="checkbox"
            name="inapp"
            value={id}
            defaultChecked={inAppOn}
            className="align-middle"
          />
        </td>
      ) : null}
    </tr>
  );
}
