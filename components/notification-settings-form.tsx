import { AppCheck } from "@/components/app-check";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  emailDefaultOn,
  notificationIsDisabled,
  type NotificationId,
} from "@/lib/notifications/catalog";
import type { NotificationPreferences } from "@/lib/notifications/store";
import { badgeIsDisabled } from "@/lib/notifications/badges-catalog";
import {
  emailSwitchLockedOn,
  NOTIFICATION_HINTS,
  NOTIFICATION_LABELS,
  type ChannelList,
  type ChannelRow,
  type NotificationSettingGroup,
} from "@/lib/notifications/settings";

const CHANNEL_GRID =
  "grid grid-cols-[minmax(0,1fr)_6rem_6rem_6rem] items-start gap-x-2";

function ChannelEmpty() {
  return <span className="text-ink-faint">—</span>;
}

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
    <form action={action} className="mx-auto mt-6 w-[60%] space-y-6">
      {groups.map((group) => (
        <section
          key={group.id}
          className="rounded-card border border-line bg-surface p-5"
        >
          <h2 className="text-sm font-semibold text-ink">{group.label}</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="border-b border-line bg-surface-raised">
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

export function AdminChannelSettingsForm({
  lists,
  disabledEmails,
  disabledBadges,
  action,
}: {
  lists: ChannelList[];
  disabledEmails: string[];
  disabledBadges: string[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="mt-6 space-y-8">
      <p className="text-sm text-ink-muted">
        Same trigger on one row. Off email or alert is a platform kill. In-app
        stays on for members unless they mute it themselves. Admins do not get
        an inbox.
      </p>
      {lists.map((list) => (
        <section key={list.id} className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">{list.label}</h2>
          {list.groups.map((group) => (
            <div
              key={group.id}
              className="rounded-card border border-line bg-surface p-5"
            >
              <h3 className="text-sm font-semibold text-ink">{group.label}</h3>
              <div className="mt-4 min-w-[32rem] text-sm">
                <div
                  className={`${CHANNEL_GRID} pb-2 text-xs uppercase tracking-[0.12em] text-ink-faint`}
                >
                  <div className="font-medium">Notice</div>
                  <div className="text-center font-medium">Email</div>
                  <div className="text-center font-medium">In-app</div>
                  <div className="text-center font-medium">Alert</div>
                </div>
                <div className="divide-y divide-line">
                  {group.rows.map((row) => (
                    <ChannelSettingRow
                      key={row.id}
                      row={row}
                      showInApp={list.showInApp}
                      emailOn={
                        row.emailId
                          ? !notificationIsDisabled(
                              disabledEmails,
                              row.emailId,
                            )
                          : false
                      }
                      badgeOn={
                        row.badgeId
                          ? !badgeIsDisabled(disabledBadges, row.badgeId)
                          : false
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </section>
      ))}
      <PendingSubmitButton
        pendingLabel="Saving…"
        successKey="save-admin-channels"
        className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
      >
        Save notifications & alerts
      </PendingSubmitButton>
    </form>
  );
}

function ChannelSettingRow({
  row,
  showInApp,
  emailOn,
  badgeOn,
}: {
  row: ChannelRow;
  showInApp: boolean;
  emailOn: boolean;
  badgeOn: boolean;
}) {
  return (
    <div className={`${CHANNEL_GRID} py-3`}>
      <div className="pr-4">
        <p className="text-ink">{row.label}</p>
        <p className="mt-1 text-hint text-ink-faint">{row.hint}</p>
        {row.emailId && !emailDefaultOn(row.emailId) ? (
          <p className="mt-1 text-hint text-ink-faint">Email defaults off.</p>
        ) : null}
      </div>
      <div className="flex justify-center">
        {row.emailId ? (
          <SettingsCheck
            name="email"
            value={row.emailId}
            defaultChecked={emailOn}
            label={`${row.label} email`}
          />
        ) : (
          <ChannelEmpty />
        )}
      </div>
      <div className="flex justify-center">
        {showInApp && row.showInApp ? (
          <SettingsCheck
            name="inapp-preview"
            value={row.id}
            defaultChecked
            disabled
            label={`${row.label} in-app`}
          />
        ) : (
          <ChannelEmpty />
        )}
      </div>
      <div className="flex justify-center">
        {row.badgeId ? (
          <SettingsCheck
            name="badge"
            value={row.badgeId}
            defaultChecked={badgeOn}
            label={`${row.label} alert`}
          />
        ) : (
          <ChannelEmpty />
        )}
      </div>
    </div>
  );
}

function SettingRow({
  id,
  emailOn,
  inAppOn,
  showInApp,
}: {
  id: NotificationId;
  emailOn: boolean;
  inAppOn: boolean;
  showInApp: boolean;
}) {
  const locked = emailSwitchLockedOn(id);
  return (
    <tr>
      <td className="py-3 pr-4">
        <p className="text-ink">{NOTIFICATION_LABELS[id]}</p>
        <p className="mt-1 text-hint text-ink-faint">{NOTIFICATION_HINTS[id]}</p>
      </td>
      <td className="py-3 text-center">
        <SettingsCheck
          name="email"
          value={id}
          defaultChecked={emailOn}
          disabled={locked}
          label={`${NOTIFICATION_LABELS[id]} email`}
        />
        {locked ? <input type="hidden" name="email" value={id} /> : null}
      </td>
      {showInApp ? (
        <td className="py-3 text-center">
          <SettingsCheck
            name="inapp"
            value={id}
            defaultChecked={inAppOn}
            label={`${NOTIFICATION_LABELS[id]} in-app`}
          />
        </td>
      ) : null}
    </tr>
  );
}

function SettingsCheck({
  name,
  value,
  defaultChecked,
  disabled,
  label,
}: {
  name: string;
  value: string;
  defaultChecked: boolean;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label
      className={`inline-flex justify-center ${
        disabled ? "cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      <AppCheck
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        disabled={disabled}
        aria-label={label}
        className=""
      />
    </label>
  );
}
