import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AgentRuntime } from "../../src/index.ts";
import { JsonlSessionStore } from "../../src/memory/session_store.ts";
import { createTestAgentDefinition } from "../helpers/buildTestAgent.ts";

function tmpDir() {
  return mkdtempSync(join(tmpdir(), "roxy-agent-runtime-rollout-"));
}

describe("AgentRuntime rollout wiring", () => {
  it("a new session writes session_start through the injected store", async () => {
    const dir = tmpDir();
    const store = new JsonlSessionStore({ dir });
    const agent = await AgentRuntime.create(createTestAgentDefinition({ sessionId: "brand-new", sessionStore: store }));
    await agent.dispose();

    const path = join(dir, "brand-new.rollout.jsonl");
    expect(existsSync(path)).toBe(true);
    const firstLine = readFileSync(path, "utf-8").split("\n").filter(Boolean)[0]!;
    expect(JSON.parse(firstLine)).toMatchObject({ type: "session_start", sessionId: "brand-new" });
  });

  it("a resumed session replays without appending another session_start", async () => {
    const dir = tmpDir();
    const store = new JsonlSessionStore({ dir });
    await store.append("resume-me", { type: "session_start", sessionId: "resume-me", createdAt: 1 });
    await store.append("resume-me", { type: "user_input", message: { role: "user", content: "prior" } });
    await store.append("resume-me", {
      type: "assistant_turn",
      message: { role: "assistant", content: "prior reply" },
      stopReason: "end_turn",
    });

    const agent = await AgentRuntime.create(createTestAgentDefinition({ sessionId: "resume-me", sessionStore: store }));
    await agent.dispose();

    const events = readFileSync(join(dir, "resume-me.rollout.jsonl"), "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { type: string });
    expect(events.filter((event) => event.type === "session_start")).toHaveLength(1);
    expect(events).toHaveLength(3);
  });

  it("omitting sessionStore keeps the Agent ephemeral", async () => {
    const agent = await AgentRuntime.create(createTestAgentDefinition({ sessionId: "ephemeral" }));
    await agent.dispose();
  });
});
