/**
 * Usage examples for window-based aggregation.
 */

import {
  OHLCV,
  TumblingWindow,
  CounterWindow,
  SessionWindow,
  OHLCVProcessor,
  StreamingAdapter,
} from "../src/aggregation/index.js";
import { CMA } from "@junduck/trading-core";

// Example 1: Convenience OHLCV class
export function example1_convenience() {
  const ohlcv = new OHLCV({ intervalMs: 60000 }); // 1-minute bars

  console.log(ohlcv.update(1000, 100, 10)); // undefined
  console.log(ohlcv.update(2000, 101, 20)); // undefined
  console.log(ohlcv.update(61000, 102, 30)); // OHLCVBar
}

// Example 2: Manual composition - time-based OHLCV
export function example2_manual_time() {
  const window = new TumblingWindow({ interval: 60000 });
  const processor = new OHLCVProcessor();

  const tick1 = { timestamp: 1000, price: 100, volume: 10 };
  const tick2 = { timestamp: 2000, price: 101, volume: 20 };
  const tick3 = { timestamp: 61000, price: 102, volume: 30 };

  console.log(
    processor.update(window.update(tick1.timestamp), tick1.price, tick1.volume)
  ); // undefined
  console.log(
    processor.update(window.update(tick2.timestamp), tick2.price, tick2.volume)
  ); // undefined
  console.log(
    processor.update(window.update(tick3.timestamp), tick3.price, tick3.volume)
  ); // OHLCVBar
}

// Example 3: Volume-based OHLCV (every 1000 shares)
export function example3_volume_based() {
  const window = new CounterWindow({ count: 1000 });
  const processor = new OHLCVProcessor();

  for (let i = 0; i < 1500; i++) {
    const spec = window.update(i); // value doesn't matter for counter
    const result = processor.update(spec, 100 + Math.random(), 1);
    if (result) {
      console.log("Emitted bar after 1000 ticks:", result);
    }
  }
}

// Example 4: Session-based OHLCV (gap detection)
export function example4_session() {
  const window = new SessionWindow({ gapThreshold: 60000 }); // 1-minute gap
  const processor = new OHLCVProcessor();

  console.log(processor.update(window.update(1000), 100, 10)); // undefined
  console.log(processor.update(window.update(2000), 101, 20)); // undefined
  console.log(processor.update(window.update(63000), 102, 30)); // OHLCVBar (gap > 60s)
}

// Example 5: StreamingAdapter - windowed CMA (CMA on every window)
export function example5_streaming_adapter() {
  // Create adapted constructor with new operator name for registry
  const CMAAggregator = StreamingAdapter(CMA, "WindowedCMA");

  // Instantiate like original operator
  const windowedCMA = new CMAAggregator({});
  const window = new TumblingWindow({ interval: 60000 });

  const prices = [
    { timestamp: 1000, price: 100 },
    { timestamp: 2000, price: 101 },
    { timestamp: 61000, price: 102 },
  ];

  prices.forEach(({ timestamp, price }) => {
    const spec = window.update(timestamp);
    const result = windowedCMA.update(spec, price);
    if (result !== undefined) {
      console.log("Windowed CMA:", result);
    }
  });
}
