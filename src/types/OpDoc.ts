/**
 * AI agent friendly operator doc context
 */
export interface OperatorDoc {
  type: string; // Registry key
  desc: string; // What it computes
  init?: string; // Constructor parameters
  onDataParam: string; // onData's parameters
  output: string; // What it produces
}
