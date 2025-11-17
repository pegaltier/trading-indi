import type { BarWith } from "../types/BarData.js";
import type { PeriodOptions, PeriodWith } from "../types/PeriodOptions.js";
import { Max, Min, MinMax, SMA } from "../fn/Foundation.js";
import { RSI } from "./Momentum.js";
import { type OperatorDoc } from "../types/OpDoc.js";

/**
 * Stochastic Oscillator - stateful indicator.
 * Measures price position relative to high-low range over k_period.
 * Returns smoothed %K and %D lines.
 */
export class STOCH {
  private highest: Max;
  private lowest: Min;
  private smaK: SMA;
  private smaD: SMA;

  constructor(
    opts: PeriodOptions & {
      k_period?: number;
      k_slowing?: number;
      d_period?: number;
    } = {
      k_period: 14,
      k_slowing: 3,
      d_period: 3,
    }
  ) {
    const kPeriod = opts.k_period ?? opts.period ?? 14;
    const kSlowing = opts.k_slowing ?? 3;
    const dPeriod = opts.d_period ?? 3;

    this.highest = new Max({ period: kPeriod });
    this.lowest = new Min({ period: kPeriod });
    this.smaK = new SMA({ period: kSlowing });
    this.smaD = new SMA({ period: dPeriod });
  }

  /**
   * Process new data point.
   * @param bar Bar with high, low, close prices
   * @returns Object with %K and %D values
   */
  onData(bar: BarWith<"high" | "low" | "close">): {
    k: number;
    d: number;
  } {
    const highest = this.highest.onData(bar.high);
    const lowest = this.lowest.onData(bar.low);

    if (!this.highest.buffer.full()) {
      return { k: 0, d: 0 };
    }

    const range = highest - lowest;
    const rawK = range !== 0 ? ((bar.close - lowest) / range) * 100 : 50;
    const k = this.smaK.onData(rawK);
    const d = this.smaD.onData(k);
    return { k, d };
  }

  static readonly doc: OperatorDoc = {
    type: "STOCH",
    desc: "Stochastic Oscillator",
    init: "{k_period?: number, k_slowing?: number, d_period?: number}",
    onDataParam: "bar: {high: number, low: number, close: number}",
    output: "{k: number, d: number}",
  };
}

/**
 * Creates STOCH closure for functional usage.
 * @param opts Period configuration with k_period, k_slowing, d_period
 * @returns Function that processes bar data and returns {k, d}
 */
export function useSTOCH(
  opts: PeriodOptions & {
    k_period?: number;
    k_slowing?: number;
    d_period?: number;
  }
): (bar: BarWith<"high" | "low" | "close">) => {
  k: number;
  d: number;
} {
  const instance = new STOCH(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Stochastic RSI - stateful indicator.
 * Applies stochastic formula to RSI values over specified period.
 */
export class STOCHRSI {
  private rsi: RSI;
  private minmax: MinMax;

  constructor(opts: PeriodWith<"period">) {
    this.rsi = new RSI(opts);
    this.minmax = new MinMax(opts);
  }

  /**
   * Process new data point.
   * @param bar Bar with close price
   * @returns Current Stochastic RSI value
   */
  onData(bar: BarWith<"close">): number {
    const rsi = this.rsi.onData(bar);
    const { min, max } = this.minmax.onData(rsi);

    if (!this.minmax.buffer.full()) {
      return 0;
    }

    const range = max - min;
    return range !== 0 ? ((rsi - min) / range) * 100 : 0;
  }

  static readonly doc: OperatorDoc = {
    type: "STOCHRSI",
    desc: "Stochastic RSI",
    init: "{period: number}",
    onDataParam: "bar: {close: number}",
    output: "number",
  };
}

/**
 * Creates STOCHRSI closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes bar data and returns Stochastic RSI
 */
export function useSTOCHRSI(
  opts: PeriodWith<"period">
): (bar: BarWith<"close">) => number {
  const instance = new STOCHRSI(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Williams %R - stateful indicator.
 * Measures overbought/oversold levels over specified period.
 */
export class WILLR {
  private highest: Max;
  private lowest: Min;

  constructor(opts: PeriodWith<"period">) {
    this.highest = new Max(opts);
    this.lowest = new Min(opts);
  }

  /**
   * Process new data point.
   * @param bar Bar with high, low, close prices
   * @returns Current Williams %R value
   */
  onData(bar: BarWith<"high" | "low" | "close">): number {
    const highest = this.highest.onData(bar.high);
    const lowest = this.lowest.onData(bar.low);

    if (!this.highest.buffer.full()) {
      return 0;
    }

    const range = highest - lowest;
    return range !== 0 ? ((highest - bar.close) / range) * -100 : 0;
  }

  static readonly doc: OperatorDoc = {
    type: "WILLR",
    desc: "Williams %R",
    init: "{period: number}",
    onDataParam: "bar: {high: number, low: number, close: number}",
    output: "number",
  };
}

/**
 * Creates WILLR closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes bar data and returns Williams %R
 */
export function useWILLR(
  opts: PeriodWith<"period">
): (bar: BarWith<"high" | "low" | "close">) => number {
  const instance = new WILLR(opts);
  return (bar) => instance.onData(bar);
}
