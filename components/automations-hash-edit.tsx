"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  automationsEditHref,
  parseAutomationsEdit,
  parseBotHashId,
} from "@/lib/bots/automations-path";

export function AutomationsHashEdit({ listHref }: { listHref: string }) {
  const router = useRouter();

  useEffect(() => {
    const botId = parseBotHashId(window.location.hash);
    if (!botId) {
      return;
    }
    const current = parseAutomationsEdit(
      new URLSearchParams(window.location.search).get("edit"),
    );
    if (current) {
      return;
    }
    router.replace(automationsEditHref(listHref, botId));
  }, [listHref, router]);

  return null;
}
