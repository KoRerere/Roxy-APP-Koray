import { describe, expect, it } from "vitest";
import { SubAgentRegistry } from "../../src/subagent/registry.ts";
import type { SubAgentSpec } from "../../src/core/interfaces.ts";

const spec = (name: string): SubAgentSpec => ({
  name,
  description: `the ${name} subagent`,
  systemPrompt: `You are ${name}.`,
});

describe("SubAgentRegistry", () => {
  it("lists specs in declaration order", () => {
    const r = new SubAgentRegistry([spec("browser"), spec("coder")]);
    expect(r.list().map((s) => s.name)).toEqual(["browser", "coder"]);
  });

  it("get() returns a spec by name, undefined otherwise", () => {
    const r = new SubAgentRegistry([spec("coder")]);
    expect(r.get("coder")?.systemPrompt).toBe("You are coder.");
    expect(r.get("missing")).toBeUndefined();
  });

  it("has() reports membership", () => {
    const r = new SubAgentRegistry([spec("coder")]);
    expect(r.has("coder")).toBe(true);
    expect(r.has("nope")).toBe(false);
  });

  it("rejects duplicate names", () => {
    expect(() => new SubAgentRegistry([spec("coder"), spec("coder")])).toThrow(/duplicate|unique/i);
  });

  it("empty registry lists nothing", () => {
    expect(new SubAgentRegistry([]).list()).toEqual([]);
  });
});
