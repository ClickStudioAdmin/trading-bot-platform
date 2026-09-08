# Adaptive DCA — parked

Not started. Not a roadmap item until Click says go. Trend **start** (Supertrend) is built now on the Phase 11 playbook. This file is the later **filter and exit** layer only.

## Status

Parked. Do not implement filters or adaptive exits until Click says go on wave 1.

## Filters and exits (later)

Reuse the same Trend definitions already on the start door. Do not invent a second Supertrend.

| Tool | Role | Notes |
| --- | --- | --- |
| **Supertrend** | Filter and/or exit | ATR trail. Filter: only start or add while bullish/bearish. Exit: flatten or stop adding on a flip against the position. Start already exists as Initial Order Trigger **Trend**. |
| **ADX** | Filter only | Strength, not direction. Example: allow the start (RSI, Price vs EMA, Supertrend flip, Price Cross) only when ADX is strong, or only fade BB when ADX is weak. Not a start. |
| **Market Structure** | Filter and later start | Swing highs/lows, BOS / flip. Not on the Trend start door until Click locks a swing rule (e.g. N-bar pivot). Then it can join Supertrend on that door **and** sit here as a filter. |

Wave 1, when Click says go: pick one filter (likely Supertrend sit or ADX strength) on adds, not a full exit suite.

## Out of scope until Click asks

- Combining two starts with AND
- Market Structure start
- ADX as a start (+DI / −DI cross)
- Changing the add ladder from the filter (adaptive size)
