import type { TumblingSpec } from "./types.js";

/**
 * Time-based tumbling window (right-open).
 * Non-overlapping windows aligned to interval boundaries.
 * Current data always starts new window when boundary crossed.
 */
export class TumblingWindow {
  private readonly interval: number;
  private windowStart: number | undefined;

  constructor(opts: { interval: number }) {
    this.interval = opts.interval;
  }

  update(value: number): TumblingSpec {
    if (this.windowStart === undefined) {
      this.windowStart = this.align(value);
      return { include: false };
    }

    const windowEnd = this.windowStart + this.interval;

    if (value >= windowEnd) {
      // Window boundary crossed - emit old window, current data starts new
      const spec: TumblingSpec = {
        timestamp: this.windowStart,
        include: false,
      };
      this.windowStart = this.align(value);
      return spec;
    }

    return { include: false };
  }

  reset(): void {
    this.windowStart = undefined;
  }

  private align(value: number): number {
    return Math.floor(value / this.interval) * this.interval;
  }
}

/**
 * Count-based window (right-closed).
 * Emits after N data points, including the Nth point in emitted window.
 */
export class CounterWindow {
  private readonly count: number;
  private current: number = 0;

  constructor(opts: { count: number }) {
    this.count = opts.count;
  }

  update(_value: number): TumblingSpec {
    this.current++;

    if (this.current >= this.count) {
      // Emit window including current data point
      const spec: TumblingSpec = {
        timestamp: this.current,
        include: true,
      };
      this.current = 0;
      return spec;
    }

    return { include: false };
  }

  reset(): void {
    this.current = 0;
  }
}

/**
 * Session window (right-closed).
 * Detects gaps - emits when gap exceeds threshold.
 * Current data included in emitted window if gap detected.
 */
export class SessionWindow {
  private readonly gapThreshold: number;
  private lastValue: number | undefined;

  constructor(opts: { gapThreshold: number }) {
    this.gapThreshold = opts.gapThreshold;
  }

  update(value: number): TumblingSpec {
    if (this.lastValue === undefined) {
      this.lastValue = value;
      return { include: false };
    }

    const gap = value - this.lastValue;

    if (gap >= this.gapThreshold) {
      // Gap detected - emit session including current data
      const spec: TumblingSpec = {
        timestamp: this.lastValue,
        include: true,
      };
      this.lastValue = value;
      return spec;
    }

    this.lastValue = value;
    return { include: false };
  }

  reset(): void {
    this.lastValue = undefined;
  }
}
