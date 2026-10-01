# Account profit on the 10-year ETH book

The combined bot from [dca-eth-sweep-10y.md](dca-eth-sweep-10y.md) made +$1,369.41 because each new cycle used 4% of the cash book as notional. This pass keeps those signals and changes the size, the take profit, the stop, and the dip ladder. Tape is Coinbase ETH-USD 6h, 2016-10-01 to 2026-09-30 (14608 bars), $10,000, 10×, 6 bps. Percent of account sets notional to cash book × percent. Percent of margin sets notional to cash book × leverage × percent, so 10% of margin matches 100% of account. A liquidated run is not a winner.

## Best account result

**Realized +$55,363,678.18. Ending equity $56,828,335.62. APY +136.80%.** Max drawdown $47,059,128.64. 1,000 closed trades. Not liquidated.

Settings: both, 50% of margin, TP 2% market, stop 5%, 4 clips, 1% dip.

A full ladder is 5.00× the cash book in notional. The first clip is 1.25× the book. If the whole ladder is on, a 2% take profit is about 10% of the book and a 5% stop is about 25% of the book. Closed profit changes the next clip.

Ending equity includes +$1,454,657.44 of open profit on the last bar.

That is 40,428.76× the +$1,369.41 baseline. Full-ladder notional is 125.0× the baseline 4% ladder. The long side is still price crossing above SMA 21 with price inside the Bollinger bands. The short side is still price crossing below EMA 21 with price above SMA 21.

Highest realized whose max drawdown stays within the $10,000 start: +$36,426.62, APY +16.60%, drawdown $5,856.65. Settings: both, 50% of account, TP 2% market, stop 5%, 4 clips, 1% dip.

Highest realized with max drawdown at or under 25% of the $10,000 start: +$11,953.90, APY +8.18%, drawdown $1,479.64. Settings: both, 25% of account, TP 2% market, stop 5%, 4 clips, 1% dip.

## Size on the original 2% take profit and 5% stop

Holding the original exit, clips, and dip, the best surviving size was both, 50% of margin, TP 2% market, stop 5%, 4 clips, 1% dip at +$55,363,678.18. Larger ladders make more dollars only while the stop still fires before the account is wiped.

## Top surviving settings

| Side | Size | Exit | Ladder | Realized | Ending | APY | Max DD | Trades | Liquidated |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| both | 50% of margin | TP 2% market / SL 5% | 4 × 1% | +$55,363,678.18 | $56,828,335.62 | +136.80% | $47,059,128.64 | 1000 | no |
| both | 60% of margin | TP 2% market / SL 5% | 4 × 1% | +$35,176,578.76 | $36,287,469.92 | +126.30% | $42,610,314.77 | 997 | no |
| both | 80% of margin | TP 2% market / SL 3% | 4 × 1% | +$34,397,890.66 | $35,822,509.19 | +125.79% | $63,695,401.11 | 1114 | no |
| both | 40% of margin | TP 2% market / SL 5% | 4 × 1% | +$34,375,562.70 | $35,113,796.43 | +125.78% | $22,857,225.64 | 1001 | no |
| both | 60% of margin | TP 2% market / SL 3% | 4 × 1% | +$21,817,965.14 | $22,510,902.07 | +115.75% | $16,407,086.19 | 1114 | no |
| both | 50% of margin | TP 2% limit / SL 5% | 4 × 1% | +$12,865,900.19 | $13,142,469.10 | +104.65% | $4,174,084.43 | 1160 | no |
| both | 30% of margin | TP 2% market / SL 5% | 4 × 1% | +$10,878,626.24 | $11,062,949.40 | +101.25% | $5,668,002.83 | 1001 | no |
| both | 50% of margin | TP 2% market / SL 3% | 4 × 1% | +$9,756,040.99 | $10,022,593.29 | +99.07% | $6,041,259.93 | 1114 | no |
| both | 80% of margin | TP 1% market / SL 3% | 4 × 1% | +$6,154,299.10 | $6,211,592.10 | +90.12% | $3,968,975.68 | 1246 | no |
| both | 50% of margin | TP 2% market / SL 5% | 2 × 3% | +$5,720,951.42 | $5,787,651.59 | +88.74% | $3,587,621.58 | 978 | no |
| both | 60% of margin | TP 1% market / SL 3% | 4 × 1% | +$3,985,725.02 | $4,019,155.99 | +82.05% | $1,874,119.47 | 1248 | no |
| both | 40% of margin | TP 2% market / SL 3% | 4 × 1% | +$3,614,580.89 | $3,701,343.98 | +80.29% | $1,788,594.66 | 1114 | no |

## Sizes that liquidated

| Side | Size | Exit | Ladder | Realized | Ending | APY | Max DD | Trades | Liquidated |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| both | 80% of margin | TP 1% market / SL 8% | 4 × 1% | −$10,000.00 | $0.00 | — | $12,816.97 | 500 | yes |
| both | 80% of margin | TP 1% market / SL 12% | 4 × 1% | −$10,000.00 | $0.00 | — | $12,816.97 | 75 | yes |
| both | 80% of margin | TP 2% market / SL 8% | 4 × 1% | −$10,000.00 | $0.00 | — | $13,276.72 | 530 | yes |
| both | 80% of margin | TP 2% market / SL 12% | 4 × 1% | −$10,000.00 | $0.00 | — | $13,276.72 | 72 | yes |
| both | 80% of margin | TP 3% market / SL 8% | 4 × 1% | −$10,000.00 | $0.00 | — | $14,384.59 | 460 | yes |
| both | 80% of margin | TP 3% market / SL 12% | 4 × 1% | −$10,000.00 | $0.00 | — | $14,384.59 | 63 | yes |
| both | 80% of margin | TP 5% market / SL 8% | 4 × 1% | −$10,000.00 | $0.00 | — | $18,687.88 | 528 | yes |
| both | 80% of margin | TP 5% market / SL 12% | 4 × 1% | −$10,000.00 | $0.00 | — | $16,553.66 | 73 | yes |

## Long only, short only, and other signals

Long only and short only use the winning size, exit, and ladder. The other rows keep that size and use the next-best fixed-clip signals from the 10-year study, with their own exits.

| Side | Size | Exit | Ladder | Realized | Ending | APY | Max DD | Trades | Liquidated |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| long | 50% of margin | TP 2% market / SL 5% | 4 × 1% | +$1,538,656.40 | $1,556,701.70 | +65.59% | $1,298,524.83 | 538 | no |
| short | 50% of margin | TP 2% market / SL 5% | 4 × 1% | +$4,017.74 | $14,190.84 | +3.44% | $166,479.32 | 521 | no |
| long | 50% of margin | ATR ×2 / SL 5% | 4 × 1% SMA cross ATR | +$259,384.46 | $276,948.26 | +39.01% | $1,212,882.78 | 307 | no |
| long | 50% of margin | ATR ×2 / SL 5% | 4 × 1% EMA cross ATR | +$24,129.84 | $34,625.46 | +13.06% | $59,924.69 | 345 | no |
| short | 50% of margin | TP 2% limit / SL 5% | 4 × 1% EMA cross limit | +$65,393.56 | $76,976.86 | +22.39% | $74,677.94 | 684 | no |
| short | 50% of margin | ATR ×2 / SL 5% | 4 × 1% Supertrend ATR | +$49,800.59 | $59,800.59 | +19.59% | $55,860.22 | 151 | no |

## Limit orders, breakeven, and a larger later clip

| Side | Size | Exit | Ladder | Realized | Ending | APY | Max DD | Trades | Liquidated |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| both | 50% of margin | TP 2% limit / SL 5% | 4 × 1% | +$12,865,900.19 | $13,142,469.10 | +104.65% | $4,174,084.43 | 1160 | no |
| both | 50% of margin | TP 2% market / SL 5% | 4 × 1% breakeven at 1% | +$1,187,990.60 | $1,204,222.86 | +61.39% | $1,913,859.45 | 1081 | no |
| both | 50% of margin | TP 2% market / SL 5% | 4 × 1% later clips ×1.5 | +$954,318.37 | $980,919.62 | +57.92% | $838,380.94 | 1039 | no |

Paper fills on this Coinbase tape only. These runs are not saved on the admin account, because that chart would reload Hyperliquid or Bybit candles and would not match this tape.
