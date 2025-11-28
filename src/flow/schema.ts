import { z } from "zod";
import type { FlowTopoError } from "./validate-topo.js";

/**
 * Zod schema for operator node validation.
 */
export const FlowNodeSchema = z.object({
  name: z.string().min(1, "Node name must be non-empty"),
  type: z.string().min(1, "Node type must be non-empty"),
  init: z.unknown().optional(),
  inputSrc: z.union([z.array(z.string()), z.string()]).optional(),
});

/**
 * Operator node schema for JSON serialization.
 */
export type FlowNode = z.infer<typeof FlowNodeSchema>;

/**
 * Zod schema for graph validation.
 */
export const FlowGraphSchema = z.object({
  root: z.string().min(1, "Root node name must be non-empty"),
  nodes: z.array(FlowNodeSchema),
});

/**
 * GraphExec schema for JSON serialization.
 */
export type FlowGraph = z.infer<typeof FlowGraphSchema>;

export const FlowGraphComplexitySchema = z.object({
  nodeCount: z.number().int().min(0),
  edgeCount: z.number().int().min(0),
  maxDepth: z.number().int().min(0),
});

export type FlowGraphComplexity = z.infer<typeof FlowGraphComplexitySchema>;

/**
 * Unified graph error types.
 */
export type FlowGraphError =
  | { type: "structure"; path: string; message: string }
  | { type: "unknown_type"; node: string; opType: string }
  | FlowTopoError;

/**
 * Result of graph validation.
 */
export interface FlowGraphValidationResult {
  valid: boolean;
  errors: FlowGraphError[];
}

/**
 * Type of change in graph diff.
 */
export type FlowGraphDiffKind =
  | "root_changed"
  | "node_added"
  | "node_removed"
  | "node_type_changed"
  | "node_init_changed"
  | "node_input_changed";

/**
 * Single difference between two graph descriptors.
 */
export interface FlowGraphDiff {
  kind: FlowGraphDiffKind;
  node?: string;
  before?: any;
  after?: any;
}
