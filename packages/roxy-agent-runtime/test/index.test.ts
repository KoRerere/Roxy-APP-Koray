import { describe, expect, it } from "vitest";
import * as runtime from "../src/index.ts";
import { AgentRuntime } from "../src/index.ts";
import { createTestAgentDefinition } from "./helpers/buildTestAgent.ts";

describe("roxy-agent entrypoint", () => {
  it("exports AgentRuntime without the legacy createAgent function", () => {
    // Regression: the framework exposed both a function factory and an
    // implementation class, leaving no single lifecycle-owning public API.
    // Fixed by: AgentRuntime.create() is the only assembly entry point.
    expect(typeof AgentRuntime).toBe("function");
    expect("createAgent" in runtime).toBe(false);
  });

  it("creates an AgentRuntime from a direct definition", async () => {
    const agent = await AgentRuntime.create(createTestAgentDefinition());
    expect(agent).toBeDefined();
    expect(typeof agent.id).toBe("string");
    expect(typeof agent.sessionId).toBe("string");
    expect(typeof agent.invoke).toBe("function");
    expect(typeof agent.stream).toBe("function");
    expect(typeof agent.structured).toBe("function");
    await agent.dispose();
  });
});
