"use client";

import { useConfirmDialog } from "@/components/confirm-modal";
import {
  archiveMembershipPlanAction,
  deleteMembershipPlanAction,
  unarchiveMembershipPlanAction,
} from "@/lib/membership/actions";
import type { MembershipPlan } from "@/lib/membership/catalog";
import {
  canArchivePlan,
  canDeletePlan,
  planIsArchived,
} from "@/lib/membership/catalog";

const ghost =
  "rounded-control px-2 py-1 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink";

export function AdminPlanRowActions({ plan }: { plan: MembershipPlan }) {
  const { confirm, dialog } = useConfirmDialog();
  const archived = planIsArchived(plan);

  async function onArchive() {
    const ok = await confirm({
      title: "Archive this plan?",
      message:
        "It leaves the public catalog. Members already on it stay until they change. You can un-archive later.",
      confirmLabel: "Archive",
    });
    if (!ok) {
      return;
    }
    const data = new FormData();
    data.set("planId", plan.id);
    await archiveMembershipPlanAction(data);
  }

  async function onUnarchive() {
    const data = new FormData();
    data.set("planId", plan.id);
    await unarchiveMembershipPlanAction(data);
  }

  async function onDelete() {
    const ok = await confirm({
      title: "Delete this plan?",
      message: "Only unused drafts can be deleted. This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) {
      return;
    }
    const data = new FormData();
    data.set("planId", plan.id);
    await deleteMembershipPlanAction(data);
  }

  return (
    <div className="flex flex-wrap justify-end gap-1">
      {dialog}
      {archived ? (
        <button type="button" className={ghost} onClick={() => void onUnarchive()}>
          Un-archive
        </button>
      ) : canArchivePlan(plan) ? (
        <button type="button" className={ghost} onClick={() => void onArchive()}>
          Archive
        </button>
      ) : null}
      {canDeletePlan(plan) ? (
        <button
          type="button"
          className="rounded-control px-2 py-1 text-sm text-danger hover:bg-danger/10"
          onClick={() => void onDelete()}
        >
          Delete
        </button>
      ) : null}
    </div>
  );
}
