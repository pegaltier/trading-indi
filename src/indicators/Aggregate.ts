import { type OperatorDoc } from "../types/OpDoc.js";

export interface OHLCVBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OHLCVTick {
  timestamp: number;
  price: number;
  volume: number;
}

/**
 * OHLCV Aggregator - stateful time-based candle aggregator.
 * Aggregates tick data into OHLCV bars based on time intervals.
 */
export class OHLCV {
  private readonly intervalMs: number;
  private currentBar: OHLCVBar | undefined;
  private intervalStart: number | undefined;

  constructor(opts: { intervalMs: number }) {
    this.intervalMs = opts.intervalMs;
  }

  /**
   * Process new tick data.
   * @param tick Tick with timestamp, price, and volume
   * @returns Completed OHLCV bar or undefined if bar still in progress
   */
  onData(tick: OHLCVTick): OHLCVBar | undefined {
    const tickTime = tick.timestamp;

    if (!this.currentBar || !this.intervalStart) {
      // First tick - initialize new bar
      this.intervalStart = this.alignTimestamp(tickTime);
      this.currentBar = {
        timestamp: this.intervalStart,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.volume,
      };
      return undefined;
    }

    const expectedIntervalEnd = this.intervalStart + this.intervalMs;

    if (tickTime >= expectedIntervalEnd) {
      // New interval - complete current bar and start new one
      const completedBar = { ...this.currentBar };

      this.intervalStart = this.alignTimestamp(tickTime);
      this.currentBar = {
        timestamp: this.intervalStart,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.volume,
      };

      return completedBar;
    }

    // Same interval - update current bar
    this.currentBar.high = Math.max(this.currentBar.high, tick.price);
    this.currentBar.low = Math.min(this.currentBar.low, tick.price);
    this.currentBar.close = tick.price;
    this.currentBar.volume += tick.volume;

    return undefined;
  }

  /**
   * Get current incomplete bar (if any).
   * @returns Current bar or undefined
   */
  getCurrentBar(): OHLCVBar | undefined {
    return this.currentBar ? { ...this.currentBar } : undefined;
  }

  /**
   * Reset aggregator state.
   */
  reset(): void {
    this.currentBar = undefined;
    this.intervalStart = undefined;
  }

  private alignTimestamp(timestamp: number): number {
    return Math.floor(timestamp / this.intervalMs) * this.intervalMs;
  }

  static readonly doc: OperatorDoc = {
    type: "OHLCV",
    desc: "Time-based OHLCV candle aggregator",
    init: "{intervalMs: number}",
    onDataParam: "{timestamp, price, volume}",
    output: "{timestamp, open, high, low, close, volume} | undefined",
  };
}

/**
 * Creates OHLCV aggregator closure for functional usage.
 * @param opts Interval configuration
 * @returns Function that processes ticks and returns completed bars
 */
export function useOHLCV(opts: {
  intervalMs: number;
}): (tick: OHLCVTick) => OHLCVBar | undefined {
  const instance = new OHLCV(opts);
  return (tick: OHLCVTick) => instance.onData(tick);
}
