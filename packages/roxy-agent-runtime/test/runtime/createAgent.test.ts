import { describe, expect, it } from "vitest";
import { AgentRuntime } from "../../src/index.ts";
import { createTestAgentDefinition } from "../helpers/buildTestAgent.ts";

describe("AgentRuntime.create", () => {
  it("returns an Agent instance from a complete definition", async () => {
    const agent = await AgentRuntime.create(createTestAgentDefinition());
    expect(agent).toBeDefined();
    expect(typeof agent.id).toBe("string");
    expect(typeof agent.sessionId).toBe("string");
    await agent.dispose();
  });

  it("preserves a host-provided sessionId", async () => {
    const agent = await AgentRuntime.create(createTestAgentDefinition({ sessionId: "my-session-123" }));
    expect(agent.sessionId).toBe("my-session-123");
    await agent.dispose();
  });

  it("generates a sessionId when the host omits one", async () => {
    const agent = await AgentRuntime.create(createTestAgentDefinition());
    expect(agent.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    await agent.dispose();
  });
});
