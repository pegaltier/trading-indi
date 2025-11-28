import type { OpRegistry } from "./Registry.js";
import {
  FlowGraphSchema,
  type FlowGraph,
  type FlowGraphError,
  type FlowGraphValidationResult,
} from "./schema.js";
import { validateAdjList } from "./validate-topo.js";

/**
 * Normalize inputSrc to string array. Handles undefined, empty string, and Const nodes.
 */
export function normalizeUpdateSource(source?: string[] | string): string[] {
  if (!source || source === "") return [];
  return Array.isArray(source) ? source : [source];
}

/**
 * Build successor adjacency list from graph schema.
 * Nodes with no inputs depend on root.
 */
export function buildSuccessorMap(graph: FlowGraph): Map<string, string[]> {
  const succ = new Map<string, string[]>();

  succ.set(graph.root, []);
  for (const node of graph.nodes) {
    succ.set(node.name, []);
  }

  for (const node of graph.nodes) {
    const sources = normalizeUpdateSource(node.inputSrc);
    if (sources.length === 0) {
      // Nodes with no inputs (e.g., Const) depend on root
      const rootSuccs = succ.get(graph.root)!;
      if (!rootSuccs.includes(node.name)) {
        rootSuccs.push(node.name);
      }
    } else {
      for (const depPath of sources) {
        const dep = depPath.split(".")[0]!;
        const depSuccs = succ.get(dep);
        if (depSuccs && !depSuccs.includes(node.name)) {
          depSuccs.push(node.name);
        }
      }
    }
  }

  return succ;
}

/**
 * Validate a graph against a registry.
 * Checks:
 * - GraphExec structure (via Zod)
 * - All types exist in registry
 * - GraphExec topology (cycles, reachability)
 * @param graph GraphExec
 * @param registry Type registry
 */
export function validateFlowGraph(
  graph: FlowGraph,
  registry: OpRegistry
): FlowGraphValidationResult {
  const errors: FlowGraphError[] = [];

  // Validate structure with Zod
  const parseResult = FlowGraphSchema.safeParse(graph);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      errors.push({
        type: "structure",
        path: issue.path.join("."),
        message: issue.message,
      });
    }
    return { valid: false, errors };
  }

  const validSchema = parseResult.data;

  // Check all types exist in registry
  for (const node of validSchema.nodes) {
    if (!registry.has(node.type)) {
      errors.push({
        type: "unknown_type",
        node: node.name,
        opType: node.type,
      });
    }
  }

  // Check topology (unreachable errors will catch unknown dependencies)
  if (errors.length === 0) {
    const succ = buildSuccessorMap(validSchema);
    const FlowTopoErrors = validateAdjList(validSchema.root, succ);
    errors.push(...FlowTopoErrors);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Format validation error as human-readable string.
 */
export function formatFlowValidationError(error: FlowGraphError): string {
  switch (error.type) {
    case "structure":
      return `${error.path}: ${error.message}`;
    case "unknown_type":
      return `Unknown type "${error.opType}" for node "${error.node}"`;
    case "cycle":
      return `GraphExec contains a cycle: ${error.nodes.join(" → ")}`;
    case "unreachable":
      return `Unreachable nodes from root: ${error.nodes.join(", ")}`;
  }
}
