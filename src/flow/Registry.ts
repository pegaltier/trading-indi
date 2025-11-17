/**
 * Type registry for graph serialization.
 * Maps type names to constructor functions.
 */
export class OpRegistry {
  private types = new Map<string, new (opts: any) => any>();

  /**
   * Register a type with its constructor.
   * @param name Type name used in JSON
   * @param ctor Constructor function
   */
  register(name: string, ctor: new (opts: any) => any): this {
    this.types.set(name, ctor);
    return this;
  }

  /**
   * Get constructor for a type name.
   * @param name Type name
   * @returns Constructor function
   */
  get(name: string): (new (opts: any) => any) | undefined {
    return this.types.get(name);
  }

  /**
   * Check if type is registered.
   * @param name Type name
   */
  has(name: string): boolean {
    return this.types.has(name);
  }
}

/**
 * Node descriptor for JSON serialization.
 */
export interface OpDescriptor {
  name: string;
  type: string;
  init?: any;
  input: string[];
}

/**
 * Graph descriptor for JSON serialization.
 */
export interface GraphDescriptor {
  root: string;
  nodes: OpDescriptor[];
}

/**
 * Result of graph validation.
 */
export interface GraphDescValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a graph descriptor against a registry.
 * Checks:
 * - All types exist in registry
 * - No cycles (topological sort feasibility)
 * - All dependencies reference existing nodes
 * @param desc Graph descriptor
 * @param registry Type registry
 */
export function validateDescriptor(
  desc: GraphDescriptor,
  registry: OpRegistry
): GraphDescValidationResult {
  const errors: string[] = [];
  const nodeNames = new Set(desc.nodes.map((n) => n.name));
  nodeNames.add(desc.root);

  for (const node of desc.nodes) {
    if (!registry.has(node.type)) {
      errors.push(`Unknown type "${node.type}" for node "${node.name}"`);
    }

    for (const depPath of node.input) {
      const depNode = depPath.split(".")[0]!;
      if (!nodeNames.has(depNode)) {
        errors.push(
          `Node "${node.name}" references unknown dependency "${depNode}"`
        );
      }
    }
  }

  if (errors.length === 0) {
    const cycleError = detectCycle(desc);
    if (cycleError) {
      errors.push(cycleError);
    }
  }

  return { valid: errors.length === 0, errors };
}

function detectCycle(desc: GraphDescriptor): string | null {
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  inDegree.set(desc.root, 0);
  adjList.set(desc.root, []);

  for (const node of desc.nodes) {
    inDegree.set(node.name, 0);
    adjList.set(node.name, []);
  }

  for (const node of desc.nodes) {
    for (const depPath of node.input) {
      const dep = depPath.split(".")[0]!;
      adjList.get(dep)!.push(node.name);
      inDegree.set(node.name, inDegree.get(node.name)! + 1);
    }
  }

  const queue: string[] = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) queue.push(name);
  }

  let processed = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    processed++;
    for (const next of adjList.get(current)!) {
      const newDegree = inDegree.get(next)! - 1;
      inDegree.set(next, newDegree);
      if (newDegree === 0) queue.push(next);
    }
  }

  if (processed !== desc.nodes.length + 1) {
    return "Graph contains a cycle";
  }
  return null;
}

/**
 * Calculate graph complexity.
 * @param desc Graph descriptor
 * @returns Complexity score (node count + edge count)
 */
export function graphComplexity(desc: GraphDescriptor): number {
  const edgeCount = desc.nodes.reduce(
    (sum, node) => sum + node.input.length,
    0
  );
  return desc.nodes.length + edgeCount;
}

/**
 * Type of change in graph diff.
 */
export type GraphDiffKind =
  | "root_changed"
  | "node_added"
  | "node_removed"
  | "node_type_changed"
  | "node_init_changed"
  | "node_input_changed";

/**
 * Single difference between two graph descriptors.
 */
export interface GraphDiff {
  kind: GraphDiffKind;
  node?: string;
  before?: any;
  after?: any;
}

/**
 * Compare two graph descriptors and return differences.
 * @param before Previous graph state
 * @param after Current graph state
 */
export function diffGraphs(
  before: GraphDescriptor,
  after: GraphDescriptor
): GraphDiff[] {
  const diffs: GraphDiff[] = [];

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

    const beforeInputs = beforeNode.input.slice().sort().join(",");
    const afterInputs = afterNode.input.slice().sort().join(",");
    if (beforeInputs !== afterInputs) {
      diffs.push({
        kind: "node_input_changed",
        node: name,
        before: beforeNode.input,
        after: afterNode.input,
      });
    }
  }

  return diffs;
}
