export type CustomIconMeta = {
  id: string;
  name: string;
  usedIn: string;
  group: "desk" | "chart";
};

export const CUSTOM_ICONS = [
  {
    id: "paper",
    name: "Paper",
    usedIn: "Desk mark",
    group: "desk",
  },
  {
    id: "bybit",
    name: "Bybit",
    usedIn: "Desk mark",
    group: "desk",
  },
  {
    id: "hyperliquid",
    name: "Hyperliquid",
    usedIn: "Desk mark",
    group: "desk",
  },
  {
    id: "dca",
    name: "DCA",
    usedIn: "Desk type",
    group: "desk",
  },
  {
    id: "perps",
    name: "Perps",
    usedIn: "Desk type",
    group: "desk",
  },
  {
    id: "carry",
    name: "Cash and Carry",
    usedIn: "Desk type",
    group: "desk",
  },
  {
    id: "signal",
    name: "Signal",
    usedIn: "Desk type",
    group: "desk",
  },
  {
    id: "copy-image",
    name: "Copy image",
    usedIn: "Chart toolbar",
    group: "chart",
  },
  {
    id: "camera",
    name: "Camera",
    usedIn: "Chart toolbar",
    group: "chart",
  },
  {
    id: "expand",
    name: "Expand",
    usedIn: "Chart toolbar",
    group: "chart",
  },
  {
    id: "collapse",
    name: "Collapse",
    usedIn: "Chart toolbar",
    group: "chart",
  },
  {
    id: "monitor",
    name: "Monitor",
    usedIn: "Chart toolbar",
    group: "chart",
  },
  {
    id: "exit-monitor",
    name: "Exit monitor",
    usedIn: "Chart toolbar",
    group: "chart",
  },
  {
    id: "chart-check",
    name: "Copied",
    usedIn: "Chart toolbar",
    group: "chart",
  },
] as const satisfies readonly CustomIconMeta[];

export const CUSTOM_ICON_IDS: readonly string[] = CUSTOM_ICONS.map(
  (row) => row.id,
);
