import type { TumblingSpec } from "./types.js";
import type { OperatorDoc } from "../types/OpDoc.js";

type Constructor<T> = new (opts: any) => T;

/**
 * Factory that creates a windowed aggregator class for any streaming operator.
 *
 * Returns a constructor that can be registered in the operator registry.
 * The returned class wraps the operator and resets on window emission.
 *
 * @example
 * ```typescript
 * // Create adapted constructor
 * const SMAAggregator = StreamingAdapter(SMA);
 *
 * // Use like original operator, but with window parameter
 * const aggr = new SMAAggregator({ period: 10 });
 * const spec = window.update(timestamp);
 * const result = aggr.update(spec, price);
 *
 * // Register for DAG execution
 * registry.register(SMAAggregator);
 * ```
 */
export function StreamingAdapter<
  TOperator extends { update(...args: any[]): any }
>(OperatorClass: Constructor<TOperator>, NewOperatorName: string) {
  const originalDoc = (OperatorClass as any).doc as OperatorDoc | undefined;

  const AdaptedClass = class {
    readonly initOpts: any;
    instance: TOperator;
    last: ReturnType<TOperator["update"]> | undefined;

    constructor(opts?: any) {
      this.initOpts = opts ?? {};
      this.instance = new OperatorClass(opts);
    }

    /**
     * Update with window signal.
     * Window as first parameter, then original operator update() parameters.
     * @param window Window emission signal
     * @param args Arguments to forward to operator's update() method
     * @returns Output when window emits, undefined otherwise
     */
    update(
      window: TumblingSpec,
      ...args: Parameters<TOperator["update"]>
    ): ReturnType<TOperator["update"]> | undefined {
      if (window.timestamp === undefined) {
        // Accumulate
        this.last = this.instance.update(...args);
        return undefined;
      }

      // Emit window
      if (window.include) {
        // Right-closed: include current data in emitted window
        const output = this.instance.update(...args);
        this.reset();
        this.last = undefined;
        return output;
      } else {
        // Right-open: emit old window, start new with current data
        const output = this.last;
        this.reset();
        this.last = this.instance.update(...args);
        return output;
      }
    }

    /**
     * Manually reset by creating new instance.
     */
    reset(): void {
      this.instance = new OperatorClass(this.initOpts);
    }
  };

  // Steal and adapt doc from original operator
  if (originalDoc) {
    (AdaptedClass as any).doc = {
      type: NewOperatorName,
      desc: `Aggregation using ${originalDoc.type}, resets on window boundary`,
      init: originalDoc.init,
      input: `window: TumblingSpec, ${originalDoc.input}`,
      output: `${originalDoc.output} | undefined`,
    } as OperatorDoc;
  }

  return AdaptedClass;
}
