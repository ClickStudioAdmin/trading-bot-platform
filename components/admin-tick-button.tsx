"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ButtonBusyIcon,
  ButtonCheckIcon,
} from "@/components/pending-submit-button";

const TICK_OK_KEY = "tbp-tick-ok";
const TICK_NOTE_KEY = "tbp-tick-note";
const NOTE_MS = 5000;
const OK_MS = 1500;
const POLL_MS = 5000;

type TickBody = {
  error?: string;
  opened?: number;
  added?: number;
  closed?: number;
  clipped?: number;
};

function readStored(key: string): string | null {
  try {
    const value = sessionStorage.getItem(key);
    if (!value) {
      return null;
    }
    sessionStorage.removeItem(key);
    return value;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    return;
  }
}

function tickSummary(body: TickBody): string {
  return `Opened ${body.opened ?? 0} · added ${body.added ?? 0} · closed ${body.closed ?? 0} · clipped ${body.clipped ?? 0}`;
}

function tickChanged(body: TickBody): boolean {
  return (
    (body.opened ?? 0) > 0 ||
    (body.added ?? 0) > 0 ||
    (body.closed ?? 0) > 0 ||
    (body.clipped ?? 0) > 0
  );
}

export function AdminTickButton() {
  const router = useRouter();
  const inFlight = useRef(false);
  const runTickRef = useRef<(auto: boolean) => Promise<void>>(async () => {});
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (readStored(TICK_OK_KEY) === "1") {
      setOk(true);
    }
    const storedNote = readStored(TICK_NOTE_KEY);
    if (storedNote) {
      setNote(storedNote);
    }
  }, []);

  useEffect(() => {
    if (!ok) {
      return;
    }
    const timer = window.setTimeout(() => setOk(false), OK_MS);
    return () => window.clearTimeout(timer);
  }, [ok]);

  useEffect(() => {
    if (!note) {
      return;
    }
    const timer = window.setTimeout(() => {
      setNote(null);
      try {
        sessionStorage.removeItem(TICK_NOTE_KEY);
      } catch {
        /* ignore */
      }
    }, NOTE_MS);
    return () => window.clearTimeout(timer);
  }, [note]);

  async function runTick(auto: boolean) {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setBusy(true);
    if (!auto) {
      setOk(false);
      setNote(null);
    }
    try {
      const response = await fetch(
        auto ? "/api/engine/admin-tick?auto=1" : "/api/engine/admin-tick",
        { method: "POST" },
      );
      const body = (await response.json()) as TickBody;
      if (!response.ok) {
        setNote(body.error ?? "Tick failed");
        return;
      }
      if (auto) {
        if (tickChanged(body)) {
          router.refresh();
        }
        return;
      }
      const summary = tickSummary(body);
      setNote(summary);
      writeStored(TICK_NOTE_KEY, summary);
      writeStored(TICK_OK_KEY, "1");
      setOk(true);
      router.refresh();
    } catch {
      setNote("Tick failed");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  runTickRef.current = runTick;

  useEffect(() => {
    let timer = 0;

    function stop() {
      window.clearInterval(timer);
      timer = 0;
    }

    function start() {
      stop();
      if (document.hidden) {
        return;
      }
      void runTickRef.current(true);
      timer = window.setInterval(() => {
        if (!document.hidden) {
          void runTickRef.current(true);
        }
      }, POLL_MS);
    }

    function onVisibility() {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    }

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <span className="relative">
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        onClick={() => void runTick(false)}
        className="relative rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink disabled:opacity-50"
        aria-label={busy ? "Ticking" : ok ? "Done" : "Tick"}
        title="Ticks every 5 seconds while this tab is open. Click for a count."
      >
        <span className="absolute top-1 right-1 size-1.5 rounded-full bg-success" />
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
        <span
          role="status"
          className="absolute top-full right-0 z-30 mt-2 whitespace-nowrap rounded-card border border-line bg-surface px-3 py-2 text-xs text-ink-muted"
        >
          {note}
        </span>
      ) : null}
    </span>
  );
}
