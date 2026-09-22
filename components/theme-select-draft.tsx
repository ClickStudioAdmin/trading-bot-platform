"use client";

import { useState } from "react";
import { AppMultiSelect, AppSelect } from "@/components/app-select";

const ACTION_MENU = [
  { value: "", label: "Choose a desk" },
  { value: "dca-btc", label: "DCA · BTCUSDT" },
  { value: "dca-eth", label: "DCA · ETHUSDT" },
  { value: "perps-sol", label: "Perps · SOLUSDT" },
];

const VENUES = [
  { value: "bybit", label: "Bybit" },
  { value: "hyperliquid", label: "Hyperliquid" },
];

const CONTRACTS = [
  { value: "BTCUSDT", label: "BTCUSDT", icon: "BTC" },
  { value: "ETHUSDT", label: "ETHUSDT", icon: "ETH" },
  { value: "SOLUSDT", label: "SOLUSDT", icon: "SOL" },
  { value: "DOGEUSDT", label: "DOGEUSDT", icon: "DOGE" },
  { value: "XRPUSDT", label: "XRPUSDT", icon: "XRP" },
  { value: "LINKUSDT", label: "LINKUSDT", icon: "LINK" },
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
        Action is the purple desk control. Searchable and multi-select use the
        same listbox. Live folder and comparable pickers use multi-select.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <label className="block min-w-[12rem] text-sm text-ink">
          Action menu
          <AppSelect
            variant="action"
            className="mt-1"
            aria-label="Choose a desk"
            defaultValue=""
            options={ACTION_MENU}
          />
        </label>
        <label className="block min-w-[12rem] text-sm text-ink">
          Field
          <AppSelect
            className="mt-1"
            value={venue}
            onChange={(event) => setVenue(event.target.value)}
            options={VENUES}
          />
        </label>
        <label className="block min-w-[12rem] text-sm text-ink">
          Searchable
          <AppSelect
            className="mt-1"
            searchable
            defaultValue="BTCUSDT"
            options={CONTRACTS}
          />
        </label>
        <label className="block min-w-[12rem] text-sm text-ink">
          Multi-select
          <AppMultiSelect
            className="mt-1"
            defaultValue={["BTCUSDT"]}
            options={CONTRACTS}
            placeholder="Contracts"
          />
        </label>
      </div>
    </div>
  );
}
