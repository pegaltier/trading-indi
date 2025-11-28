import type {
  FlowGraph,
  FlowGraphComplexity,
  FlowGraphDiff,
} from "./schema.js";
import { buildSuccessorMap, normalizeUpdateSource } from "./validate.js";

/**
 * Calculate graph complexity.
 * @param desc GraphExec descriptor
 * @returns Complexity score (node count + edge count)
 */
export function calculateFlowGraphComplexity(
  desc: FlowGraph
): FlowGraphComplexity {
  const nodeCount = desc.nodes.length;
  const edgeCount = desc.nodes.reduce(
    (sum, node) => sum + normalizeUpdateSource(node.inputSrc).length,
    0
  );

  // Calculate max depth by traversing the graph
  const succ = buildSuccessorMap(desc);
  const visited = new Set<string>();
  const depths = new Map<string, number>();

  function calculateDepth(nodeName: string): number {
    if (visited.has(nodeName)) {
      return depths.get(nodeName) || 0;
    }

    visited.add(nodeName);
    const successors = succ.get(nodeName) || [];

    if (successors.length === 0) {
      depths.set(nodeName, 0);
      return 0;
    }

    let maxChildDepth = 0;
    for (const child of successors) {
      const childDepth = calculateDepth(child);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }

    const depth = maxChildDepth + 1;
    depths.set(nodeName, depth);
    return depth;
  }

  const maxDepth = calculateDepth(desc.root);

  return {
    nodeCount,
    edgeCount,
    maxDepth,
  };
}

/**
 * Compare two graph descriptors and return differences.
 * @param before Previous graph state
 * @param after Current graph state
 */
export function compareFlowGraphs(
  before: FlowGraph,
  after: FlowGraph
): FlowGraphDiff[] {
  const diffs: FlowGraphDiff[] = [];

  if (before.root !== after.root) {
    diffs.push({
      kind: "root_changed",
      before: before.root,
      after: after.root,
    });
  }

  const beforeNodes = new Map(before.nodes.map((n) => [n.name, n]));
  const afterNodes = new Map(after.nodes.map((n) => [n.name, n]));

  for (const [name, node] of afterNodes) {
    if (!beforeNodes.has(name)) {
      diffs.push({ kind: "node_added", node: name, after: node });
    }
  }

  for (const [name, node] of beforeNodes) {
    if (!afterNodes.has(name)) {
      diffs.push({ kind: "node_removed", node: name, before: node });
    }
  }

  for (const [name, afterNode] of afterNodes) {
    const beforeNode = beforeNodes.get(name);
    if (!beforeNode) continue;

    if (beforeNode.type !== afterNode.type) {
      diffs.push({
        kind: "node_type_changed",
        node: name,
        before: beforeNode.type,
        after: afterNode.type,
      });
    }

    if (JSON.stringify(beforeNode.init) !== JSON.stringify(afterNode.init)) {
      diffs.push({
        kind: "node_init_changed",
        node: name,
        before: beforeNode.init,
        after: afterNode.init,
      });
    }

    const beforeInputs = normalizeUpdateSource(beforeNode.inputSrc)
      .slice()
      .sort()
      .join(",");
    const afterInputs = normalizeUpdateSource(afterNode.inputSrc)
      .slice()
      .sort()
      .join(",");
    if (beforeInputs !== afterInputs) {
      diffs.push({
        kind: "node_input_changed",
        node: name,
        before: normalizeUpdateSource(beforeNode.inputSrc),
        after: normalizeUpdateSource(afterNode.inputSrc),
      });
    }
  }

  return diffs;
}
