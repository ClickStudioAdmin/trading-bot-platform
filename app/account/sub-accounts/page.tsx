import type { Metadata } from "next";
import Link from "next/link";
import { AccountExchangesPanel } from "@/components/account-exchanges-panel";
import { DeskTable } from "@/components/desk-table";
import { PageHeading } from "@/components/page-heading";
import { pickDefaultAccount } from "@/lib/accounts/model";
import {
  listTradingAccounts,
  loadAccountUsage,
} from "@/lib/accounts/store";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { AFFILIATES_PATH } from "@/lib/auth/onboarding-path";
import { requireVerifiedEmail } from "@/lib/auth/session";
import { firstSearchValue } from "@/lib/paper/open";
import {
  ACCOUNT_DESKS_HREF,
  ACCOUNT_EXCHANGES_HREF,
} from "@/lib/site-links";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Manage Desks",
  description: "Rename, disable, and delete desks, and manage exchange keys.",
};

export default async function ManageSubAccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await requireVerifiedEmail();
  if (!member.platformMember) {
    redirect(AFFILIATES_PATH);
  }
  const params = await searchParams;
  const tab = firstSearchValue(params.tab) === "exchanges" ? "exchanges" : "desks";
  const error = firstSearchValue(params.error);
  const deleted = firstSearchValue(params.deleted) === "1";
  const renamed = firstSearchValue(params.renamed) === "1";
  const saved = firstSearchValue(params.saved) === "1";
  const replaced = firstSearchValue(params.replaced) === "1";
  const removed = firstSearchValue(params.removed) === "1";

  return (
    <div>
      <PageHeading title="Manage Desks" tour="manage-desks" />
      <nav
        aria-label="Manage Desks"
        className="mt-5 flex flex-wrap border-b border-line"
      >
        <TabLink href={ACCOUNT_DESKS_HREF} selected={tab === "desks"}>
          Desks
        </TabLink>
        <TabLink
          href={ACCOUNT_EXCHANGES_HREF}
          selected={tab === "exchanges"}
          tour="exchanges"
        >
          Exchanges
        </TabLink>
      </nav>
      {tab === "exchanges" ? (
        <div className="mt-6">
          <AccountExchangesPanel
            memberId={member.id}
            error={error}
            saved={saved}
            renamed={renamed}
            replaced={replaced}
            removed={removed}
          />
        </div>
      ) : (
        <DesksTab
          memberId={member.id}
          error={error}
          deleted={deleted}
          renamed={renamed}
        />
      )}
    </div>
  );
}

async function DesksTab({
  memberId,
  error,
  deleted,
  renamed,
}: {
  memberId: string;
  error?: string;
  deleted: boolean;
  renamed: boolean;
}) {
  const accounts = await listTradingAccounts(memberId);
  const [usage, connections] = await Promise.all([
    loadAccountUsage(accounts),
    listExchangeConnections(memberId),
  ]);
  const currentId = pickDefaultAccount(accounts)?.id ?? "";

  return (
    <div className="mt-6">
      {error ? (
        <p className="mb-6 rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {deleted ? (
        <p className="mb-6 text-sm text-success">Desk deleted.</p>
      ) : null}
      {renamed ? (
        <p className="mb-6 text-sm text-success">Desk renamed.</p>
      ) : null}

      <DeskTable
        accounts={accounts}
        usage={Object.fromEntries(usage)}
        connections={connections}
        currentId={currentId}
      />
    </div>
  );
}

function TabLink({
  href,
  selected,
  children,
  tour,
}: {
  href: string;
  selected: boolean;
  children: string;
  tour?: string;
}) {
  return (
    <Link
      href={href}
      data-tour={tour}
      className={`-mb-px border-b-2 px-3 py-2 text-sm ${
        selected
          ? "border-accent text-ink"
          : "border-transparent text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

