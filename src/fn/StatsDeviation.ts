import type { PeriodWith } from "../types/PeriodOptions.js";
import type { CircularBuffer } from "./Containers.js";
import { SMA } from "./Foundation.js";
import { type OperatorDoc } from "../types/OpDoc.js";

/**
 * Mean Absolute Deviation - stateful indicator.
 * Calculates average absolute deviation from the mean over a sliding window.
 */
export class MeanAD {
  private sma: SMA;
  // Expose SMA buffer reference for user access
  readonly buffer: CircularBuffer<number>;

  constructor(opts: PeriodWith<"period">) {
    this.sma = new SMA(opts);
    this.buffer = this.sma.buffer;
  }

  /**
   * Process new data point.
   * @param x New value
   * @returns Object with mean and MAD values
   */
  onData(x: number): { mean: number; mad: number } {
    const mean = this.sma.onData(x);
    const n = this.buffer.size();

    let sum = 0;
    for (let i = 0; i < n; i++) {
      const val = this.buffer.at(i)!;
      sum += Math.abs(val - mean);
    }

    return { mean, mad: sum / n };
  }

  static readonly doc: OperatorDoc = {
    type: "MeanAD",
    desc: "Mean Absolute Deviation",
    init: "{period: number}",
    onDataParam: "x: number",
    output: "{mean: number, mad: number}",
  };
}

/**
 * Creates MeanAD closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes data and returns {mean, mad}
 */
export function useMeanAD(
  opts: PeriodWith<"period">
): (x: number) => { mean: number; mad: number } {
  const instance = new MeanAD(opts);
  return (x: number) => instance.onData(x);
}
