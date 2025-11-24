import { describe, it, expect } from "vitest";
import { StreamingAdapter } from "../src/aggregation/StreamingAdapter.js";
import { TumblingWindow, CounterWindow } from "../src/aggregation/windows.js";
import { CMA } from "../src/primitive/core-ops/online.js";

describe("StreamingAdapter", () => {
  it("should steal and adapt operator doc", () => {
    const CMAAggregator = StreamingAdapter(CMA, "WindowedCMA");

    expect(CMAAggregator.doc).toBeDefined();
    expect(CMAAggregator.doc.type).toBe("WindowedCMA");
    expect(CMAAggregator.doc.desc).toBe(
      "Aggregation using CMA, resets on window boundary"
    );
    expect(CMAAggregator.doc.input).toBe("window: TumblingSpec, x");
    expect(CMAAggregator.doc.output).toBe("number | undefined");
  });

  it("should accumulate and emit with right-open window (TumblingWindow)", () => {
    const CMAAggregator = StreamingAdapter(CMA, "WindowedCMA");
    const aggr = new CMAAggregator({});
    const window = new TumblingWindow({ interval: 100 });

    // Accumulate phase - should return undefined
    expect(aggr.update(window.update(10), 100)).toBeUndefined();
    expect(aggr.update(window.update(20), 200)).toBeUndefined();
    expect(aggr.update(window.update(30), 300)).toBeUndefined();

    // Emit (right-open: current data NOT included, starts new window)
    // CMA of [100, 200, 300] = 200, and 400 starts new window
    const result = aggr.update(window.update(110), 400);
    expect(result).toBeCloseTo(200);

    // New window starts with 400 - accumulating again
    expect(aggr.update(window.update(120), 50)).toBeUndefined();
  });

  it("should handle right-closed window correctly (CounterWindow)", () => {
    const CMAAggregator = StreamingAdapter(CMA, "WindowedCMA");
    const aggr = new CMAAggregator({});
    const window = new CounterWindow({ count: 3 });

    // Accumulate 2 values
    expect(aggr.update(window.update(1), 100)).toBeUndefined();
    expect(aggr.update(window.update(2), 200)).toBeUndefined();

    // 3rd value triggers emission (right-closed: includes current data)
    // CMA of [100, 200, 300] = 200
    const result = aggr.update(window.update(3), 300);
    expect(result).toBeCloseTo(200);

    // New window starts fresh
    expect(aggr.update(window.update(4), 10)).toBeUndefined();
    expect(aggr.update(window.update(5), 20)).toBeUndefined();

    // 3rd value in new window
    // CMA of [10, 20, 30] = 20
    const result2 = aggr.update(window.update(6), 30);
    expect(result2).toBeCloseTo(20);
  });

  it("should emit last accumulated value for right-open", () => {
    const CMAAggregator = StreamingAdapter(CMA, "WindowedCMA");
    const aggr = new CMAAggregator({});

    // Accumulate 3 values in right-open window
    aggr.update({ timestamp: undefined, include: false }, 100);
    aggr.update({ timestamp: undefined, include: false }, 200);
    aggr.update({ timestamp: undefined, include: false }, 300);

    // Right-open emit: emits last accumulated (CMA of [100,200,300] = 200)
    // Current data (999) starts new window
    const result = aggr.update({ timestamp: 100, include: false }, 999);
    expect(result).toBeCloseTo(200);

    // Verify new window started with 999
    // Next value accumulates: CMA of [999, 888] = 943.5
    aggr.update({ timestamp: undefined, include: false }, 888);

    // Emit again: should get CMA of [999, 888]
    const result2 = aggr.update({ timestamp: 200, include: false }, 777);
    expect(result2).toBeCloseTo(943.5);
  });

  it("should reset operator state between windows", () => {
    const CMAAggregator = StreamingAdapter(CMA, "WindowedCMA");
    const aggr = new CMAAggregator({});

    // First window with right-closed
    aggr.update({ timestamp: undefined, include: true }, 10);
    aggr.update({ timestamp: undefined, include: true }, 20);
    // CMA of [10, 20, 30] = 20
    const result1 = aggr.update({ timestamp: 100, include: true }, 30);
    expect(result1).toBeCloseTo(20);

    // Second window - should start fresh
    aggr.update({ timestamp: undefined, include: true }, 100);
    // CMA of [100, 200] = 150
    const result2 = aggr.update({ timestamp: 200, include: true }, 200);
    expect(result2).toBeCloseTo(150);
  });
});
