import type { BarWith } from "../types/BarData.js";
import type { PeriodWith } from "../types/PeriodOptions.js";
import { EMA, MinMax, SMA, Sum } from "../fn/Foundation.js";
import { type OperatorDoc } from "../types/OpDoc.js";

/**
 * Awesome Oscillator - stateful indicator.
 * Measures momentum using median price with 5/34 period SMAs.
 */
export class AO {
  private smaShort = new SMA({ period: 5 });
  private smaLong = new SMA({ period: 34 });

  /**
   * Process new bar data.
   * @param bar Bar with high and low prices
   * @returns Current AO value
   */
  onData(bar: BarWith<"high" | "low">): number {
    const midpoint = (bar.high + bar.low) / 2;
    return this.smaShort.onData(midpoint) - this.smaLong.onData(midpoint);
  }

  static readonly doc: OperatorDoc = {
    type: "AO",
    onDataParam: "bar: {high, low}",
    output: "number",
  };
}

/**
 * Creates AO closure for functional usage.
 * @returns Function that processes bar data and returns AO
 */
export function useAO(): (bar: BarWith<"high" | "low">) => number {
  const instance = new AO();
  return (bar) => instance.onData(bar);
}

/**
 * Absolute Price Oscillator - stateful indicator.
 * Calculates difference between short and long period EMAs.
 */
export class APO {
  private emsFast: EMA;
  private emsSlow: EMA;

  constructor(opts: PeriodWith<"period_fast" | "period_slow">) {
    this.emsFast = new EMA({ period: opts.period_fast });
    this.emsSlow = new EMA({ period: opts.period_slow });
  }

  /**
   * Process new data point.
   * @param bar Bar with close price
   * @returns Current APO value
   */
  onData(bar: BarWith<"close">): number {
    return this.emsFast.onData(bar.close) - this.emsSlow.onData(bar.close);
  }

  static readonly doc: OperatorDoc = {
    type: "APO",
    init: "{period_fast, period_slow}",
    onDataParam: "bar: {close}",
    output: "number",
  };
}

/**
 * Creates APO closure for functional usage.
 * @param opts Short and long period configuration
 * @returns Function that processes bar data and returns APO
 */
export function useAPO(
  opts: PeriodWith<"period_fast" | "period_slow">
): (bar: BarWith<"close">) => number {
  const instance = new APO(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Detrended Price Oscillator - stateful indicator.
 * Removes trend to identify cycles using displaced SMA.
 */
export class DPO {
  private sma: SMA;
  private lookback: number;

  constructor(opts: PeriodWith<"period">) {
    this.sma = new SMA({ period: opts.period });
    this.lookback = Math.floor(opts.period / 2) + 1;
  }

  /**
   * Process new data point.
   * @param bar Bar with close price
   * @returns Current DPO value
   */
  onData(bar: BarWith<"close">): number {
    const smaVal = this.sma.onData(bar.close);

    if (!this.sma.buffer.full()) {
      return 0;
    }

    const pastPrice =
      this.sma.buffer.at(this.sma.buffer.size() - this.lookback) ?? bar.close;
    return pastPrice - smaVal;
  }

  static readonly doc: OperatorDoc = {
    type: "DPO",
    init: "{period: number}",
    onDataParam: "bar: {close}",
    output: "number",
  };
}

/**
 * Creates DPO closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes bar data and returns DPO
 */
export function useDPO(
  opts: PeriodWith<"period">
): (bar: BarWith<"close">) => number {
  const instance = new DPO(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Fisher Transform - stateful indicator.
 * Transforms prices to Gaussian distribution for identifying turning points.
 */
export class Fisher {
  private minmax: MinMax;
  private val: number = 0;
  private fisher: number = 0;

  constructor(opts: PeriodWith<"period">) {
    this.minmax = new MinMax({ period: opts.period });
  }

  /**
   * Process new bar data.
   * @param bar Bar with high and low prices
   * @returns Current Fisher Transform value
   */
  onData(bar: BarWith<"high" | "low">): number {
    const hl = (bar.high + bar.low) / 2;
    const { min, max } = this.minmax.onData(hl);

    const range = max - min;
    if (range === 0) {
      return this.fisher;
    }

    const normalized = 2 * ((hl - min) / range - 0.5);
    this.val = 0.333 * normalized + 0.667 * this.val;

    const clamped = Math.max(-0.999, Math.min(0.999, this.val));
    const rawFisher = 0.5 * Math.log((1 + clamped) / (1 - clamped));
    this.fisher = 0.5 * rawFisher + 0.5 * this.fisher;

    return this.fisher;
  }

  static readonly doc: OperatorDoc = {
    type: "Fisher",
    init: "{period: number}",
    onDataParam: "bar: {high, low}",
    output: "number",
  };
}

/**
 * Creates Fisher closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes bar data and returns Fisher Transform
 */
export function useFisher(
  opts: PeriodWith<"period">
): (bar: BarWith<"high" | "low">) => number {
  const instance = new Fisher(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Moving Average Convergence/Divergence - stateful indicator.
 * Trend-following momentum indicator using EMAs.
 */
export class MACD {
  private emsFast: EMA;
  private emsSlow: EMA;
  private emaSignal: EMA;

  constructor(
    opts: PeriodWith<"period_fast" | "period_slow" | "period_signal">
  ) {
    this.emsFast = new EMA({ period: opts.period_fast });
    this.emsSlow = new EMA({ period: opts.period_slow });
    this.emaSignal = new EMA({ period: opts.period_signal });
  }

  /**
   * Process new data point.
   * @param bar Bar with close price
   * @returns Object with macd, signal, and histogram values
   */
  onData(bar: BarWith<"close">): {
    macd: number;
    signal: number;
    histogram: number;
  } {
    const macd =
      this.emsFast.onData(bar.close) - this.emsSlow.onData(bar.close);
    const signal = this.emaSignal.onData(macd);
    const histogram = macd - signal;
    return { macd, signal, histogram };
  }

  static readonly doc: OperatorDoc = {
    type: "MACD",
    init: "{period_fast, period_slow, period_signal}",
    onDataParam: "bar: {close}",
    output: "{macd, signal, histogram}",
  };
}

/**
 * Creates MACD closure for functional usage.
 * @param opts Short, long, and signal period configuration
 * @returns Function that processes bar data and returns MACD values
 */
export function useMACD(
  opts: PeriodWith<"period_fast" | "period_slow" | "period_signal">
): (bar: BarWith<"close">) => {
  macd: number;
  signal: number;
  histogram: number;
} {
  const instance = new MACD(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Percentage Price Oscillator - stateful indicator.
 * Calculates percentage difference between short and long period EMAs.
 */
export class PPO {
  private emsFast: EMA;
  private emsSlow: EMA;

  constructor(opts: PeriodWith<"period_fast" | "period_slow">) {
    this.emsFast = new EMA({ period: opts.period_fast });
    this.emsSlow = new EMA({ period: opts.period_slow });
  }

  /**
   * Process new data point.
   * @param bar Bar with close price
   * @returns Current PPO value as percentage
   */
  onData(bar: BarWith<"close">): number {
    const emsFastVal = this.emsFast.onData(bar.close);
    const emsSlowVal = this.emsSlow.onData(bar.close);
    return emsSlowVal !== 0
      ? ((emsFastVal - emsSlowVal) / emsSlowVal) * 100
      : 0;
  }

  static readonly doc: OperatorDoc = {
    type: "PPO",
    init: "{period_fast, period_slow}",
    onDataParam: "bar: {close}",
    output: "number",
  };
}

/**
 * Creates PPO closure for functional usage.
 * @param opts Short and long period configuration
 * @returns Function that processes bar data and returns PPO
 */
export function usePPO(
  opts: PeriodWith<"period_fast" | "period_slow">
): (bar: BarWith<"close">) => number {
  const instance = new PPO(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Qstick - stateful indicator.
 * Measures average difference between close and open prices.
 */
export class QSTICK {
  private sma: SMA;

  constructor(opts: PeriodWith<"period">) {
    this.sma = new SMA({ period: opts.period });
  }

  /**
   * Process new bar data.
   * @param bar Bar with open and close prices
   * @returns Current QSTICK value
   */
  onData(bar: BarWith<"open" | "close">): number {
    const diff = bar.close - bar.open;
    return this.sma.onData(diff);
  }

  static readonly doc: OperatorDoc = {
    type: "QSTICK",
    init: "{period: number}",
    onDataParam: "bar: {open, close}",
    output: "number",
  };
}

/**
 * Creates QSTICK closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes bar data and returns QSTICK
 */
export function useQSTICK(
  opts: PeriodWith<"period">
): (bar: BarWith<"open" | "close">) => number {
  const instance = new QSTICK(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Trix - stateful indicator.
 * Rate of change of triple exponential moving average.
 */
export class TRIX {
  private ema1: EMA;
  private ema2: EMA;
  private ema3: EMA;
  private prevEma3?: number;

  constructor(opts: PeriodWith<"period">) {
    this.ema1 = new EMA({ period: opts.period });
    this.ema2 = new EMA({ period: opts.period });
    this.ema3 = new EMA({ period: opts.period });
  }

  /**
   * Process new data point.
   * @param bar Bar with close price
   * @returns Current TRIX value as percentage
   */
  onData(bar: BarWith<"close">): number {
    const ema1Val = this.ema1.onData(bar.close);
    const ema2Val = this.ema2.onData(ema1Val);
    const ema3Val = this.ema3.onData(ema2Val);

    if (this.prevEma3 === undefined || this.prevEma3 === 0) {
      this.prevEma3 = ema3Val;
      return 0;
    }

    const trix = ((ema3Val - this.prevEma3) / this.prevEma3) * 100;
    this.prevEma3 = ema3Val;
    return trix;
  }

  static readonly doc: OperatorDoc = {
    type: "TRIX",
    init: "{period: number}",
    onDataParam: "bar: {close}",
    output: "number",
  };
}

/**
 * Creates TRIX closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes bar data and returns TRIX
 */
export function useTRIX(
  opts: PeriodWith<"period">
): (bar: BarWith<"close">) => number {
  const instance = new TRIX(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Ultimate Oscillator - stateful indicator.
 * Momentum oscillator using weighted average of buying pressure across three timeframes.
 */
export class ULTOSC {
  private prevClose?: number;
  private sumBpFast: Sum;
  private sumBpMed: Sum;
  private sumBpSlow: Sum;
  private sumTrFast: Sum;
  private sumTrMed: Sum;
  private sumTrSlow: Sum;

  constructor(opts: PeriodWith<"period_fast" | "period_med" | "period_slow">) {
    this.sumBpFast = new Sum({ period: opts.period_fast });
    this.sumBpMed = new Sum({ period: opts.period_med });
    this.sumBpSlow = new Sum({ period: opts.period_slow });
    this.sumTrFast = new Sum({ period: opts.period_fast });
    this.sumTrMed = new Sum({ period: opts.period_med });
    this.sumTrSlow = new Sum({ period: opts.period_slow });
  }

  /**
   * Process new bar data.
   * @param bar OHLC bar with high, low, close
   * @returns Ultimate Oscillator value (0-100 range)
   */
  onData(bar: BarWith<"high" | "low" | "close">): number {
    if (this.prevClose === undefined) {
      this.prevClose = bar.close;
      return 50;
    }

    const tl = Math.min(bar.low, this.prevClose);
    const th = Math.max(bar.high, this.prevClose);
    const bp = bar.close - tl;
    const tr = th - tl;

    const bpFast = this.sumBpFast.onData(bp);
    const bpMed = this.sumBpMed.onData(bp);
    const bpSlow = this.sumBpSlow.onData(bp);
    const trFast = this.sumTrFast.onData(tr);
    const trMed = this.sumTrMed.onData(tr);
    const trSlow = this.sumTrSlow.onData(tr);

    this.prevClose = bar.close;

    const avg1 = trFast !== 0 ? bpFast / trFast : 0;
    const avg2 = trMed !== 0 ? bpMed / trMed : 0;
    const avg3 = trSlow !== 0 ? bpSlow / trSlow : 0;

    return (100 * (4 * avg1 + 2 * avg2 + avg3)) / 7;
  }

  static readonly doc: OperatorDoc = {
    type: "ULTOSC",
    init: "{period_fast, period_med, period_slow}",
    onDataParam: "bar: {high, low, close}",
    output: "number",
  };
}

/**
 * Creates ULTOSC closure for functional usage.
 * @param opts Short, medium, and long period configuration (typically 7, 14, 28)
 * @returns Function that processes bar data and returns Ultimate Oscillator
 */
export function useULTOSC(
  opts: PeriodWith<"period_fast" | "period_med" | "period_slow">
): (bar: BarWith<"high" | "low" | "close">) => number {
  const instance = new ULTOSC(opts);
  return (bar: BarWith<"high" | "low" | "close">) => instance.onData(bar);
}
