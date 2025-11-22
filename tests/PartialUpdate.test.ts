import { describe, expect, it } from "vitest";
import { Graph, makeOp } from "../src/flow/Graph.js";
import { SMA } from "../src/primitive/core-ops/rolling.js";

describe("Partial Update Handling", () => {
  it.concurrent(
    "should handle nodes that only emit on the 3rd update",
    async () => {
      const outputs: any[] = [];
      const g = new Graph("tick");

      // Create a custom node that only produces output on the 3rd update
      class ThirdUpdateNode {
        private count = 0;

        update(value: number): number | undefined {
          this.count++;
          // Only return a value on the 3rd update
          if (this.count === 3) {
            return value * 2;
          }
          return undefined;
        }
      }

      // Create a simple multiplier node that depends on the third update node
      const multiplierNode = {
        update: (value: number) => value + 10,
      };

      // Add nodes to the graph
      g.add("third", new ThirdUpdateNode())
        .depends("tick")
        .add("result", multiplierNode)
        .depends("third")
        .output((output) => {
          outputs.push(output);
        });

      // Execute with multiple data points
      await g.update(100);
      await g.update(200);
      await g.update(300);

      // Verify the behavior
      expect(outputs.length).toBe(3);

      // First update: third node produces undefined, result node should not execute
      expect(outputs[0].tick).toBe(100);
      expect(outputs[0].third).toBeUndefined();
      expect(outputs[0].result).toBeUndefined();

      // Second update: third node produces undefined, result node should not execute
      expect(outputs[1].tick).toBe(200);
      expect(outputs[1].third).toBeUndefined();
      expect(outputs[1].result).toBeUndefined();

      // Third update: third node produces 600 (300 * 2), result node produces 610 (600 + 10)
      expect(outputs[2].tick).toBe(300);
      expect(outputs[2].third).toBe(600);
      expect(outputs[2].result).toBe(610);
    }
  );

  it.concurrent(
    "should handle SMA with period 3 that only produces output after enough data",
    async () => {
      const outputs: any[] = [];
      const g = new Graph("tick");

      g.add("sma", new SMA({ period: 3 }))
        .depends("tick")
        .add("adjusted", { update: (value: number) => value + 5 })
        .depends("sma")
        .output((output) => {
          outputs.push(output);
        });

      // Execute with multiple data points
      await g.update(100);
      await g.update(200);
      await g.update(300);
      await g.update(400);

      // Verify the behavior
      expect(outputs.length).toBe(4);

      // First update: SMA produces the value itself (100)
      expect(outputs[0].tick).toBe(100);
      expect(outputs[0].sma).toBeCloseTo(100);
      expect(outputs[0].adjusted).toBeCloseTo(105);

      // Second update: SMA produces average of (100+200)/2 = 150
      expect(outputs[1].tick).toBe(200);
      expect(outputs[1].sma).toBeCloseTo(150);
      expect(outputs[1].adjusted).toBeCloseTo(155);

      // Third update: Now we have enough data for SMA (100+200+300)/3 = 200
      expect(outputs[2].tick).toBe(300);
      expect(outputs[2].sma).toBeCloseTo(200);
      expect(outputs[2].adjusted).toBeCloseTo(205);

      // Fourth update: SMA of (200+300+400)/3 = 300
      expect(outputs[3].tick).toBe(400);
      expect(outputs[3].sma).toBeCloseTo(300);
      expect(outputs[3].adjusted).toBeCloseTo(305);
    }
  );

  it.concurrent(
    "should handle complex graph with mixed nodes that produce output at different times",
    async () => {
      const outputs: any[] = [];
      const g = new Graph("tick");

      // Node that produces output on every update
      const alwaysNode = {
        update: (value: number) => value + 1,
      };

      // Node that only produces output on the 2nd update
      class SecondUpdateNode {
        private count = 0;
        update(value: number): number | undefined {
          this.count++;
          return this.count >= 2 ? value * 2 : undefined;
        }
      }

      // Node that only produces output on the 3rd update
      class ThirdUpdateNode {
        private count = 0;
        update(value: number): number | undefined {
          this.count++;
          return this.count >= 3 ? value * 3 : undefined;
        }
      }

      // Final node that combines results when available
      const combinerNode = {
        update: (always: number, second?: number, third?: number) => ({
          always,
          second,
          third,
          sum: always + (second || 0) + (third || 0),
        }),
      };

      // Build the graph
      g.add("always", alwaysNode)
        .depends("tick")
        .add("second", new SecondUpdateNode())
        .depends("tick")
        .add("third", new ThirdUpdateNode())
        .depends("tick")
        .add("combined", combinerNode)
        .depends("always", "second", "third")
        .output((output) => {
          outputs.push(output);
        });

      // Execute with multiple data points
      await g.update(10);
      await g.update(20);
      await g.update(30);

      // Verify the behavior
      expect(outputs.length).toBe(3);

      // First update: only always node produces output
      expect(outputs[0].tick).toBe(10);
      expect(outputs[0].always).toBe(11);
      expect(outputs[0].second).toBeUndefined();
      expect(outputs[0].third).toBeUndefined();
      // Combined node doesn't execute because second and third are undefined
      expect(outputs[0].combined).toBeUndefined();

      // Second update: always and second nodes produce output
      expect(outputs[1].tick).toBe(20);
      expect(outputs[1].always).toBe(21);
      expect(outputs[1].second).toBe(40);
      expect(outputs[1].third).toBeUndefined();
      // Combined node doesn't execute because third is still undefined
      expect(outputs[1].combined).toBeUndefined();

      // Third update: all nodes produce output
      expect(outputs[2].tick).toBe(30);
      expect(outputs[2].always).toBe(31);
      expect(outputs[2].second).toBe(60);
      expect(outputs[2].third).toBe(90);
      // Now combined node executes because all dependencies have values
      expect(outputs[2].combined).toEqual({
        always: 31,
        second: 60,
        third: 90,
        sum: 181,
      });
    }
  );

  it.concurrent(
    "should handle listeners for nodes that only emit on specific updates",
    async () => {
      const thirdUpdates: Array<{ name: string; result: any }> = [];
      const resultUpdates: Array<{ name: string; result: any }> = [];
      const g = new Graph("tick");

      // Node that only produces output on the 3rd update
      class ThirdUpdateNode {
        private count = 0;
        update(value: number): number | undefined {
          this.count++;
          return this.count === 3 ? value * 2 : undefined;
        }
      }

      // Set up listeners
      g.on("third", (nodeName, result) => {
        thirdUpdates.push({ name: nodeName, result });
      });

      g.on("result", (nodeName, result) => {
        resultUpdates.push({ name: nodeName, result });
      });

      // Add nodes
      g.add("third", new ThirdUpdateNode())
        .depends("tick")
        .add("result", { update: (value: number) => value + 10 })
        .depends("third");

      // Execute with multiple data points
      await g.update(100);
      await g.update(200);
      await g.update(300);

      // Verify that listeners only fire when nodes produce output
      expect(thirdUpdates.length).toBe(1);
      expect(thirdUpdates[0].name).toBe("third");
      expect(thirdUpdates[0].result).toBe(600);

      expect(resultUpdates.length).toBe(1);
      expect(resultUpdates[0].name).toBe("result");
      expect(resultUpdates[0].result).toBe(610);
    }
  );
});
