import { expect } from "vitest";
import type { TrajectoryEvent, TrajectoryPhase } from "../../src/core/interfaces.ts";

/**
 * Assert that a trajectory's phases match the expected sequence (in order),
 * ignoring `ts` and `data` details. Useful for lifecycle contract tests.
 */
export function assertPhaseSequence(events: TrajectoryEvent[], expected: TrajectoryPhase[]): void {
  const actual = events.map((e) => e.phase);
  expect(actual).toEqual(expected);
}

/**
 * Assert that a particular phase appears at least once with the given key/value
 * in its `data`.
 */
export function assertPhaseWithData(
  events: TrajectoryEvent[],
  phase: TrajectoryPhase,
  dataKey: string,
  dataValue: unknown,
): void {
  const hit = events.some((e) => e.phase === phase && e.data[dataKey] === dataValue);
  expect(hit, `expected phase ${phase} with ${dataKey}=${String(dataValue)}`).toBe(true);
}
