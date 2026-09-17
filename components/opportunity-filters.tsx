import {
  LiveGetForm,
  TABLE_FILTER_CLEAR_CLASS,
  TABLE_FILTER_FIELD_CLASS,
  TableFilterField,
} from "@/components/table-chrome";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import type { OpportunityFilterInputs } from "@/lib/opportunities/filter";
import { DESK_QUERY, deskHref } from "@/lib/accounts/model";

export function OpportunityFiltersForm({
  values,
  deskId,
}: {
  values: OpportunityFilterInputs;
  deskId?: string | null;
}) {
  const clearHref = deskHref(
    "/strategies/cash-and-carry/opportunities",
    deskId,
  );
  return (
    <LiveGetForm>
      {deskId ? (
        <input type="hidden" name={DESK_QUERY} value={deskId} />
      ) : null}
      <input type="hidden" name="page" value="1" />
      <Field
        id="minApr"
        name="minApr"
        label="Min net APR %"
        defaultValue={values.minApr}
      />
      <Field
        id="minDte"
        name="minDte"
        label="Min DTE"
        defaultValue={values.minDte}
      />
      <Field
        id="maxDte"
        name="maxDte"
        label="Max DTE"
        defaultValue={values.maxDte}
      />
      <Field
        id="minCapacity"
        name="minCapacity"
        label="Min usable book"
        defaultValue={values.minCapacity}
      />
      <a href={clearHref} className={TABLE_FILTER_CLEAR_CLASS}>
        Clear
      </a>
    </LiveGetForm>
  );
}

function Field({
  id,
  name,
  label,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <TableFilterField label={label}>
      <GroupedNumberInput
        id={id}
        name={name}
        defaultValue={defaultValue}
        allowDecimal
        className={TABLE_FILTER_FIELD_CLASS}
      />
    </TableFilterField>
  );
}
