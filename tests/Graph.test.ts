import { describe, expect, it } from "vitest";
import { GraphExec } from "../src/flow/GraphExec.js";
import { EMA } from "../src/primitive/core-ops/rolling.js";

describe("GraphExec", () => {
  it("should handle simple tick data flow with .depends()", () => {
    const g = new GraphExec("tick");

    g.add("ema", new EMA({ period: 2 })).depends("tick");

    const out1 = g.update(100);
    const out2 = g.update(200);

    expect(out1.tick).toBe(100);
    expect(out1.ema).toBeCloseTo(100);
    expect(out2.tick).toBe(200);
    expect(out2.ema).toBeCloseTo(166.67, 1);
  });

  it("should work with multiple EMAs using .depends() API", () => {
    const g = new GraphExec("tick");

    g.add("fast", new EMA({ period: 2 }))
      .depends("tick")
      .add("slow", new EMA({ period: 3 }))
      .depends("tick");

    const out1 = g.update(100);
    const out2 = g.update(200);
    const out3 = g.update(300);

    expect(out1.fast).toBeCloseTo(100);
    expect(out2.fast).toBeCloseTo(166.67, 1);
    expect(out3.fast).toBeCloseTo(255.56, 1);
  });

  it("should handle property access like tick.price", () => {
    const g = new GraphExec("tick");

    g.add("ema", new EMA({ period: 2 })).depends("tick.price");

    const out1 = g.update({ price: 100, volume: 1000 });
    const out2 = g.update({ price: 200, volume: 2000 });

    expect(out1.tick.price).toBe(100);
    expect(out1.ema).toBeCloseTo(100);
    expect(out2.ema).toBeCloseTo(166.67, 1);
  });

  it("should handle multiple dependencies", () => {
    const sumNode = {
      update: (a: number, b: number) => a + b,
    };

    const g = new GraphExec("tick");

    g.add("ema1", new EMA({ period: 2 }))
      .depends("tick")
      .add("ema2", new EMA({ period: 3 }))
      .depends("tick")
      .add("sum", sumNode)
      .depends("ema1", "ema2");

    g.update(100);
    const out2 = g.update(200);

    expect(out2.sum).toBeCloseTo(out2.ema1 + out2.ema2, 1);
  });

  it("should handle nodes added in reverse topological order", () => {
    const sumNode = {
      update: (a: number, b: number) => a + b,
    };

    const g = new GraphExec("tick");

    g.add("sum", sumNode)
      .depends("ema1", "ema2")
      .add("ema2", new EMA({ period: 3 }))
      .depends("tick")
      .add("ema1", new EMA({ period: 2 }))
      .depends("tick");

    const out1 = g.update(100);
    const out2 = g.update(200);

    expect(out1.ema1).toBeCloseTo(100);
    expect(out1.ema2).toBeCloseTo(100);
    expect(out1.sum).toBeCloseTo(200);
    expect(out2.sum).toBeCloseTo(out2.ema1 + out2.ema2, 1);
  });

  it("should handle complex dependency graph with arbitrary order", () => {
    const g = new GraphExec("tick");

    g.add("final", { update: (a: number, b: number) => a * b })
      .depends("diff", "fast")
      .add("diff", { update: (a: number, b: number) => a - b })
      .depends("fast", "slow")
      .add("slow", new EMA({ period: 3 }))
      .depends("tick")
      .add("fast", new EMA({ period: 2 }))
      .depends("tick");

    g.update(100);
    g.update(200);
    const out3 = g.update(300);

    expect(out3.fast).toBeGreaterThan(out3.slow);
    expect(out3.diff).toBeCloseTo(out3.fast - out3.slow, 1);
    expect(out3.final).toBeCloseTo(out3.diff * out3.fast, 1);
  });

  it("should handle aggregator nodes that don't always produce output", () => {
    class BatchAggregator {
      private buffer: number[] = [];
      private batchSize = 3;

      update(value: number): number[] | undefined {
        this.buffer.push(value);
        if (this.buffer.length >= this.batchSize) {
          const result = [...this.buffer];
          this.buffer = [];
          return result;
        }
        return undefined;
      }
    }

    const sumArray = {
      update: (arr: number[]) => arr.reduce((sum, v) => sum + v, 0),
    };

    const g = new GraphExec("tick");

    g.add("batch", new BatchAggregator())
      .depends("tick")
      .add("sum", sumArray)
      .depends("batch");

    const out1 = g.update(1);
    const out2 = g.update(2);
    const out3 = g.update(3);
    const out4 = g.update(4);
    const out5 = g.update(5);

    expect(out1.batch).toBeUndefined();
    expect(out1.sum).toBeUndefined();
    expect(out2.batch).toBeUndefined();
    expect(out2.sum).toBeUndefined();
    expect(out3.batch).toEqual([1, 2, 3]);
    expect(out3.sum).toBe(6);
    expect(out4.batch).toBeUndefined();
    expect(out4.sum).toBeUndefined();
    expect(out5.batch).toBeUndefined();
    expect(out5.sum).toBeUndefined();
  });

  it("should throw error when adding node with root name", () => {
    const g = new GraphExec("tick");

    expect(() => {
      g.add("tick", new EMA({ period: 2 })).depends("tick");
    }).toThrow("Cannot add node with name 'tick': conflicts with root node");
  });

  it("should validate acyclic graph without errors", () => {
    const g = new GraphExec("tick");

    g.add("ema1", new EMA({ period: 2 }))
      .depends("tick")
      .add("ema2", new EMA({ period: 3 }))
      .depends("tick")
      .add("sum", { update: (a: number, b: number) => a + b })
      .depends("ema1", "ema2");

    const result = g.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("should detect simple cycle", () => {
    const g = new GraphExec("tick");
    const identity = { update: (x: number) => x };

    g.add("a", identity).depends("b").add("b", identity).depends("a");

    const result = g.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].type).toBe("cycle");
    if (result.errors[0].type === "cycle") {
      expect(result.errors[0].nodes).toContain("a");
      expect(result.errors[0].nodes).toContain("b");
    }
  });

  it("should detect cycle in longer chain", () => {
    const g = new GraphExec("tick");
    const identity = { update: (x: number) => x };

    g.add("a", identity)
      .depends("tick")
      .add("b", identity)
      .depends("a")
      .add("c", identity)
      .depends("b")
      .add("d", identity)
      .depends("c", "a");

    const result = g.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);

    const g2 = new GraphExec("tick");
    g2.add("a", { update: (x: number) => x })
      .depends("tick")
      .add("b", { update: (x: number) => x })
      .depends("a")
      .add("c", { update: (x: number) => x })
      .depends("b")
      .add("d", { update: (x: number) => x })
      .depends("c")
      .add("e", { update: (x: number) => x })
      .depends("d", "b");

    const result2 = g2.validate();
    expect(result2.valid).toBe(true);

    const g3 = new GraphExec("tick");
    g3.add("a", { update: (x: number) => x })
      .depends("b")
      .add("b", { update: (x: number) => x })
      .depends("c")
      .add("c", { update: (x: number) => x })
      .depends("a");

    const result3 = g3.validate();
    expect(result3.valid).toBe(false);
    expect(result3.errors.length).toBeGreaterThan(0);
    expect(result3.errors[0].type).toBe("cycle");
    if (result3.errors[0].type === "cycle") {
      expect(result3.errors[0].nodes.length).toBeGreaterThan(2);
    }
  });

  it("should detect node with unknown dependency", () => {
    const g = new GraphExec("tick");
    const identity = { update: (x: number) => x };

    g.add("a", identity)
      .depends("tick")
      .add("b", identity)
      .depends("a")
      .add("orphan", identity)
      .depends("nonexistent");

    const result = g.validate();
    expect(result.valid).toBe(false);
    // Nodes with unknown dependencies are reported as unreachable
    expect(result.errors.some((e) => e.type === "unreachable")).toBe(true);
    const unreachableError = result.errors.find(
      (e) => e.type === "unreachable"
    );
    if (unreachableError && unreachableError.type === "unreachable") {
      // Both "nonexistent" and "orphan" are unreachable
      expect(unreachableError.nodes).toContain("orphan");
      expect(unreachableError.nodes).toContain("nonexistent");
    }
  });

  it("should detect two independent cycles", () => {
    const g = new GraphExec("tick");
    const identity = { update: (x: number) => x };

    // First cycle: a -> b -> c -> a
    g.add("a", identity)
      .depends("b")
      .add("b", identity)
      .depends("c")
      .add("c", identity)
      .depends("a");

    // Second cycle: d -> e -> d
    g.add("d", identity).depends("e").add("e", identity).depends("d");

    const result = g.validate();
    expect(result.valid).toBe(false);

    const cycleErrors = result.errors.filter((e) => e.type === "cycle");

    // Should detect at least one cycle (implementation may stop after first)
    expect(cycleErrors.length).toBeGreaterThan(0);

    // Verify the detected cycle(s) contain valid node sequences
    for (const error of cycleErrors) {
      if (error.type === "cycle") {
        // Each cycle should have at least 2 nodes (to form a cycle)
        expect(error.nodes.length).toBeGreaterThanOrEqual(2);

        // First and last node should be the same (cycle starts and ends at same node)
        expect(error.nodes[0]).toBe(error.nodes[error.nodes.length - 1]);
      }
    }

    // Verify at least one cycle involves nodes from our defined cycles
    const allCycleNodes = cycleErrors.flatMap((e) =>
      e.type === "cycle" ? e.nodes : []
    );
    const hasFirstCycle =
      allCycleNodes.includes("a") ||
      allCycleNodes.includes("b") ||
      allCycleNodes.includes("c");
    const hasSecondCycle =
      allCycleNodes.includes("d") || allCycleNodes.includes("e");

    expect(hasFirstCycle || hasSecondCycle).toBe(true);
  });

  it("should detect both cycles separately", () => {
    const g = new GraphExec("tick");
    const identity = { update: (x: number) => x };

    // First cycle: a -> b -> c -> a
    g.add("a", identity)
      .depends("b")
      .add("b", identity)
      .depends("c")
      .add("c", identity)
      .depends("a");

    // Second cycle: d -> e -> d
    g.add("d", identity).depends("e").add("e", identity).depends("d");

    const result = g.validate();
    expect(result.valid).toBe(false);

    const cycleErrors = result.errors.filter((e) => e.type === "cycle");

    // Should detect both independent cycles
    expect(cycleErrors.length).toBe(2);

    let foundCycle1 = false;
    let foundCycle2 = false;

    for (const error of cycleErrors) {
      if (error.type === "cycle") {
        const cycleNodeSet = new Set(error.nodes);

        // Check for first cycle (a -> b -> c -> a or any permutation)
        if (
          cycleNodeSet.has("a") ||
          cycleNodeSet.has("b") ||
          cycleNodeSet.has("c")
        ) {
          foundCycle1 = true;
          // Verify cycle structure
          expect(error.nodes.length).toBeGreaterThanOrEqual(3);
          expect(error.nodes[0]).toBe(error.nodes[error.nodes.length - 1]);
        }

        // Check for second cycle (d -> e -> d)
        if (cycleNodeSet.has("d") || cycleNodeSet.has("e")) {
          foundCycle2 = true;
          // Verify cycle structure
          expect(error.nodes.length).toBeGreaterThanOrEqual(2);
          expect(error.nodes[0]).toBe(error.nodes[error.nodes.length - 1]);
        }
      }
    }

    // Both cycles should be detected
    expect(foundCycle1).toBe(true);
    expect(foundCycle2).toBe(true);
  });

  it("should prevent duplicate node names", () => {
    const g = new GraphExec("tick");
    const identity = { update: (x: number) => x };

    g.add("a", identity).depends("tick");

    // Attempting to add a node with the same name should throw
    expect(() => {
      g.add("a", identity).depends("tick");
    }).toThrow("node already exists");
  });
});
