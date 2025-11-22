import { describe, expect, it } from "vitest";
import {
  OpRegistry,
  type GraphSchema,
  validateGraphSchema,
  graphComplexity,
  Graph,
} from "../src/flow/index.js";
import type { OperatorDoc } from "../src/types/OpDoc.js";

class EMA {
  static readonly doc: OperatorDoc = {
    type: "EMA",
    update: "x: number",
    output: "number",
  };
}

class SMA {
  static readonly doc: OperatorDoc = {
    type: "SMA",
    update: "x: number",
    output: "number",
  };
}

class Op {
  static readonly doc: OperatorDoc = {
    type: "Op",
    update: "...args: any[]",
    output: "any",
  };
}

describe("Graph Validation", () => {
  it("should validate a valid graph", () => {
    const registry = new OpRegistry().register(EMA).register(SMA);

    const descriptor: GraphSchema = {
      root: "tick",
      nodes: [
        { name: "fast", type: "EMA", updateSource: ["tick"] },
        { name: "slow", type: "SMA", updateSource: ["tick"] },
      ],
    };

    const result = validateGraphSchema(descriptor, registry);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect unknown type", () => {
    const registry = new OpRegistry().register(EMA);

    const descriptor: GraphSchema = {
      root: "tick",
      nodes: [{ name: "ema", type: "Unknown", updateSource: ["tick"] }],
    };

    const result = validateGraphSchema(descriptor, registry);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      type: "unknown_type",
      node: "ema",
      opType: "Unknown",
    });
  });

  it("should detect missing dependency", () => {
    const registry = new OpRegistry().register(EMA);

    const descriptor: GraphSchema = {
      root: "tick",
      nodes: [{ name: "ema", type: "EMA", updateSource: ["missing"] }],
    };

    const result = validateGraphSchema(descriptor, registry);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    // Missing dependencies are detected as unreachable nodes
    expect(result.errors[0].type).toBe("unreachable");
    if (result.errors[0].type === "unreachable") {
      expect(result.errors[0].nodes).toContain("ema");
    }
  });

  it("should handle path dependencies", () => {
    const registry = new OpRegistry().register(EMA);

    const descriptor: GraphSchema = {
      root: "tick",
      nodes: [{ name: "ema", type: "EMA", updateSource: ["tick.price"] }],
    };

    const result = validateGraphSchema(descriptor, registry);
    expect(result.valid).toBe(true);
  });

  it("should detect missing dependency when root is different", () => {
    const registry = new OpRegistry().register(EMA);

    const descriptor: GraphSchema = {
      root: "price",
      nodes: [{ name: "ema", type: "EMA", updateSource: ["tick"] }],
    };

    const result = validateGraphSchema(descriptor, registry);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    // Missing dependencies are detected as unreachable nodes
    expect(result.errors[0].type).toBe("unreachable");
    if (result.errors[0].type === "unreachable") {
      expect(result.errors[0].nodes).toContain("ema");
    }
  });

  it("should detect cycle", () => {
    const registry = new OpRegistry().register(Op);

    const descriptor: GraphSchema = {
      root: "a",
      nodes: [
        { name: "a", type: "Op", updateSource: ["c"] },
        { name: "b", type: "Op", updateSource: ["a"] },
        { name: "c", type: "Op", updateSource: ["b"] },
      ],
    };

    const result = validateGraphSchema(descriptor, registry);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.type).toBe("cycle");
    expect(result.errors[0]).toHaveProperty("nodes");
    if (result.errors[0]?.type === "cycle") {
      expect(result.errors[0].nodes.length).toBeGreaterThan(0);
    }
  });

  it("should allow valid DAG", () => {
    const registry = new OpRegistry().register(Op);

    const descriptor: GraphSchema = {
      root: "tick",
      nodes: [
        { name: "a", type: "Op", updateSource: ["tick"] },
        { name: "b", type: "Op", updateSource: ["a"] },
        { name: "c", type: "Op", updateSource: ["a", "b"] },
      ],
    };

    const result = validateGraphSchema(descriptor, registry);
    expect(result.valid).toBe(true);
  });

  it("should validate when updateSource is omitted (for Const nodes)", () => {
    const registry = new OpRegistry().register(Op);

    const descriptor: GraphSchema = {
      root: "tick",
      nodes: [
        { name: "const", type: "Op" },
        { name: "b", type: "Op", updateSource: ["const"] },
      ],
    };

    const result = validateGraphSchema(descriptor, registry);
    expect(result.valid).toBe(true);
  });

  it("should validate when updateSource is empty string (for Const nodes)", () => {
    const registry = new OpRegistry().register(Op);

    const descriptor: GraphSchema = {
      root: "tick",
      nodes: [
        { name: "const", type: "Op", updateSource: "" },
        { name: "b", type: "Op", updateSource: ["const"] },
      ],
    } as any;

    const result = validateGraphSchema(descriptor, registry);
    expect(result.valid).toBe(true);
  });
});

describe("Graph Complexity", () => {
  it("should calculate complexity for simple graph", () => {
    const descriptor: GraphSchema = {
      root: "tick",
      nodes: [{ name: "ema", type: "EMA", updateSource: ["tick"] }],
    };

    expect(graphComplexity(descriptor)).toBe(2); // 1 node + 1 edge
  });

  it("should calculate complexity for complex graph", () => {
    const descriptor: GraphSchema = {
      root: "tick",
      nodes: [
        { name: "a", type: "Op", updateSource: ["tick"] },
        { name: "b", type: "Op", updateSource: ["tick"] },
        { name: "c", type: "Op", updateSource: ["a", "b"] },
      ],
    };

    expect(graphComplexity(descriptor)).toBe(7); // 3 nodes + 4 edges
  });

  it("should return node count for graph with no edges", () => {
    const descriptor: GraphSchema = {
      root: "tick",
      nodes: [
        { name: "a", type: "Op", updateSource: [] },
        { name: "b", type: "Op", updateSource: [] },
      ],
    };

    expect(graphComplexity(descriptor)).toBe(2); // 2 nodes + 0 edges
  });

  it("should handle omitted updateSource (for Const nodes)", () => {
    const descriptor: GraphSchema = {
      root: "tick",
      nodes: [
        { name: "const", type: "Op" },
        { name: "b", type: "Op", updateSource: ["const"] },
      ],
    };

    expect(graphComplexity(descriptor)).toBe(3); // 2 nodes + 1 edge
  });

  it("should handle empty string updateSource (for Const nodes)", () => {
    const descriptor: GraphSchema = {
      root: "tick",
      nodes: [
        { name: "const", type: "Op", updateSource: "" },
        { name: "b", type: "Op", updateSource: ["const"] },
      ],
    } as any;

    expect(graphComplexity(descriptor)).toBe(3); // 2 nodes + 1 edge
  });
});

describe("Graph.validate() - runtime validation", () => {
  it("should detect non-existent dependency when built imperatively", () => {
    const registry = new OpRegistry().register(EMA);
    const ema = new EMA();

    const graph = new Graph("tick");
    const node = {
      __isDagNode: true as const,
      inputPath: ["nonExistent"],
      onData: (state: Record<string, any>) => ema.update(state.nonExistent),
    };

    graph.addNode("ema", node);

    const result = graph.validate();
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    // Runtime validation reports unknown dependencies as unreachable
    expect(result.errors[0].type).toBe("unreachable");
    if (result.errors[0].type === "unreachable") {
      expect(result.errors[0].nodes).toContain("nonExistent");
      expect(result.errors[0].nodes).toContain("ema");
    }
  });

  it("should pass validation when all dependencies exist", () => {
    const graph = new Graph("tick");
    const node1 = {
      __isDagNode: true as const,
      inputPath: ["tick"],
      update: (state: Record<string, any>) => state.tick,
    };
    const node2 = {
      __isDagNode: true as const,
      inputPath: ["node1"],
      update: (state: Record<string, any>) => state.node1,
    };

    graph.addNode("node1", node1);
    graph.addNode("node2", node2);

    const result = graph.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect multiple non-existent dependencies", () => {
    const graph = new Graph("tick");
    const node1 = {
      __isDagNode: true as const,
      inputPath: ["missing1", "missing2"],
      update: (state: Record<string, any>) => null,
    };

    graph.addNode("node1", node1);

    const result = graph.validate();
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    // Multiple missing dependencies are reported as unreachable nodes
    expect(result.errors[0].type).toBe("unreachable");
    if (result.errors[0].type === "unreachable") {
      expect(result.errors[0].nodes).toContain("missing1");
      expect(result.errors[0].nodes).toContain("missing2");
      expect(result.errors[0].nodes).toContain("node1");
    }
  });

  it("should handle path-based dependencies correctly", () => {
    const graph = new Graph("tick");
    const node = {
      __isDagNode: true as const,
      inputPath: ["tick.price"],
      update: (state: Record<string, any>) => state.tick?.price,
    };

    graph.addNode("node1", node);

    const result = graph.validate();
    expect(result.valid).toBe(true);
  });
});
