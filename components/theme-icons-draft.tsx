"use client";

import { type ReactNode } from "react";
import { LUCIDE_ICONS } from "@/components/icons";
import { TokenIcon } from "@/components/token-icon";

export function ThemeIconsDraft() {
  return (
    <div className="space-y-8">
      <IconGroup
        title="Lucide"
        note="Import from @/components/icons. Add a Lucide icon there first — never import lucide-react in a page. Check this list before adding so we do not pick a near-duplicate."
      >
        {LUCIDE_ICONS.map((row) => {
          const Icon = row.Icon;
          return (
            <IconTile
              key={row.id}
              name={row.name}
              source="Lucide"
              lucide={row.lucide}
              usedIn={row.usedIn}
            >
              <Icon
                size={20}
                strokeWidth={1.75}
                fill={row.id === "star-filled" ? "currentColor" : "none"}
                className="size-5"
              />
            </IconTile>
          );
        })}
      </IconGroup>

      <IconGroup
        title="Market tokens"
        note="Not UI chrome. Live pair images from /api/market/icons. Keep these."
      >
        <IconTile name="BTC" source="Market" usedIn="TokenIcon">
          <TokenIcon symbol="BTC" size={24} />
        </IconTile>
        <IconTile name="ETH" source="Market" usedIn="TokenIcon">
          <TokenIcon symbol="ETH" size={24} />
        </IconTile>
        <IconTile name="SOL" source="Market" usedIn="TokenIcon">
          <TokenIcon symbol="SOL" size={24} />
        </IconTile>
      </IconGroup>
    </div>
  );
}

function IconGroup({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-1 text-sm text-ink-muted">{note}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {children}
      </div>
    </section>
  );
}

function IconTile({
  name,
  source,
  lucide,
  usedIn,
  children,
}: {
  name: string;
  source: "Lucide" | "Market";
  lucide?: string;
  usedIn: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-line bg-surface p-3">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-raised text-ink">
        {children}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm text-ink">{name}</p>
        <p className="truncate text-xs text-ink-faint">
          {source}
          {lucide ? ` · ${lucide}` : ""}
        </p>
        <p className="truncate text-xs text-ink-muted">{usedIn}</p>
      </div>
    </div>
  );
}
