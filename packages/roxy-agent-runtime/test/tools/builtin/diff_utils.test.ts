import { describe, expect, it } from "vitest";
import { computeUnifiedDiff } from "../../../src/tools/builtin/diff_utils.ts";

describe("computeUnifiedDiff", () => {
  it("returns empty string when content is identical", () => {
    const text = "line1\nline2\nline3\n";
    expect(computeUnifiedDiff(text, text, "file.ts")).toBe("");
  });

  it("shows added lines with + prefix", () => {
    const old = "line1\nline2\n";
    const next = "line1\nline2\nnew line\n";
    const diff = computeUnifiedDiff(old, next, "file.ts");
    expect(diff).toContain("+new line");
  });

  it("shows removed lines with - prefix", () => {
    const old = "line1\nremoved\nline3\n";
    const next = "line1\nline3\n";
    const diff = computeUnifiedDiff(old, next, "file.ts");
    expect(diff).toContain("-removed");
  });

  it("includes file path header", () => {
    const diff = computeUnifiedDiff("a\n", "b\n", "src/foo.ts");
    expect(diff).toContain("src/foo.ts");
  });

  it("new file (empty old) shows all lines as additions", () => {
    const diff = computeUnifiedDiff("", "hello\nworld\n", "new.ts");
    expect(diff).toContain("+hello");
    expect(diff).toContain("+world");
    // No content lines should be deletions (header "---" is OK)
    const contentLines = diff
      .split("\n")
      .filter((l) => !l.startsWith("---") && !l.startsWith("+++") && !l.startsWith("@@"));
    expect(contentLines.some((l) => l.startsWith("-"))).toBe(false);
  });

  it("deleted file (empty new) shows all lines as removals", () => {
    const diff = computeUnifiedDiff("hello\nworld\n", "", "del.ts");
    expect(diff).toContain("-hello");
    expect(diff).toContain("-world");
    // No content lines should be additions (header "+++" is OK)
    const contentLines = diff
      .split("\n")
      .filter((l) => !l.startsWith("---") && !l.startsWith("+++") && !l.startsWith("@@"));
    expect(contentLines.some((l) => l.startsWith("+"))).toBe(false);
  });

  it("includes @@ hunk header with line numbers", () => {
    const old = "a\nb\nc\n";
    const next = "a\nB\nc\n";
    const diff = computeUnifiedDiff(old, next, "f.ts");
    expect(diff).toMatch(/@@.+-.*\+.*@@/);
  });

  it("context lines are not prefixed with + or -", () => {
    const old = "ctx1\nctx2\nold\nctx3\nctx4\n";
    const next = "ctx1\nctx2\nnew\nctx3\nctx4\n";
    const diff = computeUnifiedDiff(old, next, "f.ts");
    const lines = diff.split("\n").filter((l) => l.startsWith(" "));
    expect(lines.length).toBeGreaterThan(0);
  });

  it("truncates very large diffs with a notice", () => {
    const old = Array.from({ length: 400 }, (_, i) => `old_line_${i}`).join("\n");
    const next = Array.from({ length: 400 }, (_, i) => `new_line_${i}`).join("\n");
    const diff = computeUnifiedDiff(old, next, "big.ts");
    expect(diff).toContain("truncated");
  });
});
