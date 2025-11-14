import type { PeriodOptions } from "../types/PeriodOptions.js";
import type { BarWith } from "../types/BarData.js";
import { CircularBuffer } from "../classes/Containers.js";
import { wilders_factor, smooth } from "../utils/math.js";

/**
 * Balance of Power - measures buying vs selling pressure.
 * Calculates (close - open) / (high - low) ratio.
 */
export class BOP {
  /**
   * Process new bar data.
   * @param bar OHLC bar data
   * @returns Balance of Power value
   */
  onData(bar: BarWith<"open" | "high" | "low" | "close">): number {
    const range = bar.high - bar.low;
    return range !== 0 ? (bar.close - bar.open) / range : 0;
  }
}

/**
 * Creates BOP closure for functional usage.
 * @returns Function that processes bar data and returns BOP
 */
export function useBOP(): (
  bar: BarWith<"open" | "high" | "low" | "close">
) => number {
  const instance = new BOP();
  return (bar) => instance.onData(bar);
}

/**
 * Momentum - stateful indicator.
 * Measures rate of price change over period.
 */
export class MOM {
  private buffer: CircularBuffer<number>;

  constructor(opts: PeriodOptions) {
    if (opts.period === undefined) {
      throw new Error("MOM requires period");
    }
    this.buffer = new CircularBuffer(opts.period + 1);
  }

  /**
   * Process new data point.
   * @param bar Bar data with close price
   * @returns Price change from period ago
   */
  onData(bar: BarWith<"close">): number {
    this.buffer.push(bar.close);
    if (!this.buffer.full()) {
      return 0;
    }
    return bar.close - this.buffer.front()!;
  }
}

/**
 * Creates MOM closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes data and returns momentum
 */
export function useMOM(opts: PeriodOptions): (bar: BarWith<"close">) => number {
  const instance = new MOM(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Rate of Change - stateful indicator.
 * Calculates percentage price change over period.
 */
export class ROC {
  private buffer: CircularBuffer<number>;

  constructor(opts: PeriodOptions) {
    if (opts.period === undefined) {
      throw new Error("ROC requires period");
    }
    this.buffer = new CircularBuffer(opts.period + 1);
  }

  /**
   * Process new data point.
   * @param bar Bar data with close price
   * @returns Percentage change from period ago
   */
  onData(bar: BarWith<"close">): number {
    this.buffer.push(bar.close);
    if (!this.buffer.full()) {
      return 0;
    }
    const old = this.buffer.front()!;
    return old !== 0 ? ((bar.close - old) / old) * 100 : 0;
  }
}

/**
 * Creates ROC closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes data and returns rate of change
 */
export function useROC(opts: PeriodOptions): (bar: BarWith<"close">) => number {
  const instance = new ROC(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Rate of Change Ratio - stateful indicator.
 * Calculates price change ratio over period.
 */
export class ROCR {
  private buffer: CircularBuffer<number>;

  constructor(opts: PeriodOptions) {
    if (opts.period === undefined) {
      throw new Error("ROCR requires period");
    }
    this.buffer = new CircularBuffer(opts.period + 1);
  }

  /**
   * Process new data point.
   * @param bar Bar data with close price
   * @returns Price ratio from period ago
   */
  onData(bar: BarWith<"close">): number {
    this.buffer.push(bar.close);
    if (!this.buffer.full()) {
      return 1;
    }
    const old = this.buffer.front()!;
    return old !== 0 ? bar.close / old : 1;
  }
}

/**
 * Creates ROCR closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes data and returns rate of change ratio
 */
export function useROCR(
  opts: PeriodOptions
): (bar: BarWith<"close">) => number {
  const instance = new ROCR(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Relative Strength Index - stateful indicator.
 * Uses Wilder's smoothing to measure overbought/oversold conditions.
 */
export class RSI {
  private alpha: number;
  private avgGain?: number;
  private avgLoss?: number;
  private prevClose?: number;

  constructor(opts: PeriodOptions) {
    if (opts.period === undefined) {
      throw new Error("RSI requires period");
    }
    this.alpha = wilders_factor(opts.period);
  }

  /**
   * Process new data point.
   * @param bar Bar data with close price
   * @returns RSI value (0-100)
   */
  onData(bar: BarWith<"close">): number {
    if (this.prevClose === undefined) {
      this.prevClose = bar.close;
      return 50;
    }

    const change = bar.close - this.prevClose;
    this.prevClose = bar.close;

    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (this.avgGain === undefined) {
      this.avgGain = gain;
      this.avgLoss = loss;
    } else {
      this.avgGain = smooth(this.avgGain, gain, this.alpha);
      this.avgLoss = smooth(this.avgLoss!, loss, this.alpha);
    }

    if (this.avgLoss === 0) {
      return 100;
    }

    const rs = this.avgGain / this.avgLoss;
    return 100 - 100 / (1 + rs);
  }
}

/**
 * Creates RSI closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes data and returns RSI
 */
export function useRSI(opts: PeriodOptions): (bar: BarWith<"close">) => number {
  const instance = new RSI(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Chande Momentum Oscillator - stateful indicator.
 * Measures momentum using sum of gains vs losses over period.
 */
export class CMO {
  private buffer: CircularBuffer<number>;
  private prevClose?: number;

  constructor(opts: PeriodOptions) {
    if (opts.period === undefined) {
      throw new Error("CMO requires period");
    }
    this.buffer = new CircularBuffer(opts.period);
  }

  /**
   * Process new data point.
   * @param bar Bar data with close price
   * @returns CMO value (-100 to 100)
   */
  onData(bar: BarWith<"close">): number {
    if (this.prevClose === undefined) {
      this.prevClose = bar.close;
      return 0;
    }

    const change = bar.close - this.prevClose;
    this.prevClose = bar.close;
    this.buffer.push(change);

    if (!this.buffer.full()) {
      return 0;
    }

    let upSum = 0;
    let downSum = 0;
    for (const val of this.buffer) {
      if (val > 0) upSum += val;
      else downSum -= val;
    }

    const total = upSum + downSum;
    return total !== 0 ? ((upSum - downSum) / total) * 100 : 0;
  }
}

/**
 * Creates CMO closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes data and returns CMO
 */
export function useCMO(opts: PeriodOptions): (bar: BarWith<"close">) => number {
  const instance = new CMO(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Williams Accumulation/Distribution - stateful indicator.
 * Cumulative indicator measuring buying and selling pressure.
 */
export class WAD {
  private wad: number = 0;
  private prevClose?: number;

  /**
   * Process new bar data.
   * @param bar Bar data with high, low, close
   * @returns Current WAD value
   */
  onData(bar: BarWith<"high" | "low" | "close">): number {
    if (this.prevClose === undefined) {
      this.prevClose = bar.close;
      return this.wad;
    }

    if (bar.close > this.prevClose) {
      this.wad += bar.close - Math.min(this.prevClose, bar.low);
    } else if (bar.close < this.prevClose) {
      this.wad += bar.close - Math.max(this.prevClose, bar.high);
    }

    this.prevClose = bar.close;
    return this.wad;
  }
}

/**
 * Creates WAD closure for functional usage.
 * @returns Function that processes bar data and returns WAD
 */
export function useWAD(): (bar: BarWith<"high" | "low" | "close">) => number {
  const instance = new WAD();
  return (bar) => instance.onData(bar);
}
