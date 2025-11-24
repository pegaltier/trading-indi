// Core types
export type { TumblingSpec } from "./types.js";

// Windows
export { TumblingWindow, CounterWindow, SessionWindow } from "./windows.js";

// Processors
export { OHLCVProcessor, type OHLCVBar } from "./processors.js";

// Adapter
export { StreamingAdapter } from "./StreamingAdapter.js";

// Convenience OHLCV
export { OHLCV, useOHLCV, type OHLCVTick } from "./OHLCV.js";
