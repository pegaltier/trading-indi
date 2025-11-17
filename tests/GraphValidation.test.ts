import { describe, expect, it } from "vitest";
import {
  OpRegistry,
  type GraphDescriptor,
  validateDescriptor,
  graphComplexity,
} from "../src/flow/index.js";

describe("Graph Validation", () => {
  it("should validate a valid graph", () => {
    const registry = new OpRegistry()
      .register("EMA", class {})
      .register("SMA", class {});

    const descriptor: GraphDescriptor = {
      root: "tick",
      nodes: [
        { name: "fast", type: "EMA", input: ["tick"] },
        { name: "slow", type: "SMA", input: ["tick"] },
      ],
    };

    const result = validateDescriptor(descriptor, registry);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect unknown type", () => {
    const registry = new OpRegistry().register("EMA", class {});

    const descriptor: GraphDescriptor = {
      root: "tick",
      nodes: [{ name: "ema", type: "Unknown", input: ["tick"] }],
    };

    const result = validateDescriptor(descriptor, registry);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Unknown type "Unknown" for node "ema"');
  });

  it("should detect missing dependency", () => {
    const registry = new OpRegistry().register("EMA", class {});

    const descriptor: GraphDescriptor = {
      root: "tick",
      nodes: [{ name: "ema", type: "EMA", input: ["missing"] }],
    };

    const result = validateDescriptor(descriptor, registry);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Node "ema" references unknown dependency "missing"'
    );
  });

  it("should handle path dependencies", () => {
    const registry = new OpRegistry().register("EMA", class {});

    const descriptor: GraphDescriptor = {
      root: "tick",
      nodes: [{ name: "ema", type: "EMA", input: ["tick.price"] }],
    };

    const result = validateDescriptor(descriptor, registry);
    expect(result.valid).toBe(true);
  });

  it("should detect missing dependency when root is different", () => {
    const registry = new OpRegistry().register("EMA", class {});

    const descriptor: GraphDescriptor = {
      root: "price",
      nodes: [{ name: "ema", type: "EMA", input: ["tick"] }],
    };

    const result = validateDescriptor(descriptor, registry);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Node "ema" references unknown dependency "tick"'
    );
  });

  it("should detect cycle", () => {
    const registry = new OpRegistry().register("Op", class {});

    const descriptor: GraphDescriptor = {
      root: "a",
      nodes: [
        { name: "a", type: "Op", input: ["c"] },
        { name: "b", type: "Op", input: ["a"] },
        { name: "c", type: "Op", input: ["b"] },
      ],
    };

    const result = validateDescriptor(descriptor, registry);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Graph contains a cycle");
  });

  it("should allow valid DAG", () => {
    const registry = new OpRegistry().register("Op", class {});

    const descriptor: GraphDescriptor = {
      root: "tick",
      nodes: [
        { name: "a", type: "Op", input: ["tick"] },
        { name: "b", type: "Op", input: ["a"] },
        { name: "c", type: "Op", input: ["a", "b"] },
      ],
    };

    const result = validateDescriptor(descriptor, registry);
    expect(result.valid).toBe(true);
  });
});

describe("Graph Complexity", () => {
  it("should calculate complexity for simple graph", () => {
    const descriptor: GraphDescriptor = {
      root: "tick",
      nodes: [{ name: "ema", type: "EMA", input: ["tick"] }],
    };

    expect(graphComplexity(descriptor)).toBe(2); // 1 node + 1 edge
  });

  it("should calculate complexity for complex graph", () => {
    const descriptor: GraphDescriptor = {
      root: "tick",
      nodes: [
        { name: "a", type: "Op", input: ["tick"] },
        { name: "b", type: "Op", input: ["tick"] },
        { name: "c", type: "Op", input: ["a", "b"] },
      ],
    };

    expect(graphComplexity(descriptor)).toBe(7); // 3 nodes + 4 edges
  });

  it("should return node count for graph with no edges", () => {
    const descriptor: GraphDescriptor = {
      root: "tick",
      nodes: [
        { name: "a", type: "Op", input: [] },
        { name: "b", type: "Op", input: [] },
      ],
    };

    expect(graphComplexity(descriptor)).toBe(2); // 2 nodes + 0 edges
  });
});
