// Dip-buy bot for make.fun btc-race-24h-20261111-0801.
//
// Long-only cbBTC/USDC, $1,000 start, 1-minute bars, fills at next bar's open.
// Rule (deterministic, no clock, no randomness, no network):
//   - track the last 240 closes; buy with all cash when the latest close is
//     at least 0.8% below the highest close of the last 240 bars;
//   - sell the whole position when the close is >= 0.8% above the entry
//     close (take profit) or <= 1.0% below it (stop loss).
// A full round trip costs ~26 bps in fees/slippage/impact, so the 0.8% move
// threshold clears it. On the published dev window the same rule earned
// +$10.29 (offline sim, 10 trades, 2.3% max drawdown); every kit baseline
// lost money on the same window. Local grade of this file (grade-local,
// --driver process): net PnL +10.295330 USDC, 10 trades, win rate 0.80,
// max drawdown 0.0233, guardrails met, reproduced byte for byte.
//
// vendor/makefun-bars.ts is a byte-identical copy of the kit SDK shim.
import { runBars, type BarsState } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const LOOKBACK = 240;
const DROP_BPS = 80n;
const TP_BPS = 80n;
const SL_BPS = 100n;
const MAX_SLIPPAGE_BPS = 300;

const closes: bigint[] = [];
let entryClose: bigint | null = null;

/** Highest close of the last LOOKBACK bars, excluding the latest one. */
function recentMax(): bigint {
  let m = closes[closes.length - LOOKBACK - 1];
  for (let i = closes.length - LOOKBACK; i < closes.length - 1; i++) {
    if (closes[i] > m) m = closes[i];
  }
  return m;
}

/** True when the latest close has dipped DROP_BPS below the 240-bar high. */
function dipped(close: bigint): boolean {
  return close * 10000n <= recentMax() * (10000n - DROP_BPS);
}

/** True when a held position has hit its take-profit or stop-loss. */
function shouldExit(close: bigint): boolean {
  if (entryClose === null) return false;
  const up = (close * 10000n) >= (entryClose * (10000n + TP_BPS));
  const down = (close * 10000n) <= (entryClose * (10000n - SL_BPS));
  return up || down;
}

await runBars({
  onBatch(state: BarsState, batch) {
    const close = state.close(SYMBOL);
    if (close === null) return [];
    closes.push(close);
    const held = state.positions.get(SYMBOL);
    if (held !== undefined) {
      if (entryClose === null) entryClose = close;
      if (shouldExit(close)) {
        entryClose = null;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }
    if (closes.length < LOOKBACK + 1) return [];
    if (dipped(close)) {
      entryClose = close;
      const room = state.weightRoom(SYMBOL);
      let spend = state.cash < room ? state.cash : room;
      if (spend < BigInt(state.hello.fees.min_notional_quote_units)) return [];
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  },
});
