import { describe, expect, it } from "vitest";
import { GraphExec } from "../src/flow/graph-exec.js";
import { GraphTracker } from "../src/flow/graph-tracker.js";
import { EMA } from "../src/primitive/core-ops/rolling.js";

describe("GraphTracker", () => {
  it("should track numeric values alongside original state", () => {
    const graph = new GraphExec("tick");
    graph.add("ema", new EMA({ period: 2 })).depends("tick");

    const tracker = new GraphTracker(graph);

    // First update
    const result1 = tracker.update(100);
    expect(result1.state.tick).toBe(100);
    expect(result1.state.ema).toBeCloseTo(100);
    expect(result1.tracked.tick).toHaveProperty("mean");
    expect(result1.tracked.tick).toHaveProperty("variance");
    expect(result1.tracked.tick).toHaveProperty("nanCount");
    expect(result1.tracked.ema).toHaveProperty("mean");
    expect(result1.tracked.ema).toHaveProperty("variance");
    expect(result1.tracked.ema).toHaveProperty("nanCount");

    // Second update
    const result2 = tracker.update(200);
    expect(result2.state.tick).toBe(200);
    expect(result2.state.ema).toBeCloseTo(166.67, 1);
    expect(result2.tracked.tick).toHaveProperty("mean");
    expect(result2.tracked.tick).toHaveProperty("variance");
    expect(result2.tracked.ema).toHaveProperty("mean");
    expect(result2.tracked.ema).toHaveProperty("variance");
  });

  it("should handle nested object values", () => {
    const graph = new GraphExec("tick");
    graph.add("ema", new EMA({ period: 2 })).depends("tick.price");

    const tracker = new GraphTracker(graph);

    const result = tracker.update({ price: 100, volume: 1000 });

    expect(result.state.tick.price).toBe(100);
    expect(result.state.tick.volume).toBe(1000);
    expect(result.state.ema).toBeCloseTo(100);

    // Should track both price and volume since they're numeric
    expect(result.tracked.tick.price).toHaveProperty("mean");
    expect(result.tracked.tick.price).toHaveProperty("variance");
    expect(result.tracked.tick.price).toHaveProperty("nanCount");
    expect(result.tracked.tick.volume).toHaveProperty("mean");
    expect(result.tracked.tick.volume).toHaveProperty("variance");
    expect(result.tracked.tick.volume).toHaveProperty("nanCount");
    expect(result.tracked.ema).toHaveProperty("mean");
    expect(result.tracked.ema).toHaveProperty("variance");
    expect(result.tracked.ema).toHaveProperty("nanCount");
  });

  it("should skip non-numeric values", () => {
    const graph = new GraphExec("data");
    graph
      .add("upper", { update: (x: string) => x.toUpperCase() })
      .depends("data.text");

    const tracker = new GraphTracker(graph);

    const result = tracker.update({ text: "hello", count: 42 });

    expect(result.state.data.text).toBe("hello");
    expect(result.state.data.count).toBe(42);
    expect(result.state.upper).toBe("HELLO");

    // Only count should be tracked
    expect(result.tracked.data.text).toBeUndefined();
    expect(result.tracked.data.count).toHaveProperty("mean");
    expect(result.tracked.data.count).toHaveProperty("variance");
    expect(result.tracked.data.count).toHaveProperty("nanCount");
    expect(result.tracked.upper).toBeUndefined();
  });

  it("should provide access to current tracked state", () => {
    const graph = new GraphExec("value");
    graph.add("doubled", { update: (x: number) => x * 2 }).depends("value");

    const tracker = new GraphTracker(graph);

    tracker.update(10);
    tracker.update(20);

    const trackedState = tracker.getTrackedState();
    expect(trackedState.value).toHaveProperty("mean");
    expect(trackedState.value).toHaveProperty("variance");
    expect(trackedState.value).toHaveProperty("nanCount");
    expect(trackedState.doubled).toHaveProperty("mean");
    expect(trackedState.doubled).toHaveProperty("variance");
    expect(trackedState.doubled).toHaveProperty("nanCount");
  });

  it("should provide access to underlying GraphExec", () => {
    const graph = new GraphExec("test");
    const tracker = new GraphTracker(graph);

    expect(tracker.getGraphExec()).toBe(graph);
  });
});
