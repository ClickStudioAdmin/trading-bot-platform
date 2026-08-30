# Click’s standing list

Not a phase. Not ordered. Not a gate before Fly.io or anything else. Work these whenever they come up during later phases. Ask to see this list when needed.

1. Test TradingView webhooks (live alerts, not only the Positions dummy). See [phase-9.md](phase-9.md) Later.
2. Test all DCA indicator start triggers (RSI / MACD / EMA, sit vs cross, timeframes).
3. More testing on **Perps** (ticket), **Perps bots**, and **TradingView Strategy** desks.
4. Discuss multiple pairs on one DCA bot (including virtual amounts). Today one live playbook owns one contract. Folders already stamp several pairs as separate bots. Do not build multi-pair or virtual size until Click locks that design.
5. Review **near-only live DCA grid**. Today live rests six rungs per pass, nearest first, but far GTC stays on Bybit. Click asked about only placing limits inside a band (e.g. 3%). Prefer a working set (next 4–6 unfilled rungs nearest mark, cancel the rest) over a fixed %. Playbook knob, not a global. Trade-off: less venue load vs missing a fast dump through empty rungs. Shelved 29 Aug 2026.
6. Refine **backtesting forms and flow** (queue, replay fields, run detail, save/attach). See [phase-backtesting.md](phase-backtesting.md). Added 30 Aug 2026.
7. Refine **charts and locations** (where charts sit, which page owns them). See [phase-charts.md](phase-charts.md). Added 30 Aug 2026.
