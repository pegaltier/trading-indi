import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { OpRegistry } from "../src/flow/Registry.js";
import { Graph } from "../src/flow/Graph.js";
import {
  validateGraphSchema,
  GraphSchemaZod,
  formatValidationError,
} from "../src/flow/Schema.js";
import {
  regFoundation,
  regArithmeticPrimitive,
  regLogicalPrimitive,
} from "../src/flow/RegistryUtils.js";

// Load JSON file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const jsonPath = join(__dirname, "gen_prompt_agent_output.json");
const jsonContent = readFileSync(jsonPath, "utf-8");

// Parse and validate JSON structure with Zod
console.log("Parsing and validating JSON structure...");
const parseResult = GraphSchemaZod.safeParse(JSON.parse(jsonContent));

if (!parseResult.success) {
  console.error("❌ Schema structure validation failed:");
  console.error(parseResult.error.format());
  console.error("\nDetailed errors:");
  for (const issue of parseResult.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const graphSchema = parseResult.data;

console.log("✓ JSON structure validation passed");
console.log("Loaded graph schema:");
console.log(`  Root: ${graphSchema.root}`);
console.log(`  Nodes: ${graphSchema.nodes.length}`);
console.log();

// Create registry with operators
const registry = new OpRegistry();
regArithmeticPrimitive(registry);
regLogicalPrimitive(registry);
regFoundation(registry);

console.log("Validating business logic (registry, cycles, dependencies)...");
const schemaValidation = validateGraphSchema(graphSchema, registry);

if (!schemaValidation.valid) {
  console.error("❌ Business logic validation failed:");
  for (const error of schemaValidation.errors) {
    console.error(`  - ${formatValidationError(error)}`);
  }
  process.exit(1);
}

console.log("✓ Schema validation passed");
console.log();

// Construct graph from schema
console.log("Building graph from schema...");
const graph = Graph.fromJSON(graphSchema, registry);

// Validate graph structure
console.log("Validating graph structure...");
const graphValidation = graph.validate();

if (!graphValidation.valid) {
  console.error("Graph validation failed:");
  for (const error of graphValidation.errors) {
    if (error.type === "cycle") {
      console.error(`  - Cycle detected: ${error.nodes.join(" -> ")}`);
    } else if (error.type === "unreachable") {
      console.error(`  - Unreachable nodes: ${error.node.join(", ")}`);
    }
  }
  process.exit(1);
}

console.log("✓ Graph validation passed");
console.log();

// Example usage: run the graph with sample data
console.log("Running graph with sample data...");

const sampleTick = {
  open: 100,
  high: 105,
  low: 98,
  close: 103,
  volume: 10000,
};

graph.output((state) => {
  console.log("Graph output:", state);
});

// Execute with sample data
await graph.update(sampleTick);

console.log();
console.log("✓ Graph execution completed successfully");
