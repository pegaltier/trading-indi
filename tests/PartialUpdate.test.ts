import { describe, expect, it } from "vitest";
import { GraphExec } from "../src/flow/graph-exec";
import { SMA } from "../src/primitive/core-ops/rolling.js";

describe("Partial Update Handling", () => {
  it("should handle nodes that only emit on the 3rd update", () => {
    const g = new GraphExec("tick");

    class ThirdUpdateNode {
      private count = 0;

      update(value: number): number | undefined {
        this.count++;
        if (this.count === 3) {
          return value * 2;
        }
        return undefined;
      }
    }

    const multiplierNode = {
      update: (value: number) => value + 10,
    };

    g.add("third", new ThirdUpdateNode())
      .depends("tick")
      .add("result", multiplierNode)
      .depends("third");

    const out1 = g.update(100);
    const out2 = g.update(200);
    const out3 = g.update(300);

    // First update: third node produces undefined, result node should not execute
    expect(out1.tick).toBe(100);
    expect(out1.third).toBeUndefined();
    expect(out1.result).toBeUndefined();

    // Second update: third node produces undefined, result node should not execute
    expect(out2.tick).toBe(200);
    expect(out2.third).toBeUndefined();
    expect(out2.result).toBeUndefined();

    // Third update: third node produces 600 (300 * 2), result node produces 610 (600 + 10)
    expect(out3.tick).toBe(300);
    expect(out3.third).toBe(600);
    expect(out3.result).toBe(610);
  });

  it("should handle SMA with period 3 that only produces output after enough data", () => {
    const g = new GraphExec("tick");

    g.add("sma", new SMA({ period: 3 }))
      .depends("tick")
      .add("adjusted", { update: (value: number) => value + 5 })
      .depends("sma");

    const out1 = g.update(100);
    const out2 = g.update(200);
    const out3 = g.update(300);
    const out4 = g.update(400);

    // First update: SMA produces the value itself (100)
    expect(out1.tick).toBe(100);
    expect(out1.sma).toBeCloseTo(100);
    expect(out1.adjusted).toBeCloseTo(105);

    // Second update: SMA produces average of (100+200)/2 = 150
    expect(out2.tick).toBe(200);
    expect(out2.sma).toBeCloseTo(150);
    expect(out2.adjusted).toBeCloseTo(155);

    // Third update: Now we have enough data for SMA (100+200+300)/3 = 200
    expect(out3.tick).toBe(300);
    expect(out3.sma).toBeCloseTo(200);
    expect(out3.adjusted).toBeCloseTo(205);

    // Fourth update: SMA of (200+300+400)/3 = 300
    expect(out4.tick).toBe(400);
    expect(out4.sma).toBeCloseTo(300);
    expect(out4.adjusted).toBeCloseTo(305);
  });

  it("should handle complex graph with mixed nodes that produce output at different times", () => {
    const g = new GraphExec("tick");

    const alwaysNode = {
      update: (value: number) => value + 1,
    };

    class SecondUpdateNode {
      private count = 0;
      update(value: number): number | undefined {
        this.count++;
        return this.count >= 2 ? value * 2 : undefined;
      }
    }

    class ThirdUpdateNode {
      private count = 0;
      update(value: number): number | undefined {
        this.count++;
        return this.count >= 3 ? value * 3 : undefined;
      }
    }

    const combinerNode = {
      update: (always: number, second?: number, third?: number) => ({
        always,
        second,
        third,
        sum: always + (second || 0) + (third || 0),
      }),
    };

    g.add("always", alwaysNode)
      .depends("tick")
      .add("second", new SecondUpdateNode())
      .depends("tick")
      .add("third", new ThirdUpdateNode())
      .depends("tick")
      .add("combined", combinerNode)
      .depends("always", "second", "third");

    const out1 = g.update(10);
    const out2 = g.update(20);
    const out3 = g.update(30);

    // First update: only always node produces output
    expect(out1.tick).toBe(10);
    expect(out1.always).toBe(11);
    expect(out1.second).toBeUndefined();
    expect(out1.third).toBeUndefined();
    expect(out1.combined).toBeUndefined();

    // Second update: always and second nodes produce output
    expect(out2.tick).toBe(20);
    expect(out2.always).toBe(21);
    expect(out2.second).toBe(40);
    expect(out2.third).toBeUndefined();
    expect(out2.combined).toBeUndefined();

    // Third update: all nodes produce output
    expect(out3.tick).toBe(30);
    expect(out3.always).toBe(31);
    expect(out3.second).toBe(60);
    expect(out3.third).toBe(90);
    expect(out3.combined).toEqual({
      always: 31,
      second: 60,
      third: 90,
      sum: 181,
    });
  });
});
