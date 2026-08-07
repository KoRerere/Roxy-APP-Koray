import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { read_fileTool } from "../../src/tools/builtin/read_file.ts";
import { PathPermissions } from "../../src/tools/builtin/permissions.ts";
import type { ToolContext } from "../../src/core/interfaces.ts";

const ctx: ToolContext = { agentId: "a", traceId: "t", signal: new AbortController().signal };

function setup(roots: string[] = []) {
  const permissions = new PathPermissions({ allowRoots: roots });
  return read_fileTool({ permissions });
}

function tmpFile(content: string) {
  const dir = mkdtempSync(join(tmpdir(), "rf-h-"));
  const path = join(dir, "f.txt");
  writeFileSync(path, content);
  return { path, dir };
}

describe("read_file hardening", () => {
  it("paginates with offset+limit and numbers lines", async () => {
    const lines = Array.from({ length: 50 }, (_, i) => `L${i}`);
    const { path, dir } = tmpFile(lines.join("\n"));
    const tool = setup([dir]);
    const r = await tool.handler({ path, offset: 10, limit: 5 }, ctx);
    expect(r.isError).toBe(false);
    expect(r.content).toContain("11\tL10");
    expect(r.content).toContain("15\tL14");
    expect(r.content).not.toContain("L9");
    expect(r.content).toContain("offset=15");
  });

  it("defaults to the first 100 lines with a continuation footer", async () => {
    const lines = Array.from({ length: 250 }, (_, i) => `L${i}`);
    const { path, dir } = tmpFile(lines.join("\n"));
    const tool = setup([dir]);
    const r = await tool.handler({ path }, ctx);
    expect(r.isError).toBe(false);
    expect(r.content).toContain("1\tL0");
    expect(r.content).toContain("100\tL99");
    expect(r.content).not.toContain("L100 ");
    expect(r.content).toMatch(/offset=100/);
    expect(r.content).toMatch(/of 250/);
  });

  it("omits line-number prefix when line_numbers:false", async () => {
    const { path, dir } = tmpFile("hello");
    const tool = setup([dir]);
    const r = await tool.handler({ path, line_numbers: false }, ctx);
    expect(r.isError).toBe(false);
    expect(r.content).toBe("hello");
  });

  it("splits overlong lines as N.1 / N.2", async () => {
    const long = "x".repeat(5000);
    const { path, dir } = tmpFile(long);
    const tool = setup([dir]);
    const r = await tool.handler({ path, line_numbers: true }, ctx);
    expect(r.isError).toBe(false);
    expect(r.content).toContain("1\t");
    expect(r.content).toContain("1.1\t");
  });

  it("rejects binary files (NUL byte) with a short message", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rf-h-"));
    const path = join(dir, "blob");
    writeFileSync(path, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0d, 0x0a]));
    const tool = setup([dir]);
    const r = await tool.handler({ path }, ctx);
    expect(r.isError).toBe(true);
    expect(r.content).toContain("binary");
  });

  it("refuses whole-file reads above MAX_READ_BYTES without offset, allows windowed", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rf-h-"));
    const path = join(dir, "big");
    // Just over the cap: write a file > MAX_READ_BYTES. Use a small cap via
    // a manual stat trick — instead, write ~6MB of 'a's.
    const big = "a ".repeat(3_000_000); // ~6MB
    writeFileSync(path, big);
    const tool = setup([dir]);
    const whole = await tool.handler({ path }, ctx);
    expect(whole.isError).toBe(true);
    expect(whole.content).toContain("cap");
    const windowed = await tool.handler({ path, offset: 0, limit: 5 }, ctx);
    expect(windowed.isError).toBe(false);
  });
});
