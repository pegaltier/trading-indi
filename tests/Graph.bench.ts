import { bench, describe } from "vitest";
import { GraphExec } from "../src/flow/graph-exec";
import { EMA, SMA } from "@junduck/trading-core";

// Trivial computation nodes
class Add {
  constructor(private value: number) {}
  update(x: number): number {
    return x + this.value;
  }
}

class Multiply {
  constructor(private factor: number) {}
  update(x: number): number {
    return x * this.factor;
  }
}

class Subtract {
  update(a: number, b: number): number {
    return a - b;
  }
}

// GraphExec builders for different topologies

/** Linear chain: tick -> n1 -> n2 -> ... -> nN */
function buildLinearGraph(nodeCount: number): GraphExec {
  const graph = new GraphExec("tick");
  let prevNode = "tick";

  for (let i = 0; i < nodeCount; i++) {
    const name = `node_${i}`;
    graph.add(name, new Add(i)).depends(prevNode);
    prevNode = name;
  }

  return graph;
}

/** Wide graph: all nodes depend directly on root */
function buildWideGraph(nodeCount: number): GraphExec {
  const graph = new GraphExec("tick");

  for (let i = 0; i < nodeCount; i++) {
    graph.add(`node_${i}`, new Add(i)).depends("tick");
  }

  return graph;
}

/** Diamond pattern: creates many diamond-shaped dependency structures */
function buildDiamondGraph(nodeCount: number): GraphExec {
  const graph = new GraphExec("tick");

  // Create diamonds in batches of 4 nodes
  const diamonds = Math.floor(nodeCount / 4);

  for (let i = 0; i < diamonds; i++) {
    const base = i * 4;
    const left = `left_${i}`;
    const right = `right_${i}`;
    const merge = `merge_${i}`;

    if (i === 0) {
      graph
        .add(left, new Add(1))
        .depends("tick")
        .add(right, new Add(2))
        .depends("tick")
        .add(merge, new Subtract())
        .depends(left, right);
    } else {
      const prevMerge = `merge_${i - 1}`;
      graph
        .add(left, new Add(1))
        .depends(prevMerge)
        .add(right, new Add(2))
        .depends(prevMerge)
        .add(merge, new Subtract())
        .depends(left, right);
    }
  }

  // Fill remaining nodes
  const remaining = nodeCount - diamonds * 3;
  for (let i = 0; i < remaining; i++) {
    graph.add(`extra_${i}`, new Add(i)).depends("tick");
  }

  return graph;
}

/** Complex realistic graph: multiple layers with indicators */
function buildRealisticGraph(nodeCount: number): GraphExec {
  const graph = new GraphExec("tick");
  let nodesAdded = 0;

  // Layer 1: Fast EMAs (1/4 of nodes)
  const fastEmas = Math.floor(nodeCount * 0.25);
  for (let i = 0; i < fastEmas && nodesAdded < nodeCount; i++, nodesAdded++) {
    graph.add(`fast_ema_${i}`, new EMA({ period: 5 + i })).depends("tick");
  }

  // Layer 2: Slow SMAs (1/4 of nodes)
  const slowSmas = Math.floor(nodeCount * 0.25);
  for (let i = 0; i < slowSmas && nodesAdded < nodeCount; i++, nodesAdded++) {
    graph.add(`slow_sma_${i}`, new SMA({ period: 20 + i * 2 })).depends("tick");
  }

  // Layer 3: Derived indicators (1/4 of nodes)
  const derived = Math.floor(nodeCount * 0.25);
  for (let i = 0; i < derived && nodesAdded < nodeCount; i++, nodesAdded++) {
    const emaIdx = i % fastEmas;
    const smaIdx = i % slowSmas;
    graph
      .add(`diff_${i}`, new Subtract())
      .depends(`fast_ema_${emaIdx}`, `slow_sma_${smaIdx}`);
  }

  // Layer 4: Aggregated signals (remaining nodes)
  let layer3Idx = 0;
  while (nodesAdded < nodeCount) {
    const diffIdx = layer3Idx % derived;
    const emaIdx = layer3Idx % fastEmas;
    graph
      .add(`signal_${nodesAdded}`, new Multiply(1.5))
      .depends(`diff_${diffIdx}`);
    nodesAdded++;
    layer3Idx++;
  }

  return graph;
}

// Benchmark helpers
function createSampleData(): number[] {
  return Array.from({ length: 1000 }, (_, i) => 100 + Math.sin(i / 10) * 20);
}

// Construction benchmarks
describe("GraphExec Construction", () => {
  bench("build linear graph (10 nodes)", () => {
    buildLinearGraph(10);
  });

  bench("build linear graph (50 nodes)", () => {
    buildLinearGraph(50);
  });

  bench("build linear graph (100 nodes)", () => {
    buildLinearGraph(100);
  });

  bench("build linear graph (200 nodes)", () => {
    buildLinearGraph(200);
  });

  bench("build wide graph (50 nodes)", () => {
    buildWideGraph(50);
  });

  bench("build wide graph (100 nodes)", () => {
    buildWideGraph(100);
  });

  bench("build wide graph (200 nodes)", () => {
    buildWideGraph(200);
  });

  bench("build diamond graph (60 nodes)", () => {
    buildDiamondGraph(60);
  });

  bench("build diamond graph (120 nodes)", () => {
    buildDiamondGraph(120);
  });

  bench("build realistic graph (50 nodes)", () => {
    buildRealisticGraph(50);
  });

  bench("build realistic graph (100 nodes)", () => {
    buildRealisticGraph(100);
  });

  bench("build realistic graph (200 nodes)", () => {
    buildRealisticGraph(200);
  });
});

// Execution benchmarks - single update
describe("GraphExec Execution - Single Update", () => {
  const graphs = {
    linear10: buildLinearGraph(10),
    linear50: buildLinearGraph(50),
    linear100: buildLinearGraph(100),
    linear200: buildLinearGraph(200),
    wide50: buildWideGraph(50),
    wide100: buildWideGraph(100),
    wide200: buildWideGraph(200),
    diamond60: buildDiamondGraph(60),
    diamond120: buildDiamondGraph(120),
    realistic50: buildRealisticGraph(50),
    realistic100: buildRealisticGraph(100),
    realistic200: buildRealisticGraph(200),
  };

  // Warmup all graphs
  Object.values(graphs).forEach((g) => {
    for (let i = 0; i < 10; i++) {
      g.update(100);
    }
  });

  bench("linear graph (10 nodes)", () => {
    graphs.linear10.update(100);
  });

  bench("linear graph (50 nodes)", () => {
    graphs.linear50.update(100);
  });

  bench("linear graph (100 nodes)", () => {
    graphs.linear100.update(100);
  });

  bench("linear graph (200 nodes)", () => {
    graphs.linear200.update(100);
  });

  bench("wide graph (50 nodes)", () => {
    graphs.wide50.update(100);
  });

  bench("wide graph (100 nodes)", () => {
    graphs.wide100.update(100);
  });

  bench("wide graph (200 nodes)", () => {
    graphs.wide200.update(100);
  });

  bench("diamond graph (60 nodes)", () => {
    graphs.diamond60.update(100);
  });

  bench("diamond graph (120 nodes)", () => {
    graphs.diamond120.update(100);
  });

  bench("realistic graph (50 nodes)", () => {
    graphs.realistic50.update(100);
  });

  bench("realistic graph (100 nodes)", () => {
    graphs.realistic100.update(100);
  });

  bench("realistic graph (200 nodes)", () => {
    graphs.realistic200.update(100);
  });
});

// Throughput benchmarks - batch updates
describe("GraphExec Throughput - Batch Updates", () => {
  const data = createSampleData();

  bench("linear 50 nodes x 1000 updates", () => {
    const graph = buildLinearGraph(50);
    for (const value of data) {
      graph.update(value);
    }
  });

  bench("linear 100 nodes x 1000 updates", () => {
    const graph = buildLinearGraph(100);
    for (const value of data) {
      graph.update(value);
    }
  });

  bench("wide 50 nodes x 1000 updates", () => {
    const graph = buildWideGraph(50);
    for (const value of data) {
      graph.update(value);
    }
  });

  bench("wide 100 nodes x 1000 updates", () => {
    const graph = buildWideGraph(100);
    for (const value of data) {
      graph.update(value);
    }
  });

  bench("realistic 50 nodes x 1000 updates", () => {
    const graph = buildRealisticGraph(50);
    for (const value of data) {
      graph.update(value);
    }
  });

  bench("realistic 100 nodes x 1000 updates", () => {
    const graph = buildRealisticGraph(100);
    for (const value of data) {
      graph.update(value);
    }
  });

  bench("realistic 200 nodes x 1000 updates", () => {
    const graph = buildRealisticGraph(200);
    for (const value of data) {
      graph.update(value);
    }
  });
});

// Scaling analysis
describe("Scaling Analysis - Node Count vs Performance", () => {
  const nodeCounts = [10, 25, 50, 75, 100, 150, 200];

  for (const count of nodeCounts) {
    bench(`linear ${count} nodes`, () => {
      const graph = buildLinearGraph(count);
      graph.update(100);
    });
  }

  for (const count of nodeCounts) {
    bench(`wide ${count} nodes`, () => {
      const graph = buildWideGraph(count);
      graph.update(100);
    });
  }
});
