# ETH DCA sweep, 10 years

Same eight long starts and five exits as the one-year study, plus the short mirror of each start. Tape is Coinbase ETH-USD 6h, 2016-10-01 to 2026-09-30 (14608 bars). Bybit’s public candles are blocked here, and Hyperliquid does not keep ten years of 4h. 6h is the bot timeframe `360`. Fixed-clip pass: $10,000, 10×, $100 clips, four adds at a 1% dip, 6 bps. Each cell also ran all 15 secondary conditions. The winner is the secondary with the highest net.

## Best long, fixed clip

| # | Side | Entry | Exit | Secondary | Net | Gross win | Gross loss | Trades |
| ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| 1 | long | Price crosses above SMA 21 | TP 2% market | BB inside | +$865.97 | +$3042.20 | $2098.66 | 538 |
| 2 | long | SMA 9 crosses above SMA 21 | TP ATR ×2 | EMA below | +$822.75 | +$2771.40 | $1901.43 | 307 |
| 3 | long | Price crosses above EMA 21 | TP ATR ×2 | SMA below | +$807.86 | +$3209.57 | $2346.45 | 345 |
| 4 | long | Price crosses above SMA 21 | TP ATR ×2 | EMA below | +$781.11 | +$3141.40 | $2305.99 | 343 |
| 5 | long | Price crosses above EMA 21 | TP 2% limit | BB inside | +$767.96 | +$2239.31 | $1385.62 | 666 |
| 6 | long | MACD crosses above 0 | TP ATR ×2 | RSI at or above 70 | +$732.89 | +$1585.09 | $829.35 | 151 |
| 7 | long | Price crosses above SMA 21 | TP 2% limit | BB inside | +$685.93 | +$2122.99 | $1355.28 | 620 |
| 8 | long | Price crosses above EMA 21 | TP 2% market | SMA above | +$683.37 | +$2841.44 | $2083.48 | 521 |

## Best short, fixed clip

| # | Side | Entry | Exit | Secondary | Net | Gross win | Gross loss | Trades |
| ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| 1 | short | Price crosses below EMA 21 | TP 2% market | SMA above | +$476.83 | +$2739.11 | $2187.22 | 521 |
| 2 | short | Price crosses below EMA 21 | TP 2% limit | BB inside | +$439.99 | +$2230.44 | $1701.17 | 684 |
| 3 | short | Supertrend turns bearish | TP ATR ×2 | EMA above | +$433.93 | +$1404.17 | $946.78 | 151 |
| 4 | short | SMA 9 crosses below SMA 21 | Trailing 1% / 0.5% | ATR band below | +$343.87 | +$814.11 | $456.50 | 85 |
| 5 | short | Supertrend turns bearish | TP 2% limit | EMA above | +$331.54 | +$537.71 | $187.33 | 155 |
| 6 | short | Supertrend turns bearish | Trailing 1% / 0.5% | ATR band below | +$290.64 | +$596.11 | $293.90 | 72 |
| 7 | short | EMA 9 crosses below EMA 21 | Trailing 1% / 0.5% | ATR band below | +$290.41 | +$674.87 | $371.80 | 79 |
| 8 | short | Price crosses below SMA 21 | TP 2% limit | EMA below | +$282.96 | +$1925.67 | $1564.47 | 592 |

## Winners taken into the compound test

- Long: Price crosses above SMA 21, TP 2% market, secondary BB inside. Fixed-clip net +$865.97 over 538 trades.
- Short: Price crosses below EMA 21, TP 2% market, secondary SMA above. Fixed-clip net +$476.83 over 521 trades.

## Each winner compounding on its own $10,000

Compounding uses 4% of the cash book (start plus realized) for the four-clip ladder. That is a $100 first clip on $10,000, and the clip grows or shrinks with closed profit. Open profit is not resized until the cycle ends.

| Book | Realized | Ending equity | APY | Trades | Liquidated |
| --- | ---: | ---: | ---: | ---: | --- |
| Long $10,000 | +$900.70 | $10901.16 | +0.87% | 538 | no |
| Short $10,000 | +$484.81 | $10485.85 | +0.47% | 521 | no |

## Both strategies together

One bot, direction both, one $10,000 cash book. The long side is price crossing above SMA 21 with price inside the Bollinger bands. The short side is price crossing below EMA 21 with price above SMA 21. Both sides use the shared 2% market take profit and the 5% stop. Each new cycle sizes the four-clip ladder at 4% of that book, so closed profit changes the next clip.

**Overall realized profit +$1,369.41. Ending equity $11,371.90. APY +1.29%.** 1,001 closed trades. Not liquidated.

APY is (1 + 1,369.41 / 10,000) ^ (365.25 / days) − 1 over 2016-10-01 to 2026-09-30.

Running the same two bots as separate half-books ($5,000 each, still one $10,000 start) realized +$692.76, ending equity $10,693.50, APY +0.67%. Splitting the cash in half cuts the clip in half, so the dollar profit is about half. The shared bot is the combined test.

Paper fills on this Coinbase tape only. The one-year Hyperliquid runs stay on the admin account. These 10-year fills are not saved there, because that chart would reload Hyperliquid or Bybit candles and would not match this tape.
