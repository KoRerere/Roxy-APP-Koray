import { describe, expect, it } from "vitest";
import type { ITrajectoryRecorder, TrajectoryEvent } from "../../src/core/interfaces.ts";

/**
 * CONTRACT tests for ITrajectoryRecorder. Production impls
 * (src/observability/trajectory.ts) MUST satisfy these.
 *
 *  - start(input) returns a unique traceId
 *  - emit(event) preserves insertion order
 *  - getTrace(id) returns events in emit order; unknown id → []
 *  - recorder stamps ts (caller may pass 0)
 */

function makeRecorder(stampTs = true): ITrajectoryRecorder {
  const traces = new Map<string, TrajectoryEvent[]>();
  let counter = 0;
  return {
    start: () => {
      const id = `trace-${++counter}`;
      traces.set(id, []);
      return id;
    },
    emit: (e) => {
      const list = traces.get(e.traceId);
      if (!list) return;
      if (stampTs) {
        list.push({ ...e, ts: list.length + 1 });
      } else {
        list.push(e);
      }
    },
    end: () => {},
    getTrace: (id) => traces.get(id) ?? [],
  };
}

describe("trajectory recorder contract", () => {
  it("returns a unique traceId per start", () => {
    const rec = makeRecorder();
    const a = rec.start([]);
    const b = rec.start([]);
    expect(a).not.toBe(b);
  });

  it("preserves emit order in getTrace", () => {
    const rec = makeRecorder();
    const id = rec.start([]);
    const phases = ["model_thought", "tool_selected", "tool_executed", "result_returned"] as const;
    phases.forEach((p, i) => rec.emit({ traceId: id, ts: 0, phase: p, data: { i } }));
    expect(rec.getTrace(id).map((e) => e.phase)).toEqual([...phases]);
  });

  it("returns [] for an unknown traceId", () => {
    const rec = makeRecorder();
    expect(rec.getTrace("nope")).toEqual([]);
  });

  it("stamps ts when the caller passes 0", () => {
    const rec = makeRecorder(true);
    const id = rec.start([]);
    rec.emit({ traceId: id, ts: 0, phase: "tool_selected", data: {} });
    const ev = rec.getTrace(id)[0]!;
    expect(ev.ts).not.toBe(0);
  });
});
