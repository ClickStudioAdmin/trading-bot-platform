# Adaptive DCA

Wave 2 + 2b (Confirm + Exit-if) are in progress on the existing Phase 11 playbook. Same `dca_playbooks` row, same `decideDcaTick` for live and replay. Not a new engine or desk type.

## Status

Wave 2 and 2b started 9 Sep 2026. Stop after these waves. Do not implement cooldown, max cycles/day, stacked AND filters, or the research wizard until Click says go.

Wave 1 (ATR spacing + ATR take profit) is on the playbook. `%` stays the default. Legacy bots are unchanged until someone picks ATR, Confirm, or Exit-if.

Push `develop` so GitHub Actions migrates the development database (`20260909120000_dca_confirm_exit_if.sql`).

## Wave 1 — ATR spacing + ATR take profit

Additional orders: Spacing `%` | `ATR`. Geometric ATR step is `atr * atr_spacing_mult * deviationMultiplier^addIndex` from the previous clip (absolute ATR distance, not % of price). Rest-grid converts that distance to a limit at rest time and reprices after each add.

Take profit: Method `%` | `ATR × multiplier` from the same basis (average / first fill). `%` TP is still PnL %. ATR TP compares mark to the ATR price. Trailing stays `%`.

ATR uses public klines already loaded for indicators. No `atr_timeframe` column. Use the playbook indicator/trend timeframe, else `15`. Defaults: ATR period **14**, spacing multiple **1**, TP ATR multiple **2**. Desk Summary reads last **closed** ATR on that timeframe so covered range, add prices, and ATR take profit show USDT and % — not a frozen table. Backtest precomputes that ATR series once per tape; it must not rebuild ATR on every bar.

Cycle lock: spacing / ATR add fields lock while a position is open. TP kind and TP ATR multiple still save.

Columns: `spacing_kind`, `atr_period`, `atr_spacing_mult`, `take_profit_kind`, `take_profit_atr_mult`. Migration `20260909090000_dca_atr_spacing_tp.sql`.

## Wave 2 — Confirm

One optional AND filter under Initial Order Trigger. Default **Off**. Pick a kind and the same When / period / timeframe widgets as Start appear. v1 is one confirm per side (Long confirm / Short confirm on Both). Cycle-lock Confirm with Start. Not stacked AND filters.

Catalog: **Price vs EMA**, **Price vs SMA**, **RSI**, **Price vs BB**, **ATR band**, **Supertrend**. No MACD, no MA-cross, no ADX, no Market Structure.

Confirm is **AND** with the start at fire time (`now` only, no latch). Missing bars = not met. Dual Both leftover overlap is this path (confirm the start, then Exit-if the old side). Not an in-playbook natural hedge.

ATR band is Keltner-style: `EMA(period) ± ATR(period) × multiplier`. When: price above upper / below lower. Defaults: period **10**, multiplier **2**.

Summary: one muted line when on (`Confirm: Price vs EMA · 4h`).

## Wave 2b — Exit-if

Same Off pattern on Stop loss. Own kind + When, **not** the inverse of Confirm. Editable while a position is open (like TP/SL). One Exit-if per side on Both.

When open, market flatten that side. Order in `decideDcaTick`: **% SL first, then Exit-if, then TP**. Replay wick SL / liq still win if they hit first that bar. Indicator Exit-if is **close-based**.

New close reason: `exit_if` (live + backtest fill). Chart label `Exit-if long` / `Exit-if short` with the stop/yellow colour.

## Later waves (parked)

A later admin **research wizard** would run wave 2 as its stage 2; that wizard is parked. Do not start until Click says go.

| Wave | What | Notes |
| --- | --- | --- |
| **2** | Optional AND confirming filters | In progress. HTF EMA, RSI, BB, ATR band, Supertrend. Per side on Both. Sit beside Start; do not replace Dual Both. |
| **2b** | Separate Exit-if flatten | In progress. Own filters on Stop loss. Market flatten of that side. % SL first, then Exit-if, then TP. Not the inverse of entry filters. |
| **3** | Cooldown + max cycles/day | After flatten. Caps flip-flop on Dual Both. Parked. |

Reuse Trend definitions already on the start door. Do not invent a second Supertrend.

| Tool | Role | Notes |
| --- | --- | --- |
| **Supertrend** | Filter and/or exit | Start already exists as Initial Order Trigger **Trend**. Same definition on Confirm / Exit-if. |
| **ADX** | Filter only later | Strength, not direction. Not a start. Parked. |
| **Market Structure** | Filter and later start | Not on the Trend start door until Click locks a swing rule. Parked. |

## Out of scope until Click asks

- Combining two starts with AND
- Stacked AND confirming filters
- Market Structure start
- ADX as a start (+DI / −DI cross)
- Changing the add ladder from a filter (adaptive size)
- Per-rung ATR / size table
- ATR trailing
- Cooldown / max cycles/day (wave 3)
- Research wizard
- Scale-in, MEXC, or a second strategy runtime
