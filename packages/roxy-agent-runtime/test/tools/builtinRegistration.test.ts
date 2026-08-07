import { describe, expect, it } from "vitest";
import { registerBuiltinTools } from "../../src/tools/builtin/index.ts";
import { ToolRegistry } from "../../src/tools/registry.ts";

describe("registerBuiltinTools", () => {
  it("always returns the filesystem + shell tools", () => {
    const names = registerBuiltinTools({}).map((t) => t.descriptor.name);
    expect(names).toEqual(
      expect.arrayContaining(["read_file", "glob", "grep", "ls", "write_file", "edit_file", "execute"]),
    );
  });

  it("marks mutating/executing tools sensitive (HITL-gated)", () => {
    const byName = new Map(registerBuiltinTools({}).map((t) => [t.descriptor.name, t.descriptor]));
    expect(byName.get("write_file")?.metadata?.sensitive).toBe(true);
    expect(byName.get("edit_file")?.metadata?.sensitive).toBe(true);
    expect(byName.get("execute")?.metadata?.sensitive).toBe(true);
    // read-only family is NOT sensitive — free in any HITL mode.
    expect(byName.get("read_file")?.metadata?.sensitive).toBe(false);
    expect(byName.get("glob")?.metadata?.sensitive).toBe(false);
    expect(byName.get("grep")?.metadata?.sensitive).toBe(false);
    expect(byName.get("ls")?.metadata?.sensitive).toBe(false);
  });

  it("includes todo_write + ask_user only when their deps are provided", () => {
    const without = registerBuiltinTools({}).map((t) => t.descriptor.name);
    expect(without).not.toContain("todo_read");
    expect(without).not.toContain("todo_write");
    expect(without).not.toContain("ask_user");

    const withDeps = registerBuiltinTools({
      enableTodos: true,
      clarificationHandler: { request: async () => ({ answer: "" }) } as never,
    }).map((t) => t.descriptor.name);
    expect(withDeps).not.toContain("todo_read");
    expect(withDeps).toContain("todo_write");
    expect(withDeps).toContain("ask_user");
  });

  it("every entry is registerable into a ToolRegistry without collision", () => {
    const reg = new ToolRegistry();
    for (const t of registerBuiltinTools({})) {
      reg.add(t.descriptor, t.handler);
    }
    expect(reg.all().map((d) => d.name)).toEqual(
      expect.arrayContaining(["read_file", "glob", "grep", "ls", "write_file", "edit_file", "execute"]),
    );
  });
});
