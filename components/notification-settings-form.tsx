import { NoticeEmail } from "@/components/notice-email";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { sampleOperatorNotice } from "@/lib/notifications/copy";
import {
  emailDefaultOn,
  notificationIsDisabled,
  type NotificationId,
} from "@/lib/notifications/catalog";
import type { NotificationPreferences } from "@/lib/notifications/store";
import {
  ADMIN_BADGE_SETTINGS,
  AFFILIATE_BADGE_SETTINGS,
  badgeIsDisabled,
  MEMBER_BADGE_SETTINGS,
} from "@/lib/notifications/badges-catalog";
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
    <form action={action} className="mx-auto mt-6 w-[60%] space-y-6">
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

export function AdminBadgeSettingsForm({
  disabledBadges,
  action,
}: {
  disabledBadges: string[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="mt-6 space-y-6">
      <p className="text-sm text-ink-muted">
        Off hides that numbered alert everywhere it appears. Live work still
        exists; only the badge is gone.
      </p>
      {(
        [
          ["Member alerts", MEMBER_BADGE_SETTINGS],
          ["Affiliates", AFFILIATE_BADGE_SETTINGS],
          ["Admin alerts", ADMIN_BADGE_SETTINGS],
        ] as const
      ).map(([label, rows]) => (
        <section
          key={label}
          className="rounded-card border border-line bg-surface p-5"
        >
          <h2 className="text-sm font-semibold text-ink">{label}</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.12em] text-ink-faint">
                  <th className="pb-2 font-medium">Alert</th>
                  <th className="w-28 pb-2 font-medium">Shown on</th>
                  <th className="w-20 pb-2 text-center font-medium">On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="py-3 pr-4">
                      <p className="text-ink">{row.label}</p>
                      <p className="mt-1 text-xs text-ink-faint">{row.hint}</p>
                    </td>
                    <td className="py-3 pr-4 text-xs text-ink-muted">
                      {row.audience === "admin" ? "Admin" : "Member"}
                    </td>
                    <td className="py-3 text-center">
                      <SettingsCheck
                        name="badge"
                        value={row.id}
                        defaultChecked={!badgeIsDisabled(disabledBadges, row.id)}
                        label={`${row.label} on`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <PendingSubmitButton
        pendingLabel="Saving…"
        successKey="save-admin-badges"
        className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
      >
        Save alerts
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
    <form action={action} className="mx-auto mt-6 w-[60%] space-y-6">
      {groups.map((group) =>
        group.id === "admin" ? (
          <AdminEmailTemplates
            key={group.id}
            ids={group.ids}
            disabledEmails={disabledEmails}
          />
        ) : (
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
                          ? "Admins"
                          : "Member"
                      }
                      emailDefault={emailDefaultOn(id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ),
      )}
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

function AdminEmailTemplates({
  ids,
  disabledEmails,
}: {
  ids: NotificationId[];
  disabledEmails: string[];
}) {
  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold text-ink">Admin emails</h2>
      <p className="mt-2 text-sm text-ink-muted">
        These go to listed admins only. They never write a member inbox row.
        Copy is locked. Off stops that mail for every admin.
      </p>
      <div className="mt-5 space-y-6">
        {ids.map((id) => (
          <div key={id} className="border-t border-line pt-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-ink">{NOTIFICATION_LABELS[id]}</p>
                <p className="mt-1 text-xs text-ink-faint">
                  {NOTIFICATION_HINTS[id]}
                </p>
              </div>
              <SettingsCheck
                name="email"
                value={id}
                defaultChecked={!notificationIsDisabled(disabledEmails, id)}
                label={`${NOTIFICATION_LABELS[id]} email`}
              />
            </div>
            <div className="mt-4">
              <NoticeEmail notice={sampleOperatorNotice(id)} />
            </div>
          </div>
        ))}
      </div>
    </section>
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
        <SettingsCheck
          name="email"
          value={id}
          defaultChecked={emailOn}
          disabled={locked && !sentTo}
          label={`${NOTIFICATION_LABELS[id]} email`}
        />
        {locked && !sentTo ? (
          <input type="hidden" name="email" value={id} />
        ) : null}
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
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        disabled={disabled}
        aria-label={label}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="flex size-5 items-center justify-center rounded-[5px] border border-line-strong bg-surface-raised text-canvas peer-checked:border-accent peer-checked:bg-accent peer-checked:[&_svg]:opacity-100 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:opacity-40"
      >
        <svg
          viewBox="0 0 12 12"
          className="size-3 fill-none stroke-current stroke-[1.8] opacity-0"
        >
          <path d="M2 6.2 4.6 9 10 3" />
        </svg>
      </span>
    </label>
  );
}
