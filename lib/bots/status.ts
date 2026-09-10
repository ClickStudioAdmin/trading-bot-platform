export type BotDeskKind = "perps" | "dca" | "cnc";

export type PerpsCncStatus = "active" | "reduce_only" | "disabled";
export type DcaBotStatus = "active" | "stop_adding" | "disabled";
export type BotStatus = PerpsCncStatus | DcaBotStatus;

export type BotStatusOption = {
  value: string;
  label: string;
  fill: string;
  note: string;
};

export const PERPS_STATUS_OPTIONS: readonly BotStatusOption[] = [
  {
    value: "active",
    label: "Active",
    fill: "bg-success",
    note: "Save turns this bot on. It may open and add. Existing rows stay.",
  },
  {
    value: "reduce_only",
    label: "Reduce only",
    fill: "bg-warning",
    note: "Save stops new opens and adds. Exits still run. Existing rows stay.",
  },
  {
    value: "disabled",
    label: "Disabled",
    fill: "bg-ink-faint",
    note: "Save closes every position this bot owns and turns it off.",
  },
];

export const CNC_STATUS_OPTIONS: readonly BotStatusOption[] = [
  {
    value: "active",
    label: "Active",
    fill: "bg-success",
    note: "Save turns this bot on. It may open and add carries. Existing rows stay.",
  },
  {
    value: "reduce_only",
    label: "Reduce only",
    fill: "bg-warning",
    note: "Save stops new opens and adds. Exits still run. Existing carries stay.",
  },
  {
    value: "disabled",
    label: "Disabled",
    fill: "bg-ink-faint",
    note: "Save closes every carry this bot owns and turns it off.",
  },
];

export const DCA_STATUS_OPTIONS: readonly BotStatusOption[] = [
  {
    value: "active",
    label: "Active",
    fill: "bg-success",
    note: "Save turns this bot on. It listens for entries. Existing clips stay.",
  },
  {
    value: "stop_adding",
    label: "Stop adding",
    fill: "bg-warning",
    note: "Save stops new clips. Exits still run. Existing clips stay.",
  },
  {
    value: "disabled",
    label: "Disabled",
    fill: "bg-ink-faint",
    note: "Save closes every position this bot owns and turns it off.",
  },
];

export function statusOptionsFor(desk: BotDeskKind): readonly BotStatusOption[] {
  if (desk === "dca") {
    return DCA_STATUS_OPTIONS;
  }
  if (desk === "cnc") {
    return CNC_STATUS_OPTIONS;
  }
  return PERPS_STATUS_OPTIONS;
}

export function dcaStatusFromLegs(input: {
  armed: boolean;
  stopAdding: boolean;
}): DcaBotStatus {
  if (input.armed) {
    return "active";
  }
  if (input.stopAdding) {
    return "stop_adding";
  }
  return "disabled";
}

export function parseDcaBotStatus(raw: unknown): DcaBotStatus {
  const value = String(raw ?? "").trim();
  if (value === "stop_adding" || value === "disabled") {
    return value;
  }
  return "active";
}

export function flattenOwnedRuleIds<
  T extends { id: string | number | null; mode: string },
>(rules: readonly T[]): Array<T & { id: NonNullable<T["id"]> }> {
  return rules.filter(
    (rule): rule is T & { id: NonNullable<T["id"]> } =>
      rule.mode === "disabled" &&
      rule.id != null &&
      String(rule.id).trim() !== "",
  );
}

export function dcaSaveVerb(input: {
  selected: DcaBotStatus;
  running: boolean;
  armed: boolean;
  hasOpenPosition: boolean;
}): "save" | "arm" | "disarm" | "close-playbook" {
  if (input.selected === "disabled") {
    if (input.hasOpenPosition) {
      return "close-playbook";
    }
    return input.armed || input.running ? "disarm" : "save";
  }
  if (input.selected === "stop_adding") {
    return input.armed ? "disarm" : "save";
  }
  if (input.running && input.armed) {
    return "save";
  }
  return "arm";
}

export function disableNeedsConfirm(ownsOpen: boolean): boolean {
  return ownsOpen;
}

export function disableConfirmTitle(): string {
  return "Disable this bot?";
}

export function disableConfirmMessage(desk: BotDeskKind): string {
  if (desk === "cnc") {
    return "Disabled closes every carry this bot owns and turns it off.";
  }
  return "Disabled closes every position this bot owns and turns it off.";
}
