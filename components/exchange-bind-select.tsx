"use client";

import { useState } from "react";
import { SharedKeyWarning } from "@/components/shared-key-warning";
import {
  connectionListedForBind,
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
  allowSharedKeys = false,
}: {
  options: ExchangeConnection[];
  selectedId: string | null;
  allowNone: boolean;
  sharedConnectionIds: string[];
  allowSharedKeys?: boolean;
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
        className="mt-1 w-full"
      >
        {allowNone ? <option value="none">None</option> : null}
        {options
          .filter((row) =>
            connectionListedForBind({
              connectionId: row.id,
              selectedId,
              sharedConnectionIds,
              allowShared: allowSharedKeys,
            }),
          )
          .map((row) => (
          <option key={row.id} value={row.id}>
            {formatConnectionSummary(row)}
            {row.status === "invalid" ? " (Invalid)" : ""}
          </option>
        ))}
      </AppSelect>
      {!allowSharedKeys && sharedConnectionIds.length > 0 ? (
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
