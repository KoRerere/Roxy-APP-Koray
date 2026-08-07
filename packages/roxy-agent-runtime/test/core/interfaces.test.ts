import { describe, expect, it } from "vitest";
import type {
  HitlMode,
  ToolDescriptor,
  ToolSource,
  TrajectoryEvent,
  TrajectoryPhase,
} from "../../src/core/interfaces.ts";
import { NotImplementedError } from "../../src/core/errors.ts";

describe("core interfaces (contract)", () => {
  it("ToolSource covers builtin / skill / mcp", () => {
    const sources: ToolSource[] = ["builtin", "skill", "mcp"];
    expect(sources).toHaveLength(3);
  });

  it("ToolDescriptor supports the sensitive metadata flag", () => {
    const desc: ToolDescriptor = {
      name: "write_file",
      description: "write",
      inputSchema: { type: "object" },
      source: "builtin",
      metadata: { sensitive: true },
    };
    expect(desc.metadata?.sensitive).toBe(true);
  });

  it("HitlMode covers strict / delegate / full", () => {
    const modes: HitlMode[] = ["strict", "delegate", "full"];
    expect(modes).toHaveLength(3);
  });

  it("TrajectoryPhase covers the full lifecycle", () => {
    const phases: TrajectoryPhase[] = [
      "model_thought",
      "tool_selected",
      "hitl_intercept",
      "tool_executed",
      "result_returned",
      "memory_trimmed",
      "subagent_delegated",
      "error",
    ];
    expect(phases).toHaveLength(8);
  });

  it("TrajectoryEvent is well-formed", () => {
    const event: TrajectoryEvent = {
      traceId: "t1",
      ts: 0,
      phase: "tool_selected",
      data: { toolName: "ls" },
    };
    expect(event.phase).toBe("tool_selected");
  });

  it("NotImplementedError carries its feature name", () => {
    const err = new NotImplementedError("Thing.do");
    expect(err).toBeInstanceOf(Error);
    expect(err.feature).toBe("Thing.do");
    expect(err.message).toContain("Thing.do");
  });
});
