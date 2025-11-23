/**
 * Graph Scaling Benchmark
 * Tests performance with different graph sizes
 */

import { Graph } from "../src/flow/index.js";
import { EMA } from "@junduck/trading-core";

class Add {
  constructor(private value: number) {}
  update(x: number): number {
    return x + this.value;
  }
}

function buildGraph(nodeCount: number): Graph {
  const graph = new Graph("tick");

  // Build linear chain of nodes
  for (let i = 0; i < nodeCount; i++) {
    const prevNode = i === 0 ? "tick" : `node_${i - 1}`;
    if (i % 2 === 0) {
      graph.add(`node_${i}`, new EMA({ period: 5 })).depends(prevNode);
    } else {
      graph.add(`node_${i}`, new Add(i)).depends(prevNode);
    }
  }

  return graph;
}

function benchmarkSize(nodeCount: number, iterations: number) {
  const graph = buildGraph(nodeCount);

  // Warmup
  for (let i = 0; i < 10; i++) {
    graph.update(100);
  }

  // Benchmark
  const start = Date.now();
  for (let i = 0; i < iterations; i++) {
    graph.update(100 + Math.random() * 10);
  }
  const elapsed = Date.now() - start;

  return {
    nodeCount,
    iterations,
    totalTime: elapsed,
    avgTime: elapsed / iterations,
    throughput: (iterations / (elapsed / 1000)).toFixed(0),
  };
}

function runScalingBenchmark() {
  console.log("Graph Scaling Benchmark");
  console.log("=".repeat(70));
  console.log();

  const configs = [
    { nodes: 10, iterations: 10000 },
    { nodes: 25, iterations: 10000 },
    { nodes: 50, iterations: 10000 },
    { nodes: 100, iterations: 5000 },
    { nodes: 200, iterations: 2000 },
  ];

  console.log("Nodes | Iterations | Total Time | Avg Time | Throughput");
  console.log("-".repeat(70));

  for (const config of configs) {
    const result = benchmarkSize(config.nodes, config.iterations);
    console.log(
      `${result.nodeCount.toString().padStart(5)} | ` +
        `${result.iterations.toString().padStart(10)} | ` +
        `${result.totalTime.toString().padStart(10)}ms | ` +
        `${result.avgTime.toFixed(3).padStart(8)}ms | ` +
        `${result.throughput.padStart(10)} ops/s`
    );
  }

  console.log();
  console.log("=".repeat(70));
}

runScalingBenchmark();
