import type { OpRegistry } from "./Registry.js";
import type { GraphSchema } from "./Schema.js";
import {
  normalizeUpdateSource,
  validateGraphSchema,
  formatValidationError,
} from "./Schema.js";
import type { TopoError } from "./validate.js";
import { validateAdjList } from "./validate.js";
import { OpAdapter, type DagNode, type Op } from "./utils.js";

class NodeBuilder {
  constructor(private graph: Graph, private name: string, private op: Op) {}

  depends(...inputPaths: string[]): Graph {
    const node = new OpAdapter(this.op, inputPaths);
    return this.graph.addNode(this.name, node);
  }
}

export interface GraphValidationResult {
  valid: boolean;
  errors: TopoError[];
}

/**
 * DAG-based computation graph.
 * Nodes execute synchronously in topological order.
 */
export class Graph {
  private readonly rootNode: string;
  private readonly nodes: Map<string, DagNode> = new Map();
  private readonly predecessors: Map<string, string[]> = new Map();
  private readonly successors: Map<string, string[]> = new Map();

  /**
   * Create a new Graph with a root node.
   * @param rootNode Name of the root node that receives external data
   */
  constructor(rootNode: string) {
    this.rootNode = rootNode;
    this.predecessors.set(rootNode, []);
    this.successors.set(rootNode, []);
  }

  /** Construct a graph from JSON descriptor. */
  static fromJSON(schema: GraphSchema, registry: OpRegistry): Graph {
    const validationResult = validateGraphSchema(schema, registry);
    if (!validationResult.valid) {
      const errorMessages = validationResult.errors
        .map((err) => formatValidationError(err))
        .join("; ");
      throw new Error(`Invalid graph schema: ${errorMessages}`);
    }

    const graph = new Graph(schema.root);

    for (const nodeDesc of schema.nodes) {
      const ctor = registry.get(nodeDesc.type)!;
      const instance = new ctor(nodeDesc.init ?? {});
      const sources = normalizeUpdateSource(nodeDesc.updateSource);
      const node = new OpAdapter(instance, sources);
      graph.addNode(nodeDesc.name, node);
    }

    return graph;
  }

  /** Add a computation node to the graph. */
  add(name: string, node: DagNode): this;
  add(name: string, op: Op): NodeBuilder;
  add(name: string, nodeOrOp: unknown): this | NodeBuilder {
    if ((nodeOrOp as any).__isDagNode) {
      return this.addNode(name, nodeOrOp as DagNode);
    }
    return new NodeBuilder(this, name, nodeOrOp as Op);
  }

  /** @internal */
  addNode(name: string, node: DagNode): this {
    if (name === this.rootNode) {
      throw new Error(
        `Cannot add node with name '${name}': conflicts with root node`
      );
    }
    this.nodes.set(name, node);

    const preds: string[] = [];

    // Nodes with no inputs (e.g., Const) depend on root to trigger execution
    if (node.inputPath.length === 0) {
      preds.push(this.rootNode);
      if (!this.successors.has(this.rootNode)) {
        this.successors.set(this.rootNode, []);
      }
      const rootSuccs = this.successors.get(this.rootNode)!;
      if (!rootSuccs.includes(name)) {
        rootSuccs.push(name);
      }
    } else {
      for (const path of node.inputPath) {
        if (!path) continue;
        const predName = path.split(".")[0]!;
        if (!preds.includes(predName)) {
          preds.push(predName);
        }

        if (!this.successors.has(predName)) {
          this.successors.set(predName, []);
        }
        const succs = this.successors.get(predName)!;
        if (!succs.includes(name)) {
          succs.push(name);
        }
      }
    }

    this.predecessors.set(name, preds);
    if (!this.successors.has(name)) {
      this.successors.set(name, []);
    }

    return this;
  }

  /** Validate that the graph is acyclic (DAG) and all nodes are reachable. */
  validate(): GraphValidationResult {
    const errors = validateAdjList(this.rootNode, this.successors);
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /** Execute the graph with new input data. */
  update(data: any): Record<string, any> {
    let state: Record<string, any> = { [this.rootNode]: data };

    // Initialize topological sort
    const inDegree = new Map<string, number>();
    for (const [name, preds] of this.predecessors) {
      inDegree.set(name, preds.length);
    }

    // Pre-allocate exec queue
    const queue = new Array<string>(this.nodes.size);
    let readPtr = 0;
    let writePtr = 0;

    // Enqueue root successors
    const rootSuccessors = this.successors.get(this.rootNode);
    if (rootSuccessors) {
      for (const succ of rootSuccessors) {
        const newDegree = inDegree.get(succ)! - 1;
        inDegree.set(succ, newDegree);
        if (newDegree === 0) {
          queue[writePtr++] = succ;
        }
      }
    }

    // Execute nodes in topological order (synchronous, race-free)
    while (readPtr < writePtr) {
      const nodeName = queue[readPtr++]!;
      const node = this.nodes.get(nodeName)!;
      const result = node.predSatisfied(state);

      if (result === undefined) {
        continue;
      }

      state[nodeName] = result;

      // Enqueue successors
      const nodeSuccessors = this.successors.get(nodeName);
      if (nodeSuccessors) {
        for (const succ of nodeSuccessors) {
          const oldDegree = inDegree.get(succ)!;
          const newDegree = oldDegree - 1;
          inDegree.set(succ, newDegree);

          if (newDegree === 0) {
            queue[writePtr++] = succ;
          }
        }
      }
    }

    return state;
  }
}
