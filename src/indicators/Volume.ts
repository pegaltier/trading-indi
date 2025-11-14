import type { BarWith } from "../types/BarData.js";
import type { PeriodOptions } from "../types/PeriodOptions.js";
import { CircularBuffer } from "../classes/Containers.js";
import { EMA } from "../classes/Foundation.js";

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
  private emaShort: EMA;
  private emaLong: EMA;

  constructor(
    opts: Required<Pick<PeriodOptions, "period_short" | "period_long">>
  ) {
    this.emaShort = new EMA({ period: opts.period_short });
    this.emaLong = new EMA({ period: opts.period_long });
  }

  /**
   * Process new bar data.
   * @param bar Bar data with high, low, close, volume
   * @returns Current ADOSC value
   */
  onData(bar: BarWith<"high" | "low" | "close" | "volume">): number {
    const adVal = this.ad.onData(bar);
    return this.emaShort.onData(adVal) - this.emaLong.onData(adVal);
  }
}

/**
 * Creates ADOSC closure for functional usage.
 * @param opts Period configuration (period_short, period_long)
 * @returns Function that processes bar data and returns ADOSC
 */
export function useADOSC(
  opts: Required<Pick<PeriodOptions, "period_short" | "period_long">>
): (bar: BarWith<"high" | "low" | "close" | "volume">) => number {
  const instance = new ADOSC(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Klinger Volume Oscillator - stateful indicator.
 * Combines price movement trends with volume to detect money flow.
 */
export class KVO {
  private shortEMA: EMA;
  private longEMA: EMA;
  private prevHLC?: number;
  private trend: number = 1;
  private cm: number = 0;

  constructor(opts: PeriodOptions) {
    const shortPeriod = opts.period_short ?? 34;
    const longPeriod = opts.period_long ?? 55;

    this.shortEMA = new EMA({ period: shortPeriod });
    this.longEMA = new EMA({ period: longPeriod });
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

    const shortVF = this.shortEMA.onData(vf);
    const longVF = this.longEMA.onData(vf);

    return shortVF - longVF;
  }
}

/**
 * Creates KVO closure for functional usage.
 * @param opts Period configuration (period_short defaults to 34, period_long to 55)
 * @returns Function that processes bar data and returns KVO
 */
export function useKVO(
  opts: PeriodOptions = {}
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
  private buffer: CircularBuffer<{ mf: number; positive: boolean }>;
  private prevTypical?: number;

  constructor(opts: PeriodOptions) {
    if (opts.period === undefined) {
      throw new Error("MFI requires period");
    }
    this.buffer = new CircularBuffer(opts.period);
  }

  /**
   * Process new bar data.
   * @param bar Bar data with high, low, close, volume
   * @returns Current MFI value (0-100)
   */
  onData(bar: BarWith<"high" | "low" | "close" | "volume">): number {
    const typical = (bar.high + bar.low + bar.close) / 3;
    const rawMoney = typical * bar.volume;

    if (this.prevTypical === undefined) {
      this.prevTypical = typical;
      this.buffer.push({ mf: rawMoney, positive: true });
      return 50;
    }

    const positive = typical > this.prevTypical;
    this.prevTypical = typical;
    this.buffer.push({ mf: rawMoney, positive });

    if (!this.buffer.full()) {
      return 50;
    }

    let posFlow = 0;
    let negFlow = 0;
    for (const item of this.buffer) {
      if (item.positive) {
        posFlow += item.mf;
      } else {
        negFlow += item.mf;
      }
    }

    if (negFlow === 0) {
      return 100;
    }

    const mfr = posFlow / negFlow;
    return 100 - 100 / (1 + mfr);
  }
}

/**
 * Creates MFI closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes bar data and returns MFI
 */
export function useMFI(
  opts: PeriodOptions
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
export class MARKETFI {
  /**
   * Process new bar data.
   * @param bar Bar data with high, low, volume
   * @returns Current MARKETFI value
   */
  onData(bar: BarWith<"high" | "low" | "volume">): number {
    return bar.volume !== 0 ? (bar.high - bar.low) / bar.volume : 0;
  }
}

/**
 * Creates MARKETFI closure for functional usage.
 * @returns Function that processes bar data and returns MARKETFI
 */
export function useMARKETFI(): (
  bar: BarWith<"high" | "low" | "volume">
) => number {
  const instance = new MARKETFI();
  return (bar) => instance.onData(bar);
}

/**
 * Volume Oscillator - stateful indicator.
 * Percentage difference between two volume EMAs.
 */
export class VOSC {
  private emaShort: EMA;
  private emaLong: EMA;

  constructor(
    opts: Required<Pick<PeriodOptions, "period_short" | "period_long">>
  ) {
    this.emaShort = new EMA({ period: opts.period_short });
    this.emaLong = new EMA({ period: opts.period_long });
  }

  /**
   * Process new volume data.
   * @param bar Bar data with volume
   * @returns Current VOSC percentage value
   */
  onData(bar: BarWith<"volume">): number {
    const emaShortVal = this.emaShort.onData(bar.volume);
    const emaLongVal = this.emaLong.onData(bar.volume);
    return emaLongVal !== 0
      ? ((emaShortVal - emaLongVal) / emaLongVal) * 100
      : 0;
  }
}

/**
 * Creates VOSC closure for functional usage.
 * @param opts Period configuration (period_short, period_long)
 * @returns Function that processes volume and returns VOSC
 */
export function useVOSC(
  opts: Required<Pick<PeriodOptions, "period_short" | "period_long">>
): (bar: BarWith<"volume">) => number {
  const instance = new VOSC(opts);
  return (volume) => instance.onData(volume);
}
