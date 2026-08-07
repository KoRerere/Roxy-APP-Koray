import { describe, expect, it } from "vitest";
import { AgentRuntime } from "../../src/index.ts";
import { FullAccessHandler } from "../../src/hitl/handler.ts";
import { createLogger } from "../../src/logging/logger.ts";
import { InMemoryProvider } from "../../src/memory/memory.ts";
import { InMemoryTrajectoryRecorder } from "../../src/observability/trajectory.ts";
import { FakeProvider } from "../../src/provider/fake.ts";
import { ToolRegistry } from "../../src/tools/registry.ts";
import { endTurnResponse } from "../helpers/buildTestAgent.ts";
import type { ISessionStore, RolloutEvent, RoxyPlugin, SessionId, SessionMeta } from "../../src/core/interfaces.ts";
import { createTestAgentDefinition } from "../helpers/buildTestAgent.ts";

class MemorySessionStore implements ISessionStore {
  readonly events = new Map<SessionId, RolloutEvent[]>();

  async append(sessionId: SessionId, event: RolloutEvent): Promise<void> {
    const current = this.events.get(sessionId) ?? [];
    current.push(event);
    this.events.set(sessionId, current);
  }

  async read(sessionId: SessionId): Promise<RolloutEvent[]> {
    return [...(this.events.get(sessionId) ?? [])];
  }

  async list(): Promise<SessionMeta[]> {
    return [];
  }

  async meta(_sessionId: SessionId): Promise<SessionMeta | null> {
    return null;
  }
}

describe("AgentRuntime definition API", () => {
  it("assembles from runtime instances and uses the injected session store", async () => {
    // Regression: the runtime accepted RoxyConfig and always constructed its own
    // JSONL store, so hosts could not control rollout ownership or storage layout.
    // Fixed by: the framework assembles directly from AgentDefinition instances.
    const sessionStore = new MemorySessionStore();
    const agent = await AgentRuntime.create({
      sessionId: "host-owned-session",
      model: "fake",
      maxTokens: 1024,
      provider: new FakeProvider(),
      memory: new InMemoryProvider(),
      tools: new ToolRegistry(),
      hitl: new FullAccessHandler(),
      recorder: new InMemoryTrajectoryRecorder(),
      logger: createLogger({ level: "error" }),
      sessionStore,
    });

    expect(agent.sessionId).toBe("host-owned-session");
    expect(await sessionStore.read("host-owned-session")).toMatchObject([
      { type: "session_start", sessionId: "host-owned-session" },
    ]);
    await agent.dispose();
  });

  it("fires plugin hooks before host hooks", async () => {
    // Regression: the direct-definition factory merged host hooks before
    // plugin hooks even though plugins are the inner infrastructure layer.
    // Fixed by: plugin hooks are merged first, then AgentDefinition.hooks.
    const order: string[] = [];
    const plugin: RoxyPlugin = {
      name: "inner-observer",
      setup(api) {
        api.addHooks({ invoke: { before: () => order.push("plugin") } });
      },
    };
    const definition = createTestAgentDefinition({ responses: [endTurnResponse("done")] });
    definition.plugins = [plugin];
    definition.hooks = { invoke: { before: () => order.push("host") } };

    const agent = await AgentRuntime.create(definition);
    await agent.invoke("hello");

    expect(order).toEqual(["plugin", "host"]);
    await agent.dispose();
  });
});
