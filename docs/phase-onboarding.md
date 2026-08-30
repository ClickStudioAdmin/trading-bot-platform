# Onboarding wizard (later)

Postponed. **Roadmap 9** ([roadmap.md](roadmap.md)). Not the current phase. Do not implement until Click starts this item.

The first-desk gate is already shipped. This phase **refines** `/welcome`; it does not replace it.

## Shipped today

New members start with zero desks. First sign-in lands on `/welcome`. The wizard is two steps: a splash, then the same **Create desk** form used on Manage desks (`CreateAccountForm`). After create, the session switches to that desk and goes to its home. Existing members who already have desks skip `/welcome`. After the first desk exists, at least one must remain.

Platform templates and folders can be flagged **Include in Starter Pack**. That flag is admin-only. It does **not** copy or apply anything for a new member yet.

## Purpose

Turn `/welcome` into a proper first-run wizard: clearer type and mode choices, optional next steps after the first desk, and (if Click locks it) Starter Pack delivery. Keep the gate: zero desks still cannot use the rest of the app.

## When this work starts

Lock screens with Click before coding. Likely pieces, not a build list until then:

1. **Type and mode.** Explain DCA, Perps, Cash and Carry, and TradingView Strategy, plus Paper vs Connected Exchange, before the create form. Type and mode stay immutable after create.
2. **Create the first desk.** Same create action and validation as Manage desks. No auto Demo Account. Optional key bind stays trade-only and server-side.
3. **Starter Pack.** If a platform template or folder is flagged, copy those rows into the new member’s library and/or apply them **idle / disabled** to the first desk of matching type. Never arm, never enable the C&C engine, never place orders. Skip desk types that do not match. TradingView Strategy desks have no recipe templates.
4. **Land.** After create, a short “what to do next” on that desk (Automations, bind a key, apply a template) instead of dropping the member on a bare home with no hint.
5. **Starter Pack CTA.** Same offer when **any** new desk is created (Manage desks, not only `/welcome`): matching Starter Pack templates/folders for that type, copy and/or apply idle. Never arm.

## Out of scope (when this work starts)

- Scale-in / position builder (roadmap 6)
- Hyperliquid / MEXC / XT
- Fly.io (roadmap 1; already done if this item is in order)
- Calling private exchange APIs from the browser
- Auto-creating a Demo Account again
- Auto-arm / auto-enable / marketplace
- Paper auto-switch ([phase-auto-switch.md](phase-auto-switch.md))
- Backup market-data vendors (roadmap 5)
