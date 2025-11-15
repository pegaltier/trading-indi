/**
 * Kahan summation algorithm for numerical stability.
 * Reduces floating-point rounding errors in sequential addition.
 */
export class Kahan {
  val: number = 0;
  private carry: number = 0;

  /**
   * Accumlates a value to the sum with error compensation.
   * @param x - Value to add
   * @returns Current compensated sum
   */
  accum(x: number): number {
    const y = x - this.carry;
    const t = this.val + y;
    this.carry = t - this.val - y;
    this.val = t;
    return this.val;
  }
}

/**
 * Smoothed accumulator for weighted observations.
 * Implements val = (1-w)*val + w*obs.
 */
export class SmoothedAccum {
  val: number;

  /**
   * @param init - Initial value (default: 0)
   */
  constructor(init: number = 0) {
    this.val = init;
  }

  /**
   * Updates value using exponential smoothing.
   * @param obs - Observed value
   * @param weight - Smoothing weight (0-1)
   * @returns Updated smoothed value
   */
  accum(obs: number, weight: number): number {
    this.val += weight * (obs - this.val);
    return this.val;
  }

  /**
   * Updates value by rolling out old observation and rolling in new one.
   * Requires obs_new and obs_old have same weight
   * @param obs_new - New observation to add
   * @param obs_old - Old observation to remove
   * @param weight - Smoothing weight (0-1)
   * @returns Updated smoothed value
   */
  roll(obs_new: number, obs_old: number, weight: number): number {
    this.val += weight * (obs_new - obs_old);
    return this.val;
  }
}

/**
 * Converts period to exponential smoothing factor (EMA-style).
 * @param alpha_or_period - Alpha value (≤1) or period (>1)
 * @returns Smoothing factor: alpha if ≤1, otherwise 2/(period+1)
 */
export function exp_factor(alpha_or_period: number): number {
  if (alpha_or_period > 1) return 2.0 / (alpha_or_period + 1);
  else return alpha_or_period;
}

/**
 * Converts period to Wilder's smoothing factor (RSI/ATR-style).
 * @param alpha_or_period - Alpha value (≤1) or period (>1)
 * @returns Smoothing factor: alpha if ≤1, otherwise 1/period
 */
export function wilders_factor(alpha_or_period: number): number {
  if (alpha_or_period > 1) return 1.0 / alpha_or_period;
  else return alpha_or_period;
}
