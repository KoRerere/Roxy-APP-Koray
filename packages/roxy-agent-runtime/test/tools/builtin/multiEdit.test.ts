import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import type { ToolContext } from "../../../src/core/interfaces.ts";
import { edit_fileTool } from "../../../src/tools/builtin/edit_file.ts";
import { makeTempDir } from "../../helpers/tempDir.ts";

const ctx: ToolContext = {
  agentId: "test-agent",
  traceId: "test-trace",
  signal: new AbortController().signal,
};

// Multi-edit mode: `edits` array applied SEQUENTIALLY (each edit sees the
// previous edit's output) and ATOMICALLY (any failure → file untouched).
describe("edit_file multi-edit", () => {
  let tmpPath: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ path: tmpPath, cleanup } = await makeTempDir());
  });
  afterEach(() => cleanup());

  it("applies multiple edits in one call", async () => {
    const file = join(tmpPath, "code.ts");
    await writeFile(file, "const x = 1;\nconst y = 2;\nconst z = 3;\n");
    const { handler } = edit_fileTool();

    const result = await handler(
      {
        path: file,
        edits: [
          { old_str: "const x = 1;", new_str: "const x = 10;" },
          { old_str: "const z = 3;", new_str: "const z = 30;" },
        ],
      },
      ctx,
    );

    expect(result.isError).toBe(false);
    expect(await readFile(file, "utf8")).toBe("const x = 10;\nconst y = 2;\nconst z = 30;\n");
  });

  it("edits are sequential — a later edit may match text produced by an earlier one", async () => {
    const file = join(tmpPath, "seq.txt");
    await writeFile(file, "alpha\n");
    const { handler } = edit_fileTool();

    const result = await handler(
      {
        path: file,
        edits: [
          { old_str: "alpha", new_str: "beta" },
          { old_str: "beta", new_str: "gamma" },
        ],
      },
      ctx,
    );

    expect(result.isError).toBe(false);
    expect(await readFile(file, "utf8")).toBe("gamma\n");
  });

  it("is atomic — a failing edit leaves the file completely untouched", async () => {
    const file = join(tmpPath, "atomic.txt");
    const original = "one two three\n";
    await writeFile(file, original);
    const { handler } = edit_fileTool();

    const result = await handler(
      {
        path: file,
        edits: [
          { old_str: "one", new_str: "ONE" }, // would succeed…
          { old_str: "missing", new_str: "x" }, // …but this fails
        ],
      },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content).toContain("edit #2");
    expect(result.content).toContain("not found");
    // First edit must NOT have been flushed.
    expect(await readFile(file, "utf8")).toBe(original);
  });

  it("reports the failing edit index for non-unique matches too", async () => {
    const file = join(tmpPath, "dup.txt");
    await writeFile(file, "foo bar foo\n");
    const { handler } = edit_fileTool();

    const result = await handler(
      {
        path: file,
        edits: [{ old_str: "foo", new_str: "baz" }],
      },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content).toContain("edit #1");
    expect(result.content).toContain("not unique");
  });

  it("supports per-edit replace_all", async () => {
    const file = join(tmpPath, "all.txt");
    await writeFile(file, "foo bar foo baz\n");
    const { handler } = edit_fileTool();

    const result = await handler(
      {
        path: file,
        edits: [
          { old_str: "foo", new_str: "qux", replace_all: true },
          { old_str: "bar", new_str: "BAR" },
        ],
      },
      ctx,
    );

    expect(result.isError).toBe(false);
    expect(await readFile(file, "utf8")).toBe("qux BAR qux baz\n");
  });

  it("summarizes edit and replacement counts on success", async () => {
    const file = join(tmpPath, "sum.txt");
    await writeFile(file, "a a b\n");
    const { handler } = edit_fileTool();

    const result = await handler(
      {
        path: file,
        edits: [
          { old_str: "a", new_str: "x", replace_all: true }, // 2 replacements
          { old_str: "b", new_str: "y" }, // 1 replacement
        ],
      },
      ctx,
    );

    expect(result.isError).toBe(false);
    expect(result.content).toContain("2 edits");
    expect(result.content).toContain("3 replacement");
  });

  it("rejects an empty edits array", async () => {
    const file = join(tmpPath, "empty.txt");
    await writeFile(file, "content\n");
    const { handler } = edit_fileTool();

    const result = await handler({ path: file, edits: [] }, ctx);
    expect(result.isError).toBe(true);
  });

  it("rejects mixing edits with top-level old_str/new_str", async () => {
    const file = join(tmpPath, "mix.txt");
    await writeFile(file, "content\n");
    const { handler } = edit_fileTool();

    const result = await handler(
      {
        path: file,
        old_str: "content",
        new_str: "x",
        edits: [{ old_str: "content", new_str: "y" }],
      },
      ctx,
    );
    expect(result.isError).toBe(true);
  });

  it("rejects an edits item with non-string fields", async () => {
    const file = join(tmpPath, "bad.txt");
    await writeFile(file, "content\n");
    const { handler } = edit_fileTool();

    const result = await handler({ path: file, edits: [{ old_str: "content" }] }, ctx);
    expect(result.isError).toBe(true);
    expect(await readFile(file, "utf8")).toBe("content\n");
  });

  it("descriptor schema advertises the edits parameter", () => {
    const { descriptor } = edit_fileTool();
    const props = (descriptor.inputSchema as { properties: Record<string, unknown> }).properties;
    expect(props.edits).toBeDefined();
  });
});
