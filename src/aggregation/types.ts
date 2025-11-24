/**
 * Window emission signal for tumbling/session/counter windows.
 * Windows always emit a spec - processors decide whether to emit based on timestamp.
 */
export interface TumblingSpec {
  /**
   * Window boundary value (can be timestamp, volume, or any scalar).
   * undefined = continue accumulating
   * number = emit window at this boundary
   */
  timestamp?: number | undefined;

  /**
   * Whether to include current data in emitted window.
   * false = right-open (data starts new window)
   * true = right-closed (data included in emitted window)
   */
  include: boolean;
}
