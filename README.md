# BTC dip-buy bot — make.fun btc-race-24h-20261111-0801

Long-only cbBTC/USDC bot, $1,000 paper start, 1-minute bars.

Strategy: buy the dip — when the latest close is at least 0.8% below the
highest close of the last 240 minutes, buy with all cash. Sell the whole
position at +0.8% take-profit or -1.0% stop-loss. Deterministic, standard
library only, no network, no clock, no randomness.

Dev gate (published 24h dev window, local grade): net PnL above $0 required.
See `main.py` for the exact rule.
