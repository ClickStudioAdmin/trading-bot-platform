import { CopyTextButton } from "@/components/copy-text-button";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  cancelTotpEnrollAction,
  confirmTotpEnrollAction,
  disableTotpAction,
  dismissRecoveryCodesAction,
  startTotpEnrollAction,
} from "@/lib/auth/totp-actions";
import { exchangeCredentialsConfigured } from "@/lib/exchanges/encrypt";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

export function TotpSettings({
  enabled,
  pending,
  recoveryCodes,
}: {
  enabled: boolean;
  pending: { secret: string; qrSvg: string } | null;
  recoveryCodes: string[] | null;
}) {
  const configured = exchangeCredentialsConfigured();

  if (recoveryCodes && recoveryCodes.length > 0) {
    return (
      <section className="space-y-4 rounded-card border border-line bg-surface p-5">
        <div>
          <p className="text-sm text-ink">Save these recovery codes</p>
          <p className="mt-1 text-xs text-ink-muted">
            Each code signs you in once if you lose Google Authenticator. We
            will not show them again.
          </p>
        </div>
        <ol className="grid gap-2 font-mono text-sm text-ink sm:grid-cols-2">
          {recoveryCodes.map((code) => (
            <li
              key={code}
              className="rounded-control border border-line bg-canvas px-3 py-2"
            >
              {code}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          <CopyTextButton
            text={recoveryCodes.join("\n")}
            label="Copy all codes"
          />
          <form action={dismissRecoveryCodesAction}>
            <PendingSubmitButton
              pendingLabel="Saving…"
              className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
            >
              I saved these codes
            </PendingSubmitButton>
          </form>
        </div>
      </section>
    );
  }

  if (pending) {
    return (
      <section className="space-y-4 rounded-card border border-line bg-surface p-5">
        <div>
          <p className="text-sm text-ink">Set up Google Authenticator</p>
          <p className="mt-1 text-xs text-ink-muted">
            Scan the QR code in Google Authenticator, then enter the 6-digit
            code to turn it on.
          </p>
        </div>
        <div className="inline-flex rounded-card bg-white p-3">
          <div
            className="size-44 text-canvas [&_svg]:size-full"
            dangerouslySetInnerHTML={{ __html: pending.qrSvg }}
          />
        </div>
        <div>
          <p className="text-xs text-ink-muted">Or enter this key manually</p>
          <p className="mt-1 break-all font-mono text-sm text-ink">
            {pending.secret}
          </p>
          <div className="mt-2">
            <CopyTextButton text={pending.secret} label="Copy key" />
          </div>
        </div>
        <form action={confirmTotpEnrollAction} className="space-y-3">
          <label className="block text-xs text-ink-muted">
            Google Authenticator code
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              minLength={6}
              maxLength={6}
              className={fieldClass}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <PendingSubmitButton
              pendingLabel="Checking…"
              className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
            >
              Turn on
            </PendingSubmitButton>
          </div>
        </form>
        <form action={cancelTotpEnrollAction}>
          <PendingSubmitButton
            pendingLabel="Cancelling…"
            className="rounded-control border border-line px-4 py-2 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
          >
            Cancel
          </PendingSubmitButton>
        </form>
      </section>
    );
  }

  if (enabled) {
    return (
      <section className="space-y-4 rounded-card border border-line bg-surface p-5">
        <div>
          <p className="text-sm text-ink">Google Authenticator is on</p>
          <p className="mt-1 text-xs text-ink-muted">
            Sign-in asks for a 6-digit code after your password. Turn it off
            with your current password and a code from the app (or a leftover
            recovery code).
          </p>
        </div>
        <form action={disableTotpAction} className="space-y-3">
          <label className="block text-xs text-ink-muted">
            Current password
            <input
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className={fieldClass}
            />
          </label>
          <label className="block text-xs text-ink-muted">
            Google Authenticator or recovery code
            <input
              name="code"
              required
              autoComplete="one-time-code"
              className={fieldClass}
            />
          </label>
          <PendingSubmitButton
            pendingLabel="Turning off…"
            className="rounded-control border border-danger/40 px-4 py-2 text-sm text-danger hover:bg-danger/10"
          >
            Turn off
          </PendingSubmitButton>
        </form>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-card border border-line bg-surface p-5">
      <div>
        <p className="text-sm text-ink">Google Authenticator</p>
        <p className="mt-1 text-xs text-ink-muted">
          Add a 6-digit code after your password at sign-in. Use the Google
          Authenticator app on your phone.
        </p>
      </div>
      {!configured ? (
        <p className="text-sm text-warning">
          Two-factor is not configured on this environment.
        </p>
      ) : (
        <form action={startTotpEnrollAction}>
          <PendingSubmitButton
            pendingLabel="Starting…"
            className="rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
          >
            Turn on Google Authenticator
          </PendingSubmitButton>
        </form>
      )}
    </section>
  );
}
