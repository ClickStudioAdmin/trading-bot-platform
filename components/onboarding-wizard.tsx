"use client";

import { useState } from "react";
import { CreateAccountForm } from "@/components/create-account-form";
import {
  formatAccountModeChoice,
  formatDeskTypeChoice,
} from "@/lib/accounts/model";
import { WELCOME_PATH } from "@/lib/auth/onboarding-path";
import type { ExchangeConnection } from "@/lib/exchanges/connections";

const DESK_TYPES = [
  "cash_and_carry",
  "perps",
  "signal_follower",
  "dca",
] as const;

export function OnboardingWizard({
  name,
  connections,
  sharedConnectionIds = [],
  error,
}: {
  name: string;
  connections: ExchangeConnection[];
  sharedConnectionIds?: string[];
  error?: string;
}) {
  const [step, setStep] = useState<1 | 2>(error ? 2 : 1);

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
        Welcome
      </p>
      {step === 1 ? (
        <>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Set up your first desk
          </h1>
          <p className="mt-3 text-sm text-ink-muted">
            Hi {name}. A desk is a workspace for one strategy. Type and mode
            are set when you create it and never change. You can add more desks
            later.
          </p>
          <ul className="mt-6 space-y-2 rounded-card border border-line bg-surface p-5 text-sm text-ink">
            {DESK_TYPES.map((deskType) => (
              <li key={deskType}>{formatDeskTypeChoice(deskType)}</li>
            ))}
          </ul>
          <div className="mt-4 space-y-2 text-sm text-ink-muted">
            <p>{formatAccountModeChoice("paper")}.</p>
            <p>
              {formatAccountModeChoice("live")}. Bind a key now if you have
              one, or later in Desk Settings.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="mt-8 rounded-control bg-accent-strong px-4 py-2 text-sm font-medium text-ink"
          >
            Create your first desk
          </button>
        </>
      ) : (
        <>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Create your first desk
          </h1>
          <p className="mt-3 text-sm text-ink-muted">
            Name it, pick a type and exchange, then Paper, Demo, or Live.
          </p>
          {error ? (
            <p className="mt-6 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <CreateAccountForm
            connections={connections}
            sharedConnectionIds={sharedConnectionIds}
            existingNames={[]}
            next={WELCOME_PATH}
            embedded
            firstDesk
            onCancel={() => setStep(1)}
          />
        </>
      )}
    </main>
  );
}
