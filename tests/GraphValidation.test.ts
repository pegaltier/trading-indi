import { describe, expect, it } from "vitest";
import {
  OpRegistry,
  type FlowGraph,
  validateFlowGraph,
  calculateFlowGraphComplexity,
  GraphExec,
} from "../src/flow/index.js";
import type { OperatorDoc } from "../src/types/OpDoc.js";

class EMA {
  static readonly doc: OperatorDoc = {
    type: "EMA",
    input: "x: number",
    output: "number",
  };

  update(x: number): number {
    return x;
  }
}

class SMA {
  static readonly doc: OperatorDoc = {
    type: "SMA",
    input: "x: number",
    output: "number",
  };

  update(x: number): number {
    return x;
  }
}

class Op {
  static readonly doc: OperatorDoc = {
    type: "Op",
    input: "...args: any[]",
    output: "any",
  };

  update(...args: any[]): any {
    return args;
  }
}

describe("GraphExec Validation", () => {
  it("should validate a valid graph", () => {
    const registry = new OpRegistry().register(EMA).register(SMA);

    const descriptor: FlowGraph = {
      root: "tick",
      nodes: [
        { name: "fast", type: "EMA", inputSrc: ["tick"] },
        { name: "slow", type: "SMA", inputSrc: ["tick"] },
      ],
    };

    const result = validateFlowGraph(descriptor, registry);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect unknown type", () => {
    const registry = new OpRegistry().register(EMA);

    const descriptor: FlowGraph = {
      root: "tick",
      nodes: [{ name: "ema", type: "Unknown", inputSrc: ["tick"] }],
    };

    const result = validateFlowGraph(descriptor, registry);
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

    const descriptor: FlowGraph = {
      root: "tick",
      nodes: [{ name: "ema", type: "EMA", inputSrc: ["missing"] }],
    };

    const result = validateFlowGraph(descriptor, registry);
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

    const descriptor: FlowGraph = {
      root: "tick",
      nodes: [{ name: "ema", type: "EMA", inputSrc: ["tick.price"] }],
    };

    const result = validateFlowGraph(descriptor, registry);
    expect(result.valid).toBe(true);
  });

  it("should detect missing dependency when root is different", () => {
    const registry = new OpRegistry().register(EMA);

    const descriptor: FlowGraph = {
      root: "price",
      nodes: [{ name: "ema", type: "EMA", inputSrc: ["tick"] }],
    };

    const result = validateFlowGraph(descriptor, registry);
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

    const descriptor: FlowGraph = {
      root: "a",
      nodes: [
        { name: "a", type: "Op", inputSrc: ["c"] },
        { name: "b", type: "Op", inputSrc: ["a"] },
        { name: "c", type: "Op", inputSrc: ["b"] },
      ],
    };

    const result = validateFlowGraph(descriptor, registry);
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

    const descriptor: FlowGraph = {
      root: "tick",
      nodes: [
        { name: "a", type: "Op", inputSrc: ["tick"] },
        { name: "b", type: "Op", inputSrc: ["a"] },
        { name: "c", type: "Op", inputSrc: ["a", "b"] },
      ],
    };

    const result = validateFlowGraph(descriptor, registry);
    expect(result.valid).toBe(true);
  });

  it("should validate when inputSrc is omitted (for Const nodes)", () => {
    const registry = new OpRegistry().register(Op);

    const descriptor: FlowGraph = {
      root: "tick",
      nodes: [
        { name: "const", type: "Op" },
        { name: "b", type: "Op", inputSrc: ["const"] },
      ],
    };

    const result = validateFlowGraph(descriptor, registry);
    expect(result.valid).toBe(true);
  });

  it("should validate when inputSrc is empty string (for Const nodes)", () => {
    const registry = new OpRegistry().register(Op);

    const descriptor: FlowGraph = {
      root: "tick",
      nodes: [
        { name: "const", type: "Op", inputSrc: "" },
        { name: "b", type: "Op", inputSrc: ["const"] },
      ],
    } as any;

    const result = validateFlowGraph(descriptor, registry);
    expect(result.valid).toBe(true);
  });
});

describe("GraphExec Complexity", () => {
  it("should calculate complexity for simple graph", () => {
    const descriptor: FlowGraph = {
      root: "tick",
      nodes: [{ name: "ema", type: "EMA", inputSrc: ["tick"] }],
    };

    const complexity = calculateFlowGraphComplexity(descriptor);
    expect(complexity.nodeCount).toBe(1);
    expect(complexity.edgeCount).toBe(1);
  });

  it("should calculate complexity for complex graph", () => {
    const descriptor: FlowGraph = {
      root: "tick",
      nodes: [
        { name: "a", type: "Op", inputSrc: ["tick"] },
        { name: "b", type: "Op", inputSrc: ["tick"] },
        { name: "c", type: "Op", inputSrc: ["a", "b"] },
      ],
    };

    const complexity = calculateFlowGraphComplexity(descriptor);
    expect(complexity.nodeCount).toBe(3);
    expect(complexity.edgeCount).toBe(4);
  });

  it("should return node count for graph with no edges", () => {
    const descriptor: FlowGraph = {
      root: "tick",
      nodes: [
        { name: "a", type: "Op", inputSrc: [] },
        { name: "b", type: "Op", inputSrc: [] },
      ],
    };

    const complexity = calculateFlowGraphComplexity(descriptor);
    expect(complexity.nodeCount).toBe(2);
    expect(complexity.edgeCount).toBe(0);
  });

  it("should handle omitted inputSrc (for Const nodes)", () => {
    const descriptor: FlowGraph = {
      root: "tick",
      nodes: [
        { name: "const", type: "Op" },
        { name: "b", type: "Op", inputSrc: ["const"] },
      ],
    };

    const complexity = calculateFlowGraphComplexity(descriptor);
    expect(complexity.nodeCount).toBe(2);
    expect(complexity.edgeCount).toBe(1);
  });

  it("should handle empty string inputSrc (for Const nodes)", () => {
    const descriptor: FlowGraph = {
      root: "tick",
      nodes: [
        { name: "const", type: "Op", inputSrc: "" },
        { name: "b", type: "Op", inputSrc: ["const"] },
      ],
    } as any;

    const complexity = calculateFlowGraphComplexity(descriptor);
    expect(complexity.nodeCount).toBe(2);
    expect(complexity.edgeCount).toBe(1);
  });
});

describe("GraphExec.validate() - runtime validation", () => {
  it("should detect non-existent dependency when built imperatively", () => {
    const registry = new OpRegistry().register(EMA);
    const ema = new EMA();

    const graph = new GraphExec("tick");
    const node = {
      __isDagNode: true as const,
      inputPath: ["nonExistent"],
      predSatisfied: (state: Record<string, any>) =>
        ema.update(state.nonExistent),
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
    const graph = new GraphExec("tick");
    const node1 = {
      __isDagNode: true as const,
      inputPath: ["tick"],
      predSatisfied: (state: Record<string, any>) => state.tick,
    };
    const node2 = {
      __isDagNode: true as const,
      inputPath: ["node1"],
      predSatisfied: (state: Record<string, any>) => state.node1,
    };

    graph.addNode("node1", node1);
    graph.addNode("node2", node2);

    const result = graph.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect multiple non-existent dependencies", () => {
    const graph = new GraphExec("tick");
    const node1 = {
      __isDagNode: true as const,
      inputPath: ["missing1", "missing2"],
      predSatisfied: (state: Record<string, any>) => null,
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
    const graph = new GraphExec("tick");
    const node = {
      __isDagNode: true as const,
      inputPath: ["tick.price"],
      predSatisfied: (state: Record<string, any>) => state.tick?.price,
    };

    graph.addNode("node1", node);

    const result = graph.validate();
    expect(result.valid).toBe(true);
  });
});
