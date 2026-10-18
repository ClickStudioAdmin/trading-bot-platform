"use client";

import { AppSelect } from "@/components/app-select";
import {
  HintLabel,
  botFieldInvalidClass,
} from "@/components/bot-form-chrome";
import { GroupedNumberInput } from "@/components/usdt-size-input";

export type ProtectionDraft = {
  is: "protected" | "unprotected";
  amount: "entire" | "at_least";
  pct: string;
};

export function blankProtectionDraft(): ProtectionDraft {
  return { is: "protected", amount: "entire", pct: "" };
}

export function ProtectionFields({
  prefix,
  draft,
  onChange,
  fieldClass,
  labelClass,
  showErrors = false,
}: {
  prefix: string;
  draft: ProtectionDraft;
  onChange: (next: ProtectionDraft) => void;
  fieldClass: string;
  labelClass: string;
  showErrors?: boolean;
}) {
  const pctMissing =
    draft.amount === "at_least" &&
    !(Number(draft.pct.replace(/,/g, "").trim()) > 0);
  return (
    <>
      <label className={labelClass}>
        <HintLabel text="Position" required />
        <AppSelect value="bot" className={fieldClass} disabled>
          <option value="bot">This bot</option>
        </AppSelect>
      </label>
      <label className={labelClass}>
        <HintLabel text="Is" required />
        <AppSelect
          name={prefix ? `${prefix}ProtectionIs` : undefined}
          value={draft.is}
          onChange={(event) =>
            onChange({
              ...draft,
              is: event.target.value === "unprotected" ? "unprotected" : "protected",
            })
          }
          className={fieldClass}
        >
          <option value="protected">Protected</option>
          <option value="unprotected">Not protected</option>
        </AppSelect>
      </label>
      <label className={labelClass}>
        <HintLabel text="Amount" required />
        <AppSelect
          name={prefix ? `${prefix}ProtectionAmount` : undefined}
          value={draft.amount}
          onChange={(event) =>
            onChange({
              ...draft,
              amount: event.target.value === "at_least" ? "at_least" : "entire",
            })
          }
          className={fieldClass}
        >
          <option value="entire">Entire position</option>
          <option value="at_least">At least %</option>
        </AppSelect>
      </label>
      {draft.amount === "at_least" ? (
        <label className={labelClass}>
          <HintLabel text="At least %" required />
          <GroupedNumberInput
            name={prefix ? `${prefix}ProtectionPct` : undefined}
            value={draft.pct}
            onChange={(pct) => onChange({ ...draft, pct })}
            allowDecimal
            className={showErrors && pctMissing ? botFieldInvalidClass : fieldClass}
          />
        </label>
      ) : null}
    </>
  );
}
