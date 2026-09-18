"use client";

import { useState } from "react";
import { SharedKeyWarning } from "@/components/shared-key-warning";
import {
  formatConnectionSummary,
  sharedKeyWarningKind,
  type ExchangeConnection,
} from "@/lib/exchanges/connections";
import { AppSelect } from "@/components/app-select";

export function ExchangeBindSelect({
  options,
  selectedId,
  allowNone,
  sharedConnectionIds,
}: {
  options: ExchangeConnection[];
  selectedId: string | null;
  allowNone: boolean;
  sharedConnectionIds: string[];
}) {
  const [value, setValue] = useState(selectedId ?? "none");
  const warningKind = sharedKeyWarningKind({
    connectionId: value,
    savedConnectionId: selectedId,
    sharedConnectionIds,
  });

  return (
    <>
      <AppSelect
        name="exchangeConnectionId"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none"
      >
        {allowNone ? <option value="none">None</option> : null}
        {options
          .filter(
            (row) =>
              row.id === selectedId || !sharedConnectionIds.includes(row.id),
          )
          .map((row) => (
          <option key={row.id} value={row.id}>
            {formatConnectionSummary(row)}
            {row.status === "invalid" ? " (Invalid)" : ""}
          </option>
        ))}
      </AppSelect>
      {sharedConnectionIds.length > 0 ? (
        <p className="mt-2 text-sm text-ink-muted">
          Keys already bound to another desk are not listed.
        </p>
      ) : null}
      {warningKind ? (
        <SharedKeyWarning kind={warningKind} className="mt-2" />
      ) : null}
    </>
  );
}
