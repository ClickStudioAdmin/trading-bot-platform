# Paper auto-switch (postponed)

Postponed. Not the current phase. Phase 7 is complete — [phase-7.md](phase-7.md).

## Purpose

Let a Dynamic-exit rule set wind a held paper pair down in lockstep with opening a better legal pair. Never close a clip unless the matching open on the target succeeds in the same tick.

Still the Phase 4 paper ledger, scoped to the Phase 5 account. No Bybit orders. No exchange API keys. No Fly.io. No browser Bybit calls.

## Core rule

On each tick, a switch clip is **one atomic pair**:

1. Size = `min(old usable book, new usable book, remaining on source, room under Max Position Size on dest, leftover under that set’s notional cap)`.
2. Skip the tick if that size is below Min Order Size (unless it is the last remainder on the source, and the dest can take that remainder).
3. Write the source close clip and the dest open clip **in one database transaction**. If either write fails, roll back both.
4. If either book is too thin, **pause**. Do not keep selling the old pair.

Hard exits (DTE, mark APR, take profit, stop loss) still win. Switch is an extra realloc rule, not a third exit type.

## When a switch starts

Only Auto rows on a **paper** account, on a set that has **exit = Dynamic** and **Switch to better pair** checked.

Candidate target = highest **mark net APR** on the live scan that:

- Passes **this set’s entry filters** (Min APR, Min/Max DTE, and any other entry gates)
- Clears Min Order Size on **its** usable book
- Is a **different pair** than the source (any coin, not same-base only)
- Beats the source’s mark net APR by **at least Min switch gap**
- Source has a live mark. No mark → no switch

If this set already holds more than one pair, switch the **worst** held APR that still has a legal target.

**Min switch gap** uses the same units as other APR fields (fraction in the database, percent in the form). Default when the checkbox is on: **0.50%**. Any-better-APR would churn on noise.

## While Switching

New carry status: `switching` (alongside `open` / `closing` / `closed`).

- Source: `switching`, stores the locked target
- Dest: normal `open` row on the same `rule_id`, linked back
- **Lock the target** on the first successful clip. Do not chase a third pair mid-switch
- If the locked target fails filters or disappears: **pause**, keep both rows, log `trade.switch_paused`. Do not flatten the source
- If a still-better pair appears: ignore until this switch completes or is cancelled
- **Max pairs exception:** this set may hold source + dest only. Do not open a third pair. Do not start a second switch on the same set
- No Dynamic scale-in on the source. Dest grows only from switch clips until the source is flat. After that, dest is a normal open row and scale-in resumes
- One switch clip pair per set per tick

## Accounting and UI

Keep two blotter rows. Do not merge P&L across the switch. Source realizes clip-by-clip with the existing all-in close math; dest is a new entry with its own weighted basis.

Positions: amber **Switching** badge, subtitle names the target contract. Dest can show **Switch in**.

Manual **Close** on the source: abort pairing, flatten or unwind the source only, dest stays open. Manual Close on the dest: dest flattens; source stays `switching` with no live target → pause + badge until **Cancel switch**. Cancel switch sets source back to `open` and leaves dest as-is.

## Data

- `paper_rules.switch_enabled` (bool, only meaningful when `exit_size_type = dynamic`)
- `paper_rules.switch_min_apr_gap` (nullable numeric, fraction)
- Same two fields on the per-trade automation snapshot
- `paper_carries.status` adds `switching`
- `paper_carries.switch_to_carry_id`, `switch_from_carry_id`, `switch_to_future_symbol`
- `close_reason` adds `switch`

## Checks that must exist

- Gap too small → no switch
- Target fails Min DTE / Min APR → no switch
- Either book below Min Order Size → pause, source notional unchanged
- Dest insert fails → source unchanged (transaction)
- Max pairs = 1 still allows source+dest during switch, not a third pair
- Hard exit beats a pending switch
- Locked target is not replaced by a newer better pair
- Last remainder can finish even if dest book equals that remainder
- Manual rows never switch
- Live accounts never switch

## Out of scope (when this work starts)

- Bybit orders, Fly.io
- Partial-fill / leg risk, websockets
- Switching Manual rows
- Merging two rows into one P&L story
- Auto-retarget mid-switch
- Maker future ask
