import type { PeriodOptions, PeriodWith } from "../types/PeriodOptions.js";
import { exp_factor, Kahan, SmoothedAccum } from "../utils/math.js";
import { CircularBuffer, Deque } from "./Containers.js";

import { type OperatorDoc } from "../types/OpDoc.js";

/**
 * Exponential Moving Average - stateful indicator.
 * Uses exponential smoothing with alpha = 2/(period+1).
 */
export class EMA {
  private alpha: number;
  private ema?: SmoothedAccum;

  constructor(opts: PeriodOptions & { alpha?: number }) {
    if (opts.alpha) {
      this.alpha = opts.alpha;
    } else {
      this.alpha = exp_factor(opts.period!);
    }
  }

  /**
   * Process new data point.
   * @param x New price value
   * @returns Current EMA value
   */
  onData(x: number): number {
    if (this.ema === undefined) {
      this.ema = new SmoothedAccum(x);
    } else {
      this.ema.accum(x, this.alpha);
    }
    return this.ema.val;
  }

  static readonly doc: OperatorDoc = {
    type: "EMA",
    desc: "Exponential Moving Average",
    init: "{period?: number, alpha?: number}",
    onDataParam: "x: number",
    output: "number",
  };
}

/**
 * Creates EMA closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes data and returns EMA
 */
export function useEMA(
  opts: PeriodOptions & { alpha?: number }
): (x: number) => number {
  const instance = new EMA(opts);
  return (x: number) => instance.onData(x);
}

/**
 * Exponentially Weighted Moving Average - stateful indicator.
 * Maintains sliding window with exponentially decaying weights, normalized by total weight.
 * Uses alpha = 2/(period+1).
 */
export class EWMA {
  readonly buffer: CircularBuffer<number>;
  private readonly alpha: number;
  private readonly a1: number;
  private a1_n: number = 1;
  private s: number = 0;
  private readonly totalWeight: Kahan;

  constructor(opts: PeriodWith<"period">) {
    this.buffer = new CircularBuffer<number>(opts.period);
    this.alpha = exp_factor(opts.period);
    this.a1 = 1 - this.alpha;
    this.totalWeight = new Kahan();
  }

  /**
   * Process new data point.
   * @param x New value
   * @returns Current EWMA value
   */
  onData(x: number): number {
    if (!this.buffer.full()) {
      this.buffer.push(x);
      this.totalWeight.accum(this.a1_n);
      this.s = this.a1 * this.s + x;
      this.a1_n *= this.a1;
    } else {
      const x0 = this.buffer.front()!;
      this.buffer.push(x);
      this.s = this.a1 * this.s + x - this.a1_n * x0;
    }
    return this.s / this.totalWeight.val;
  }

  static readonly doc: OperatorDoc = {
    type: "EWMA",
    desc: "Exponentially Weighted Moving Average",
    init: "{period: number}",
    onDataParam: "x: number",
    output: "number",
  };
}

/**
 * Creates EWMA closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes data and returns EWMA
 */
export function useEWMA(opts: PeriodWith<"period">): (x: number) => number {
  const instance = new EWMA(opts);
  return (x: number) => instance.onData(x);
}

/**
 * Simple Moving Average - stateful indicator.
 * Maintains rolling window of prices for exact average calculation.
 */
export class SMA {
  readonly buffer: CircularBuffer<number>;
  private sma: SmoothedAccum = new SmoothedAccum();
  private weight: number;

  constructor(opts: PeriodWith<"period">) {
    this.buffer = new CircularBuffer<number>(opts.period);
    this.weight = 1.0 / opts.period;
  }

  /**
   * Process new data point.
   * @param x New price value
   * @returns Current SMA value
   */
  onData(x: number): number {
    if (!this.buffer.full()) {
      this.buffer.push(x);
      this.sma.accum(x, 1 / this.buffer.size());
    } else {
      const old = this.buffer.front()!;
      this.sma.roll(x, old, this.weight);
      this.buffer.push(x);
    }
    return this.sma.val;
  }

  static readonly doc: OperatorDoc = {
    type: "SMA",
    desc: "Simple Moving Average",
    init: "{period: number}",
    onDataParam: "x: number",
    output: "number",
  };
}

/**
 * Creates SMA closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes data and returns SMA
 */
export function useSMA(opts: PeriodWith<"period">): (x: number) => number {
  const instance = new SMA(opts);
  return (x: number) => instance.onData(x);
}

/**
 * Min - stateful indicator.
 * Uses monotonic deque algorithm for efficient sliding window minimum.
 */
export class Min {
  readonly buffer: CircularBuffer<number>;
  private minDeque: Deque<number>;

  constructor(opts: PeriodWith<"period">) {
    this.buffer = new CircularBuffer<number>(opts.period);
    this.minDeque = new Deque(opts.period);
  }

  /**
   * Process new data point.
   * @param x New value
   * @returns Minimum value in the window
   */
  onData(x: number): number {
    if (this.buffer.full()) {
      const old = this.buffer.front()!;
      if (!this.minDeque.empty() && this.minDeque.front() === old) {
        this.minDeque.pop_front();
      }
    }

    this.buffer.push(x);

    while (!this.minDeque.empty() && this.minDeque.back()! >= x) {
      this.minDeque.pop_back();
    }
    this.minDeque.push_back(x);

    return this.minDeque.front()!;
  }

  static readonly doc: OperatorDoc = {
    type: "Min",
    desc: "Sliding Window Minimum",
    init: "{period: number}",
    onDataParam: "x: number",
    output: "number",
  };
}

/**
 * Creates Min closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes data and returns min
 */
export function useMin(opts: PeriodWith<"period">): (x: number) => number {
  const instance = new Min(opts);
  return (x: number) => instance.onData(x);
}

/**
 * Max - stateful indicator.
 * Uses monotonic deque algorithm for efficient sliding window maximum.
 */
export class Max {
  readonly buffer: CircularBuffer<number>;
  private maxDeque: Deque<number>;

  constructor(opts: PeriodWith<"period">) {
    this.buffer = new CircularBuffer<number>(opts.period);
    this.maxDeque = new Deque(opts.period);
  }

  /**
   * Process new data point.
   * @param x New value
   * @returns Maximum value in the window
   */
  onData(x: number): number {
    if (this.buffer.full()) {
      const old = this.buffer.front()!;
      if (!this.maxDeque.empty() && this.maxDeque.front() === old) {
        this.maxDeque.pop_front();
      }
    }

    this.buffer.push(x);

    while (!this.maxDeque.empty() && this.maxDeque.back()! <= x) {
      this.maxDeque.pop_back();
    }
    this.maxDeque.push_back(x);

    return this.maxDeque.front()!;
  }

  static readonly doc: OperatorDoc = {
    type: "Max",
    desc: "Sliding Window Maximum",
    init: "{period: number}",
    onDataParam: "x: number",
    output: "number",
  };
}

/**
 * Creates Max closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes data and returns max
 */
export function useMax(opts: PeriodWith<"period">): (x: number) => number {
  const instance = new Max(opts);
  return (x: number) => instance.onData(x);
}

/**
 * Sum - stateful indicator.
 * Uses Kahan summation for numerical stability in rolling window sum.
 */
export class Sum {
  readonly buffer: CircularBuffer<number>;
  private readonly sum: Kahan = new Kahan();

  constructor(opts: PeriodWith<"period">) {
    this.buffer = new CircularBuffer<number>(opts.period);
  }

  /**
   * Process new data point.
   * @param x New value
   * @returns Sum of values in the window
   */
  onData(x: number): number {
    if (!this.buffer.full()) {
      this.buffer.push(x);
      return this.sum.accum(x);
    } else {
      const old = this.buffer.front()!;
      this.buffer.push(x);
      return this.sum.accum(x - old);
    }
  }

  static readonly doc: OperatorDoc = {
    type: "Sum",
    desc: "Sliding Window Sum",
    init: "{period: number}",
    onDataParam: "x: number",
    output: "number",
  };
}

/**
 * Creates Sum closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes data and returns sum
 */
export function useSum(opts: PeriodWith<"period">): (x: number) => number {
  const instance = new Sum(opts);
  return (x: number) => instance.onData(x);
}

/**
 * Min/Max - stateful indicator.
 * Uses monotonic deque algorithm for efficient sliding window min/max.
 */
export class MinMax {
  readonly buffer: CircularBuffer<number>;
  private minDeque: Deque<number>;
  private maxDeque: Deque<number>;

  constructor(opts: PeriodWith<"period">) {
    this.buffer = new CircularBuffer<number>(opts.period);
    this.minDeque = new Deque(opts.period);
    this.maxDeque = new Deque(opts.period);
  }

  /**
   * Process new data point.
   * @param x New value
   * @returns Object with min and max values in the window
   */
  onData(x: number): { min: number; max: number } {
    if (this.buffer.full()) {
      const old = this.buffer.front()!;
      if (!this.minDeque.empty() && this.minDeque.front() === old) {
        this.minDeque.pop_front();
      }
      if (!this.maxDeque.empty() && this.maxDeque.front() === old) {
        this.maxDeque.pop_front();
      }
    }

    this.buffer.push(x);

    while (!this.minDeque.empty() && this.minDeque.back()! >= x) {
      this.minDeque.pop_back();
    }
    this.minDeque.push_back(x);

    while (!this.maxDeque.empty() && this.maxDeque.back()! <= x) {
      this.maxDeque.pop_back();
    }
    this.maxDeque.push_back(x);

    return {
      min: this.minDeque.front()!,
      max: this.maxDeque.front()!,
    };
  }

  static readonly doc: OperatorDoc = {
    type: "MinMax",
    desc: "Sliding Window Min/Max",
    init: "{period: number}",
    onDataParam: "x: number",
    output: "{min: number, max: number}",
  };
}

/**
 * Creates MinMax closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes data and returns {min, max}
 */
export function useMinMax(
  opts: PeriodWith<"period">
): (x: number) => { min: number; max: number } {
  const instance = new MinMax(opts);
  return (x: number) => instance.onData(x);
}

/**
 * ArgMin - stateful indicator.
 * Returns the minimum value and its index in the sliding window.
 * Index 0 = most recent value, period-1 = oldest value.
 */
export class ArgMin {
  readonly buffer: CircularBuffer<number>;
  private minDeque: Deque<{ val: number; pos: number }>;
  private readonly period: number;
  private position: number = 0;

  constructor(opts: PeriodWith<"period">) {
    this.buffer = new CircularBuffer<number>(opts.period);
    this.minDeque = new Deque(opts.period);
    this.period = opts.period;
  }

  /**
   * Process new data point.
   * @param x New value
   * @returns Minimum value and its index {val, pos}
   */
  onData(x: number): { val: number; pos: number } {
    this.buffer.push(x);

    // Remove elements outside window
    while (
      !this.minDeque.empty() &&
      this.position - this.minDeque.front()!.pos >= this.period
    ) {
      this.minDeque.pop_front();
    }

    // Maintain monotonic property
    while (!this.minDeque.empty() && this.minDeque.back()!.val >= x) {
      this.minDeque.pop_back();
    }
    this.minDeque.push_back({ val: x, pos: this.position });

    this.position++;

    const front = this.minDeque.front()!;
    return { val: front.val, pos: this.position - front.pos - 1 };
  }

  static readonly doc: OperatorDoc = {
    type: "ArgMin",
    desc: "Sliding Window ArgMin",
    init: "{period: number}",
    onDataParam: "x: number",
    output: "{val: number, pos: number}",
  };
}

/**
 * Creates ArgMin closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes data and returns {val, pos}
 */
export function useArgMin(
  opts: PeriodWith<"period">
): (x: number) => { val: number; pos: number } {
  const instance = new ArgMin(opts);
  return (x: number) => instance.onData(x);
}

/**
 * ArgMax - stateful indicator.
 * Returns the maximum value and its index in the sliding window.
 * Index 0 = most recent value, period-1 = oldest value.
 */
export class ArgMax {
  readonly buffer: CircularBuffer<number>;
  private maxDeque: Deque<{ val: number; pos: number }>;
  private readonly period: number;
  private position: number = 0;

  constructor(opts: PeriodWith<"period">) {
    this.buffer = new CircularBuffer<number>(opts.period);
    this.maxDeque = new Deque(opts.period);
    this.period = opts.period;
  }

  /**
   * Process new data point.
   * @param x New value
   * @returns Maximum value and its index {val, pos}
   */
  onData(x: number): { val: number; pos: number } {
    this.buffer.push(x);

    // Remove elements outside window
    while (
      !this.maxDeque.empty() &&
      this.position - this.maxDeque.front()!.pos >= this.period
    ) {
      this.maxDeque.pop_front();
    }

    // Maintain monotonic property
    while (!this.maxDeque.empty() && this.maxDeque.back()!.val <= x) {
      this.maxDeque.pop_back();
    }
    this.maxDeque.push_back({ val: x, pos: this.position });

    this.position++;

    const front = this.maxDeque.front()!;
    return { val: front.val, pos: this.position - front.pos - 1 };
  }

  static readonly doc: OperatorDoc = {
    type: "ArgMax",
    desc: "Sliding Window ArgMax",
    init: "{period: number}",
    onDataParam: "x: number",
    output: "{val: number, pos: number}",
  };
}

/**
 * Creates ArgMax closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes data and returns {val, pos}
 */
export function useArgMax(
  opts: PeriodWith<"period">
): (x: number) => { val: number; pos: number } {
  const instance = new ArgMax(opts);
  return (x: number) => instance.onData(x);
}

/**
 * ArgMinMax - stateful indicator.
 * Returns both minimum and maximum values with their indices in the sliding window.
 * Index 0 = most recent value, period-1 = oldest value.
 */
export class ArgMinMax {
  readonly buffer: CircularBuffer<number>;
  private minDeque: Deque<{ val: number; pos: number }>;
  private maxDeque: Deque<{ val: number; pos: number }>;
  private readonly period: number;
  private position: number = 0;

  constructor(opts: PeriodWith<"period">) {
    this.buffer = new CircularBuffer<number>(opts.period);
    this.minDeque = new Deque(opts.period);
    this.maxDeque = new Deque(opts.period);
    this.period = opts.period;
  }

  /**
   * Process new data point.
   * @param x New value
   * @returns Object with min and max values and positions
   */
  onData(x: number): {
    min: { val: number; pos: number };
    max: { val: number; pos: number };
  } {
    this.buffer.push(x);

    // Remove elements outside window
    while (
      !this.minDeque.empty() &&
      this.position - this.minDeque.front()!.pos >= this.period
    ) {
      this.minDeque.pop_front();
    }
    while (
      !this.maxDeque.empty() &&
      this.position - this.maxDeque.front()!.pos >= this.period
    ) {
      this.maxDeque.pop_front();
    }

    // Maintain monotonic property for min
    while (!this.minDeque.empty() && this.minDeque.back()!.val >= x) {
      this.minDeque.pop_back();
    }
    this.minDeque.push_back({ val: x, pos: this.position });

    // Maintain monotonic property for max
    while (!this.maxDeque.empty() && this.maxDeque.back()!.val <= x) {
      this.maxDeque.pop_back();
    }
    this.maxDeque.push_back({ val: x, pos: this.position });

    this.position++;

    const minFront = this.minDeque.front()!;
    const maxFront = this.maxDeque.front()!;

    return {
      min: { val: minFront.val, pos: this.position - minFront.pos - 1 },
      max: { val: maxFront.val, pos: this.position - maxFront.pos - 1 },
    };
  }

  static readonly doc: OperatorDoc = {
    type: "ArgMinMax",
    desc: "Sliding Window ArgMin/ArgMax",
    init: "{period: number}",
    onDataParam: "x: number",
    output:
      "{min: {val: number, pos: number}, max: {val: number, pos: number}}",
  };
}

/**
 * Creates ArgMinMax closure for functional usage.
 * @param opts Period configuration
 * @returns Function that processes data and returns {min: {val, pos}, max: {val, pos}}
 */
export function useArgMinMax(opts: PeriodWith<"period">): (x: number) => {
  min: { val: number; pos: number };
  max: { val: number; pos: number };
} {
  const instance = new ArgMinMax(opts);
  return (x: number) => instance.onData(x);
}
