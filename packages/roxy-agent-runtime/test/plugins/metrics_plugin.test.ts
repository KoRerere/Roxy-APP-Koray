import { describe, expect, it, afterEach } from "vitest";
import { rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { buildTestAgent, endTurnResponse, toolCallResponse } from "../helpers/buildTestAgent.ts";
import { chatResponse } from "../../src/provider/fake.ts";
import { metricsPlugin } from "../../src/plugins/metrics_plugin.ts";
import { assemblePlugins } from "../../src/runtime/plugin_assembler.ts";
import { mergeHooks } from "../../src/runtime/plugin_assembler.ts";
import { createLogger } from "../../src/logging/logger.ts";
import type { MetricsReport } from "../../src/plugins/metrics_plugin.ts";

function tmpDir(): string {
  return join(tmpdir(), "roxy-metrics-test-" + randomUUID());
}

async function buildAgentWithMetrics(outputDir: string, responses: Parameters<typeof buildTestAgent>[0]) {
  const plugin = metricsPlugin({ outputDir });
  const logger = createLogger({ level: "error" });
  const assembled = await assemblePlugins([plugin], logger);
  const hooks = mergeHooks(assembled.hooks);
  return buildTestAgent({ ...responses, hooks });
}

function readReport(dir: string): MetricsReport {
  const files = readdirSync(dir).filter((f: string) => f.endsWith(".json"));
  expect(files.length).toBeGreaterThan(0);
  return JSON.parse(readFileSync(join(dir, files[0]!), "utf-8")) as MetricsReport;
}

describe("metricsPlugin", () => {
  const testDirs: string[] = [];

  afterEach(() => {
    for (const d of testDirs) {
      try {
        rmSync(d, { recursive: true, force: true });
      } catch {
        /* ok */
      }
    }
    testDirs.length = 0;
  });

  function trackDir(dir: string): string {
    testDirs.push(dir);
    return dir;
  }

  // -----------------------------------------------------------------------
  // Basic metrics
  // -----------------------------------------------------------------------

  it("writes a JSON report on invoke.after with summary fields", async () => {
    const dir = trackDir(tmpDir());
    const { agent } = await buildAgentWithMetrics(dir, {
      responses: [
        chatResponse({ role: "assistant", content: "hello" }, "end_turn", { inputTokens: 100, outputTokens: 50 }),
      ],
    });

    await agent.invoke("hi");

    const report = readReport(dir);
    expect(report.sessionId).toBe(agent.sessionId);
    expect(report.aborted).toBe(false);
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
    expect(report.modelCalls).toHaveLength(1);
    expect(report.modelCalls[0]!.inputTokens).toBe(100);
    expect(report.modelCalls[0]!.outputTokens).toBe(50);
    expect(report.modelCalls[0]!.tokensPerSecond).toBeGreaterThanOrEqual(0);
    expect(report.summary.totalInputTokens).toBe(100);
    expect(report.summary.totalOutputTokens).toBe(50);
    expect(report.summary.totalToolCalls).toBe(0);
    expect(report.summary.errorCount).toBe(0);
  });

  it("records system prompt token estimation", async () => {
    const dir = trackDir(tmpDir());
    const { agent } = await buildAgentWithMetrics(dir, {
      responses: [endTurnResponse("ok")],
    });

    await agent.invoke("test");

    const report = readReport(dir);
    const mc = report.modelCalls[0]!;
    expect(mc.estimatedSystemTokens).toBeGreaterThanOrEqual(0);
    expect(mc.estimatedHistoryTokens).toBeGreaterThan(0); // user message has tokens
  });

  // -----------------------------------------------------------------------
  // Tool call tracking
  // -----------------------------------------------------------------------

  it("records tool call sequence and durations", async () => {
    const dir = trackDir(tmpDir());
    let n = 0;
    const { agent, registry } = await buildAgentWithMetrics(dir, {
      handler: () => {
        n++;
        if (n === 1) return toolCallResponse("t1", "tool_a", { x: 1 });
        if (n === 2) return toolCallResponse("t2", "tool_b", { y: 2 });
        return endTurnResponse("all done");
      },
    });
    registry.add({ name: "tool_a", description: "a", inputSchema: {}, source: "builtin" }, async () => ({
      content: "a-ok",
      isError: false,
    }));
    registry.add({ name: "tool_b", description: "b", inputSchema: {}, source: "builtin" }, async () => ({
      content: "b-ok",
      isError: false,
    }));

    await agent.invoke("go");

    const report = readReport(dir);
    expect(report.toolCalls).toHaveLength(2);
    expect(report.toolCalls[0]!.toolName).toBe("tool_a");
    expect(report.toolCalls[0]!.callIndex).toBe(0);
    expect(report.toolCalls[0]!.isError).toBe(false);
    expect(report.toolCalls[0]!.durationMs).toBeGreaterThanOrEqual(0);
    expect(report.toolCalls[1]!.toolName).toBe("tool_b");
    expect(report.toolCalls[1]!.callIndex).toBe(1);
    expect(report.summary.totalToolCalls).toBe(2);
  });

  it("classifies tool errors by errorKind", async () => {
    const dir = trackDir(tmpDir());
    let n = 0;
    const { agent, registry } = await buildAgentWithMetrics(dir, {
      handler: () => {
        n++;
        if (n === 1) return toolCallResponse("t1", "bad_param", {});
        if (n === 2) return toolCallResponse("t2", "crash_tool", {});
        return endTurnResponse("done");
      },
    });
    registry.add({ name: "bad_param", description: "bp", inputSchema: {}, source: "builtin" }, async () => ({
      content: "invalid input",
      isError: true,
    }));
    registry.add({ name: "crash_tool", description: "ct", inputSchema: {}, source: "builtin" }, async () => {
      throw new Error("BOOM");
    });

    await agent.invoke("test errors");

    const report = readReport(dir);
    expect(report.toolCalls).toHaveLength(2);

    // First tool: handler returned isError=true
    expect(report.toolCalls[0]!.isError).toBe(true);
    expect(report.toolCalls[0]!.errorKind).toBeUndefined(); // no explicit errorKind from handler

    // Second tool: handler threw — executor wraps into ToolResult{isError:true}
    expect(report.toolCalls[1]!.isError).toBe(true);

    expect(report.summary.errorCount).toBe(2);
  });

  it("records errorKind 'aborted' when middleware before() aborts", async () => {
    const dir = trackDir(tmpDir());
    let n = 0;
    const { agent, registry } = await buildAgentWithMetrics(dir, {
      handler: () => {
        n++;
        if (n === 1) return toolCallResponse("t1", "blocked_tool", {});
        return endTurnResponse("done");
      },
      middleware: [
        {
          match: "blocked_tool",
          before: () => {
            throw new Error("blocked by middleware");
          },
        },
      ],
    });
    registry.add({ name: "blocked_tool", description: "bt", inputSchema: {}, source: "builtin" }, async () => ({
      content: "never runs",
      isError: false,
    }));

    await agent.invoke("test middleware abort");

    const report = readReport(dir);
    expect(report.toolCalls).toHaveLength(1);
    expect(report.toolCalls[0]!.isError).toBe(true);
    expect(report.toolCalls[0]!.errorKind).toBe("aborted");
  });

  // -----------------------------------------------------------------------
  // Abort
  // -----------------------------------------------------------------------

  it("records aborted:true when the signal fires", async () => {
    const dir = trackDir(tmpDir());
    const { agent, registry } = await buildAgentWithMetrics(dir, {
      handler: () => toolCallResponse("t1", "slow_tool", {}),
    });
    registry.add({ name: "slow_tool", description: "st", inputSchema: {}, source: "builtin" }, async (_input, ctx) => {
      // Wait for abort
      await new Promise<void>((resolve, reject) => {
        ctx.signal.addEventListener("abort", () => {
          // Let the abort propagate
          resolve();
        });
      });
      return { content: "after abort", isError: false };
    });

    const ac = new AbortController();
    const invokePromise = agent.invoke("test abort", ac.signal);

    // Give the loop time to reach the tool
    await new Promise((r) => setTimeout(r, 50));
    ac.abort();

    await invokePromise;

    const report = readReport(dir);
    expect(report.aborted).toBe(true);
  });

  // -----------------------------------------------------------------------
  // TTFT (time to first token)
  // -----------------------------------------------------------------------

  it("records ttftMs on model calls when streaming", async () => {
    const dir = trackDir(tmpDir());
    const { agent } = await buildAgentWithMetrics(dir, {
      responses: [endTurnResponse("streamed response")],
    });

    // Consume the stream to completion
    for await (const _ of agent.stream("test ttft")) {
      void _;
    }

    const report = readReport(dir);
    expect(report.modelCalls).toHaveLength(1);
    // stream path fires model.firstToken, so ttftMs is populated
    expect(report.modelCalls[0]!.ttftMs).toBeGreaterThanOrEqual(0);
  });

  it("does NOT record ttftMs on invoke() path (non-streaming)", async () => {
    const dir = trackDir(tmpDir());
    const { agent } = await buildAgentWithMetrics(dir, {
      responses: [endTurnResponse("non-streamed")],
    });

    await agent.invoke("test invoke");

    const report = readReport(dir);
    expect(report.modelCalls[0]!.ttftMs).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Multi-turn (multiple model calls)
  // -----------------------------------------------------------------------

  it("accumulates metrics across multi-turn tool loops", async () => {
    const dir = trackDir(tmpDir());
    let n = 0;
    const { agent, registry } = await buildAgentWithMetrics(dir, {
      handler: () => {
        n++;
        if (n === 1) {
          return chatResponse(
            { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "read", input: {} }] },
            "tool_use",
            { inputTokens: 200, outputTokens: 20 },
          );
        }
        return chatResponse({ role: "assistant", content: "second turn done" }, "end_turn", {
          inputTokens: 300,
          outputTokens: 30,
        });
      },
    });
    registry.add({ name: "read", description: "r", inputSchema: {}, source: "builtin" }, async () => ({
      content: "file content",
      isError: false,
    }));

    await agent.invoke("multi-turn");

    const report = readReport(dir);
    expect(report.modelCalls).toHaveLength(2);
    expect(report.modelCalls[0]!.callIndex).toBe(0);
    expect(report.modelCalls[1]!.callIndex).toBe(1);
    expect(report.toolCalls).toHaveLength(1);
    expect(report.summary.totalInputTokens).toBe(500);
    expect(report.summary.totalOutputTokens).toBe(50);
  });

  // -----------------------------------------------------------------------
  // JSON output file
  // -----------------------------------------------------------------------

  it("writes one JSON file per invoke", async () => {
    const dir = trackDir(tmpDir());
    const { agent } = await buildAgentWithMetrics(dir, {
      responses: [endTurnResponse("first"), endTurnResponse("second")],
    });

    await agent.invoke("one");
    // Small delay to ensure distinct timestamp filenames.
    await new Promise((r) => setTimeout(r, 5));
    await agent.invoke("two");

    const files = readdirSync(dir).filter((f: string) => f.endsWith(".json"));
    expect(files).toHaveLength(2);
  });

  it("report contains valid timestamp and traceId", async () => {
    const dir = trackDir(tmpDir());
    const { agent } = await buildAgentWithMetrics(dir, {
      responses: [endTurnResponse("ok")],
    });

    await agent.invoke("test");

    const report = readReport(dir);
    expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(report.traceId).toBeTruthy();
    expect(typeof report.traceId).toBe("string");
  });
});
