"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ButtonBusyIcon,
  ButtonCheckIcon,
} from "@/components/pending-submit-button";

const TICK_OK_KEY = "tbp-tick-ok";

export function AdminTickButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(TICK_OK_KEY) !== "1") {
        return;
      }
      sessionStorage.removeItem(TICK_OK_KEY);
    } catch {
      return;
    }
    setOk(true);
    const timer = window.setTimeout(() => setOk(false), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  async function runTick() {
    setBusy(true);
    setOk(false);
    setNote(null);
    try {
      const response = await fetch("/api/engine/admin-tick", {
        method: "POST",
      });
      const body = (await response.json()) as {
        error?: string;
        opened?: number;
        added?: number;
        closed?: number;
        clipped?: number;
      };
      if (!response.ok) {
        setNote(body.error ?? "Tick failed");
        return;
      }
      setNote(
        `Opened ${body.opened ?? 0} · added ${body.added ?? 0} · closed ${body.closed ?? 0} · clipped ${body.clipped ?? 0}`,
      );
      try {
        sessionStorage.setItem(TICK_OK_KEY, "1");
      } catch {
        setOk(true);
        window.setTimeout(() => setOk(false), 1500);
      }
      router.refresh();
    } catch {
      setNote("Tick failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        onClick={() => void runTick()}
        className="rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink disabled:opacity-50"
        aria-label={busy ? "Ticking" : ok ? "Done" : undefined}
      >
        <span className="inline-grid justify-items-center">
          <span className="invisible col-start-1 row-start-1" aria-hidden>
            Tick
          </span>
          <span className="col-start-1 row-start-1 inline-flex items-center justify-center">
            {busy ? (
              <ButtonBusyIcon />
            ) : ok ? (
              <ButtonCheckIcon />
            ) : (
              "Tick"
            )}
          </span>
        </span>
      </button>
      {note ? (
        <span className="hidden max-w-[16rem] truncate text-xs text-ink-faint lg:inline">
          {note}
        </span>
      ) : null}
    </span>
  );
}
