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
import { listPaperCarriesFiltered } from "@/lib/paper/list";
import { firstSearchValue } from "@/lib/paper/open";
import { getSessionContext } from "@/lib/auth/session";
import { memberIsAdmin } from "@/lib/admin/access";
import {
  listApplyableSets,
  listApplyableTemplates,
  templateToSummary,
} from "@/lib/templates/store";

export const metadata: Metadata = {
  title: "Bots",
  description: "Cash-and-carry bots.",
};

export default async function CashAndCarryAutomationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSessionContext();
  const listHref = deskHref(CASH_AND_CARRY_AUTOMATIONS_PATH, session?.account.id);
  const saved = firstSearchValue(params.saved) === "1";
  const createdId = firstSearchValue(params.created);
  const error = firstSearchValue(params.error);
  if (!session) {
    return (
      <AutomationsPageFrame listHref={listHref} editTitle={null}>
        <h2 className="text-lg font-semibold tracking-tight">Bots</h2>
        <p className="mt-6 text-sm text-ink-muted">
          <Link href="/sign-in" className="text-accent">
            Sign in
          </Link>{" "}
          to save automations.
        </p>
      </AutomationsPageFrame>
    );
  }
  const requestedEdit = parseAutomationsEdit(firstSearchValue(params.edit));
  const clone = parseAutomationsClone(firstSearchValue(params.clone));
  const openingForm = Boolean(requestedEdit || clone);
  const [loaded, templates, sets, paperOpen, paperClosed] = await Promise.all([
    loadPaperRules(),
    listApplyableTemplates({
      userId: session.member.id,
      deskType: "cash_and_carry",
    }).catch(() => []),
    listApplyableSets({
      userId: session.member.id,
      deskType: "cash_and_carry",
    }).catch(() => []),
    listPaperCarriesFiltered({ status: "open" }),
    listPaperCarriesFiltered({ status: "closed" }),
  ]);
  const values = paperConfigToFormValues(loaded.config);
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
      {loaded.signedIn ? (
        <div className="mt-6">
          <AutomationsDesk
            values={values}
            inUseRuleIds={loaded.inUseRuleIds}
            reduceOnly={Boolean(loaded.config.reduceOnly)}
            isAdmin={memberIsAdmin(session.member)}
            accountId={session.account.id}
            templates={templates.map(templateToSummary)}
            sets={sets}
            recipeLibrary={openingForm ? templates : []}
            edit={knownEdit}
            clone={clone}
            listHref={listHref}
            blotter={blotter}
            revealId={createdId}
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
