import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../../src/memory/summarizer.ts";
import { renderSkillCatalog } from "../../src/skills/prompt.ts";
import type { SkillManifest } from "../../src/core/interfaces.ts";

const skill = (over: Partial<SkillManifest> = {}): SkillManifest => ({
  name: over.name ?? "s",
  description: over.description ?? "d",
  sourcePath: over.sourcePath ?? "/s",
  bodyPath: over.bodyPath ?? "/s/SKILL.md",
  frontmatter: over.frontmatter ?? {},
});

describe("buildSystemPrompt", () => {
  it("returns just the base block when no summary and no skills", () => {
    const blocks = buildSystemPrompt("You are helpful.", null, []);
    expect(blocks).toEqual([{ type: "text", text: "You are helpful." }]);
  });

  it("prepends an archived-summary block when summary is non-empty", () => {
    const blocks = buildSystemPrompt("base", "prior context", []);
    expect(blocks).toEqual([
      { type: "text", text: "[Archived Context Summary: prior context]" },
      { type: "text", text: "base" },
    ]);
  });

  it("omits the summary block for null/empty/whitespace summary", () => {
    for (const s of [null, "", "   "]) {
      const blocks = buildSystemPrompt("base", s, []);
      expect(blocks.some((b) => b.text.startsWith("["))).toBe(false);
    }
  });

  it("appends a Markdown skill catalog inside the Codex-style XML envelope", () => {
    const blocks = buildSystemPrompt("base", null, [
      skill({ name: "fix-issue", description: "Fix a GitHub issue", bodyPath: "/sk/fix/SKILL.md" }),
    ]);
    const index = blocks.at(-1)!;
    expect(index.text).toContain("<skills_instructions>\n## Skills");
    expect(index.text).toContain("### Available skills");
    expect(index.text).toContain("- fix-issue: Fix a GitHub issue (file: /sk/fix/SKILL.md)");
    expect(index.text).toContain("### How to use skills");
    expect(index.text).not.toContain("<skills>");
    expect(index.text).not.toContain("<skill_catalog>");
    expect(index.text).not.toContain("<skill>");
    // progressive disclosure: body is never inlined into system
    expect(blocks.some((b) => b.text.includes("SKILL.md body content"))).toBe(false);
  });

  it("omits the skill-index block when there are no skills", () => {
    const blocks = buildSystemPrompt("base", null, []);
    expect(blocks.some((b) => b.text.includes("<skills_instructions>"))).toBe(false);
  });

  it("returns no base block when base is empty (summary/skill only)", () => {
    const blocks = buildSystemPrompt("", "sum", [skill()]);
    expect(blocks.some((b) => b.text === "")).toBe(false);
    expect(blocks.length).toBe(2); // summary + skill-index
  });

  it("escapes dynamic Markdown catalog metadata inside the XML envelope", () => {
    const rendered = renderSkillCatalog([
      skill({ name: "a<&", description: "route </description> safely", bodyPath: "/s/a&b/SKILL.md" }),
    ]);

    expect(rendered.text).toContain("- a&lt;&amp;:");
    expect(rendered.text).toContain("route &lt;/description&gt; safely");
    expect(rendered.text).toContain("/s/a&amp;b/SKILL.md");
  });

  it("bounds the complete catalog and reports truncation diagnostics", () => {
    const skills = Array.from({ length: 20 }, (_, index) =>
      skill({
        name: `skill-${String(index).padStart(2, "0")}`,
        description: `description-${index}-${"x".repeat(500)}`,
        bodyPath: `/very/long/catalog/path/${index}/SKILL.md`,
      }),
    );

    const rendered = renderSkillCatalog(skills, { maxChars: 4_000 });

    expect(rendered.text.length).toBeLessThanOrEqual(4_000);
    expect(rendered.warnings.some((warning) => warning.code === "catalog_description_truncated")).toBe(true);
    expect(rendered.text).toContain("- skill-00:");
  });
});
