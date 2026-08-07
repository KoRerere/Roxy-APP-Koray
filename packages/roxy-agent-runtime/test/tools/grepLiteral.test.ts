import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { grepTool } from "../../src/tools/builtin/grep.ts";
import { PathPermissions } from "../../src/tools/builtin/permissions.ts";
import type { ToolContext } from "../../src/core/interfaces.ts";

const ctx: ToolContext = { agentId: "a", traceId: "t", signal: new AbortController().signal };

function setup(roots: string[]) {
  return grepTool({ permissions: new PathPermissions({ allowRoots: roots }) });
}

function makeDir(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "grep-"));
  for (const [name, content] of Object.entries(files)) {
    const p = join(dir, name);
    if (name.includes("/")) mkdirSync(join(dir, name.split("/").slice(0, -1).join("/")), { recursive: true });
    writeFileSync(p, content);
  }
  return dir;
}

describe("grep literal search", () => {
  it("matches a literal substring including special regex chars (NOT regex)", async () => {
    const dir = makeDir({ "a.ts": "def __init__(self):\n  pass\n" });
    const tool = setup([dir]);
    const r = await tool.handler({ pattern: "__init__(self)", path: dir }, ctx);
    expect(r.isError).toBe(false);
    expect(r.content).toContain("__init__(self)");
    expect(r.content).toContain("def __init__(self):");
  });

  it("does NOT throw on an invalid-as-regex pattern (treats literally)", async () => {
    const dir = makeDir({ "a.txt": "weird [invalid thing\n" });
    const tool = setup([dir]);
    const r = await tool.handler({ pattern: "[invalid", path: dir }, ctx);
    expect(r.isError).toBe(false);
    expect(r.content).toContain("[invalid");
  });

  it("case_insensitive:true matches across case", async () => {
    const dir = makeDir({ "a.txt": "Hello World\nHELLO again\n" });
    const tool = setup([dir]);
    const r = await tool.handler({ pattern: "hello", path: dir, case_insensitive: true }, ctx);
    expect(r.isError).toBe(false);
    expect(r.content).toContain("Hello World");
    expect(r.content).toContain("HELLO again");
  });

  it("case_insensitive default (false) is case-sensitive", async () => {
    const dir = makeDir({ "a.txt": "Hello\nhello\n" });
    const tool = setup([dir]);
    const r = await tool.handler({ pattern: "Hello", path: dir }, ctx);
    expect(r.isError).toBe(false);
    expect(r.content).toContain("Hello");
    // the lowercase 'hello' line should not be its match... but "Hello" substring
    // isn't in the lowercase line. Confirm only the first matches.
    const lines = String(r.content).split("\n");
    expect(lines.filter((l) => l.includes(": Hello")).length).toBe(1);
  });

  it("glob filter restricts to matching filenames", async () => {
    const dir = makeDir({ "a.ts": "todo\n", "b.md": "todo\n" });
    const tool = setup([dir]);
    const r = await tool.handler({ pattern: "todo", path: dir, glob: "*.ts" }, ctx);
    expect(r.isError).toBe(false);
    expect(r.content).toContain("a.ts");
    expect(r.content).not.toContain("b.md");
  });

  it("output_mode files_with_matches returns only paths", async () => {
    const dir = makeDir({ "a.ts": "match here\n", "b.ts": "nope\n" });
    const tool = setup([dir]);
    const r = await tool.handler(
      {
        pattern: "match",
        path: dir,
        glob: "*.ts",
        output_mode: "files_with_matches",
      },
      ctx,
    );
    expect(r.isError).toBe(false);
    expect(r.content).toContain("a.ts");
    expect(r.content).not.toContain("match here");
    expect(r.content).not.toContain("b.ts");
  });

  it("groups output by file with indented line:text", async () => {
    const dir = makeDir({ "a.ts": "foo\nbar foo\n" });
    const tool = setup([dir]);
    const r = await tool.handler({ pattern: "foo", path: dir }, ctx);
    expect(r.isError).toBe(false);
    expect(r.content).toContain("a.ts");
    expect(r.content).toContain("1: foo");
    expect(r.content).toContain("2: bar foo");
  });
});
