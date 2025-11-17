import { describe, it, expect } from "vitest";
import { ArgMinMax } from "../src/fn/Foundation.js";

/**
 * Naive O(N) implementation - scans entire window to find argmin/argmax
 */
function naiveArgMinMax(values: number[]): {
  min: { val: number; pos: number };
  max: { val: number; pos: number };
} {
  if (values.length === 0) {
    return {
      min: { val: NaN, pos: -1 },
      max: { val: NaN, pos: -1 },
    };
  }

  let minIdx = 0;
  let minVal = values[0];
  let maxIdx = 0;
  let maxVal = values[0];

  for (let i = 1; i < values.length; i++) {
    if (values[i] < minVal) {
      minVal = values[i];
      minIdx = i;
    }
    if (values[i] > maxVal) {
      maxVal = values[i];
      maxIdx = i;
    }
  }

  // Convert from oldest-first index to newest-first index
  return {
    min: { val: minVal, pos: values.length - 1 - minIdx },
    max: { val: maxVal, pos: values.length - 1 - maxIdx },
  };
}

describe("ArgMinMax", () => {
  it("should match naive ArgMinMax during fill phase", () => {
    const argminmax = new ArgMinMax({ period: 5 });
    const values: number[] = [];
    const testData = [10, 30, 20, 5, 40];

    for (const x of testData) {
      values.push(x);
      const result = argminmax.onData(x);
      const expected = naiveArgMinMax(values);

      expect(result.min.val).toBe(expected.min.val);
      expect(result.min.pos).toBe(expected.min.pos);
      expect(result.max.val).toBe(expected.max.val);
      expect(result.max.pos).toBe(expected.max.pos);
    }
  });

  it("should match naive ArgMinMax during rolling phase", () => {
    const period = 4;
    const argminmax = new ArgMinMax({ period });
    const testData = [10, 30, 20, 40, 50, 60, 10, 80, 5];
    const values: number[] = [];

    for (const x of testData) {
      values.push(x);
      if (values.length > period) {
        values.shift();
      }
      const result = argminmax.onData(x);
      const expected = naiveArgMinMax(values);

      expect(result.min.val).toBe(expected.min.val);
      expect(result.min.pos).toBe(expected.min.pos);
      expect(result.max.val).toBe(expected.max.val);
      expect(result.max.pos).toBe(expected.max.pos);
    }
  });

  it("should handle zigzag pattern", () => {
    const period = 4;
    const argminmax = new ArgMinMax({ period });
    const testData = [10, 80, 20, 60, 5, 50, 30, 70];
    const values: number[] = [];

    for (const x of testData) {
      values.push(x);
      if (values.length > period) {
        values.shift();
      }
      const result = argminmax.onData(x);
      const expected = naiveArgMinMax(values);

      expect(result.min.val).toBe(expected.min.val);
      expect(result.min.pos).toBe(expected.min.pos);
      expect(result.max.val).toBe(expected.max.val);
      expect(result.max.pos).toBe(expected.max.pos);
    }
  });

  it("should handle constant values", () => {
    const argminmax = new ArgMinMax({ period: 4 });
    const testData = [100, 100, 100, 100, 100];

    for (const x of testData) {
      const result = argminmax.onData(x);
      expect(result.min.val).toBe(100);
      expect(result.max.val).toBe(100);
      expect(result.min.pos).toBe(0);
      expect(result.max.pos).toBe(0);
    }
  });

  it("should handle ascending sequence", () => {
    const argminmax = new ArgMinMax({ period: 4 });
    const testData = [10, 20, 30, 40, 50, 60];
    const values: number[] = [];

    for (const x of testData) {
      values.push(x);
      if (values.length > 4) {
        values.shift();
      }
      const result = argminmax.onData(x);
      const expected = naiveArgMinMax(values);

      expect(result.min.val).toBe(expected.min.val);
      expect(result.min.pos).toBe(expected.min.pos);
      expect(result.max.val).toBe(expected.max.val);
      expect(result.max.pos).toBe(expected.max.pos);
    }
  });

  it("should handle descending sequence", () => {
    const argminmax = new ArgMinMax({ period: 4 });
    const testData = [60, 50, 40, 30, 20, 10];
    const values: number[] = [];

    for (const x of testData) {
      values.push(x);
      if (values.length > 4) {
        values.shift();
      }
      const result = argminmax.onData(x);
      const expected = naiveArgMinMax(values);

      expect(result.min.val).toBe(expected.min.val);
      expect(result.min.pos).toBe(expected.min.pos);
      expect(result.max.val).toBe(expected.max.val);
      expect(result.max.pos).toBe(expected.max.pos);
    }
  });

  it("should handle large random dataset", () => {
    const period = 10;
    const argminmax = new ArgMinMax({ period });
    const values: number[] = [];

    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 1000;
      values.push(x);
      if (values.length > period) {
        values.shift();
      }
      const result = argminmax.onData(x);
      const expected = naiveArgMinMax(values);

      expect(result.min.val).toBe(expected.min.val);
      expect(result.min.pos).toBe(expected.min.pos);
      expect(result.max.val).toBe(expected.max.val);
      expect(result.max.pos).toBe(expected.max.pos);
    }
  });

  it("should handle period of 1", () => {
    const argminmax = new ArgMinMax({ period: 1 });
    const testData = [10, 20, 30, 5, 40];

    for (const x of testData) {
      const result = argminmax.onData(x);
      expect(result.min.val).toBe(x);
      expect(result.max.val).toBe(x);
      expect(result.min.pos).toBe(0);
      expect(result.max.pos).toBe(0);
    }
  });
});
