import { describe, expect, it } from "vitest";
import type {
  IContextContributor,
  PluginAPI,
  RoxyPlugin,
  SystemBlock,
  ToolMiddleware,
} from "../../src/core/interfaces.ts";
import { createLogger } from "../../src/logging/logger.ts";
import { assemblePlugins } from "../../src/runtime/plugin_assembler.ts";
import { buildTestAgent } from "../helpers/buildTestAgent.ts";

const logger = createLogger({ level: "error" });

describe("assemblePlugins", () => {
  it("calls setup() on each plugin in declaration order", async () => {
    const order: number[] = [];
    const plugins: RoxyPlugin[] = [
      {
        name: "a",
        async setup(_api: PluginAPI) {
          order.push(1);
        },
      },
      {
        name: "b",
        async setup(_api: PluginAPI) {
          order.push(2);
        },
      },
    ];
    await assemblePlugins(plugins, logger);
    expect(order).toEqual([1, 2]);
  });

  it("registerTools — tools appear in the assembled result", async () => {
    const plugins: RoxyPlugin[] = [
      {
        name: "test",
        setup(api: PluginAPI) {
          api.registerTools([
            {
              descriptor: { name: "plugin_tool", description: "x", inputSchema: { type: "object" }, source: "builtin" },
              handler: async () => ({ content: "ok", isError: false }),
            },
          ]);
        },
      },
    ];
    const result = await assemblePlugins(plugins, logger);
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0]!.descriptor.name).toBe("plugin_tool");
  });

  it("addContextContributor — contributors appear in the assembled result", async () => {
    const contributor: IContextContributor = {
      async contribute(): Promise<SystemBlock[]> {
        return [{ type: "text", text: "injected" }];
      },
    };
    const plugins: RoxyPlugin[] = [
      {
        name: "test",
        setup(api: PluginAPI) {
          api.addContextContributor(contributor);
        },
      },
    ];
    const result = await assemblePlugins(plugins, logger);
    expect(result.contributors).toHaveLength(1);
    expect(result.contributors[0]).toBe(contributor);
  });

  it("addHooks — hooks appear in the assembled result", async () => {
    const seen: string[] = [];
    const plugins: RoxyPlugin[] = [
      {
        name: "test",
        setup(api: PluginAPI) {
          api.addHooks({ invoke: { before: () => seen.push("before") } });
        },
      },
    ];
    const result = await assemblePlugins(plugins, logger);
    expect(result.hooks).toHaveLength(1);
    result.hooks[0]?.invoke?.before?.({ agentId: "a", sessionId: "s", traceId: "t", mode: "invoke", input: "x" });
    expect(seen).toContain("before");
  });

  it("addToolMiddleware — middleware appears in the assembled result", async () => {
    const mw: ToolMiddleware = { before: async (input) => input };
    const plugins: RoxyPlugin[] = [
      {
        name: "test",
        setup(api: PluginAPI) {
          api.addToolMiddleware(mw);
        },
      },
    ];
    const result = await assemblePlugins(plugins, logger);
    expect(result.middleware).toHaveLength(1);
    expect(result.middleware[0]).toBe(mw);
  });

  it("onDispose — callbacks collected in registration order (executed LIFO)", async () => {
    const order: string[] = [];
    const plugins: RoxyPlugin[] = [
      {
        name: "test",
        setup(api: PluginAPI) {
          api.onDispose(() => {
            order.push("first");
          });
          api.onDispose(() => {
            order.push("second");
          });
        },
      },
    ];
    const result = await assemblePlugins(plugins, logger);
    // Caller (AgentRuntime/AgentImpl) runs them in reverse
    for (const cb of [...result.disposeCallbacks].reverse()) {
      await cb();
    }
    expect(order).toEqual(["second", "first"]);
  });

  it("throws on duplicate plugin name", async () => {
    const plugins: RoxyPlugin[] = [
      { name: "dup", setup(_api: PluginAPI) {} },
      { name: "dup", setup(_api: PluginAPI) {} },
    ];
    await expect(assemblePlugins(plugins, logger)).rejects.toThrow("dup");
  });

  it("aggregates tools from multiple plugins", async () => {
    const plugins: RoxyPlugin[] = [
      {
        name: "a",
        setup(api: PluginAPI) {
          api.registerTools([
            {
              descriptor: { name: "tool_a", description: "", inputSchema: {}, source: "builtin" },
              handler: async () => ({ content: "", isError: false }),
            },
          ]);
        },
      },
      {
        name: "b",
        setup(api: PluginAPI) {
          api.registerTools([
            {
              descriptor: { name: "tool_b", description: "", inputSchema: {}, source: "builtin" },
              handler: async () => ({ content: "", isError: false }),
            },
          ]);
        },
      },
    ];
    const result = await assemblePlugins(plugins, logger);
    expect(result.tools.map((t) => t.descriptor.name).sort()).toEqual(["tool_a", "tool_b"]);
  });
});

describe("AgentImpl dispose callback ordering", () => {
  it("addDisposeCallback — callbacks run in reverse registration order", async () => {
    const order: string[] = [];
    const { agent } = buildTestAgent();
    agent.addDisposeCallback(() => {
      order.push("1st");
    });
    agent.addDisposeCallback(() => {
      order.push("2nd");
    });
    await agent.dispose();
    expect(order).toEqual(["2nd", "1st"]);
  });

  it("dispose() is idempotent — callbacks run only once", async () => {
    const calls: number[] = [];
    const { agent } = buildTestAgent();
    agent.addDisposeCallback(() => {
      calls.push(1);
    });
    await agent.dispose();
    await agent.dispose(); // second call is no-op
    expect(calls).toHaveLength(1);
  });
});
