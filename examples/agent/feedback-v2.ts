import type { OpRegistry } from "../../src/flow/Registry.js";
import type { GraphSchema } from "../../src/flow/Schema.js";
import {
  validateGraphSchema,
  formatValidationError,
  graphDiff,
  type GraphDiff,
} from "../../src/flow/Schema.js";
import { Graph } from "../../src/flow/Graph.js";

/**
 * Feedback loop using whole graph replacement.
 * Agent generates complete GraphSchema, not fine-grained actions.
 */

/**
 * Why the current schema needs replacement.
 */
export type FeedbackReason =
  | { type: "initial"; prompt: string }
  | { type: "validation_failed"; errors: string[] }
  | { type: "eval_failed"; metrics: any; failedTests: TestCaseResult[] }
  | { type: "user_request"; prompt: string }
  | { type: "optimization"; metrics: any; target?: string }
  | { type: "structural_issue"; issues: StructuralIssue[] };

/**
 * Structural issues detected in the graph.
 */
export interface StructuralIssue {
  severity: "warning" | "error" | "info";
  category: "redundancy" | "bottleneck" | "missing" | "complexity" | "other";
  description: string;
  affectedNodes?: string[];
  suggestion?: string;
}

/**
 * Single iteration in feedback loop.
 */
export interface FeedbackIteration {
  reason: FeedbackReason;
  schema: GraphSchema;
  diff?: GraphDiffSummary; // Computed from previous iteration
  evalResult?: EvaluationResult;
  timestamp: number;
}

/**
 * Enhanced diff summary with impact analysis.
 */
export interface GraphDiffSummary {
  changes: GraphDiff[];
  summary: string; // Human/agent-readable summary
  impactAnalysis: ImpactAnalysis;
  structuralChanges: StructuralChange[];
}

/**
 * Impact analysis of changes.
 */
export interface ImpactAnalysis {
  nodesAdded: number;
  nodesRemoved: number;
  nodesModified: number;
  affectedDownstream: string[]; // Nodes whose inputs changed
  criticalChanges: boolean; // Root or output nodes changed
}

/**
 * High-level structural changes.
 */
export interface StructuralChange {
  type:
    | "dataflow_rewired"
    | "operator_substitution"
    | "complexity_increased"
    | "complexity_decreased"
    | "output_changed";
  description: string;
  nodes: string[];
}

/**
 * Test case result.
 */
export interface TestCaseResult {
  name: string;
  passed: boolean;
  expected?: any;
  actual?: any;
  error?: string;
}

/**
 * Evaluation result with flexible metrics.
 */
export interface EvaluationResult {
  passed: boolean;
  testCases: TestCaseResult[];
  metrics?: any; // Any JSON-serializable metrics for agent
}

/**
 * Feedback loop state.
 */
export interface FeedbackLoopState {
  initialSchema: GraphSchema; // Schema at initialization (for undo to beginning)
  currentSchema: GraphSchema;
  history: FeedbackIteration[];
  registry: OpRegistry;
}

/**
 * Initialize feedback loop with initial schema.
 */
export function initFeedbackLoop(
  initialSchema: GraphSchema,
  registry: OpRegistry
): FeedbackLoopState {
  return {
    initialSchema,
    currentSchema: initialSchema,
    history: [],
    registry,
  };
}

/**
 * Apply new schema to feedback loop.
 * Validates, computes diff, and updates state.
 */
export function applyFeedback(
  state: FeedbackLoopState,
  reason: FeedbackReason,
  newSchema: GraphSchema
): {
  success: boolean;
  state?: FeedbackLoopState;
  errors?: string[];
} {
  // Validate new schema
  const validation = validateGraphSchema(newSchema, state.registry);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors.map(formatValidationError),
    };
  }

  // Compute diff from current schema
  const diff = computeEnhancedDiff(state.currentSchema, newSchema);

  // Create iteration record
  const iteration: FeedbackIteration = {
    reason,
    schema: newSchema,
    diff,
    timestamp: Date.now(),
  };

  return {
    success: true,
    state: {
      ...state,
      currentSchema: newSchema,
      history: [...state.history, iteration],
    },
  };
}

/**
 * Evaluate current schema against test data.
 */
export async function evaluateSchema(
  state: FeedbackLoopState,
  testData: Array<{ input: any; expected: any; name?: string }>,
  outputNodeName: string
): Promise<{
  state: FeedbackLoopState;
  result: EvaluationResult;
}> {
  const graph = Graph.fromJSON(state.currentSchema, state.registry);
  const testCases: TestCaseResult[] = [];
  let passCount = 0;

  for (let i = 0; i < testData.length; i++) {
    const testCase = testData[i]!;
    const name = testCase.name ?? `Test ${i + 1}`;

    try {
      const output = graph.update(testCase.input);
      const actual = output[outputNodeName];
      const passed = compareValues(actual, testCase.expected);

      testCases.push({
        name,
        passed,
        expected: testCase.expected,
        actual,
      });

      if (passed) passCount++;
    } catch (error) {
      testCases.push({
        name,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const evalResult: EvaluationResult = {
    passed: passCount === testData.length,
    testCases,
    metrics: {
      accuracy: testData.length > 0 ? passCount / testData.length : 0,
      passedCount: passCount,
      totalCount: testData.length,
    },
  };

  // Update latest iteration with eval result
  const updatedHistory = [...state.history];
  if (updatedHistory.length > 0) {
    updatedHistory[updatedHistory.length - 1] = {
      ...updatedHistory[updatedHistory.length - 1]!,
      evalResult,
    };
  }

  return {
    state: { ...state, history: updatedHistory },
    result: evalResult,
  };
}

/**
 * Compute enhanced diff with impact analysis.
 */
export function computeEnhancedDiff(
  before: GraphSchema,
  after: GraphSchema
): GraphDiffSummary {
  const changes = graphDiff(before, after);

  // Analyze impact
  const nodesAdded = changes.filter((c) => c.kind === "node_added").length;
  const nodesRemoved = changes.filter((c) => c.kind === "node_removed").length;
  const nodesModified =
    changes.filter(
      (c) =>
        c.kind === "node_type_changed" ||
        c.kind === "node_init_changed" ||
        c.kind === "node_input_changed"
    ).length / 2; // Approximate, nodes can have multiple changes

  // Find affected downstream nodes
  const modifiedNodes = new Set<string>();
  changes.forEach((c) => {
    if (c.node) modifiedNodes.add(c.node);
  });

  const affectedDownstream = after.nodes
    .filter((n) => {
      const inputs = n.inputSrc
        ? Array.isArray(n.inputSrc)
          ? n.inputSrc
          : [n.inputSrc]
        : [];
      return inputs.some((path) => {
        const refNode = path.split(".")[0];
        return modifiedNodes.has(refNode!);
      });
    })
    .map((n) => n.name)
    .filter((name) => !modifiedNodes.has(name)); // Exclude already modified

  const criticalChanges = changes.some((c) => c.kind === "root_changed");

  const impactAnalysis: ImpactAnalysis = {
    nodesAdded,
    nodesRemoved,
    nodesModified,
    affectedDownstream,
    criticalChanges,
  };

  // Detect structural changes
  const structuralChanges = detectStructuralChanges(changes, before, after);

  // Generate summary
  const summary = generateDiffSummary(changes, impactAnalysis);

  return {
    changes,
    summary,
    impactAnalysis,
    structuralChanges,
  };
}

/**
 * Detect high-level structural changes.
 */
function detectStructuralChanges(
  changes: GraphDiff[],
  before: GraphSchema,
  after: GraphSchema
): StructuralChange[] {
  const structural: StructuralChange[] = [];

  // Check for dataflow rewiring (input changes)
  const rewiredNodes = changes
    .filter((c) => c.kind === "node_input_changed")
    .map((c) => c.node!);

  if (rewiredNodes.length > 0) {
    structural.push({
      type: "dataflow_rewired",
      description: `Dataflow connections rewired for ${rewiredNodes.length} node(s)`,
      nodes: rewiredNodes,
    });
  }

  // Check for operator substitution
  const substitutedNodes = changes
    .filter((c) => c.kind === "node_type_changed")
    .map((c) => c.node!);

  if (substitutedNodes.length > 0) {
    structural.push({
      type: "operator_substitution",
      description: `Operator types changed for ${substitutedNodes.length} node(s)`,
      nodes: substitutedNodes,
    });
  }

  // Check for complexity changes
  const complexityBefore = before.nodes.length;
  const complexityAfter = after.nodes.length;

  if (complexityAfter > complexityBefore * 1.2) {
    structural.push({
      type: "complexity_increased",
      description: `Graph complexity increased: ${complexityBefore} → ${complexityAfter} nodes`,
      nodes: [],
    });
  } else if (complexityAfter < complexityBefore * 0.8) {
    structural.push({
      type: "complexity_decreased",
      description: `Graph complexity decreased: ${complexityBefore} → ${complexityAfter} nodes`,
      nodes: [],
    });
  }

  return structural;
}

/**
 * Generate human/agent-readable diff summary.
 */
function generateDiffSummary(
  _changes: GraphDiff[],
  impact: ImpactAnalysis
): string {
  const parts: string[] = [];

  if (impact.nodesAdded > 0) {
    parts.push(`Added ${impact.nodesAdded} node(s)`);
  }
  if (impact.nodesRemoved > 0) {
    parts.push(`Removed ${impact.nodesRemoved} node(s)`);
  }
  if (impact.nodesModified > 0) {
    parts.push(`Modified ${impact.nodesModified} node(s)`);
  }
  if (impact.affectedDownstream.length > 0) {
    parts.push(
      `Affected ${impact.affectedDownstream.length} downstream node(s)`
    );
  }

  if (parts.length === 0) {
    return "No changes";
  }

  return parts.join(", ");
}

/**
 * Generate feedback prompt for agent based on evaluation result.
 */
export function generateFeedbackPrompt(
  state: FeedbackLoopState,
  evalResult: EvaluationResult,
  reason?: FeedbackReason
): string {
  const failedTests = evalResult.testCases.filter((tc) => !tc.passed);

  if (failedTests.length === 0 && evalResult.passed) {
    return "All tests passed! The graph is working correctly.";
  }

  let prompt = "";

  // Add context from reason
  if (reason) {
    prompt += formatReason(reason) + "\n\n";
  }

  prompt += `Evaluation Results:\n`;
  prompt += `- Passed: ${evalResult.testCases.length - failedTests.length}/${
    evalResult.testCases.length
  } tests\n`;

  if (evalResult.metrics) {
    prompt += `- Metrics: ${JSON.stringify(evalResult.metrics, null, 2)}\n`;
  }

  prompt += "\nCurrent Graph:\n";
  prompt += JSON.stringify(state.currentSchema, null, 2) + "\n\n";

  if (failedTests.length > 0) {
    prompt += "Failed Test Cases:\n";
    for (const tc of failedTests.slice(0, 5)) {
      prompt += `- ${tc.name}:\n`;
      if (tc.error) {
        prompt += `  Error: ${tc.error}\n`;
      } else {
        prompt += `  Expected: ${JSON.stringify(tc.expected)}\n`;
        prompt += `  Actual: ${JSON.stringify(tc.actual)}\n`;
      }
    }
  }

  // Add diff from last iteration if available
  const lastIter = state.history[state.history.length - 1];
  if (lastIter?.diff) {
    prompt += `\nRecent Changes: ${lastIter.diff.summary}\n`;
    if (lastIter.diff.structuralChanges.length > 0) {
      prompt += "Structural Changes:\n";
      for (const sc of lastIter.diff.structuralChanges) {
        prompt += `- ${sc.description}\n`;
      }
    }
  }

  prompt += "\nPlease provide an updated GraphSchema to fix these issues.\n";

  return prompt;
}

/**
 * Format feedback reason for prompt.
 */
function formatReason(reason: FeedbackReason): string {
  switch (reason.type) {
    case "initial":
      return `Initial Request: ${reason.prompt}`;
    case "validation_failed":
      return `Validation Failed:\n${reason.errors.join("\n")}`;
    case "eval_failed":
      return `Evaluation Failed (${reason.failedTests.length} test(s))`;
    case "user_request":
      return `User Request: ${reason.prompt}`;
    case "optimization":
      return `Optimization Target: ${reason.target ?? "improve metrics"}`;
    case "structural_issue":
      return `Structural Issues Detected:\n${reason.issues
        .map((i) => `- ${i.description}`)
        .join("\n")}`;
  }
}

/**
 * Undo last iteration, reverting to previous schema.
 */
export function undoLastIteration(
  state: FeedbackLoopState
): FeedbackLoopState | null {
  if (state.history.length === 0) return null;

  const previousHistory = state.history.slice(0, -1);
  const previousSchema =
    previousHistory.length > 0
      ? previousHistory[previousHistory.length - 1]!.schema
      : state.initialSchema; // Revert to initial schema

  return {
    ...state,
    currentSchema: previousSchema,
    history: previousHistory,
  };
}

/**
 * Get loop statistics.
 */
export function getLoopStatistics(state: FeedbackLoopState): {
  iterations: number;
  lastAccuracy?: number;
  lastMetrics?: any;
  improvementTrend?: number;
  structuralComplexity: number;
} {
  const iterations = state.history.length;

  const lastIteration = state.history[state.history.length - 1];
  const lastAccuracy = lastIteration?.evalResult?.metrics?.accuracy;
  const lastMetrics = lastIteration?.evalResult?.metrics;

  // Calculate improvement trend
  let improvementTrend: number | undefined;
  if (state.history.length >= 2) {
    const prev =
      state.history[state.history.length - 2]!.evalResult?.metrics?.accuracy;
    const curr = lastAccuracy;
    if (prev !== undefined && curr !== undefined) {
      improvementTrend = curr - prev;
    }
  }

  return {
    iterations,
    ...(lastAccuracy !== undefined && { lastAccuracy }),
    ...(lastMetrics !== undefined && { lastMetrics }),
    ...(improvementTrend !== undefined && { improvementTrend }),
    structuralComplexity: state.currentSchema.nodes.length,
  };
}

/**
 * Analyze graph for structural issues.
 */
export function analyzeGraphStructure(
  schema: GraphSchema,
  _registry: OpRegistry
): StructuralIssue[] {
  const issues: StructuralIssue[] = [];

  // Check complexity
  if (schema.nodes.length > 50) {
    issues.push({
      severity: "warning",
      category: "complexity",
      description: `Graph has ${schema.nodes.length} nodes, consider simplification`,
    });
  }

  // Check for potential redundancy (same type + init)
  const nodeSignatures = new Map<string, string[]>();
  for (const node of schema.nodes) {
    const sig = `${node.type}:${JSON.stringify(node.init)}`;
    if (!nodeSignatures.has(sig)) {
      nodeSignatures.set(sig, []);
    }
    nodeSignatures.get(sig)!.push(node.name);
  }

  for (const [_sig, nodes] of nodeSignatures) {
    if (nodes.length > 1) {
      issues.push({
        severity: "info",
        category: "redundancy",
        description: `Potentially redundant nodes with same type/config`,
        affectedNodes: nodes,
        suggestion: "Consider reusing computation if nodes have same inputs",
      });
    }
  }

  // Check for isolated nodes (no inputs except root)
  const nodesWithInputs = new Set<string>();
  for (const node of schema.nodes) {
    const inputs = node.inputSrc
      ? Array.isArray(node.inputSrc)
        ? node.inputSrc
        : [node.inputSrc]
      : [];
    for (const input of inputs) {
      const refNode = input.split(".")[0];
      if (refNode && refNode !== schema.root) {
        nodesWithInputs.add(node.name);
      }
    }
  }

  const isolatedNodes = schema.nodes.filter(
    (n) => !nodesWithInputs.has(n.name)
  );
  if (isolatedNodes.length > schema.nodes.length * 0.3) {
    issues.push({
      severity: "warning",
      category: "other",
      description: `Many isolated nodes (${isolatedNodes.length}/${schema.nodes.length})`,
      affectedNodes: isolatedNodes.map((n) => n.name),
    });
  }

  return issues;
}

/**
 * Compare two values for equality.
 */
function compareValues(actual: any, expected: any, tolerance = 1e-10): boolean {
  if (typeof actual === "number" && typeof expected === "number") {
    return Math.abs(actual - expected) < tolerance;
  }
  return JSON.stringify(actual) === JSON.stringify(expected);
}
