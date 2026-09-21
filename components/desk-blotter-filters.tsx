import { IconFilterClear } from "@/components/icons";
import {
  LiveGetForm,
  TABLE_BTN_ICON,
  TABLE_FILTER_FIELD_CLASS,
  TableFilterField,
  TableLabelButton,
} from "@/components/table-chrome";
import { AppSelect } from "@/components/app-select";
import { DESK_QUERY } from "@/lib/accounts/model";
import type {
  DeskBlotterBotOption,
  DeskBlotterFilters,
} from "@/lib/desk-blotter-filters";

export function DeskBlotterFilters({
  values,
  bots,
  clearHref,
  deskId,
  showSide = true,
}: {
  values: DeskBlotterFilters;
  bots: readonly DeskBlotterBotOption[];
  clearHref: string;
  deskId?: string | null;
  showSide?: boolean;
}) {
  return (
    <LiveGetForm>
      {deskId ? <input type="hidden" name={DESK_QUERY} value={deskId} /> : null}
      {bots.length > 0 ? (
        <TableFilterField label="Bot">
          <AppSelect
            name="bot"
            defaultValue={values.bot}
            className={TABLE_FILTER_FIELD_CLASS}
          >
            <option value="">All bots</option>
            {bots.map((bot) => (
              <option key={bot.id} value={bot.id}>
                {bot.name || "Bot"}
              </option>
            ))}
          </AppSelect>
        </TableFilterField>
      ) : null}
      <TableFilterField label="Pair">
        <input
          name="pair"
          type="search"
          defaultValue={values.pair}
          placeholder="Contract or pair"
          autoComplete="off"
          className={TABLE_FILTER_FIELD_CLASS}
        />
      </TableFilterField>
      {showSide ? (
        <TableFilterField label="Side">
          <AppSelect
            name="side"
            defaultValue={values.side}
            className={TABLE_FILTER_FIELD_CLASS}
          >
            <option value="">All</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </AppSelect>
        </TableFilterField>
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
