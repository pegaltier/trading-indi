import { TumblingWindow } from "./windows.js";
import { OHLCVProcessor, type OHLCVBar } from "./processors.js";
import type { OperatorDoc } from "../types/OpDoc.js";

/**
 * OHLCV tick input.
 */
export interface OHLCVTick {
  timestamp: number;
  price: number;
  volume: number;
}

/**
 * Convenience OHLCV aggregator for time-based candles.
 * Internally composes TumblingWindow + OHLCVProcessor.
 */
export class OHLCV {
  private readonly window: TumblingWindow;
  private readonly processor: OHLCVProcessor;

  constructor(opts: { intervalMs: number }) {
    this.window = new TumblingWindow({ interval: opts.intervalMs });
    this.processor = new OHLCVProcessor();
  }

  /**
   * Process tick data.
   * @param timestamp Tick timestamp
   * @param price Tick price
   * @param volume Tick volume
   * @returns Completed OHLCV bar or undefined
   */
  update(
    timestamp: number,
    price: number,
    volume: number
  ): OHLCVBar | undefined {
    const spec = this.window.update(timestamp);
    return this.processor.update(spec, price, volume);
  }

  /**
   * Process tick object.
   * @param tick Tick data
   * @returns Completed OHLCV bar or undefined
   */
  onData(tick: OHLCVTick): OHLCVBar | undefined {
    return this.update(tick.timestamp, tick.price, tick.volume);
  }

  /**
   * Reset aggregator state.
   */
  reset(): void {
    this.window.reset();
    // Processor resets itself on emission
  }

  static readonly doc: OperatorDoc = {
    type: "OHLCV",
    desc: "Time-based OHLCV candle aggregator",
    init: "{intervalMs: number}",
    input: "timestamp, price, volume",
    output: "{timestamp, open, high, low, close, volume, turnover} | undefined",
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
