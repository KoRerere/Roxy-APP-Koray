import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildTestAgent, endTurnResponse } from "../helpers/buildTestAgent.ts";
import { makeTempDir } from "../helpers/tempDir.ts";
import type { SkillManifest } from "../../src/core/interfaces.ts";

const skill = (over: Partial<SkillManifest> = {}): SkillManifest => ({
  name: over.name ?? "roxybrowser-automation",
  description: over.description ?? "Drive a browser via Playwright.",
  sourcePath: over.sourcePath ?? "/sk/play",
  bodyPath: over.bodyPath ?? "/sk/play/SKILL.md",
  frontmatter: over.frontmatter ?? {},
});

describe("skill discovery in the system prompt", () => {
  it("advertises available skills in the model call's system blocks", async () => {
    const { agent, provider } = buildTestAgent({
      skills: [
        skill({ name: "roxybrowser-automation", description: "Drive a browser via Playwright." }),
        skill({ name: "roxybrowser-control", description: "Control RoxyBrowser resources." }),
      ],
      handler: () => endTurnResponse("ok"),
    });

    await agent.invoke("hello");

    const req = provider.calls[0]!;
    const systemText = (req.system ?? []).map((b) => ("text" in b ? b.text : "")).join("\n");

    // Regression: the loop used to pass `[]` for skills, so no skill index
    // ever reached the model — the agent could not discover skills. Skills
    // are now loaded on demand via read_file (skill dirs are allow roots).
    expect(systemText).toContain("<skills_instructions>\n## Skills");
    expect(systemText).toContain("### Available skills");
    expect(systemText).toContain("- roxybrowser-automation: Drive a browser via Playwright.");
    expect(systemText).toContain("- roxybrowser-control: Control RoxyBrowser resources.");
    expect(systemText).toContain("### How to use skills");
    expect(systemText).not.toContain("<skill_catalog>");
    expect(systemText).not.toContain("<available_skills>");
    expect(systemText).toContain("read_file");
    expect(systemText).not.toContain("invoke_skill");
  });

  it("injects an explicitly selected skill as transient XML before the user request", async () => {
    // Regression: an explicit skill selection still required a model-generated
    // read_file round trip and had no path-based identity.
    // Fixed by: resolving name+path and injecting the bounded body for this turn.
    const { path, cleanup } = await makeTempDir();
    try {
      const sourcePath = join(path, "selected");
      const bodyPath = join(sourcePath, "SKILL.md");
      await mkdir(sourcePath);
      await writeFile(
        bodyPath,
        "---\nname: selected\ndescription: Selected workflow.\n---\n# Selected body\nDo the exact workflow.",
      );
      const manifest = skill({ name: "selected", description: "Selected workflow.", sourcePath, bodyPath });
      const { agent, provider, memory } = buildTestAgent({ skills: [manifest], handler: () => endTurnResponse("ok") });

      await agent.invoke({ input: "run it", skills: [{ name: "selected", path: bodyPath }] });

      const messages = provider.calls[0]!.messages;
      expect(messages).toHaveLength(2);
      expect(messages[0]!.role).toBe("user");
      expect(messages[0]!.content).toContain("<skill>");
      expect(messages[0]!.content).toContain("<name>selected</name>");
      expect(messages[0]!.content).toContain("<path>");
      expect(messages[0]!.content).toContain("---\nname: selected\ndescription: Selected workflow.\n---");
      expect(messages[0]!.content).toContain("# Selected body");
      expect(messages[0]!.content).not.toContain("<instructions>");
      expect(messages[0]!.content).not.toContain("<![CDATA[");
      expect(messages[1]).toMatchObject({ role: "user", content: "run it" });
      expect(await memory.getAll(agent.sessionId)).toEqual([
        { role: "user", content: "run it" },
        expect.objectContaining({ role: "assistant" }),
      ]);
    } finally {
      await cleanup();
    }
  });

  it("does not load a selected skill when its name and path do not identify one catalog entry", async () => {
    // Regression: name-only selection cannot distinguish duplicate or spoofed
    // skills.
    // Fixed by: requiring both fields to match one enabled manifest snapshot.
    const manifest = skill({ name: "selected", bodyPath: "/sk/selected/SKILL.md" });
    const { agent, provider } = buildTestAgent({ skills: [manifest], handler: () => endTurnResponse("ok") });

    await agent.invoke({ input: "run it", skills: [{ name: "selected", path: "/other/SKILL.md" }] });

    const first = provider.calls[0]!.messages[0]!;
    expect(first.content).toContain("<skill_error>");
    expect(first.content).not.toContain("Selected workflow body");
  });

  it("turns an oversized explicitly selected body into a bounded skill error", async () => {
    // Regression: an explicitly selected SKILL.md could inject an effectively
    // unbounded prompt before the first model call.
    // Fixed by: enforcing the main-prompt byte limit before XML assembly.
    const { path, cleanup } = await makeTempDir();
    try {
      const sourcePath = join(path, "large");
      const bodyPath = join(sourcePath, "SKILL.md");
      await mkdir(sourcePath);
      await writeFile(bodyPath, `---\nname: large\ndescription: Large workflow.\n---\n${"x".repeat(40_000)}`);
      const manifest = skill({ name: "large", description: "Large workflow.", sourcePath, bodyPath });
      const { agent, provider } = buildTestAgent({ skills: [manifest], handler: () => endTurnResponse("ok") });

      await agent.invoke({ input: "run it", skills: [{ name: "large", path: bodyPath }] });

      const first = provider.calls[0]!.messages[0]!;
      expect(first.content).toContain("<skill_error>");
      expect(first.content).toContain("MAX_SKILL_BODY_SIZE");
      expect(first.content.length).toBeLessThan(1_000);
    } finally {
      await cleanup();
    }
  });

  it("keeps explicit skill XML available throughout a streaming turn", async () => {
    // Regression: invoke and stream have separate request loops, so skill
    // context could work in invoke while silently disappearing in stream.
    // Fixed by: injecting the same transient context in both request paths.
    const { path, cleanup } = await makeTempDir();
    try {
      const sourcePath = join(path, "stream-skill");
      const bodyPath = join(sourcePath, "SKILL.md");
      await mkdir(sourcePath);
      await writeFile(bodyPath, "---\nname: stream-skill\ndescription: Stream workflow.\n---\n# Stream body");
      const manifest = skill({ name: "stream-skill", description: "Stream workflow.", sourcePath, bodyPath });
      const { agent, provider } = buildTestAgent({ skills: [manifest], handler: () => endTurnResponse("ok") });

      const events = [];
      for await (const event of agent.stream({
        input: "stream it",
        skills: [{ name: "stream-skill", path: bodyPath }],
      })) {
        events.push(event);
      }

      expect(events.at(-1)).toMatchObject({ type: "done" });
      expect(provider.calls[0]!.messages[0]!.content).toContain("<name>stream-skill</name>");
      expect(provider.calls[0]!.messages[1]).toMatchObject({ role: "user", content: "stream it" });
    } finally {
      await cleanup();
    }
  });

  it("omits the skill-index block when there are no skills", async () => {
    const { agent, provider } = buildTestAgent({
      handler: () => endTurnResponse("ok"),
    });
    await agent.invoke("hello");
    const systemText = (provider.calls[0]!.system ?? []).map((b) => ("text" in b ? b.text : "")).join("\n");
    expect(systemText).not.toContain("<skills_instructions>");
  });
});
