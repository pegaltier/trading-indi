import { describe, it, expect } from "vitest";
import { OHLCV, useOHLCV, type OHLCVTick } from "../src/aggregation/OHLCV";

describe("OHLCV", () => {
  it("should return undefined on first tick", () => {
    const ohlcv = new OHLCV({ intervalMs: 1000 });
    const tick: OHLCVTick = { timestamp: 1000, price: 100, volume: 10 };

    const result = ohlcv.onData(tick);

    expect(result).toBeUndefined();
  });

  it("should return undefined within same interval", () => {
    const ohlcv = new OHLCV({ intervalMs: 1000 });

    ohlcv.onData({ timestamp: 1000, price: 100, volume: 10 });
    ohlcv.onData({ timestamp: 1200, price: 110, volume: 20 });
    const result = ohlcv.onData({ timestamp: 1500, price: 90, volume: 30 });

    expect(result).toBeUndefined();
  });

  it("should return completed bar on interval boundary", () => {
    const ohlcv = new OHLCV({ intervalMs: 1000 });

    ohlcv.onData({ timestamp: 1000, price: 100, volume: 10 });
    ohlcv.onData({ timestamp: 1500, price: 110, volume: 20 });
    const result = ohlcv.onData({ timestamp: 2000, price: 120, volume: 30 });

    expect(result).toEqual({
      timestamp: 1000,
      open: 100,
      high: 110,
      low: 100,
      close: 110,
      volume: 30,
      turnover: 100 * 10 + 110 * 20,
    });
  });

  it("should handle multiple intervals", () => {
    const ohlcv = new OHLCV({ intervalMs: 1000 });
    const results = [];

    results.push(ohlcv.onData({ timestamp: 1000, price: 100, volume: 10 }));
    results.push(ohlcv.onData({ timestamp: 1500, price: 110, volume: 20 }));
    results.push(ohlcv.onData({ timestamp: 2000, price: 120, volume: 30 }));
    results.push(ohlcv.onData({ timestamp: 2500, price: 130, volume: 40 }));
    results.push(ohlcv.onData({ timestamp: 3000, price: 140, volume: 50 }));

    expect(results[0]).toBeUndefined();
    expect(results[1]).toBeUndefined();
    expect(results[2]).toBeDefined();
    expect(results[2]!.timestamp).toBe(1000);
    expect(results[3]).toBeUndefined();
    expect(results[4]).toBeDefined();
    expect(results[4]!.timestamp).toBe(2000);
  });

  it("should track high and low correctly", () => {
    const ohlcv = new OHLCV({ intervalMs: 1000 });

    ohlcv.onData({ timestamp: 1000, price: 100, volume: 10 });
    ohlcv.onData({ timestamp: 1100, price: 120, volume: 10 });
    ohlcv.onData({ timestamp: 1200, price: 80, volume: 10 });
    ohlcv.onData({ timestamp: 1300, price: 110, volume: 10 });
    ohlcv.onData({ timestamp: 1400, price: 90, volume: 10 });
    const result = ohlcv.onData({ timestamp: 2000, price: 100, volume: 10 });

    expect(result).toBeDefined();
    expect(result!.high).toBe(120);
    expect(result!.low).toBe(80);
    expect(result!.close).toBe(90);
  });

  it("should accumulate volume correctly", () => {
    const ohlcv = new OHLCV({ intervalMs: 1000 });

    ohlcv.onData({ timestamp: 1000, price: 100, volume: 10 });
    ohlcv.onData({ timestamp: 1100, price: 100, volume: 20 });
    ohlcv.onData({ timestamp: 1200, price: 100, volume: 30 });
    ohlcv.onData({ timestamp: 1300, price: 100, volume: 40 });
    const result = ohlcv.onData({ timestamp: 2000, price: 100, volume: 10 });

    expect(result).toBeDefined();
    expect(result!.volume).toBe(100);
  });

  it("should handle larger time intervals", () => {
    const ohlcv = new OHLCV({ intervalMs: 60000 });

    const r1 = ohlcv.onData({ timestamp: 60000, price: 100, volume: 10 });
    expect(r1).toBeUndefined();

    const r2 = ohlcv.onData({ timestamp: 120000, price: 110, volume: 20 });
    expect(r2).toBeDefined();
    expect(r2!.timestamp).toBe(60000);
  });

  it("should reset state correctly", () => {
    const ohlcv = new OHLCV({ intervalMs: 1000 });

    ohlcv.onData({ timestamp: 1000, price: 100, volume: 10 });
    ohlcv.reset();

    const result = ohlcv.onData({ timestamp: 2000, price: 200, volume: 20 });
    expect(result).toBeUndefined();
  });
});

describe("useOHLCV", () => {
  it("should work as functional closure", () => {
    const ohlcvFn = useOHLCV({ intervalMs: 1000 });

    const r1 = ohlcvFn({ timestamp: 1000, price: 100, volume: 10 });
    expect(r1).toBeUndefined();

    const r2 = ohlcvFn({ timestamp: 1500, price: 110, volume: 20 });
    expect(r2).toBeUndefined();

    const r3 = ohlcvFn({ timestamp: 2000, price: 120, volume: 30 });
    expect(r3).toBeDefined();
    expect(r3!.timestamp).toBe(1000);
  });

  it("should maintain state between calls", () => {
    const ohlcvFn = useOHLCV({ intervalMs: 1000 });

    ohlcvFn({ timestamp: 1000, price: 100, volume: 10 });
    ohlcvFn({ timestamp: 1200, price: 120, volume: 20 });
    ohlcvFn({ timestamp: 1400, price: 80, volume: 30 });
    const result = ohlcvFn({ timestamp: 2000, price: 100, volume: 10 });

    expect(result).toBeDefined();
    expect(result!.high).toBe(120);
    expect(result!.low).toBe(80);
    expect(result!.volume).toBe(60);
  });
});
