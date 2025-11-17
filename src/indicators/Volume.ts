import type { BarWith } from "../types/BarData.js";
import type { PeriodWith } from "../types/PeriodOptions.js";
import { CircularBuffer } from "../fn/Containers.js";
import { EMA, Sum } from "../fn/Foundation.js";
import { type OperatorDoc } from "../types/OpDoc.js";

/**
 * Accumulation/Distribution - stateful indicator.
 * Cumulative measure of money flow based on close location value.
 */
export class AD {
  private ad: number = 0;

  /**
   * Process new bar data.
   * @param bar Bar data with high, low, close, volume
   * @returns Current AD value
   */
  onData(bar: BarWith<"high" | "low" | "close" | "volume">): number {
    const clv =
      bar.high !== bar.low
        ? ((bar.close - bar.low - (bar.high - bar.close)) /
            (bar.high - bar.low)) *
          bar.volume
        : 0;
    this.ad += clv;
    return this.ad;
  }

  static readonly doc: OperatorDoc = {
    type: "AD",
    desc: "Accumulation/Distribution",
    onDataParam: "bar: {high: number, low: number, close: number, volume: number}",
    output: "number",
  };
}

/**
 * Creates AD closure for functional usage.
 * @returns Function that processes bar data and returns AD
 */
export function useAD(): (
  bar: BarWith<"high" | "low" | "close" | "volume">
) => number {
  const instance = new AD();
  return (bar) => instance.onData(bar);
}

/**
 * Accumulation/Distribution Oscillator - stateful indicator.
 * Measures difference between short and long EMAs of AD values.
 */
export class ADOSC {
  private ad = new AD();
  private emsFast: EMA;
  private emsSlow: EMA;

  constructor(opts: PeriodWith<"period_fast" | "period_slow">) {
    this.emsFast = new EMA({ period: opts.period_fast });
    this.emsSlow = new EMA({ period: opts.period_slow });
  }

  /**
   * Process new bar data.
   * @param bar Bar data with high, low, close, volume
   * @returns Current ADOSC value
   */
  onData(bar: BarWith<"high" | "low" | "close" | "volume">): number {
    const adVal = this.ad.onData(bar);
    return this.emsFast.onData(adVal) - this.emsSlow.onData(adVal);
  }

  static readonly doc: OperatorDoc = {
    type: "ADOSC",
    desc: "Accumulation/Distribution Oscillator",
    init: "{period_fast: number, period_slow: number}",
    onDataParam: "bar: {high: number, low: number, close: number, volume: number}",
    output: "number",
  };
}

/**
 * Creates ADOSC closure for functional usage.
 * @param opts Period configuration (period_fast, period_slow)
 * @returns Function that processes bar data and returns ADOSC
 */
export function useADOSC(
  opts: PeriodWith<"period_fast" | "period_slow">
): (bar: BarWith<"high" | "low" | "close" | "volume">) => number {
  const instance = new ADOSC(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Klinger Volume Oscillator - stateful indicator.
 * Combines price movement trends with volume to detect money flow.
 */
export class KVO {
  private fastEMA: EMA;
  private slowEMA: EMA;
  private prevHLC?: number;
  private trend: number = 1;
  private cm: number = 0;

  constructor(opts: PeriodWith<"period_fast" | "period_slow">) {
    this.fastEMA = new EMA({ period: opts.period_fast });
    this.slowEMA = new EMA({ period: opts.period_slow });
  }

  /**
   * Process new bar data.
   * @param bar Bar data with high, low, close, volume
   * @returns Current KVO value
   */
  onData(bar: BarWith<"high" | "low" | "close" | "volume">): number {
    const hlc = bar.high + bar.low + bar.close;
    const dm = bar.high - bar.low;

    if (this.prevHLC !== undefined) {
      if (hlc > this.prevHLC) {
        const prevTrend = this.trend;
        this.trend = 1;
        this.cm = prevTrend !== this.trend ? dm : this.cm + dm;
      } else if (hlc < this.prevHLC) {
        const prevTrend = this.trend;
        this.trend = -1;
        this.cm = prevTrend !== this.trend ? dm : this.cm + dm;
      } else {
        this.cm += dm;
      }
    } else {
      this.cm = dm;
    }

    this.prevHLC = hlc;

    const vf =
      this.cm > 0
        ? 100 * bar.volume * this.trend * Math.abs((2 * dm) / this.cm - 1)
        : 0;

    const fastVF = this.fastEMA.onData(vf);
    const slowVF = this.slowEMA.onData(vf);

    return fastVF - slowVF;
  }

  static readonly doc: OperatorDoc = {
    type: "KVO",
    desc: "Klinger Volume Oscillator",
    init: "{period_fast: number, period_slow: number}",
    onDataParam: "bar: {high: number, low: number, close: number, volume: number}",
    output: "number",
  };
}

/**
 * Creates KVO closure for functional usage.
 * @param opts Period configuration (period_fast defaults to 34, period_slow to 55)
 * @returns Function that processes bar data and returns KVO
 */
export function useKVO(
  opts: PeriodWith<"period_fast" | "period_slow">
): (bar: BarWith<"high" | "low" | "close" | "volume">) => number {
  const instance = new KVO(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Negative Volume Index - stateful indicator.
 * Tracks price changes on decreasing volume days.
 */
export class NVI {
  private nvi: number = 1000;
  private prevVolume?: number;
  private prevClose?: number;

  /**
   * Process new bar data.
   * @param bar Bar data with close, volume
   * @returns Current NVI value
   */
  onData(bar: BarWith<"close" | "volume">): number {
    if (this.prevVolume === undefined) {
      this.prevVolume = bar.volume;
      this.prevClose = bar.close;
      return this.nvi;
    }

    if (bar.volume < this.prevVolume && this.prevClose !== 0) {
      const roc = (bar.close - this.prevClose!) / this.prevClose!;
      this.nvi += this.nvi * roc;
    }

    this.prevVolume = bar.volume;
    this.prevClose = bar.close;
    return this.nvi;
  }

  static readonly doc: OperatorDoc = {
    type: "NVI",
    desc: "Negative Volume Index",
    onDataParam: "bar: {close: number, volume: number}",
    output: "number",
  };
}

/**
 * Creates NVI closure for functional usage.
 * @returns Function that processes bar data and returns NVI
 */
export function useNVI(): (bar: BarWith<"close" | "volume">) => number {
  const instance = new NVI();
  return (bar) => instance.onData(bar);
}

/**
 * On Balance Volume - stateful indicator.
 * Cumulative volume indicator based on price direction.
 */
export class OBV {
  private obv: number = 0;
  private prevClose?: number;

  /**
   * Process new bar data.
   * @param bar Bar data with close, volume
   * @returns Current OBV value
   */
  onData(bar: BarWith<"close" | "volume">): number {
    if (this.prevClose === undefined) {
      this.prevClose = bar.close;
      return this.obv;
    }

    if (bar.close > this.prevClose) {
      this.obv += bar.volume;
    } else if (bar.close < this.prevClose) {
      this.obv -= bar.volume;
    }

    this.prevClose = bar.close;
    return this.obv;
  }

  static readonly doc: OperatorDoc = {
    type: "OBV",
    desc: "On Balance Volume",
    onDataParam: "bar: {close: number, volume: number}",
    output: "number",
  };
}

/**
 * Creates OBV closure for functional usage.
 * @returns Function that processes bar data and returns OBV
 */
export function useOBV(): (bar: BarWith<"close" | "volume">) => number {
  const instance = new OBV();
  return (bar) => instance.onData(bar);
}

/**
 * Positive Volume Index - stateful indicator.
 * Tracks price changes on increasing volume days.
 */
export class PVI {
  private pvi: number = 1000;
  private prevVolume?: number;
  private prevClose?: number;

  /**
   * Process new bar data.
   * @param bar Bar data with close, volume
   * @returns Current PVI value
   */
  onData(bar: BarWith<"close" | "volume">): number {
    if (this.prevVolume === undefined) {
      this.prevVolume = bar.volume;
      this.prevClose = bar.close;
      return this.pvi;
    }

    if (bar.volume > this.prevVolume && this.prevClose !== 0) {
      const roc = (bar.close - this.prevClose!) / this.prevClose!;
      this.pvi += this.pvi * roc;
    }

    this.prevVolume = bar.volume;
    this.prevClose = bar.close;
    return this.pvi;
  }

  static readonly doc: OperatorDoc = {
    type: "PVI",
    desc: "Positive Volume Index",
    onDataParam: "bar: {close: number, volume: number}",
    output: "number",
  };
}

/**
 * Creates PVI closure for functional usage.
 * @returns Function that processes bar data and returns PVI
 */
export function usePVI(): (bar: BarWith<"close" | "volume">) => number {
  const instance = new PVI();
  return (bar) => instance.onData(bar);
}

/**
 * Money Flow Index - stateful indicator.
 * Volume-weighted momentum indicator using typical price.
 */
export class MFI {
  private buffer: CircularBuffer<number>;
  private prevTypical?: number;
  private posFlow: number = 0;
  private negFlow: number = 0;

  constructor(opts: PeriodWith<"period">) {
    this.buffer = new CircularBuffer(opts.period);
  }

  /**
   * Process new bar data.
   * @param bar Bar data with high, low, close, volume
   * @returns Current MFI value (0-100)
   */
  onData(bar: BarWith<"high" | "low" | "close" | "volume">): number {
    const typical = (bar.high + bar.low + bar.close) / 3;
    let moneyFlow = typical * bar.volume;

    if (this.prevTypical === undefined) {
      this.prevTypical = typical;
      this.buffer.push(moneyFlow);
      return 50;
    }

    this.prevTypical = typical;

    if (typical >= this.prevTypical) {
      this.posFlow += moneyFlow;
    } else {
      this.negFlow += moneyFlow;
    }

    if (this.buffer.full()) {
      const expiredMoneyFlow = this.buffer.front()!;
      if (expiredMoneyFlow >= 0) {
        this.posFlow -= expiredMoneyFlow;
      } else {
        this.negFlow += expiredMoneyFlow;
      }
    }

    if (typical >= this.prevTypical) {
      this.buffer.push(moneyFlow);
    } else {
      this.buffer.push(-moneyFlow);
    }

    if (!this.buffer.full()) {
      return 50;
    }

    const mfr = this.posFlow / this.negFlow;
    return 100 - 100 / (1 + mfr);
  }

  static readonly doc: OperatorDoc = {
    type: "MFI",
    desc: "Money Flow Index",
    init: "{period: number}",
    onDataParam: "bar: {high: number, low: number, close: number, volume: number}",
    output: "number",
  };
}

/**
 * Creates MFI closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes bar data and returns MFI
 */
export function useMFI(
  opts: PeriodWith<"period">
): (bar: BarWith<"high" | "low" | "close" | "volume">) => number {
  const instance = new MFI(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Ease of Movement - stateful indicator.
 * Relates price change to volume for trend strength analysis.
 */
export class EMV {
  private prevMid?: number;

  /**
   * Process new bar data.
   * @param bar Bar data with high, low, volume
   * @returns Current EMV value
   */
  onData(bar: BarWith<"high" | "low" | "volume">): number {
    const mid = (bar.high + bar.low) / 2;
    if (this.prevMid === undefined) {
      this.prevMid = mid;
      return 0;
    }

    const distance = mid - this.prevMid;
    this.prevMid = mid;

    const boxRatio = bar.volume / 100000000 / (bar.high - bar.low);
    return boxRatio !== 0 ? distance / boxRatio : 0;
  }

  static readonly doc: OperatorDoc = {
    type: "EMV",
    desc: "Ease of Movement",
    onDataParam: "bar: {high: number, low: number, volume: number}",
    output: "number",
  };
}

/**
 * Creates EMV closure for functional usage.
 * @returns Function that processes bar data and returns EMV
 */
export function useEMV(): (bar: BarWith<"high" | "low" | "volume">) => number {
  const instance = new EMV();
  return (bar) => instance.onData(bar);
}

/**
 * Market Facilitation Index - stateless indicator.
 * Measures price movement efficiency per volume unit.
 */
export class MarketFI {
  /**
   * Process new bar data.
   * @param bar Bar data with high, low, volume
   * @returns Current MarketFI value
   */
  onData(bar: BarWith<"high" | "low" | "volume">): number {
    return bar.volume !== 0 ? (bar.high - bar.low) / bar.volume : 0;
  }

  static readonly doc: OperatorDoc = {
    type: "MarketFI",
    desc: "Market Facilitation Index",
    onDataParam: "bar: {high: number, low: number, volume: number}",
    output: "number",
  };
}

/**
 * Creates MarketFI closure for functional usage.
 * @returns Function that processes bar data and returns MarketFI
 */
export function useMarketFI(): (
  bar: BarWith<"high" | "low" | "volume">
) => number {
  const instance = new MarketFI();
  return (bar) => instance.onData(bar);
}

/**
 * Volume Oscillator - stateful indicator.
 * Percentage difference between two volume EMAs.
 */
export class VOSC {
  private emsFast: EMA;
  private emsSlow: EMA;

  constructor(opts: PeriodWith<"period_fast" | "period_slow">) {
    this.emsFast = new EMA({ period: opts.period_fast });
    this.emsSlow = new EMA({ period: opts.period_slow });
  }

  /**
   * Process new volume data.
   * @param bar Bar data with volume
   * @returns Current VOSC percentage value
   */
  onData(bar: BarWith<"volume">): number {
    const emsFastVal = this.emsFast.onData(bar.volume);
    const emsSlowVal = this.emsSlow.onData(bar.volume);
    return emsSlowVal !== 0
      ? ((emsFastVal - emsSlowVal) / emsSlowVal) * 100
      : 0;
  }

  static readonly doc: OperatorDoc = {
    type: "VOSC",
    desc: "Volume Oscillator",
    init: "{period_fast: number, period_slow: number}",
    onDataParam: "bar: {volume: number}",
    output: "number",
  };
}

/**
 * Creates VOSC closure for functional usage.
 * @param opts Period configuration (period_fast, period_slow)
 * @returns Function that processes volume and returns VOSC
 */
export function useVOSC(
  opts: PeriodWith<"period_fast" | "period_slow">
): (bar: BarWith<"volume">) => number {
  const instance = new VOSC(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Chaikin Money Flow - volume-weighted accumulation/distribution.
 * Measures buying/selling pressure over a period.
 */
export class CMF {
  private mfvSum: Sum;
  private volSum: Sum;

  constructor(opts: PeriodWith<"period">) {
    this.mfvSum = new Sum(opts);
    this.volSum = new Sum(opts);
  }

  /**
   * Process new bar data.
   * @param bar Bar with high, low, close, volume
   * @returns CMF value (-1 to +1 range)
   */
  onData(bar: BarWith<"high" | "low" | "close" | "volume">): number {
    const clv =
      bar.high !== bar.low
        ? (bar.close - bar.low - (bar.high - bar.close)) / (bar.high - bar.low)
        : 0;
    const mfv = clv * bar.volume;

    const mfvSum = this.mfvSum.onData(mfv);
    const volSum = this.volSum.onData(bar.volume);

    return volSum !== 0 ? mfvSum / volSum : 0;
  }

  static readonly doc: OperatorDoc = {
    type: "CMF",
    desc: "Chaikin Money Flow",
    init: "{period: number}",
    onDataParam: "bar: {high: number, low: number, close: number, volume: number}",
    output: "number",
  };
}

/**
 * Creates CMF closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes bar data and returns CMF
 */
export function useCMF(
  opts: PeriodWith<"period">
): (bar: BarWith<"high" | "low" | "close" | "volume">) => number {
  const instance = new CMF(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Chaikin Oscillator - momentum of accumulation/distribution.
 * Difference between short and long EMAs of A/D line.
 */
export class CHO {
  private ad: AD;
  private emsFast: EMA;
  private emsSlow: EMA;

  constructor(opts: PeriodWith<"period_fast" | "period_slow">) {
    this.ad = new AD();
    this.emsFast = new EMA({ period: opts.period_fast });
    this.emsSlow = new EMA({ period: opts.period_slow });
  }

  /**
   * Process new bar data.
   * @param bar Bar with high, low, close, volume
   * @returns Chaikin Oscillator value
   */
  onData(bar: BarWith<"high" | "low" | "close" | "volume">): number {
    const adValue = this.ad.onData(bar);
    return this.emsFast.onData(adValue) - this.emsSlow.onData(adValue);
  }

  static readonly doc: OperatorDoc = {
    type: "CHO",
    desc: "Chaikin Oscillator",
    init: "{period_fast: number, period_slow: number}",
    onDataParam: "bar: {high: number, low: number, close: number, volume: number}",
    output: "number",
  };
}

/**
 * Creates CHO closure for functional usage.
 * @param opts Short and long period configuration
 * @returns Function that processes bar data and returns Chaikin Oscillator
 */
export function useCHO(
  opts: PeriodWith<"period_fast" | "period_slow">
): (bar: BarWith<"high" | "low" | "close" | "volume">) => number {
  const instance = new CHO(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Percentage Volume Oscillator - volume momentum indicator.
 * Percentage difference between short and long volume EMAs.
 */
export class PVO {
  private emsFast: EMA;
  private emsSlow: EMA;
  private emaSignal: EMA;

  constructor(
    opts: PeriodWith<"period_fast" | "period_slow"> & {
      period_signal?: number;
    }
  ) {
    this.emsFast = new EMA({ period: opts.period_fast });
    this.emsSlow = new EMA({ period: opts.period_slow });
    this.emaSignal = new EMA({ period: opts.period_signal ?? 9 });
  }

  /**
   * Process new volume data.
   * @param bar Bar with volume
   * @returns Object with pvo, signal, and histogram
   */
  onData(bar: BarWith<"volume">): {
    pvo: number;
    signal: number;
    histogram: number;
  } {
    const emsFastVal = this.emsFast.onData(bar.volume);
    const emsSlowVal = this.emsSlow.onData(bar.volume);
    const pvo =
      emsSlowVal !== 0 ? ((emsFastVal - emsSlowVal) / emsSlowVal) * 100 : 0;
    const signal = this.emaSignal.onData(pvo);
    const histogram = pvo - signal;

    return { pvo, signal, histogram };
  }

  static readonly doc: OperatorDoc = {
    type: "PVO",
    desc: "Percentage Volume Oscillator",
    init: "{period_fast: number, period_slow: number, period_signal?: number}",
    onDataParam: "bar: {volume: number}",
    output: "{pvo: number, signal: number, histogram: number}",
  };
}

/**
 * Creates PVO closure for functional usage.
 * @param opts Short, long, and signal period configuration
 * @returns Function that processes bar data and returns PVO
 */
export function usePVO(
  opts: PeriodWith<"period_fast" | "period_slow"> & { period_signal?: number }
): (bar: BarWith<"volume">) => {
  pvo: number;
  signal: number;
  histogram: number;
} {
  const instance = new PVO(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Elder's Force Index - measures power behind price movements.
 * Combines price change with volume.
 */
export class FI {
  private ema: EMA;
  private prevClose?: number;

  constructor(opts: PeriodWith<"period">) {
    this.ema = new EMA({ period: opts.period });
  }

  /**
   * Process new bar data.
   * @param bar Bar with close and volume
   * @returns Force Index value
   */
  onData(bar: BarWith<"close" | "volume">): number {
    if (this.prevClose === undefined) {
      this.prevClose = bar.close;
      return this.ema.onData(0);
    }

    const force = (bar.close - this.prevClose) * bar.volume;
    this.prevClose = bar.close;
    return this.ema.onData(force);
  }

  static readonly doc: OperatorDoc = {
    type: "FI",
    desc: "Force Index",
    init: "{period: number}",
    onDataParam: "bar: {close: number, volume: number}",
    output: "number",
  };
}

/**
 * Creates FI closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes bar data and returns Force Index
 */
export function useFI(
  opts: PeriodWith<"period">
): (bar: BarWith<"close" | "volume">) => number {
  const instance = new FI(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Volume Rate of Change - measures volume momentum.
 * Percentage change in volume over period.
 */
export class VROC {
  private buffer: CircularBuffer<number>;

  constructor(opts: PeriodWith<"period">) {
    this.buffer = new CircularBuffer(opts.period + 1);
  }

  /**
   * Process new volume data.
   * @param bar Bar with volume
   * @returns Volume rate of change as percentage
   */
  onData(bar: BarWith<"volume">): number {
    this.buffer.push(bar.volume);

    if (!this.buffer.full()) {
      return 0;
    }

    const oldVolume = this.buffer.front()!;
    return oldVolume !== 0 ? ((bar.volume - oldVolume) / oldVolume) * 100 : 0;
  }

  static readonly doc: OperatorDoc = {
    type: "VROC",
    desc: "Volume Rate of Change",
    init: "{period: number}",
    onDataParam: "bar: {volume: number}",
    output: "number",
  };
}

/**
 * Creates VROC closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes bar data and returns VROC
 */
export function useVROC(
  opts: PeriodWith<"period">
): (bar: BarWith<"volume">) => number {
  const instance = new VROC(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Price Volume Trend - cumulative volume based on price changes.
 * Similar to OBV but uses percentage price change.
 */
export class PVT {
  private pvt: number = 0;
  private prevClose?: number;

  /**
   * Process new bar data.
   * @param bar Bar with close and volume
   * @returns Cumulative PVT value
   */
  onData(bar: BarWith<"close" | "volume">): number {
    if (this.prevClose === undefined || this.prevClose === 0) {
      this.prevClose = bar.close;
      return this.pvt;
    }

    const priceChange = (bar.close - this.prevClose) / this.prevClose;
    this.pvt += priceChange * bar.volume;
    this.prevClose = bar.close;

    return this.pvt;
  }

  static readonly doc: OperatorDoc = {
    type: "PVT",
    desc: "Price Volume Trend",
    onDataParam: "bar: {close: number, volume: number}",
    output: "number",
  };
}

/**
 * Creates PVT closure for functional usage.
 * @returns Function that processes bar data and returns PVT
 */
export function usePVT(): (bar: BarWith<"close" | "volume">) => number {
  const instance = new PVT();
  return (bar) => instance.onData(bar);
}
