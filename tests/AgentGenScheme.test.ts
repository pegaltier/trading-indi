import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { regCoreOps } from "../src/flow/RegistryUtils.js";

import {
  Graph,
  OpRegistry,
  type GraphSchema,
  validateGraphSchema,
  graphComplexity,
} from "../src/flow/index.js";

describe("Agent Generated Schema", () => {
  it("should load and validate AgentGenScheme.json", () => {
    const schemaPath = join(__dirname, "AgentGenScheme.json");
    const schemaJson = readFileSync(schemaPath, "utf-8");
    const schema: GraphSchema = JSON.parse(schemaJson);

    const registry = new OpRegistry();
    regCoreOps(registry);

    const result = validateGraphSchema(schema, registry);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);

    expect(graphComplexity(schema)).greaterThan(0);
  });

  it("should build graph from AgentGenScheme.json without errors", async () => {
    const schemaPath = join(__dirname, "AgentGenScheme.json");
    const schemaJson = readFileSync(schemaPath, "utf-8");
    const schema: GraphSchema = JSON.parse(schemaJson);

    const registry = new OpRegistry();
    regCoreOps(registry);

    // This should not throw the TypeError about node.updateSource not being iterable
    const graph = Graph.fromJSON(schema, registry);

    // Add listeners to track node execution
    const executedNodes: string[] = [];
    const nodeResults: Record<string, any> = {};
    const skippedNodes: string[] = [];

    // Add listeners for all nodes in the schema
    for (const node of schema.nodes) {
      graph.on(node.name, (nodeName, result) => {
        executedNodes.push(nodeName);
        nodeResults[nodeName] = result;
        console.log(`Node ${nodeName} executed with result:`, result);
        if (result === undefined) {
          console.log(`WARNING: Node ${nodeName} returned undefined!`);
        }
      });
    }

    const outputs: any[] = [];
    graph.output((output) => {
      console.log("Graph output:", JSON.stringify(output, null, 2));
      console.log("Executed nodes:", executedNodes);

      // Check which nodes from the schema didn't execute
      const allNodeNames = schema.nodes.map((n) => n.name);
      const missingNodes = allNodeNames.filter(
        (name) => !executedNodes.includes(name)
      );
      if (missingNodes.length > 0) {
        console.log("Missing nodes:", missingNodes);

        // Debug specific missing nodes
        if (missingNodes.includes("trend_diff")) {
          console.log("DEBUG: trend_diff missing. Dependencies:");
          console.log("trend_fast result:", nodeResults["trend_fast"]);
          console.log("trend_slow result:", nodeResults["trend_slow"]);
        }
      }

      outputs.push(output);
    });

    // Execute the graph
    await graph.update({
      open: 100,
      high: 105,
      low: 95,
      close: 102,
      volume: 1000,
    });

    expect(outputs.length).toBe(1);

    // Verify Const nodes work correctly (they have missing/empty updateSource)
    expect(outputs[0].one).toBe(1.0);
    expect(outputs[0].hundred).toBe(100.0);
    expect(outputs[0].neg_hundred).toBe(-100.0);
    expect(outputs[0].fifty).toBe(50.0);
    expect(outputs[0].scale_factor).toBe(1000.0);

    // Verify nodes that are actually computed
    expect(outputs[0].returns).toBeDefined();
    expect(outputs[0].short_vol).toBeDefined();
    expect(outputs[0].long_vol).toBeDefined();
    expect(outputs[0].vol_ratio).toBeDefined();
    expect(outputs[0].vol_shift).toBeDefined();
    expect(outputs[0].vol_shift_abs).toBeDefined();
    expect(outputs[0].vol_shift_sign).toBeDefined();
    expect(outputs[0].my_signal).toBeDefined();
  });

  it("should validate graph structure is acyclic", () => {
    const schemaPath = join(__dirname, "AgentGenScheme.json");
    const schemaJson = readFileSync(schemaPath, "utf-8");
    const schema: GraphSchema = JSON.parse(schemaJson);

    const registry = new OpRegistry();
    regCoreOps(registry);

    const graph = Graph.fromJSON(schema, registry);
    const validationResult = graph.validate();

    expect(validationResult.valid).toBe(true);
    expect(validationResult.errors).toHaveLength(0);
  });
});
