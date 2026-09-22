import { IconFilterClear } from "@/components/icons";
import {
  LiveGetForm,
  TABLE_BTN_ICON,
  TABLE_FILTER_FIELD_CLASS,
  TableFilterField,
  TableLabelButton,
} from "@/components/table-chrome";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import type { PairFilterInputs } from "@/lib/pairs/filter";
import { DESK_QUERY } from "@/lib/accounts/model";
import { PAIR_DEFAULT_DIR, PAIR_DEFAULT_SORT } from "@/lib/pairs/page";
import type { TableSortDir } from "@/lib/table-chrome";
import { AppSelect } from "@/components/app-select";

export function PairFiltersForm({
  clearHref,
  values,
  bases,
  showDte = false,
  deskId,
  keep,
  sort,
  dir,
}: {
  clearHref: string;
  values: PairFilterInputs;
  bases?: readonly string[];
  showDte?: boolean;
  deskId?: string | null;
  keep?: Record<string, string | undefined>;
  sort?: string;
  dir?: TableSortDir;
}) {
  return (
    <LiveGetForm>
      {deskId ? (
        <input type="hidden" name={DESK_QUERY} value={deskId} />
      ) : null}
      {Object.entries(keep ?? {}).map(([name, value]) =>
        value ? (
          <input key={name} type="hidden" name={name} value={value} />
        ) : null,
      )}
      <input type="hidden" name="page" value="1" />
      {sort && sort !== PAIR_DEFAULT_SORT ? (
        <input type="hidden" name="sort" value={sort} />
      ) : null}
      {dir && dir !== PAIR_DEFAULT_DIR ? (
        <input type="hidden" name="dir" value={dir} />
      ) : null}
      <TableFilterField label="Search">
        <input
          name="q"
          type="search"
          defaultValue={values.q}
          placeholder="Base or contract"
          autoComplete="off"
          className={TABLE_FILTER_FIELD_CLASS}
        />
      </TableFilterField>
      {bases ? (
        <TableFilterField label="Base">
          <AppSelect
            name="base"
            defaultValue={values.base}
            className={TABLE_FILTER_FIELD_CLASS}
          >
            <option value="">All</option>
            {bases.map((base) => (
              <option key={base} value={base}>
                {base}
              </option>
            ))}
          </AppSelect>
        </TableFilterField>
      ) : (
        <TableFilterField label="Base">
          <input
            name="base"
            defaultValue={values.base}
            placeholder="BTC"
            autoComplete="off"
            className={TABLE_FILTER_FIELD_CLASS}
          />
        </TableFilterField>
      )}
      {showDte ? (
        <>
          <TableFilterField label="Min DTE">
            <GroupedNumberInput
              name="minDte"
              defaultValue={values.minDte}
              allowDecimal
              className={TABLE_FILTER_FIELD_CLASS}
            />
          </TableFilterField>
          <TableFilterField label="Max DTE">
            <GroupedNumberInput
              name="maxDte"
              defaultValue={values.maxDte}
              allowDecimal
              className={TABLE_FILTER_FIELD_CLASS}
            />
          </TableFilterField>
        </>
      ) : null}
      <TableLabelButton
        href={clearHref}
        variant="filter"
        icon={<IconFilterClear {...TABLE_BTN_ICON} />}
      >
        Clear
      </TableLabelButton>
    </LiveGetForm>
  );
}
