/**
 * MetricsPlugin — lifecycle-hook-based observability plugin.
 *
 * Collects per-invoke metrics (TTFT, token counts, tool-call sequence, errors,
 * abort status, wall-clock duration) and writes them as a JSON report to disk.
 *
 * Usage (via roxy.yaml):
 * ```yaml
 * plugins:
 *   - metricsPlugin({ outputDir: "./.roxy/metrics" })
 * ```
 *
 * Or programmatically:
 * ```ts
 * import { metricsPlugin } from "roxy-agent";
 * const definition: AgentDefinition = { plugins: [metricsPlugin({ outputDir: "./.roxy/metrics" })], … };
 * ```
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type {
  AgentLifecycleHooks,
  InvokeAfterContext,
  InvokeBeforeContext,
  ModelAfterContext,
  ModelBeforeContext,
  ModelFirstTokenContext,
  RoxyPlugin,
  ToolAfterContext,
  ToolBeforeContext,
  ToolErrorKind,
} from "../core/interfaces.ts";

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface MetricsModelCall {
  callIndex: number;
  model: string;
  /** Time-to-first-token in ms; absent for non-streaming invocations. */
  ttftMs?: number;
  inputTokens: number;
  outputTokens: number;
  /** Wall-clock ms from model.before to model.after. */
  durationMs: number;
  /** Derived: outputTokens / (durationMs / 1000). */
  tokensPerSecond: number;
  /** Character count of all system blocks. */
  systemPromptChars: number;
  /** Estimated token count for system prompt (heuristic: chars / 4). */
  estimatedSystemTokens: number;
  /** Estimated token count for message history. */
  estimatedHistoryTokens: number;
}

export interface MetricsToolCall {
  callIndex: number;
  toolName: string;
  isError: boolean;
  errorKind?: ToolErrorKind;
  /** Wall-clock ms from tool.before to tool.after. */
  durationMs: number;
}

export interface MetricsSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalToolCalls: number;
  errorCount: number;
  errorByKind: Record<string, number>;
}

export interface MetricsReport {
  sessionId: string;
  traceId: string;
  timestamp: string;
  durationMs: number;
  aborted: boolean;
  modelCalls: MetricsModelCall[];
  toolCalls: MetricsToolCall[];
  summary: MetricsSummary;
}

// ---------------------------------------------------------------------------
// Collector (mutable per-invoke state)
// ---------------------------------------------------------------------------

class MetricsCollector {
  sessionId = "";
  traceId = "";

  modelCalls: MetricsModelCall[] = [];
  toolCalls: MetricsToolCall[] = [];

  /** Pending model-call data — populated by model.before, finalised by model.after. */
  private pendingModel: {
    callIndex: number;
    model: string;
    systemPromptChars: number;
    estimatedSystemTokens: number;
    estimatedHistoryTokens: number;
    ttftMs?: number; // set by model.firstToken
  } | null = null;

  /** Pending tool-call data — populated by tool.before, finalised by tool.after. */
  private pendingTool: {
    callIndex: number;
    toolName: string;
  } | null = null;

  reset(sessionId: string, traceId: string): void {
    this.sessionId = sessionId;
    this.traceId = traceId;
    this.modelCalls = [];
    this.toolCalls = [];
    this.pendingModel = null;
    this.pendingTool = null;
  }

  // -- model hooks ----------------------------------------------------------

  onModelBefore(ctx: ModelBeforeContext): void {
    this.pendingModel = {
      callIndex: ctx.callIndex,
      model: ctx.model,
      systemPromptChars: 0,
      estimatedSystemTokens: ctx.estimatedSystemTokens,
      estimatedHistoryTokens: ctx.estimatedHistoryTokens,
    };
  }

  onModelFirstToken(ctx: ModelFirstTokenContext): void {
    if (this.pendingModel) {
      this.pendingModel.ttftMs = ctx.latencyMs;
    }
  }

  onModelAfter(ctx: ModelAfterContext): void {
    const p = this.pendingModel;
    if (!p) return;
    this.pendingModel = null;

    this.modelCalls.push({
      callIndex: ctx.callIndex,
      model: ctx.model,
      ttftMs: p.ttftMs,
      inputTokens: ctx.inputTokens,
      outputTokens: ctx.outputTokens,
      durationMs: ctx.durationMs,
      tokensPerSecond: ctx.durationMs > 0 ? Math.round((ctx.outputTokens / (ctx.durationMs / 1000)) * 10) / 10 : 0,
      systemPromptChars: p.systemPromptChars,
      estimatedSystemTokens: p.estimatedSystemTokens,
      estimatedHistoryTokens: p.estimatedHistoryTokens,
    });
  }

  // -- tool hooks -----------------------------------------------------------

  onToolBefore(ctx: ToolBeforeContext): void {
    this.pendingTool = {
      callIndex: ctx.callIndex,
      toolName: ctx.toolName,
    };
  }

  onToolAfter(ctx: ToolAfterContext): void {
    const p = this.pendingTool;
    this.pendingTool = null;

    this.toolCalls.push({
      callIndex: ctx.callIndex,
      toolName: ctx.toolName,
      isError: ctx.isError,
      errorKind: ctx.errorKind,
      durationMs: ctx.durationMs,
    });
  }

  // -- invoke hooks ---------------------------------------------------------

  onInvokeBefore(ctx: InvokeBeforeContext): void {
    this.reset(ctx.sessionId, ctx.traceId);
  }

  buildReport(ctx: InvokeAfterContext): MetricsReport {
    const summary = this.buildSummary();
    return {
      sessionId: this.sessionId,
      traceId: this.traceId,
      timestamp: new Date().toISOString(),
      durationMs: ctx.durationMs,
      aborted: ctx.aborted,
      modelCalls: this.modelCalls,
      toolCalls: this.toolCalls,
      summary,
    };
  }

  private buildSummary(): MetricsSummary {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const errorByKind: Record<string, number> = {};
    let errorCount = 0;

    for (const mc of this.modelCalls) {
      totalInputTokens += mc.inputTokens;
      totalOutputTokens += mc.outputTokens;
    }

    for (const tc of this.toolCalls) {
      if (tc.isError) {
        errorCount++;
        const kind = tc.errorKind ?? "unknown";
        errorByKind[kind] = (errorByKind[kind] ?? 0) + 1;
      }
    }

    return {
      totalInputTokens,
      totalOutputTokens,
      totalToolCalls: this.toolCalls.length,
      errorCount,
      errorByKind,
    };
  }
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

export interface MetricsPluginOptions {
  /** Directory where per-invoke JSON reports are written. */
  outputDir: string;
}

/**
 * Create a {@link RoxyPlugin} that records per-invoke metrics to JSON files.
 *
 * One file is written per `invoke()` / `stream()` call:
 * `{outputDir}/{sessionId}-{timestamp}.json`
 *
 * Hooks run synchronously (fire-and-forget); file I/O is sync so writes
 * complete before the hook returns.
 */
export function metricsPlugin(opts: MetricsPluginOptions): RoxyPlugin {
  const collector = new MetricsCollector();

  const hooks: AgentLifecycleHooks = {
    invoke: {
      before: (ctx) => collector.onInvokeBefore(ctx),
      after: (ctx) => {
        const report = collector.buildReport(ctx);
        const dir = opts.outputDir;
        ensureDir(dir);
        const filename = `${ctx.sessionId}-${Date.now()}.json`;
        const filepath = join(dir, filename);
        writeFileSync(filepath, JSON.stringify(report, null, 2), "utf-8");
      },
    },
    model: {
      before: (ctx) => collector.onModelBefore(ctx),
      firstToken: (ctx) => collector.onModelFirstToken(ctx),
      after: (ctx) => collector.onModelAfter(ctx),
    },
    tool: {
      before: (ctx) => collector.onToolBefore(ctx),
      after: (ctx) => collector.onToolAfter(ctx),
    },
  };

  return {
    name: "metrics",
    version: "1.0.0",
    setup(api) {
      api.addHooks(hooks);
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dir: string): void {
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // dir already exists — ok
  }
}
