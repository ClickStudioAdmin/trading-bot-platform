# ETH DCA entry × exit sweep

Study Click asked for on 1 Oct 2026. Paper replay only. Same engine as `/account/backtests` (`replayDcaPlaybook`). No live orders, no desk arming, no change to the research wizard.

Runs are saved on the admin login `click.studio.admin@gmail.com` in the development database, so they show under Saved Backtests. They are ordinary runs (no `study_id`), because study rows are hidden from that list. Bot names are capped at 40 characters, so a saved run is named `ETH {entry} · {exit}` and, when a secondary is attached, `ETH {entry} · {exit} · {secondary}`. The codes are the tables below.

## Question

Which DCA entry and exit pairs made the most money on ETH, and which secondary condition improves each pair?

Two rankings:

- **Net profit.** Realized USDT after fees. Winning trades and losing trades both count.
- **Profit ignoring losses.** Sum of winning closes only. Losing closes are left out of this total. A strategy can rank high here and still lose money overall.

## The 40 combinations

An entry is one indicator or Trend start. An exit is one way the open long is closed. Every entry is crossed with every exit: 8 × 5 = 40. Webhook and manual starts are omitted because the backtest queue rejects them.

Each cell is long-only, one contract, ETH on Hyperliquid.

### Entries (canonical long When)

| Code | Start | When |
| --- | --- | --- |
| `rsi-xb` | Indicator RSI 14 | Crosses below 30 |
| `macd-xa` | Indicator MACD | Histogram crosses above 0 |
| `ema-xa` | Indicator Price vs EMA 21 | Price crosses above |
| `sma-xa` | Indicator Price vs SMA 21 | Price crosses above |
| `emax-a` | Indicator EMA cross 9 / 21 | Fast crosses above slow |
| `smax-a` | Indicator SMA cross 9 / 21 | Fast crosses above slow |
| `bb-xb` | Indicator Price vs BB 20 | Price crosses below the lower band |
| `st-tb` | Trend Supertrend 10 × 3 | Turns bullish |

Sit Whens (already true), the opposite cross, price start, and immediate start are a longer catalog. They are listed at the bottom. They are not extra cells in the 40. The 40 is the cross of these eight starts with the five exits.

### Exits

Shared ladder on every cell, so only the exit changes inside a row:

| Code | Exit |
| --- | --- |
| `tp-pct-mkt` | Take profit 2% of average, market, on the close. Stop 5% of average. |
| `tp-pct-lmt` | Take profit 2% of average, limit, on the favorable wick. Stop 5% of average. |
| `tp-atr` | Take profit ATR(14) × 2 from the average, market. Stop 5% of average. |
| `sl-tight` | Stop 0.5% of average is the working exit. Take profit 20% market, so the stop prints first in normal volatility. |
| `trail` | Trailing stop arms after +1% and trails by 0.5%. Take profit 20% and stop 20% stay on as backstops. |

Basis is average entry. Stop and the percent take profit that is not the cell under test stay market.

### Book (held still)

| Control | Value |
| --- | --- |
| Pair | ETH perpetual |
| Venue | Hyperliquid |
| Window | Form default, 1 year ending today |
| Tape | 4h, the bot timeframe |
| Balance | 10,000 USDT |
| Leverage | 10× |
| Fee | VIP0 taker, 6 bps a fill |
| Clip | 100 USDT |
| Adds | Up to 4 clips, 1% dip, equal size, resting GTC limits |
| Direction | Long |
| Secondary on the 40 | Off |

Bybit is the usual ETHUSDT desk, and 15m is the usual indicator tape. This environment cannot call Bybit’s public REST (CloudFront rejects the region). Hyperliquid is the other venue the replay already loads. Its 15m history stops near 52 days, so a one-year window does not fit. 4h ETH on Hyperliquid covers that year (about 2,200 bars) and is a legal bot timeframe, so the saved run, the fills, and the chart use one tape.

Replay parses the recipe with the run’s venue. A Hyperliquid coin is not a Bybit USDT symbol, and forcing Bybit parse drops the run before the first bar.

## Steps

1. Write this plan and the combination list.
2. Load Hyperliquid ETH 4h for the window (one tape for every cell).
3. Build each recipe with `parseDcaPlaybookForm` and `snapshotDcaRecipe`, the same parsers as Save.
4. Replay each of the 40 with `replayDcaPlaybook`.
5. Rank the 40 by net realized USDT, and again by gross winning USDT.
6. On each of the 40, replay every secondary condition below. Keep the one with the highest net, the one with the highest gross winning USDT, and the one with the smallest gross loss (closed losses only, at least one trade).
7. Save the 40 base runs on the admin account. When a secondary beats that cell’s net, save that variant too.
8. Write the rankings and the per-cell adjustments in `docs/dca-eth-sweep-results.md`.

## Secondary conditions

These are the Secondary Entry conditions on the bot form (Confirm). Timeframe matches the 4h start. A secondary must be true on the same close as the start. Missing bars do not pass.

| Code | Filter |
| --- | --- |
| `ema-above` | Price is above EMA 21 |
| `ema-below` | Price is below EMA 21 |
| `sma-above` | Price is above SMA 21 |
| `sma-below` | Price is below SMA 21 |
| `rsi-below` | RSI 14 is at or below 30 |
| `rsi-above` | RSI 14 is at or above 70 |
| `rsi-between` | RSI 14 is between 30 and 70 |
| `bb-above` | Price is above the upper Bollinger band |
| `bb-below` | Price is below the lower Bollinger band |
| `bb-inside` | Price is inside the Bollinger bands |
| `atr-above` | Price is above the ATR band (EMA 10 ± 2 × ATR 10) |
| `atr-below` | Price is below the ATR band |
| `atr-inside` | Price is inside the ATR band |
| `st-bull` | Supertrend 10 × 3 is bullish |
| `st-bear` | Supertrend 10 × 3 is bearish |

That is every secondary kind and sit-When the form allows. Crosses stay on the start, not on the secondary.

## How to read a result

- **Net** is what the account kept.
- **Gross win** is the profit total with losing trades removed from the sum.
- **Gross loss** is the absolute loss on losing closes. Smaller is better.
- A secondary that raises net by cutting trades can also cut gross win. The results table shows all three picks, not a single blended score.
- Liquidation is a failed cell even if a few early trades were green.

## Longer catalog (not in the 40)

The desk scenario list already names every When and every exit knob. Crossing all of them is 28 starts × 27 exits = 756 cells, then × 15 secondaries. The product cap for one study is 96. This sweep uses the 40-cell cross above so every entry family and every exit mechanism is tested, and the secondary pass is where each of those 40 is tuned.

Starts in the longer list, besides the eight above: RSI at or below, RSI crosses above, RSI at or above, MACD crosses below, MACD is above, MACD is below, price crosses below EMA, price is above EMA, price is below EMA, the same four for SMA, EMA cross below, SMA cross below, BB crosses above the top, BB is above the top, BB is below the bottom, Supertrend turns bearish, Supertrend is bullish, Supertrend is bearish.

Exit knobs in the longer list, besides the five above: take profit from the first fill instead of the average, ATR take profit as a limit, ATR from the first fill, stop from the first fill, each Exit-if filter (same six kinds as the secondaries), move-to-breakeven, and the 0.5% take-profit probes used only to force that order type to print.

## Reproduce

```
npx tsx lib/backtest/eth-dca-sweep.ts
```

The script writes `docs/dca-eth-sweep-results.md` and inserts the admin runs. It does not arm a desk.
