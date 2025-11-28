/**
 * Agentic GraphSchema Generation and Refinement
 *
 * Tools for AI-assisted creation and iterative refinement of trading indicator computation graphs.
 */

export {
  generateGraphSchemaPrompt,
  parseGraphSchemaResponse,
  generateGraphSchema,
} from "./prompt.js";

// V2: Whole graph replacement (recommended)
export type {
  FeedbackLoopState,
  FeedbackIteration,
  FeedbackReason,
  EvaluationResult,
  TestCaseResult,
  FlowGraphDiffSummary,
  ImpactAnalysis,
  StructuralChange,
  StructuralIssue,
} from "./feedback-v2.js";

export {
  initFeedbackLoop,
  applyFeedback,
  evaluateSchema,
  computeEnhancedDiff,
  analyzeGraphStructure,
  generateFeedbackPrompt,
  undoLastIteration,
  getLoopStatistics,
} from "./feedback-v2.js";
