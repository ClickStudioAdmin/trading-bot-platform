import { IconFilterClear } from "@/components/icons";
import {
  LiveGetForm,
  TABLE_BTN_ICON,
  TABLE_FILTER_FIELD_CLASS,
  TableFilterField,
  TableLabelButton,
} from "@/components/table-chrome";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import { PERP_CATEGORY_OPTIONS } from "@/lib/exchanges/agreement";
import type { PairFilterInputs, PairFilters } from "@/lib/pairs/filter";
import { DESK_QUERY } from "@/lib/accounts/model";
import type { VenueDefinition } from "@/lib/exchanges/venues";
import { PAIR_DEFAULT_DIR, PAIR_DEFAULT_SORT } from "@/lib/pairs/page";
import type { TableSortDir } from "@/lib/table-chrome";
import { AppSelect } from "@/components/app-select";

export function PairsScopeSelect({
  venues,
  venueId,
  environment,
  kind,
  filters,
}: {
  venues: readonly VenueDefinition[];
  venueId: string;
  environment: string;
  kind: "perps" | "carry";
  filters: PairFilters;
}) {
  const venue = venues.find((item) => item.id === venueId) ?? venues[0];
  if (!venue) {
    return null;
  }
  return (
    <LiveGetForm bare className="flex flex-wrap items-end gap-2">
      {kind === "carry" && venue.datedCarry ? (
        <input type="hidden" name="kind" value="carry" />
      ) : null}
      {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
      {filters.base ? (
        <input type="hidden" name="base" value={filters.base} />
      ) : null}
      {filters.category ? (
        <input type="hidden" name="category" value={filters.category} />
      ) : null}
      {filters.minDte !== null ? (
        <input type="hidden" name="minDte" value={String(filters.minDte)} />
      ) : null}
      {filters.maxDte !== null ? (
        <input type="hidden" name="maxDte" value={String(filters.maxDte)} />
      ) : null}
      <TableFilterField label="Exchange" className="min-w-[10rem]">
        <AppSelect
          name="venue"
          defaultValue={venue.id}
          className={TABLE_FILTER_FIELD_CLASS}
        >
          {venues.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </AppSelect>
      </TableFilterField>
      <TableFilterField label="Environment" className="min-w-[10rem]">
        <AppSelect
          name="env"
          key={`${venue.id}-env`}
          defaultValue={environment}
          className={TABLE_FILTER_FIELD_CLASS}
        >
          {venue.environments.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </AppSelect>
      </TableFilterField>
    </LiveGetForm>
  );
}

export function PairFiltersForm({
  clearHref,
  values,
  bases,
  showCategory = false,
  showDte = false,
  deskId,
  keep,
  sort,
  dir,
}: {
  clearHref: string;
  values: PairFilterInputs;
  bases?: readonly string[];
  showCategory?: boolean;
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
      {showCategory ? (
        <TableFilterField label="Category" className="min-w-[14rem]">
          <AppSelect
            name="category"
            defaultValue={values.category}
            className={TABLE_FILTER_FIELD_CLASS}
          >
            <option value="">All</option>
            {PERP_CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </AppSelect>
        </TableFilterField>
      ) : null}
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
