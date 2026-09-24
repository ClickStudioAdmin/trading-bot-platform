# Decision audit

Parked 24 Sep 2026. Click asked to leave this for later. Not a V1 item. Do not build the tables until Click picks it up.

## Goal

Know that every automated desk executed the bot rule, and that the order the exchange saw matches that decision. Desk types: cash and carry, perps bots, signal follower, and DCA. A copy desk does not decide; the parent does. The manual perps desk has no decision tree, so it only gets the execution check.

## What does not prove it

The live monitor reads the app ledger and the engine log. It does not recompute indicators from exchange prices.

An agent must not write the audit rows. It can read exceptions and report what changed.

Calling the same decision function again on the saved inputs agrees with a bug that is consistently wrong. That replay only catches two cases: the live path recorded an action the function does not return, or the function’s result for that tick has changed since the order was sent.

## Steps when this is picked up

1. Add two shared append-only tables, `decision_snapshots` and `decision_exceptions`, keyed by desk, desk type, bot, and time. A snapshot stores the inputs that desk’s tick already had, the booleans, and the action. Write one when the desk places, adds, closes, or a boolean flips. A quiet tick that changes nothing stays unlogged.

2. Write the snapshot inside each desk branch of the engine pass (`lib/engine/cycle.ts`). DCA calls `decideDcaTick`. Perps bots, cash and carry, and signal follower call their own tick.

3. Check the decision with a second reading of the rule. Save the bars. Recompute the indicator with the chart’s calculation. Apply the bot rule as data (for example “RSI crosses above 70 on 15m, confirm off, so the action is a long”). When that result and the engine action differ, insert an exception. A person writes the expected action in the fixture. CI fails when the engine returns something else. One fixture file per automated desk, one candle case per branch.

4. Show one admin list for every desk, filtered by desk type. Each row shows the bot, the time, the engine action, and the check’s action. DCA and perps bots open the existing replay centered on that time, with the saved booleans beside the chart. Replay steps through candle closes. The live engine decides on a tick. When those two differ, the chart is the candle path and the snapshot is the tick the engine used. Cash and carry and signal follower show the saved inputs until those desks have a replay.

5. Check execution once for every desk that sends an order. Compare the action with the order sent and with the exchange accept or reject, and compare the close label with the fill. A Bybit reject is an exchange exception. A rule disagreement is a parameter exception. Both use the same admin list.

6. Point the scenario monitor at `decision_exceptions`. It reports new and cleared rows. It does not recompute indicators and it does not insert rows.
