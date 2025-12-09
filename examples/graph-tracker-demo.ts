import { GraphExec } from "../src/flow/graph-exec.js";
import { GraphTracker } from "../src/flow/graph-tracker.js";
import { EMA } from "../src/primitive/core-ops/rolling.js";

// Create a simple graph with EMA
const graph = new GraphExec("tick");
graph.add("ema", new EMA({ period: 3 })).depends("tick");

// Wrap with tracker
const tracker = new GraphTracker(graph);

console.log("=== GraphTracker Demo ===\n");

// Simulate some price data
const prices = [100, 110, 105, 115, 120, 125];

prices.forEach((price, index) => {
  const result = tracker.update(price);

  console.log(`Update ${index + 1}:`);
  console.log(
    `  Original state: tick=${
      result.state.tick
    }, ema=${result.state.ema.toFixed(2)}`
  );

  if (result.tracked.tick && result.tracked.ema) {
    console.log(`  Tracked state:`);
    console.log(
      `    tick: mean=${result.tracked.tick.mean.toFixed(
        2
      )}, variance=${result.tracked.tick.variance.toFixed(2)}`
    );
    console.log(
      `    ema: mean=${result.tracked.ema.mean.toFixed(
        2
      )}, variance=${result.tracked.ema.variance.toFixed(2)}`
    );
  }
  console.log("");
});

// Demonstrate nested object tracking
console.log("=== Nested Object Example ===\n");

const nestedGraph = new GraphExec("data");
nestedGraph.add("price_ema", new EMA({ period: 2 })).depends("data.price");
nestedGraph.add("volume_ema", new EMA({ period: 2 })).depends("data.volume");
const nestedTracker = new GraphTracker(nestedGraph);

const marketData = [
  { price: 50, volume: 1000, symbol: "AAPL" },
  { price: 52, volume: 1200, symbol: "AAPL" },
  { price: 48, volume: 800, symbol: "AAPL" },
];

marketData.forEach((data, index) => {
  const result = nestedTracker.update(data);

  console.log(`Market Update ${index + 1}:`);
  console.log(
    `  Original: price=${result.state.data.price}, volume=${result.state.data.volume}, symbol="${result.state.data.symbol}"`
  );
  console.log(`  EMA: ${result.state.price_ema.toFixed(2)}`);

  console.log(`  Tracked:`);
  if (result.tracked.data.price) {
    console.log(
      `    data.price: mean=${result.tracked.data.price.mean.toFixed(
        2
      )}, variance=${result.tracked.data.price.variance.toFixed(2)}`
    );
  }
  if (result.tracked.data.volume) {
    console.log(
      `    data.volume: mean=${result.tracked.data.volume.mean.toFixed(
        2
      )}, variance=${result.tracked.data.volume.variance.toFixed(2)}`
    );
  }
  if (result.tracked.data.symbol === undefined) {
    console.log(`    data.symbol: undefined (not tracked - non-numeric)`);
  }
  if (result.tracked.price_ema) {
    console.log(
      `    price_ema: mean=${result.tracked.price_ema.mean.toFixed(
        2
      )}, variance=${result.tracked.price_ema.variance.toFixed(2)}`
    );
  }
  console.log("");
});

console.log("=== Final Tracked State ===");
const finalState = nestedTracker.getTrackedState();
console.log(JSON.stringify(finalState, null, 2));
