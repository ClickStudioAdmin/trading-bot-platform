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
import {
  DESK_BLOTTER_ALL_BOTS_LABEL,
  type DeskBlotterBotOption,
  type DeskBlotterFilters,
} from "@/lib/desk-blotter-filters";

export function DeskBlotterScopeSelect({
  values,
  bots,
  deskId,
}: {
  values: DeskBlotterFilters;
  bots: readonly DeskBlotterBotOption[];
  deskId?: string | null;
}) {
  if (bots.length === 0) {
    return null;
  }
  return (
    <LiveGetForm bare className="w-[17.5rem] shrink-0">
      {deskId ? <input type="hidden" name={DESK_QUERY} value={deskId} /> : null}
      {values.pair ? (
        <input type="hidden" name="pair" value={values.pair} />
      ) : null}
      {values.side ? (
        <input type="hidden" name="side" value={values.side} />
      ) : null}
      <AppSelect
        key={values.bot || "desk"}
        name="bot"
        defaultValue={values.bot}
        aria-label="Data set"
        className="w-full"
      >
        <option value="">{DESK_BLOTTER_ALL_BOTS_LABEL}</option>
        {bots.map((bot) => (
          <option key={bot.id} value={bot.id}>
            {bot.name || "Bot"}
          </option>
        ))}
      </AppSelect>
    </LiveGetForm>
  );
}

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
            key={values.bot || "desk"}
            name="bot"
            defaultValue={values.bot}
            className={TABLE_FILTER_FIELD_CLASS}
          >
            <option value="">{DESK_BLOTTER_ALL_BOTS_LABEL}</option>
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
