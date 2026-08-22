import { isSafeEventName, redactLogData } from "@/lib/logs/redact";
import { createServiceClient } from "@/lib/supabase/admin";

export type EventLogLevel = "info" | "warning" | "error";
export type EventLogScope = "system" | "strategy" | "trade";

export type EventLogInput = {
  level?: EventLogLevel;
  scope: EventLogScope;
  event: string;
  message: string;
  userId?: string | null;
  strategy?: string | null;
  data?: Record<string, unknown>;
};

export async function writeEventLog(input: EventLogInput): Promise<void> {
  try {
    if (!isSafeEventName(input.event)) {
      return;
    }
    const supabase = createServiceClient();
    if (!supabase) {
      return;
    }
    const message = input.message.trim().slice(0, 500);
    if (!message) {
      return;
    }
    await supabase.from("event_logs").insert({
      level: input.level ?? "info",
      scope: input.scope,
      event: input.event,
      message,
      user_id: input.userId ?? null,
      strategy: input.strategy ?? null,
      data: redactLogData(input.data ?? {}),
    });
  } catch {
    // Logging must never break the action that produced the event.
  }
}
