"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ModalHost } from "@/components/portal-host";

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function SetupModal({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!host) {
      return;
    }
    const node = host;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node.querySelector<HTMLElement>("[role='dialog']")?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (node.querySelector("[data-setup-submodal]")) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key !== "Tab" || !node) {
        return;
      }
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) =>
          !element.hasAttribute("disabled") && element.closest("[inert]") == null,
      );
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey, true);
    };
  }, [host]);

  return (
    <div
      ref={setHost}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-canvas/80 p-4"
    >
      <ModalHost host={host}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="setup-gate-title"
          tabIndex={-1}
          className="flex max-h-[min(90dvh,52rem)] w-full max-w-[calc(80rem*3/4)] flex-col overflow-hidden rounded-card border border-line bg-surface outline-none"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </div>
      </ModalHost>
    </div>
  );
}

export function SetupModalFallback() {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-canvas/80 p-4">
      <p className="rounded-card border border-line bg-surface px-5 py-4 text-sm text-ink-muted">
        Loading setup…
      </p>
    </div>
  );
}
