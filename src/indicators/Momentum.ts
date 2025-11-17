import type { PeriodWith } from "../types/PeriodOptions.js";
import type { BarWith } from "../types/BarData.js";
import { CircularBuffer } from "../fn/Containers.js";
import { wilders_factor, SmoothedAccum } from "../utils/math.js";
import { EMA, SMA } from "../fn/Foundation.js";

import { type OperatorDoc } from "../types/OpDoc.js";

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

  static readonly doc: OperatorDoc = {
    type: "BOP",
    desc: "Balance of Power - measures buying vs selling pressure.\
    Calculates (close - open) / (high - low) ratio.",
    onDataParam:
      "bar: {open: number, high: number, low: number, close: number}",
    output: "number",
  };
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

  constructor(opts: PeriodWith<"period">) {
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

  static readonly doc: OperatorDoc = {
    type: "MOM",
    desc: "Momentum",
    init: "{period: number}",
    onDataParam: "bar: {close: number}",
    output: "number",
  };
}

/**
 * Creates MOM closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes data and returns momentum
 */
export function useMOM(
  opts: PeriodWith<"period">
): (bar: BarWith<"close">) => number {
  const instance = new MOM(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Rate of Change - stateful indicator.
 * Calculates percentage price change over period.
 */
export class ROC {
  private buffer: CircularBuffer<number>;

  constructor(opts: PeriodWith<"period">) {
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

  static readonly doc: OperatorDoc = {
    type: "ROC",
    desc: "Rate of Change",
    init: "{period: number}",
    onDataParam: "bar: {close: number}",
    output: "number",
  };
}

/**
 * Creates ROC closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes data and returns rate of change
 */
export function useROC(
  opts: PeriodWith<"period">
): (bar: BarWith<"close">) => number {
  const instance = new ROC(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Rate of Change Ratio - stateful indicator.
 * Calculates price change ratio over period.
 */
export class ROCR {
  private buffer: CircularBuffer<number>;

  constructor(opts: PeriodWith<"period">) {
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

  static readonly doc: OperatorDoc = {
    type: "ROCR",
    desc: "Rate of Change Ratio",
    init: "{period: number}",
    onDataParam: "bar: {close: number}",
    output: "number",
  };
}

/**
 * Creates ROCR closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes data and returns rate of change ratio
 */
export function useROCR(
  opts: PeriodWith<"period">
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
  private avgGain?: SmoothedAccum;
  private avgLoss?: SmoothedAccum;
  private prevClose?: number;

  constructor(opts: PeriodWith<"period">) {
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
      this.avgGain = new SmoothedAccum(gain);
      this.avgLoss = new SmoothedAccum(loss);
    } else {
      this.avgGain.accum(gain, this.alpha);
      this.avgLoss!.accum(loss, this.alpha);
    }

    if (this.avgLoss!.val === 0) {
      return 100;
    }

    const rs = this.avgGain.val / this.avgLoss!.val;
    return 100 - 100 / (1 + rs);
  }

  static readonly doc: OperatorDoc = {
    type: "RSI",
    desc: "Relative Strength Index",
    init: "{period: number}",
    onDataParam: "bar: {close: number}",
    output: "number",
  };
}

/**
 * Creates RSI closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes data and returns RSI
 */
export function useRSI(
  opts: PeriodWith<"period">
): (bar: BarWith<"close">) => number {
  const instance = new RSI(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Chande Momentum Oscillator - stateful indicator.
 * Measures momentum using sum of gains vs losses over period.
 */
export class CMO {
  private buffer: CircularBuffer<number>;
  private upSum: number = 0;
  private downSum: number = 0;
  private prevClose?: number;

  constructor(opts: PeriodWith<"period">) {
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

    if (change > 0) {
      this.upSum += change;
    } else {
      this.downSum -= change;
    }

    if (this.buffer.full()) {
      const change0 = this.buffer.front()!;
      if (change0 > 0) {
        this.upSum -= change0;
      } else {
        this.downSum += change0;
      }
    }
    this.buffer.push(change);

    if (!this.buffer.full()) {
      return 0;
    }

    const total = this.upSum + this.downSum;
    return total !== 0 ? ((this.upSum - this.downSum) / total) * 100 : 0;
  }

  static readonly doc: OperatorDoc = {
    type: "CMO",
    desc: "Chande Momentum Oscillator",
    init: "{period: number}",
    onDataParam: "bar: {close: number}",
    output: "number",
  };
}

/**
 * Creates CMO closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes data and returns CMO
 */
export function useCMO(
  opts: PeriodWith<"period">
): (bar: BarWith<"close">) => number {
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

  static readonly doc: OperatorDoc = {
    type: "WAD",
    desc: "Williams Accumulation/Distribution",
    onDataParam: "bar: {high: number, low: number, close: number}",
    output: "number",
  };
}

/**
 * Creates WAD closure for functional usage.
 * @returns Function that processes bar data and returns WAD
 */
export function useWAD(): (bar: BarWith<"high" | "low" | "close">) => number {
  const instance = new WAD();
  return (bar) => instance.onData(bar);
}

/**
 * Relative Vigor Index - measures trend conviction.
 * Compares close relative to open with range.
 */
export class RVI {
  private numeratorSma: SMA;
  private denominatorSma: SMA;
  private signalSma: SMA;

  constructor(opts: PeriodWith<"period">) {
    this.numeratorSma = new SMA(opts);
    this.denominatorSma = new SMA(opts);
    this.signalSma = new SMA({ period: 4 });
  }

  /**
   * Process new bar data.
   * @param bar Bar with open, high, low, close
   * @returns Object with rvi and signal values
   */
  onData(bar: BarWith<"open" | "high" | "low" | "close">): {
    rvi: number;
    signal: number;
  } {
    const numerator = bar.close - bar.open;
    const denominator = bar.high - bar.low;

    const avgNum = this.numeratorSma.onData(numerator);
    const avgDenom = this.denominatorSma.onData(denominator);

    const rvi = avgDenom !== 0 ? avgNum / avgDenom : 0;
    const signal = this.signalSma.onData(rvi);

    return { rvi, signal };
  }

  static readonly doc: OperatorDoc = {
    type: "RVI",
    desc: "Relative Vigor Index",
    init: "{period: number}",
    onDataParam: "bar: {open: number, high: number, low: number, close: number}",
    output: "{rvi: number, signal: number}",
  };
}

/**
 * Creates RVI closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes bar data and returns RVI
 */
export function useRVI(opts: PeriodWith<"period">): (
  bar: BarWith<"open" | "high" | "low" | "close">
) => {
  rvi: number;
  signal: number;
} {
  const instance = new RVI(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Trend Strength Index - momentum indicator.
 * Double-smoothed momentum oscillator.
 */
export class TSI {
  private emsSlow1: EMA;
  private emsFast1: EMA;
  private emsSlow2: EMA;
  private emsFast2: EMA;
  private emaSignal: EMA;
  private prevClose?: number;

  constructor(
    opts: PeriodWith<"period_fast" | "period_slow" | "period_signal"> = {
      period_fast: 13,
      period_slow: 25,
      period_signal: 13,
    }
  ) {
    this.emsSlow1 = new EMA({ period: opts.period_slow });
    this.emsFast1 = new EMA({ period: opts.period_fast });
    this.emsSlow2 = new EMA({ period: opts.period_slow });
    this.emsFast2 = new EMA({ period: opts.period_fast });
    this.emaSignal = new EMA({ period: opts.period_signal });
  }

  /**
   * Process new data point.
   * @param bar Bar with close price
   * @returns Object with tsi and signal values
   */
  onData(bar: BarWith<"close">): { tsi: number; signal: number } {
    if (this.prevClose === undefined) {
      this.prevClose = bar.close;
      this.emsSlow1.onData(0);
      this.emsFast1.onData(0);
      this.emsSlow2.onData(0);
      this.emsFast2.onData(0);
      return { tsi: 0, signal: 0 };
    }

    const momentum = bar.close - this.prevClose;
    this.prevClose = bar.close;

    const smoothed1 = this.emsSlow1.onData(momentum);
    const doubleSmoothNum = this.emsFast1.onData(smoothed1);

    const absMomentum = Math.abs(momentum);
    const smoothed2 = this.emsSlow2.onData(absMomentum);
    const doubleSmoothDenom = this.emsFast2.onData(smoothed2);

    const tsi =
      doubleSmoothDenom !== 0 ? (doubleSmoothNum / doubleSmoothDenom) * 100 : 0;
    const signal = this.emaSignal.onData(tsi);

    return { tsi, signal };
  }

  static readonly doc: OperatorDoc = {
    type: "TSI",
    desc: "Trend Strength Index",
    init: "{period_fast?: number, period_slow?: number, period_signal?: number}",
    onDataParam: "bar: {close: number}",
    output: "{tsi: number, signal: number}",
  };
}

/**
 * Creates TSI closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes bar data and returns TSI
 */
export function useTSI(
  opts: PeriodWith<"period_fast" | "period_slow" | "period_signal"> = {
    period_fast: 13,
    period_slow: 25,
    period_signal: 13,
  }
): (bar: BarWith<"close">) => { tsi: number; signal: number } {
  const instance = new TSI(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Elder's Bull/Bear Power - measures buying and selling pressure.
 * Compares highs and lows to EMA.
 */
export class BBPOWER {
  private ema: EMA;

  constructor(opts: PeriodWith<"period">) {
    this.ema = new EMA(opts);
  }

  /**
   * Process new bar data.
   * @param bar Bar with high, low, close
   * @returns Object with bull_power and bear_power
   */
  onData(bar: BarWith<"high" | "low" | "close">): {
    bull_power: number;
    bear_power: number;
  } {
    const emaValue = this.ema.onData(bar.close);
    return {
      bull_power: bar.high - emaValue,
      bear_power: bar.low - emaValue,
    };
  }

  static readonly doc: OperatorDoc = {
    type: "BBPOWER",
    desc: "Elder's Bull/Bear Power",
    init: "{period: number}",
    onDataParam: "bar: {high: number, low: number, close: number}",
    output: "{bull_power: number, bear_power: number}",
  };
}

/**
 * Creates BBPOWER closure for functional usage.
 * @param opts Period configuration (typically 13)
 * @returns Function that processes bar data and returns Bull/Bear Power
 */
export function useBBPOWER(opts: PeriodWith<"period">): (
  bar: BarWith<"high" | "low" | "close">
) => {
  bull_power: number;
  bear_power: number;
} {
  const instance = new BBPOWER(opts);
  return (bar) => instance.onData(bar);
}
