# Window-Based Aggregation

Clean, composable window aggregation following the accumulate-emit-reset pattern.

## Design Principles

1. **Windows always emit** - Return `TumblingSpec` on every update
2. **Processors decide** - Check `spec.timestamp === undefined` to accumulate or emit
3. **No full context needed** - Accumulate-emit-reset, no sliding windows
4. **Generic scalar intervals** - Works with time, volume, count, or any scalar value

## Core Components

### TumblingSpec

```typescript
interface TumblingSpec {
  timestamp?: number | undefined;  // undefined = accumulate, number = emit
  include: boolean;                // false = right-open, true = right-closed
}
```

### Windows

**TumblingWindow** - Time-based, right-open

```typescript
const window = new TumblingWindow({ interval: 60000 }); // 1-minute
const spec = window.update(timestamp);
```

**CounterWindow** - Count-based, right-closed

```typescript
const window = new CounterWindow({ count: 1000 }); // Every 1000 ticks
const spec = window.update(anyValue);
```

**SessionWindow** - Gap-based, right-closed

```typescript
const window = new SessionWindow({ gapThreshold: 60000 }); // 1-minute gaps
const spec = window.update(timestamp);
```

### Processors

**OHLCVProcessor** - Tick to OHLCV bar aggregation

```typescript
const processor = new OHLCVProcessor();
const bar = processor.update(price, volume, spec);
```

### StreamingAdapter

Factory that creates windowed aggregator classes. Returns a constructor for registry registration:

```typescript
// Create adapted constructor
const SMAAggregator = StreamingAdapter(SMA);

// Use like original operator
const aggr = new SMAAggregator({ period: 10 });
const spec = window.update(timestamp);
const result = aggr.update(spec, price);

// Register for DAG execution
registry.register(SMAAggregator);
```

The factory pattern enables registry registration while maintaining serialization compatibility.

## Usage Patterns

### Pattern 1: Convenience Class

```typescript
const ohlcv = new OHLCV({ intervalMs: 60000 });
const bar = ohlcv.update(timestamp, price, volume);
```

### Pattern 2: Manual Composition

```typescript
const window = new TumblingWindow({ interval: 60000 });
const processor = new OHLCVProcessor();

const spec = window.update(timestamp);
const bar = processor.update(price, volume, spec);
```

### Pattern 3: DAG Composition

```typescript
// Time-based 1-minute OHLCV
graph
  .add("timer", new TumblingWindow({ interval: 60000 }))
  .depends("tick.timestamp")
  .add("ohlcv_1m", new OHLCVProcessor())
  .depends( "timer", "tick.price", "tick.volume");

// Volume-based OHLCV (every 1000 shares)
graph
  .add("total_volume", new CuSum())
  .depends("tick.volume")
  .add("volume_clock", new TumblingWindow({ interval: 1000 }))
  .depends("total_volume")
  .add("ohlcv_vol", new OHLCVProcessor())
  .depends("volume_clock", "tick.price", "tick.volume")
```

## Examples

See [AggregatorAdaptor.ts](../../examples/AggregatorAdaptor.ts) for complete usage examples.

## Architecture

```text
Window (TumblingWindow/CounterWindow/SessionWindow)
  ↓ emits TumblingSpec
Processor (OHLCVProcessor/StreamingAdapter)
  ↓ processes based on spec
Output (OHLCVBar/number/etc)
```

Key insight: Separation at **logic level**, not type-safety level. Windows control timing, processors control computation.
