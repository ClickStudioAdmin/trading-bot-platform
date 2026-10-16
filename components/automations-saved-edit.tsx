"use client";

import { useEffect, useState } from "react";
import {
  automationsEditTitle,
  automationsSavedBotHref,
} from "@/lib/bots/automations-path";
import { nextShownAutomationsEdit } from "@/lib/bots/automations-saved-edit";

const TITLE_EVENT = "tbp-automations-edit-title";

export function useShownAutomationsEdit(edit: string | null) {
  const [shownEdit, setShownEdit] = useState(edit);
  const [seenEdit, setSeenEdit] = useState(edit);
  const next = nextShownAutomationsEdit(edit, seenEdit, shownEdit);
  if (next.seenEdit !== seenEdit || next.shownEdit !== shownEdit) {
    setSeenEdit(next.seenEdit);
    setShownEdit(next.shownEdit);
  }
  return [next.shownEdit, setShownEdit] as const;
}

export function rememberSavedBotEdit(
  listHref: string,
  botId: string | null | undefined,
  name?: string | null,
): void {
  const id = String(botId ?? "").trim();
  if (!id || typeof window === "undefined") {
    return;
  }
  const href = automationsSavedBotHref(listHref, id);
  const nextUrl = new URL(href, window.location.origin);
  const next = `${nextUrl.pathname}${nextUrl.search}`;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current !== next) {
    window.history.replaceState(
      window.history.state,
      "",
      `${next}${window.location.hash}`,
    );
  }
  const title = automationsEditTitle({ edit: id, name });
  if (!title) {
    return;
  }
  window.dispatchEvent(new CustomEvent(TITLE_EVENT, { detail: title }));
}

export function AutomationsEditHeading({ title }: { title: string }) {
  const [shown, setShown] = useState(title);
  const [seen, setSeen] = useState(title);
  if (title !== seen) {
    setSeen(title);
    setShown(title);
  }

  useEffect(() => {
    function onTitle(event: Event) {
      const next = (event as CustomEvent<string>).detail;
      if (typeof next === "string" && next.trim()) {
        setShown(next);
      }
    }
    window.addEventListener(TITLE_EVENT, onTitle);
    return () => window.removeEventListener(TITLE_EVENT, onTitle);
  }, []);

  return (
    <h2 className="min-w-0 text-lg font-semibold tracking-tight">{shown}</h2>
  );
}
