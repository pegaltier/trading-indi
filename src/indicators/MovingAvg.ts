import { SMA, EMA, EWMA } from "../primitive/core-ops/rolling.js";
import type { BarWith } from "../types/BarData.js";

/**
 * Creates SMA closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes bar data and returns SMA
 */
export function useSMA(opts: {
  period: number;
}): (bar: BarWith<"close">) => number {
  const instance = new SMA(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Creates EMA closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes bar data and returns EMA
 */
export function useEMA(
  opts: { period: number } | { alpha: number }
): (bar: BarWith<"close">) => number {
  const instance = new EMA(opts);
  return (bar) => instance.onData(bar);
}

/**
 * Creates EWMA closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes bar data and returns EWMA
 */
export function useEWMA(opts: {
  period: number;
}): (bar: BarWith<"close">) => number {
  const instance = new EWMA(opts);
  return (bar) => instance.onData(bar);
}
