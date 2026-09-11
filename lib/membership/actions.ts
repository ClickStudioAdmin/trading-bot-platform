"use server";

import { requireAdmin } from "@/lib/admin/access";
import { writeEventLog } from "@/lib/logs/write";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parsePlanForm, parsePlanId } from "./form";
import {
  archiveMembershipPlan,
  cloneMembershipPlan,
  deleteMembershipPlan,
  saveMembershipPlan,
  unarchiveMembershipPlan,
} from "./store";

function fail(path: string, error: string): never {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}

function refreshPlans() {
  revalidatePath("/admin/plans");
  revalidatePath("/account/plans");
}

export async function createMembershipPlanAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = parsePlanForm(formData);
  if (!parsed.ok) {
    fail("/admin/plans/new", parsed.error);
  }
  const saved = await saveMembershipPlan({ values: parsed.values });
  if (!saved.ok) {
    fail("/admin/plans/new", saved.error);
  }
  await writeEventLog({
    scope: "system",
    event: "membership.plan_created",
    message: `Created plan ${parsed.values.name}`,
    userId: admin.id,
    data: { planId: saved.id, slug: parsed.values.slug },
  });
  refreshPlans();
  redirect(`/admin/plans/${saved.id}?created=1`);
}

export async function updateMembershipPlanAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = parsePlanId(String(formData.get("planId") ?? ""));
  if (!id) {
    fail("/admin/plans", "Missing plan.");
  }
  const parsed = parsePlanForm(formData);
  if (!parsed.ok) {
    fail(`/admin/plans/${id}`, parsed.error);
  }
  const saved = await saveMembershipPlan({ id, values: parsed.values });
  if (!saved.ok) {
    fail(`/admin/plans/${id}`, saved.error);
  }
  await writeEventLog({
    scope: "system",
    event: "membership.plan_updated",
    message: `Updated plan ${parsed.values.name}`,
    userId: admin.id,
    data: { planId: id },
  });
  refreshPlans();
  redirect(`/admin/plans/${id}?saved=1`);
}

export async function cloneMembershipPlanAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = parsePlanId(String(formData.get("planId") ?? ""));
  if (!id) {
    fail("/admin/plans", "Missing plan.");
  }
  const saved = await cloneMembershipPlan(id);
  if (!saved.ok) {
    fail("/admin/plans", saved.error);
  }
  await writeEventLog({
    scope: "system",
    event: "membership.plan_cloned",
    message: "Cloned a membership plan",
    userId: admin.id,
    data: { sourcePlanId: id, planId: saved.id },
  });
  refreshPlans();
  redirect(`/admin/plans/${saved.id}?cloned=1`);
}

export async function archiveMembershipPlanAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = parsePlanId(String(formData.get("planId") ?? ""));
  if (!id) {
    fail("/admin/plans", "Missing plan.");
  }
  const result = await archiveMembershipPlan(id);
  if (!result.ok) {
    fail("/admin/plans", result.error);
  }
  await writeEventLog({
    scope: "system",
    event: "membership.plan_archived",
    message: "Archived a membership plan",
    userId: admin.id,
    data: { planId: id },
  });
  refreshPlans();
  redirect("/admin/plans?archived=1");
}

export async function unarchiveMembershipPlanAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = parsePlanId(String(formData.get("planId") ?? ""));
  if (!id) {
    fail("/admin/plans", "Missing plan.");
  }
  const result = await unarchiveMembershipPlan(id);
  if (!result.ok) {
    fail("/admin/plans", result.error);
  }
  await writeEventLog({
    scope: "system",
    event: "membership.plan_unarchived",
    message: "Unarchived a membership plan",
    userId: admin.id,
    data: { planId: id },
  });
  refreshPlans();
  redirect("/admin/plans?unarchived=1");
}

export async function deleteMembershipPlanAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = parsePlanId(String(formData.get("planId") ?? ""));
  if (!id) {
    fail("/admin/plans", "Missing plan.");
  }
  const result = await deleteMembershipPlan(id);
  if (!result.ok) {
    fail("/admin/plans", result.error);
  }
  await writeEventLog({
    scope: "system",
    event: "membership.plan_deleted",
    message: "Deleted an unused membership plan",
    userId: admin.id,
    data: { planId: id },
  });
  refreshPlans();
  redirect("/admin/plans?deleted=1");
}
