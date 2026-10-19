import type { PositionBuilderAccess } from "@/lib/membership/entitlements";

export type PositionBuilderCounts = {
  conditions: number;
  groups: number;
  actions: number;
};

type StackLike = {
  leaves?: readonly unknown[] | null;
  joins?: readonly string[] | null;
} | null;

type ExitActionLike = {
  groups?: readonly { rows?: readonly unknown[] | null }[] | null;
};

/** The stacks a Flex rule or DCA playbook can grow. */
export type PositionBuilderParts = {
  entryStack?: StackLike;
  confirm?: unknown;
  shortEntryStack?: StackLike;
  shortConfirm?: unknown;
  addStack?: StackLike;
  shortAddStack?: StackLike;
  exitStack?: StackLike;
  shortExitStack?: StackLike;
  exitActions?: readonly ExitActionLike[] | null;
  shortExitActions?: readonly ExitActionLike[] | null;
};

export function emptyPositionBuilderCounts(): PositionBuilderCounts {
  return { conditions: 0, groups: 0, actions: 0 };
}

function addStack(
  counts: PositionBuilderCounts,
  stack: StackLike | undefined,
  confirm: unknown,
) {
  const leaves = stack?.leaves?.length ?? 0;
  if (leaves > 0) {
    counts.conditions += leaves;
    for (const join of stack?.joins ?? []) {
      if (join === "or") {
        counts.groups += 1;
      }
    }
    return;
  }
  if (confirm) {
    counts.conditions += 1;
  }
}

function addPlainStack(counts: PositionBuilderCounts, stack: StackLike | undefined) {
  const leaves = stack?.leaves?.length ?? 0;
  if (leaves === 0) {
    return;
  }
  counts.conditions += leaves;
  for (const join of stack?.joins ?? []) {
    if (join === "or") {
      counts.groups += 1;
    }
  }
}

function addActions(
  counts: PositionBuilderCounts,
  actions: readonly ExitActionLike[] | null | undefined,
) {
  for (const action of actions ?? []) {
    counts.actions += 1;
    const groups = action.groups ?? [];
    if (groups.length > 1) {
      counts.groups += groups.length - 1;
    }
    for (const group of groups) {
      counts.conditions += group.rows?.length ?? 0;
    }
  }
}

export function countPositionBuilderParts(
  parts: PositionBuilderParts | null | undefined,
): PositionBuilderCounts {
  const counts = emptyPositionBuilderCounts();
  if (!parts) {
    return counts;
  }
  addStack(counts, parts.entryStack, parts.confirm);
  addStack(counts, parts.shortEntryStack, parts.shortConfirm);
  addPlainStack(counts, parts.addStack);
  addPlainStack(counts, parts.shortAddStack);
  addPlainStack(counts, parts.exitStack);
  addPlainStack(counts, parts.shortExitStack);
  addActions(counts, parts.exitActions);
  addActions(counts, parts.shortExitActions);
  return counts;
}

export function positionBuilderGrew(
  before: PositionBuilderCounts,
  after: PositionBuilderCounts,
): boolean {
  return (
    after.conditions > before.conditions ||
    after.groups > before.groups ||
    after.actions > before.actions
  );
}

/**
 * A closed Position Builder still saves the conditions a bot already has.
 * Growing that structure is the denial. An open trial or an included feature
 * returns null.
 */
export function positionBuilderSaveDenial(
  access: Pick<PositionBuilderAccess, "allowed" | "message">,
  before: PositionBuilderCounts,
  after: PositionBuilderCounts,
): string | null {
  if (access.allowed || !positionBuilderGrew(before, after)) {
    return null;
  }
  return access.message ?? "Position Builder is not allowed on your plan.";
}
