import type { TumblingSpec } from "./types.js";

/**
 * OHLCV bar output.
 */
export interface OHLCVBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
}

/**
 * OHLCV aggregation processor.
 * Accumulates tick data into OHLCV bars based on window emission.
 */
export class OHLCVProcessor {
  timestamp: number = 0;
  open: number = NaN;
  high: number = -Infinity;
  low: number = Infinity;
  close: number = NaN;
  volume: number = 0;
  turnover: number = 0;

  /**
   * Process tick data with window signal.
   * @param price Tick price
   * @param volume Tick volume
   * @param window Window emission signal
   * @returns Completed OHLCV bar or undefined
   */
  update(
    window: TumblingSpec,
    price: number,
    volume: number
  ): OHLCVBar | undefined {
    if (window.timestamp === undefined) {
      // Accumulate
      if (isNaN(this.open)) {
        this.open = price;
      }
      this.close = price;
      this.high = Math.max(this.high, price);
      this.low = Math.min(this.low, price);
      this.volume += volume;
      this.turnover += price * volume;
      return undefined;
    }

    // Emit window
    if (window.include) {
      // Right-closed: include current data in emitted window
      const bar: OHLCVBar = {
        timestamp: window.timestamp,
        open: this.open,
        high: Math.max(this.high, price),
        low: Math.min(this.low, price),
        close: price,
        volume: this.volume + volume,
        turnover: this.turnover + price * volume,
      };
      this.reset();
      return bar;
    } else {
      // Right-open: emit old window, start new with current data
      const bar: OHLCVBar = {
        timestamp: window.timestamp,
        open: this.open,
        high: this.high,
        low: this.low,
        close: this.close,
        volume: this.volume,
        turnover: this.turnover,
      };
      this.reset();
      this.open = price;
      this.close = price;
      this.high = price;
      this.low = price;
      this.volume = volume;
      this.turnover = price * volume;
      return bar;
    }
  }

  private reset(): void {
    this.timestamp = 0;
    this.open = NaN;
    this.high = -Infinity;
    this.low = Infinity;
    this.close = NaN;
    this.volume = 0;
    this.turnover = 0;
  }
}
