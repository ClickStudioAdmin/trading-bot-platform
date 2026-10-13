import {
  deskIsCopy,
  type DeskType,
} from "@/lib/accounts/model";

export type DeskDisableBotKind = "cnc" | "perps" | "dca" | "copy" | "none";

export function deskDisableBotKind(desk: {
  deskType: DeskType;
  copyOfAccountId?: string | null;
}): DeskDisableBotKind {
  if (deskIsCopy(desk)) {
    return "copy";
  }
  if (desk.deskType === "cash_and_carry") {
    return "cnc";
  }
  if (desk.deskType === "perps_bots") {
    return "perps";
  }
  if (desk.deskType === "dca") {
    return "dca";
  }
  return "none";
}

export function disableDeskConfirmBody(
  name: string,
  kind: DeskDisableBotKind,
): string {
  if (kind === "copy") {
    return `Pause copying on ${name}, then close every open position and cancel working orders. This cannot be undone.`;
  }
  if (kind === "none") {
    return `${name} has no bots. Open positions will be closed and working orders cancelled. This cannot be undone.`;
  }
  return `Turn every bot off on ${name}, then close every open position and cancel working orders. This cannot be undone.`;
}

export function disableBotsDetail(input: {
  kind: DeskDisableBotKind;
  turnedOff: number;
}): string {
  if (input.kind === "none") {
    return "No bots on this desk.";
  }
  if (input.kind === "copy") {
    return input.turnedOff > 0
      ? "Copying paused."
      : "Copying is already paused.";
  }
  if (input.turnedOff <= 0) {
    return "Bots are already off.";
  }
  return input.turnedOff === 1
    ? "Turned 1 bot off."
    : `Turned ${input.turnedOff} bots off.`;
}

export function closePositionsDetail(input: {
  closed: number;
  cancelled: number;
  pendingOnly: boolean;
}): string {
  if (input.closed <= 0 && input.cancelled <= 0) {
    return input.pendingOnly
      ? "Positions are already closing."
      : "No open positions.";
  }
  const parts: string[] = [];
  if (input.closed > 0) {
    parts.push(
      input.closed === 1
        ? "Closed 1 position."
        : `Closed ${input.closed} positions.`,
    );
  }
  if (input.cancelled > 0) {
    parts.push(
      input.cancelled === 1
        ? "Cancelled 1 order."
        : `Cancelled ${input.cancelled} orders.`,
    );
  }
  return parts.join(" ");
}

export const DISABLE_DESK_SUCCESS = "Desk disabled.";

export function disableDeskSuccessBody(input: {
  closed: number;
  cancelled: number;
}): string {
  if (input.closed <= 0 && input.cancelled <= 0) {
    return "Bots are off. There were no open positions.";
  }
  if (input.closed <= 0) {
    return "Bots are off. Working orders are cancelled.";
  }
  if (input.cancelled <= 0) {
    return "Bots are off and positions are closed.";
  }
  return "Bots are off. Positions are closed and working orders are cancelled.";
}
