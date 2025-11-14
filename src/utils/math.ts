/**
 * Exponential smoothing update (EMA-style online average).
 * @param current - Current smoothed value
 * @param obs - New observation to incorporate
 * @param weight - Smoothing weight (0 to 1, typically alpha)
 * @returns Updated smoothed value
 */
export function smooth(current: number, obs: number, weight: number): number {
  return current + weight * (obs - current);
}

/**
 * Reverse exponential smoothing (removes old observation).
 * @param current - Current smoothed value
 * @param obs_old - Old observation to remove
 * @param weight - Smoothing weight
 * @returns Updated smoothed value
 */
export function smooth_rm(
  current: number,
  obs_old: number,
  weight: number
): number {
  return current + weight * (current - obs_old);
}

/**
 * Rolling smooth update (add new, remove old with equal weight).
 * Note: Uses single weight for both operations (equal weighting required).
 * @param current - Current smoothed value
 * @param obs_new - New observation to add
 * @param obs_old - Old observation to remove
 * @param weight - Smoothing weight applied to both operations
 * @returns Updated smoothed value
 */
export function smooth_roll(
  current: number,
  obs_new: number,
  obs_old: number,
  weight: number
): number {
  return current + weight * (obs_new - obs_old);
}

/**
 * Kahan summation algorithm for numerical stability.
 * Reduces floating-point rounding errors in sequential addition.
 */
export class kahan {
  private sum: number = 0;
  private carry: number = 0;

  /**
   * Adds a value to the sum with error compensation.
   * @param x - Value to add
   * @returns Current compensated sum
   */
  add(x: number): number {
    const y = x - this.carry;
    const t = this.sum + y;
    this.carry = t - this.sum - y;
    this.sum = t;
    return this.sum;
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
