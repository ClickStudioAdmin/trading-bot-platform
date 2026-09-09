# Adaptive DCA

Wave 1 (ATR spacing + ATR take profit) is in progress on the existing Phase 11 playbook. Same `dca_playbooks` row, same `decideDcaTick` for live and replay. Not a new engine or desk type.

## Status

Wave 1 started 9 Sep 2026. Stop after this wave. Do not implement confirming filters, Exit-if flatten, cooldown, or max cycles/day until Click says go.

`%` stays the default. Legacy bots are unchanged until someone picks ATR.

## Wave 1 — ATR spacing + ATR take profit

Additional orders: Spacing `%` | `ATR`. Geometric ATR step is `atr * atr_spacing_mult * deviationMultiplier^addIndex` from the previous clip (absolute ATR distance, not % of price). Rest-grid converts that distance to a limit at rest time and reprices after each add.

Take profit: Method `%` | `ATR × multiplier` from the same basis (average / first fill). `%` TP is still PnL %. ATR TP compares mark to the ATR price. Trailing stays `%`.

ATR uses public klines already loaded for indicators. No `atr_timeframe` column. Use the playbook indicator/trend timeframe, else `15`. Defaults: ATR period **14**, spacing multiple **1**, TP ATR multiple **2**. Desk Summary reads last **closed** ATR on that timeframe so covered range, add prices, and ATR take profit show USDT and % — not a frozen table. Backtest precomputes that ATR series once per tape; it must not rebuild ATR on every bar. Backtest precomputes that ATR series once per tape; it must not rebuild ATR on every bar.

Cycle lock: spacing / ATR add fields lock while a position is open. TP kind and TP ATR multiple still save.

Columns: `spacing_kind`, `atr_period`, `atr_spacing_mult`, `take_profit_kind`, `take_profit_atr_mult`. Push `develop` so GitHub Actions migrates the development database (`20260909090000_dca_atr_spacing_tp.sql`).

## Later waves (parked)

Dual Both leftover overlap is this path (confirm the start, then Exit-if the old side). Not an in-playbook natural hedge or opposite-aware clip. Click locked that 9 Sep 2026. A later admin **research wizard** would run wave 2 as its stage 2; that wizard is also parked. Do not start until Click says go.

| Wave | What | Notes |
| --- | --- | --- |
| **2** | Optional AND confirming filters | HTF EMA, RSI, BB, ATR band. Per side on Both. Sit beside Start; do not replace Dual Both. |
| **2b** | Separate Exit-if flatten | Own filters on Stop loss. Market flatten of that side. First hit wins versus % SL / TP / Liq. Not the inverse of entry filters. |
| **3** | Cooldown + max cycles/day | After flatten. Caps flip-flop on Dual Both. |

Reuse Trend definitions already on the start door. Do not invent a second Supertrend.

| Tool | Role | Notes |
| --- | --- | --- |
| **Supertrend** | Filter and/or exit later | Start already exists as Initial Order Trigger **Trend**. |
| **ADX** | Filter only later | Strength, not direction. Not a start. |
| **Market Structure** | Filter and later start | Not on the Trend start door until Click locks a swing rule. |

## Out of scope until Click asks

- Combining two starts with AND
- Market Structure start
- ADX as a start (+DI / −DI cross)
- Changing the add ladder from a filter (adaptive size)
- Per-rung ATR / size table
- ATR trailing
- Scale-in, MEXC, or a second strategy runtime
