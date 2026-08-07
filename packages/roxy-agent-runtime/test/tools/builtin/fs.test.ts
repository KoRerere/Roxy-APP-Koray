import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { ToolContext } from "../../../src/core/interfaces.ts";
import { edit_fileTool } from "../../../src/tools/builtin/edit_file.ts";
import { executeTool } from "../../../src/tools/builtin/execute.ts";
import { globTool } from "../../../src/tools/builtin/glob.ts";
import { grepTool } from "../../../src/tools/builtin/grep.ts";
import { lsTool } from "../../../src/tools/builtin/ls.ts";
import { read_fileTool } from "../../../src/tools/builtin/read_file.ts";
import { write_fileTool } from "../../../src/tools/builtin/write_file.ts";
import { makeTempDir } from "../../helpers/tempDir.ts";

const ctx: ToolContext = {
  agentId: "test-agent",
  traceId: "test-trace",
  signal: new AbortController().signal,
};

describe("read_file", () => {
  let tmpPath: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ path: tmpPath, cleanup } = await makeTempDir());
  });
  afterEach(() => cleanup());

  it("returns file content with line numbers (cat -n)", async () => {
    const file = join(tmpPath, "hello.txt");
    await writeFile(file, "hello world");
    const { handler } = read_fileTool();
    const result = await handler({ path: file }, ctx);
    expect(result.isError).toBe(false);
    expect(result.content).toBe("1\thello world");
  });

  it("returns plain content when line_numbers:false", async () => {
    const file = join(tmpPath, "hello.txt");
    await writeFile(file, "hello world");
    const { handler } = read_fileTool();
    const result = await handler({ path: file, line_numbers: false }, ctx);
    expect(result.isError).toBe(false);
    expect(result.content).toBe("hello world");
  });

  it("returns isError when file not found", async () => {
    const { handler } = read_fileTool();
    const result = await handler({ path: join(tmpPath, "missing.txt") }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content).toContain("missing.txt");
  });

  it("returns isError when path is missing from input", async () => {
    const { handler } = read_fileTool();
    const result = await handler({}, ctx);
    expect(result.isError).toBe(true);
  });

  it("descriptor has sensitive: false", () => {
    const { descriptor } = read_fileTool();
    expect(descriptor.metadata?.sensitive).toBe(false);
    expect(descriptor.source).toBe("builtin");
  });
});

describe("write_file", () => {
  let tmpPath: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ path: tmpPath, cleanup } = await makeTempDir());
  });
  afterEach(() => cleanup());

  it("creates a new file with content", async () => {
    const file = join(tmpPath, "out.txt");
    const { handler } = write_fileTool();
    const result = await handler({ path: file, content: "written" }, ctx);
    expect(result.isError).toBe(false);
    expect(await readFile(file, "utf8")).toBe("written");
  });

  it("creates parent directories automatically", async () => {
    const file = join(tmpPath, "nested", "deep", "file.txt");
    const { handler } = write_fileTool();
    const result = await handler({ path: file, content: "deep" }, ctx);
    expect(result.isError).toBe(false);
    expect(await readFile(file, "utf8")).toBe("deep");
  });

  it("overwrites an existing file", async () => {
    const file = join(tmpPath, "existing.txt");
    await writeFile(file, "old");
    const { handler } = write_fileTool();
    await handler({ path: file, content: "new" }, ctx);
    expect(await readFile(file, "utf8")).toBe("new");
  });

  it("descriptor has sensitive: true", () => {
    const { descriptor } = write_fileTool();
    expect(descriptor.metadata?.sensitive).toBe(true);
  });

  it("returns isError when path is missing from input", async () => {
    const { handler } = write_fileTool();
    const result = await handler({ content: "x" }, ctx);
    expect(result.isError).toBe(true);
  });
});

describe("edit_file", () => {
  let tmpPath: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ path: tmpPath, cleanup } = await makeTempDir());
  });
  afterEach(() => cleanup());

  it("replaces a unique occurrence of old_str", async () => {
    const file = join(tmpPath, "code.ts");
    await writeFile(file, "const x = 1;\nconst y = 2;\n");
    const { handler } = edit_fileTool();
    const result = await handler({ path: file, old_str: "const x = 1;", new_str: "const x = 42;" }, ctx);
    expect(result.isError).toBe(false);
    expect(await readFile(file, "utf8")).toBe("const x = 42;\nconst y = 2;\n");
  });

  it("returns isError when old_str not found", async () => {
    const file = join(tmpPath, "code.ts");
    await writeFile(file, "hello");
    const { handler } = edit_fileTool();
    const result = await handler({ path: file, old_str: "world", new_str: "earth" }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/not found/i);
  });

  it("returns isError when old_str appears more than once", async () => {
    const file = join(tmpPath, "dup.txt");
    await writeFile(file, "foo\nfoo\n");
    const { handler } = edit_fileTool();
    const result = await handler({ path: file, old_str: "foo", new_str: "bar" }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/unique|occurrences/i);
  });

  it("returns isError when file not found", async () => {
    const { handler } = edit_fileTool();
    const result = await handler({ path: join(tmpPath, "ghost.ts"), old_str: "x", new_str: "y" }, ctx);
    expect(result.isError).toBe(true);
  });

  it("descriptor has sensitive: true", () => {
    const { descriptor } = edit_fileTool();
    expect(descriptor.metadata?.sensitive).toBe(true);
  });
});

describe("execute", () => {
  it("captures stdout and returns exit_code 0", async () => {
    const { handler } = executeTool();
    const result = await handler({ command: "echo hello" }, ctx);
    expect(result.isError).toBe(false);
    expect(result.content).toContain("hello");
    expect(result.content).toContain("0");
  });

  it("returns isError on non-zero exit code", async () => {
    const { handler } = executeTool();
    const result = await handler({ command: "exit 1" }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/1/);
  });

  it("kills the process on timeout and returns isError", async () => {
    const { handler } = executeTool();
    const result = await handler({ command: "sleep 60", timeoutMs: 100 }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/timeout/i);
  });

  it("truncates stdout to 4096 chars", async () => {
    const { handler } = executeTool();
    // generate ~6000 chars of output
    const result = await handler({ command: "node -e \"process.stdout.write('x'.repeat(6000))\"" }, ctx);
    expect(result.isError).toBe(false);
    expect(result.content.length).toBeLessThanOrEqual(4096 + 200);
  });

  it("descriptor has sensitive: true", () => {
    const { descriptor } = executeTool();
    expect(descriptor.metadata?.sensitive).toBe(true);
  });

  it("returns isError when command is missing", async () => {
    const { handler } = executeTool();
    const result = await handler({}, ctx);
    expect(result.isError).toBe(true);
  });
});

describe("glob", () => {
  let tmpPath: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ path: tmpPath, cleanup } = await makeTempDir());
    await writeFile(join(tmpPath, "a.ts"), "");
    await writeFile(join(tmpPath, "b.ts"), "");
    await writeFile(join(tmpPath, "c.txt"), "");
    await mkdir(join(tmpPath, "sub"));
    await writeFile(join(tmpPath, "sub", "d.ts"), "");
  });
  afterEach(() => cleanup());

  it("matches files by extension", async () => {
    const { handler } = globTool();
    const result = await handler({ pattern: "*.ts", cwd: tmpPath }, ctx);
    expect(result.isError).toBe(false);
    const lines = result.content.split("\n").filter(Boolean);
    expect(lines).toContain("a.ts");
    expect(lines).toContain("b.ts");
    expect(lines).not.toContain("c.txt");
  });

  it("matches nested files with **", async () => {
    const { handler } = globTool();
    const result = await handler({ pattern: "**/*.ts", cwd: tmpPath }, ctx);
    expect(result.isError).toBe(false);
    const lines = result.content.split("\n").filter(Boolean);
    expect(lines.some((l) => l.includes("d.ts"))).toBe(true);
  });

  it("returns empty string for no matches (not an error)", async () => {
    const { handler } = globTool();
    const result = await handler({ pattern: "*.xyz", cwd: tmpPath }, ctx);
    expect(result.isError).toBe(false);
    expect(result.content.trim()).toBe("");
  });

  it("descriptor has sensitive: false", () => {
    const { descriptor } = globTool();
    expect(descriptor.metadata?.sensitive).toBe(false);
  });
});

describe("ls", () => {
  let tmpPath: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ path: tmpPath, cleanup } = await makeTempDir());
    await writeFile(join(tmpPath, "file.txt"), "");
    await mkdir(join(tmpPath, "subdir"));
  });
  afterEach(() => cleanup());

  it("lists entries with type info", async () => {
    const { handler } = lsTool();
    const result = await handler({ path: tmpPath }, ctx);
    expect(result.isError).toBe(false);
    expect(result.content).toMatch(/file\.txt.*file|file.*file\.txt/i);
    expect(result.content).toMatch(/subdir.*dir|dir.*subdir/i);
  });

  it("returns isError for non-existent directory", async () => {
    const { handler } = lsTool();
    const result = await handler({ path: join(tmpPath, "ghost") }, ctx);
    expect(result.isError).toBe(true);
  });

  it("descriptor has sensitive: false", () => {
    const { descriptor } = lsTool();
    expect(descriptor.metadata?.sensitive).toBe(false);
  });
});

describe("grep", () => {
  let tmpPath: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ path: tmpPath, cleanup } = await makeTempDir());
    await writeFile(join(tmpPath, "a.ts"), "const x = 1;\nconst y = 2;\n");
    await writeFile(join(tmpPath, "b.ts"), "function foo() {}\n");
  });
  afterEach(() => cleanup());

  it("returns matching lines grouped by file", async () => {
    const { handler } = grepTool();
    const result = await handler({ pattern: "const", path: tmpPath }, ctx);
    expect(result.isError).toBe(false);
    expect(result.content).toContain("a.ts");
    expect(result.content).toContain("1: const x = 1;");
    expect(result.content).toContain("2: const y = 2;");
  });

  it("searches within a single file when path is a file", async () => {
    const { handler } = grepTool();
    const result = await handler({ pattern: "function", path: join(tmpPath, "b.ts") }, ctx);
    expect(result.isError).toBe(false);
    expect(result.content).toContain("function");
  });

  it("returns empty string for no matches (not an error)", async () => {
    const { handler } = grepTool();
    const result = await handler({ pattern: "zzznomatch", path: tmpPath }, ctx);
    expect(result.isError).toBe(false);
    expect(result.content.trim()).toBe("");
  });

  it("literal-matches special regex chars (NOT regex)", async () => {
    const { handler } = grepTool();
    const result = await handler({ pattern: "[invalid", path: tmpPath }, ctx);
    // literal substring — never an error, simply no matches here
    expect(result.isError).toBe(false);
  });

  it("case_insensitive:true matches across case", async () => {
    const { handler } = grepTool();
    const result = await handler({ pattern: "CONST", case_insensitive: true, path: tmpPath }, ctx);
    expect(result.isError).toBe(false);
    expect(result.content).toContain("const");
  });

  it("descriptor has sensitive: false", () => {
    const { descriptor } = grepTool();
    expect(descriptor.metadata?.sensitive).toBe(false);
  });
});
