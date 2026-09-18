# Onboarding wizard (later)

**V1 item 6** ([roadmap.md](roadmap.md)). Not the current phase. Do not implement until Click starts this item. Identity is V1 item 1. 2FA is V1 item 2. Account blotter lists are V1 item 4 ([phase-account-blotter.md](phase-account-blotter.md)). Entitlements / plan gates are V1 item 5 ([phase-entitlements.md](phase-entitlements.md)).

The first-desk `/welcome` wizard was **removed** on 16 Sep 2026 (identity step 1). Verified new users land on Overview. `/welcome` now redirects to the signed-in home. This phase **reimagines** first-run later; it does not put the old wizard back unless Click asks.

## Shipped today

New members start with zero desks. After they confirm email they land on Overview (`/account`). They create a desk from Manage desks when they want. After the first desk exists, at least one must remain.

Platform templates and folders can be flagged **Include in Starter Pack**. That flag is admin-only. It does **not** copy or apply anything for a new member yet.

## Purpose

When Click starts this item, design a new first-run (and new-desk) flow: clearer type and mode choices, optional next steps after a desk, and (if Click locks it) Starter Pack delivery. Zero desks can already use Overview and account pages.

## When this work starts

Lock screens with Click before coding. Likely pieces, not a build list until then:

1. **Type and mode.** Explain DCA, Perps, Cash and Carry, and TradingView Strategy, plus Paper vs Connected Exchange, before the create form. Type and mode stay immutable after create.
2. **Create a desk.** Same create action and validation as Manage desks. No auto Demo Account. Optional key bind stays trade-only and server-side.
3. **Starter Pack.** If a platform template or folder is flagged, copy those rows into the new member’s library and/or apply them **idle / disabled** to the first desk of matching type. Never arm, never enable the C&C engine, never place orders. Skip desk types that do not match. TradingView Strategy desks have no recipe templates.
4. **Land.** After create, a short “what to do next” on that desk (Automations, bind a key, apply a template) instead of dropping the member on a bare home with no hint.
5. **Starter Pack CTA.** Same offer when **any** new desk is created (Manage desks): matching Starter Pack templates/folders for that type, copy and/or apply idle. Never arm.

## Out of scope (when this work starts)

- Scale-in / position builder (V2)
- MEXC / XT (V2)
- Calling private exchange APIs from the browser
- Auto-creating a Demo Account again
- Auto-arm / auto-enable / marketplace
- Paper auto-switch ([phase-auto-switch.md](phase-auto-switch.md), V2)
- Backup market-data vendors (V2)
- Plans, payments, and affiliates (shipped; [phase-membership.md](phase-membership.md))
