"use client";

import { useState } from "react";
import { AppMultiSelect, AppSelect } from "@/components/app-select";

const CLONE = [
  { value: "", label: "Clone existing bot" },
  { value: "dca-btc", label: "DCA · BTCUSDT" },
  { value: "dca-eth", label: "DCA · ETHUSDT" },
  { value: "perps-sol", label: "Perps · SOLUSDT" },
];

const VENUES = [
  { value: "bybit", label: "Bybit" },
  { value: "hyperliquid", label: "Hyperliquid" },
];

const CONTRACTS = [
  { value: "btc", label: "BTCUSDT" },
  { value: "eth", label: "ETHUSDT" },
  { value: "sol", label: "SOLUSDT" },
  { value: "doge", label: "DOGEUSDT" },
  { value: "xrp", label: "XRPUSDT" },
  { value: "link", label: "LINKUSDT" },
];

export function ThemeSelectDraft() {
  const [venue, setVenue] = useState("bybit");
  return (
    <div className="mt-6 space-y-4">
      <p className="text-xs uppercase tracking-[0.12em] text-ink-faint">
        Dropdown
      </p>
      <p className="text-sm text-ink-muted">
        Shared listbox. Native option menus are not used. Field is the default.
        Action is the purple desk control. Searchable and multi-select are here
        for review — not wired on live pages yet.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <label className="block min-w-[12rem] text-xs text-ink-muted">
          Action menu
          <AppSelect
            variant="action"
            className="mt-1"
            aria-label="Clone existing bot"
            defaultValue=""
            options={CLONE}
          />
        </label>
        <label className="block min-w-[12rem] text-xs text-ink-muted">
          Field
          <AppSelect
            className="mt-1"
            value={venue}
            onChange={(event) => setVenue(event.target.value)}
            options={VENUES}
          />
        </label>
        <label className="block min-w-[12rem] text-xs text-ink-muted">
          Searchable
          <AppSelect
            className="mt-1"
            searchable
            defaultValue="btc"
            options={CONTRACTS}
          />
        </label>
        <label className="block min-w-[12rem] text-xs text-ink-muted">
          Multi-select
          <AppMultiSelect
            className="mt-1"
            defaultValue={["btc"]}
            options={CONTRACTS}
            placeholder="Contracts"
          />
        </label>
      </div>
    </div>
  );
}
