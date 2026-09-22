import type { Metadata } from "next";
import Link from "next/link";
import { AutomationsPageFrame } from "@/components/automations-page-frame";
import { AutomationsDesk } from "@/components/paper-rules-form";
import { deskHref } from "@/lib/accounts/model";
import {
  AUTOMATIONS_NEW,
  CASH_AND_CARRY_AUTOMATIONS_PATH,
  automationsEditTitle,
  parseAutomationsClone,
  parseAutomationsEdit,
} from "@/lib/bots/automations-path";
import { paperAutomationsBotBlotter } from "@/lib/bots/automations-list";
import { loadPaperRules } from "@/lib/engine/load";
import { paperConfigToFormValues } from "@/lib/engine/rules";
import { listPaperCarries } from "@/lib/paper/list";
import { firstSearchValue } from "@/lib/paper/open";
import { getSessionContext } from "@/lib/auth/session";
import { memberIsAdmin } from "@/lib/admin/access";
import {
  listApplyableSets,
  listApplyableTemplates,
  templateToSummary,
} from "@/lib/templates/store";

export const metadata: Metadata = {
  title: "Automations (bots)",
  description: "Cash-and-carry bots.",
};

export default async function CashAndCarryAutomationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSessionContext();
  const { signedIn, config, inUseRuleIds } = await loadPaperRules();
  const values = paperConfigToFormValues(config);
  const listHref = deskHref(CASH_AND_CARRY_AUTOMATIONS_PATH, session?.account.id);
  const requestedEdit = parseAutomationsEdit(firstSearchValue(params.edit));
  const clone = parseAutomationsClone(firstSearchValue(params.clone));
  const knownEdit =
    requestedEdit &&
    requestedEdit !== AUTOMATIONS_NEW &&
    !values.layers.some((layer) => layer.id === requestedEdit)
      ? null
      : requestedEdit;
  const editTitle = automationsEditTitle({
    edit: knownEdit,
    name: values.layers.find((layer) => layer.id === knownEdit)?.name,
  });
  const saved = firstSearchValue(params.saved) === "1";
  const error = firstSearchValue(params.error);
  const templates = session
    ? await listApplyableTemplates({
        userId: session.member.id,
        deskType: "cash_and_carry",
      })
    : [];
  const sets = session
    ? await listApplyableSets({
        userId: session.member.id,
        deskType: "cash_and_carry",
      })
    : [];
  const carries = session ? await listPaperCarries() : [];
  const paperOpen = carries.filter((row) => row.status !== "closed");
  const paperClosed = carries.filter((row) => row.status === "closed");
  const blotter = Object.fromEntries(
    values.layers
      .filter((layer) => layer.id)
      .map((layer) => [
        layer.id,
        paperAutomationsBotBlotter(layer.id, paperOpen, paperClosed),
      ]),
  );

  return (
    <AutomationsPageFrame listHref={listHref} editTitle={editTitle}>
      {error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-4 text-sm text-success">Bots saved.</p>
      ) : null}
      {signedIn && session ? (
        <div className="mt-6">
          <AutomationsDesk
            values={values}
            inUseRuleIds={inUseRuleIds}
            reduceOnly={Boolean(config.reduceOnly)}
            isAdmin={memberIsAdmin(session.member)}
            accountId={session.account.id}
            templates={templates.map(templateToSummary)}
            sets={sets}
            recipeLibrary={templates}
            edit={knownEdit}
            clone={clone}
            listHref={listHref}
            blotter={blotter}
          />
        </div>
      ) : (
        <p className="mt-6 text-sm text-ink-muted">
          <Link href="/sign-in" className="text-accent">
            Sign in
          </Link>{" "}
          to save automations.
        </p>
      )}
    </AutomationsPageFrame>
  );
}
