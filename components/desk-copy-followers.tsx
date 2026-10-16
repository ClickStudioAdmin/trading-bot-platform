"use client";

import { type FormEvent, useMemo, useRef, useState } from "react";
import { AppCheck } from "@/components/app-check";
import { AppSelect } from "@/components/app-select";
import {
  ClickGateNotice,
  formSubmitAnchor,
  useClickGate,
} from "@/components/click-gate-notice";
import { useConfirmDialog } from "@/components/confirm-modal";
import {
  CopyInviteTrialLine,
  useCopyGateAccess,
} from "@/components/copy-gate-access";
import { IconFilterClear, IconPlus, IconReject } from "@/components/icons";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  SortTh,
  StatusBadge,
  TABLE_ACTIONS_TD_CLASS,
  TABLE_ACTIONS_TH_CLASS,
  TABLE_BTN_ICON,
  TABLE_FILTER_FIELD_CLASS,
  TABLE_LABEL_BTN_CLASS,
  TABLE_THEAD_CLASS,
  TABLE_TITLE_CASE_TH_CLASS,
  TableActions,
  TableCard,
  TableFilterBar,
  TableFilterField,
  TableFilterSession,
  TableLabelButton,
  TablePager,
  TablePendingIconAction,
  TablePendingLabelButton,
  TableSectionTitle,
  useClientTable,
} from "@/components/table-chrome";
import { Modal } from "@/components/template-modals";
import {
  inviteDeskCopyShareAction,
  revokeDeskCopyShareAction,
} from "@/lib/copy/actions";
import {
  COPY_FOLLOWING_UNAVAILABLE,
  copyFollowerCanRevoke,
  copyFollowerFiltersActive,
  copyFollowerMatchesFilters,
  copyFollowerSourceKey,
  copyOwnerFollowerLabel,
  copyOwnerFollowerSituation,
  copyShareCountsTowardCap,
  type CopyFollowerSourceFilter,
  type CopyFollowerStatusFilter,
  type CopyShareStatus,
  type DeskCopyFollowerView,
  type DeskCopyListing,
} from "@/lib/copy/model";
import { inviteDenial } from "@/lib/membership/entitlements";
import { compareTableNum, compareTableText, type TableSortDir } from "@/lib/table-chrome";
import { formatAuDateUtc, parseDisplayTime } from "@/lib/time/display";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

const EMPTY_FILTERS = {
  query: "",
  status: "" as CopyFollowerStatusFilter,
  source: "" as CopyFollowerSourceFilter,
};

type FollowerRow = {
  id: string;
  status: CopyShareStatus;
  label: string;
  sourceLabel: string;
  sourceKey: "catalogue" | "private";
  statusLabel: string;
  detail: string;
  sinceLabel: string;
  sinceMs: number;
  canRevoke: boolean;
};

function formatShareDay(value: string): string | null {
  const ms = parseDisplayTime(value);
  return ms == null ? null : formatAuDateUtc(ms);
}

function statusTone(status: CopyShareStatus): "success" | "accent" | "muted" {
  if (status === "active") {
    return "success";
  }
  if (status === "invited") {
    return "accent";
  }
  return "muted";
}

function sinceStamp(follower: DeskCopyFollowerView): string {
  return follower.status === "revoked" ? follower.updatedAt : follower.createdAt;
}

function compareFollowers(
  left: FollowerRow,
  right: FollowerRow,
  key: string,
  dir: TableSortDir,
): number {
  if (key === "member") {
    return compareTableText(left.label, right.label, dir);
  }
  if (key === "source") {
    return compareTableText(left.sourceLabel, right.sourceLabel, dir);
  }
  if (key === "status") {
    return compareTableText(left.statusLabel, right.statusLabel, dir);
  }
  if (key === "detail") {
    return compareTableText(left.detail, right.detail, dir);
  }
  if (key === "since") {
    return compareTableNum(left.sinceMs, right.sinceMs, dir);
  }
  return 0;
}

function revokeConfirm(count: number) {
  return {
    title: count === 1 ? "Revoke this invite?" : "Revoke these invites?",
    message:
      count === 1
        ? "This member stops receiving new copies of this desk. A copy desk they already opened stays until they unfollow."
        : "These members stop receiving new copies of this desk. Copy desks they already opened stay until they unfollow.",
    confirmLabel: "Revoke",
    danger: true,
  };
}

export function DeskCopyFollowersTable({
  accountId,
  listing,
  followers,
}: {
  accountId: string;
  listing: DeskCopyListing | null;
  followers: DeskCopyFollowerView[];
}) {
  const { confirm, dialog } = useConfirmDialog();
  const allowSubmit = useRef(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selected, setSelected] = useState<string[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const openCount = followers.filter((row) =>
    copyShareCountsTowardCap(row.status),
  ).length;
  const capLabel =
    listing?.maxFollowers == null
      ? `${openCount} invited`
      : `${openCount} of ${listing.maxFollowers} invited`;

  const rows = useMemo<FollowerRow[]>(() => {
    const sourceKey = copyFollowerSourceKey(listing?.visibility);
    return followers.map((follower) => {
      const since = sinceStamp(follower);
      const situation = copyOwnerFollowerSituation({
        status: follower.status,
        visibility: listing?.visibility,
        sharingEnabled: listing?.sharingEnabled ?? false,
        invitedOn: formatShareDay(follower.createdAt),
        updatedOn: formatShareDay(follower.updatedAt),
      });
      return {
        id: follower.id,
        status: follower.status,
        label: copyOwnerFollowerLabel({
          visibility: listing?.visibility,
          invitedEmail: follower.invitedEmail,
          toUserId: follower.toUserId,
        }),
        sourceLabel: situation.sourceLabel,
        sourceKey,
        statusLabel: situation.statusLabel,
        detail: situation.detail,
        sinceLabel: formatShareDay(since) ?? "—",
        sinceMs: parseDisplayTime(since) ?? 0,
        canRevoke: copyFollowerCanRevoke(follower.status),
      };
    });
  }, [followers, listing]);

  const filtered = useMemo(
    () =>
      rows.filter((row) =>
        copyFollowerMatchesFilters({
          label: row.label,
          status: row.status,
          source: row.sourceKey,
          query: filters.query,
          statusFilter: filters.status,
          sourceFilter: filters.source,
        }),
      ),
    [filters.query, filters.source, filters.status, rows],
  );
  const table = useClientTable(filtered, compareFollowers, {
    defaultKey: "since",
    defaultDir: "asc",
  });
  const filtering = copyFollowerFiltersActive(filters);
  const pageIds = table.pageRows
    .filter((row) => row.canRevoke)
    .map((row) => row.id);
  const selectedIds = selected.filter((id) =>
    rows.some((row) => row.id === id && row.canRevoke),
  );
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  function changeFilter(
    key: keyof typeof EMPTY_FILTERS,
    value: string,
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
    table.setPage(1);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    table.setPage(1);
  }

  function toggleAll() {
    setSelected((current) =>
      allPageSelected
        ? current.filter((id) => !pageIds.includes(id))
        : [...new Set([...current, ...pageIds])],
    );
  }

  function toggleOne(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function confirmThenSubmit(
    event: FormEvent<HTMLFormElement>,
    count: number,
  ) {
    if (allowSubmit.current) {
      allowSubmit.current = false;
      return;
    }
    event.preventDefault();
    const form = event.currentTarget;
    void confirm(revokeConfirm(count)).then((ok) => {
      if (!ok) {
        return;
      }
      allowSubmit.current = true;
      form.requestSubmit();
    });
  }

  return (
    <>
      {dialog}
      <TableFilterSession
        id={accountId}
        title={
          <TableSectionTitle
            title="Followers"
            subtitle={`Private invites show email. Public followers show user id. ${capLabel}.`}
          />
        }
        toolbar={
          selectedIds.length > 0 ? (
            <form
              action={revokeDeskCopyShareAction}
              onSubmit={(event) => confirmThenSubmit(event, selectedIds.length)}
              className="flex flex-wrap items-center gap-2"
            >
              {selectedIds.map((id) => (
                <input key={id} type="hidden" name="shareId" value={id} />
              ))}
              <p className="text-sm text-ink-muted">{selectedIds.length} selected</p>
              <TablePendingLabelButton
                variant="danger"
                pendingLabel="Revoking…"
                icon={<IconReject {...TABLE_BTN_ICON} />}
              >
                Revoke
              </TablePendingLabelButton>
            </form>
          ) : undefined
        }
        actions={
          <TableLabelButton
            variant="primary"
            icon={<IconPlus {...TABLE_BTN_ICON} />}
            onClick={() => setInviteOpen(true)}
          >
            Invite
          </TableLabelButton>
        }
      >
        <TableFilterBar>
          <TableFilterField label="Search">
            <input
              type="search"
              value={filters.query}
              onChange={(event) => changeFilter("query", event.target.value)}
              placeholder="Email or user id"
              autoComplete="off"
              className={TABLE_FILTER_FIELD_CLASS}
            />
          </TableFilterField>
          <TableFilterField label="Status" className="w-40 shrink-0">
            <AppSelect
              value={filters.status}
              onChange={(event) => changeFilter("status", event.target.value)}
              className={TABLE_FILTER_FIELD_CLASS}
            >
              <option value="">All</option>
              <option value="active">Following</option>
              <option value="invited">Invited</option>
              <option value="revoked">Revoked</option>
            </AppSelect>
          </TableFilterField>
          <TableFilterField label="Source" className="w-44 shrink-0">
            <AppSelect
              value={filters.source}
              onChange={(event) => changeFilter("source", event.target.value)}
              className={TABLE_FILTER_FIELD_CLASS}
            >
              <option value="">All</option>
              <option value="catalogue">Catalogue</option>
              <option value="private">Private invite</option>
            </AppSelect>
          </TableFilterField>
          <TableLabelButton
            variant="filter"
            icon={<IconFilterClear {...TABLE_BTN_ICON} />}
            onClick={clearFilters}
          >
            Clear
          </TableLabelButton>
        </TableFilterBar>
      </TableFilterSession>
      <TableCard
        className="mt-0"
        pager={
          <TablePager
            window={table.window}
            onPage={(page) => table.setPage(page)}
            onPrev={() => table.setPage(table.window.page - 1)}
            onNext={() => table.setPage(table.window.page + 1)}
          />
        }
      >
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className={`${TABLE_THEAD_CLASS} text-hint text-ink-muted`}>
            <tr>
              <th className="w-10 px-4 py-3 font-medium">
                <AppCheck
                  checked={allPageSelected}
                  indeterminate={
                    !allPageSelected &&
                    pageIds.some((id) => selectedIds.includes(id))
                  }
                  onChange={toggleAll}
                  disabled={pageIds.length === 0}
                  aria-label="Select all followers on this page"
                  className=""
                />
              </th>
              <SortTh
                label="Member"
                className={TABLE_TITLE_CASE_TH_CLASS}
                active={table.sortKey === "member"}
                dir={table.sortDir}
                onSort={() => table.onSort("member")}
              />
              <SortTh
                label="Source"
                className={TABLE_TITLE_CASE_TH_CLASS}
                active={table.sortKey === "source"}
                dir={table.sortDir}
                onSort={() => table.onSort("source")}
              />
              <SortTh
                label="Status"
                className={TABLE_TITLE_CASE_TH_CLASS}
                active={table.sortKey === "status"}
                dir={table.sortDir}
                onSort={() => table.onSort("status")}
              />
              <SortTh
                label="Since"
                className={TABLE_TITLE_CASE_TH_CLASS}
                active={table.sortKey === "since"}
                dir={table.sortDir}
                onSort={() => table.onSort("since")}
              />
              <SortTh
                label="Detail"
                className={TABLE_TITLE_CASE_TH_CLASS}
                active={table.sortKey === "detail"}
                dir={table.sortDir}
                onSort={() => table.onSort("detail")}
              />
              <th className={`${TABLE_ACTIONS_TH_CLASS} ${TABLE_TITLE_CASE_TH_CLASS}`}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {table.pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-sm text-ink-muted">
                  {filtering
                    ? "No followers match these filters."
                    : "No followers yet."}
                </td>
              </tr>
            ) : (
              table.pageRows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-3 align-top">
                    <AppCheck
                      checked={selectedIds.includes(row.id)}
                      onChange={() => toggleOne(row.id)}
                      disabled={!row.canRevoke}
                      aria-label={`Select ${row.label}`}
                      className=""
                    />
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-ink">
                    {row.label}
                  </td>
                  <td className="px-4 py-3 align-top text-ink-muted">
                    {row.sourceLabel}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <StatusBadge label={row.statusLabel} tone={statusTone(row.status)} />
                  </td>
                  <td className="px-4 py-3 align-top tabular-nums text-ink-muted">
                    {row.sinceLabel}
                  </td>
                  <td className="px-4 py-3 align-top text-ink-muted">{row.detail}</td>
                  <td className={TABLE_ACTIONS_TD_CLASS}>
                    {row.canRevoke ? (
                      <form
                        action={revokeDeskCopyShareAction}
                        onSubmit={(event) => confirmThenSubmit(event, 1)}
                      >
                        <input type="hidden" name="shareId" value={row.id} />
                        <TableActions>
                          <TablePendingIconAction
                            label="Revoke"
                            detail="Stop this member receiving new copies of this desk."
                            danger
                            pendingLabel="Revoking…"
                            successKey={`revoke-desk-copy-${row.id}`}
                          >
                            <IconReject {...TABLE_BTN_ICON} />
                          </TablePendingIconAction>
                        </TableActions>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableCard>
      {inviteOpen ? (
        <DeskCopyInviteModal
          listing={listing}
          followerCount={openCount}
          onClose={() => setInviteOpen(false)}
        />
      ) : null}
    </>
  );
}

function DeskCopyInviteModal({
  listing,
  followerCount,
  onClose,
}: {
  listing: DeskCopyListing | null;
  followerCount: number;
  onClose: () => void;
}) {
  const gate = useCopyGateAccess();
  const clickGate = useClickGate();
  const inviteReady =
    Boolean(listing?.sharingEnabled) && Boolean(listing?.allowNewFollowers);

  function onInvite(event: FormEvent<HTMLFormElement>) {
    if (!gate) {
      return;
    }
    const denial = inviteDenial(gate, followerCount);
    if (!denial) {
      clickGate.hide();
      return;
    }
    event.preventDefault();
    clickGate.show(denial, formSubmitAnchor(event));
  }

  return (
    <Modal title="Invite" onClose={onClose}>
      <p className="mt-2 text-sm text-ink-muted">
        Invite a member by email. They must already have a login. No email is
        sent.
      </p>
      <div className="mt-4">
        {!listing ? (
          <p className="text-sm text-ink-muted">
            Save share settings on Desk Settings before inviting.
          </p>
        ) : !listing.sharingEnabled ? (
          <p
            role="note"
            className="rounded-card border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"
          >
            {COPY_FOLLOWING_UNAVAILABLE} New invites are paused.
          </p>
        ) : inviteReady ? (
          <form
            action={inviteDeskCopyShareAction}
            onSubmit={onInvite}
            className="space-y-3"
          >
            <CopyInviteTrialLine followerCount={followerCount} />
            <ClickGateNotice
              access={clickGate.notice}
              anchorRef={clickGate.anchorRef}
              generation={clickGate.generation}
              onDismiss={clickGate.hide}
            />
            <label className="block text-sm text-ink">
              Invite email
              <input
                type="email"
                name="email"
                required
                autoComplete="off"
                placeholder="member@email"
                className={fieldClass}
              />
            </label>
            <PendingSubmitButton
              pendingLabel="Inviting…"
              successKey="invite-desk-copy"
              className={TABLE_LABEL_BTN_CLASS.primary}
            >
              Send invite
            </PendingSubmitButton>
          </form>
        ) : listing.allowNewFollowers ? (
          <p className="text-sm text-ink-muted">
            Sharing is blocked until Desk Settings is ready.
          </p>
        ) : (
          <p className="text-sm text-ink-muted">
            New followers are off. Existing invites stay until you revoke them.
          </p>
        )}
      </div>
    </Modal>
  );
}
