"use client";

import { useConfirmDialog } from "@/components/confirm-modal";
import {
  IconArchive,
  IconCopy,
  IconTrash,
  IconUnarchive,
} from "@/components/icons";
import { TABLE_BTN_ICON, TableIconAction } from "@/components/table-chrome";
import {
  archiveMembershipPlanAction,
  cloneMembershipPlanAction,
  deleteMembershipPlanAction,
  unarchiveMembershipPlanAction,
} from "@/lib/membership/actions";
import type { MembershipPlan } from "@/lib/membership/catalog";
import {
  canArchivePlan,
  canDeletePlan,
  planIsArchived,
} from "@/lib/membership/catalog";

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

  async function onClone() {
    const data = new FormData();
    data.set("planId", plan.id);
    await cloneMembershipPlanAction(data);
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
      <TableIconAction
        label="Clone"
        detail="Make a draft copy of this plan."
        onClick={() => void onClone()}
      >
        <IconCopy {...TABLE_BTN_ICON} />
      </TableIconAction>
      {archived ? (
        <TableIconAction
          label="Un-archive"
          detail="Put this plan back in the catalog."
          onClick={() => void onUnarchive()}
        >
          <IconUnarchive {...TABLE_BTN_ICON} />
        </TableIconAction>
      ) : canArchivePlan(plan) ? (
        <TableIconAction
          label="Archive"
          detail="Hide this plan from the public catalog."
          onClick={() => void onArchive()}
        >
          <IconArchive {...TABLE_BTN_ICON} />
        </TableIconAction>
      ) : null}
      {canDeletePlan(plan) ? (
        <TableIconAction
          danger
          label="Delete"
          detail="Permanently delete this unused draft."
          onClick={() => void onDelete()}
        >
          <IconTrash {...TABLE_BTN_ICON} />
        </TableIconAction>
      ) : null}
    </div>
  );
}
