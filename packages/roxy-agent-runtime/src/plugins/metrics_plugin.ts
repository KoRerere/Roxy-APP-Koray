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

import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type {
  AgentLifecycleHooks,
  InvokeAfterContext,
  InvokeBeforeContext,
  ModelAfterContext,
  ModelBeforeContext,
  ModelFirstTokenContext,
  ModelErrorContext,
  MemoryCompactionContext,
  MemoryCompactionStartedContext,
  RoxyPlugin,
  ToolAfterContext,
  ToolBeforeContext,
  ToolErrorKind,
} from '../core/interfaces.ts'

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface MetricsModelCall {
  callIndex: number
  model: string
  /** Time-to-first-token in ms; absent for non-streaming invocations. */
  ttftMs?: number
  inputTokens: number
  outputTokens: number
  cachedInputTokens?: number
  /** Wall-clock ms from model.before to model.after. */
  durationMs: number
  /** Derived: outputTokens / (durationMs / 1000). */
  tokensPerSecond: number
  /** Character count of all system blocks. */
  systemPromptChars: number
  /** Estimated token count for system prompt (heuristic: chars / 4). */
  estimatedSystemTokens: number
  /** Estimated token count for message history. */
  estimatedHistoryTokens: number
  /** Estimated total input context for this request. */
  contextTokens: number
  error?: string
}

export interface MetricsToolCall {
  callIndex: number
  toolName: string
  isError: boolean
  errorKind?: ToolErrorKind
  /** Wall-clock ms from tool.before to tool.after. */
  durationMs: number
}

export interface MetricsSummary {
  totalInputTokens: number
  totalOutputTokens: number
  totalCachedInputTokens: number
  totalToolCalls: number
  errorCount: number
  errorByKind: Record<string, number>
  cost: { input: number; output: number; total: number }
  points: number
}

export interface MetricsCompaction {
  status: 'started' | 'completed' | 'failed'
  compactedCount: number
  summaryChars?: number
  timestamp: string
}

export interface MetricsReport {
  sessionId: string
  traceId: string
  timestamp: string
  contextWindowTokens?: number
  triggerTokens?: number
  durationMs: number
  aborted: boolean
  stopReason: InvokeAfterContext['stopReason']
  modelCalls: MetricsModelCall[]
  toolCalls: MetricsToolCall[]
  compactions: MetricsCompaction[]
  summary: MetricsSummary
}

// ---------------------------------------------------------------------------
// Collector (mutable per-invoke state)
// ---------------------------------------------------------------------------

class MetricsCollector {
  sessionId = ''
  traceId = ''
  contextWindowTokens: number | undefined
  triggerTokens: number | undefined

  modelCalls: MetricsModelCall[] = []
  toolCalls: MetricsToolCall[] = []
  compactions: MetricsCompaction[] = []
  private pricing: Required<NonNullable<MetricsPluginOptions['pricing']>> = {
    inputPerMillionTokens: 0,
    outputPerMillionTokens: 0,
    pointsPerCostUnit: 1,
  }

  /** Pending model-call data — populated by model.before, finalised by model.after. */
  private pendingModel: {
    callIndex: number
    model: string
    systemPromptChars: number
    estimatedSystemTokens: number
    estimatedHistoryTokens: number
    contextTokens: number
    ttftMs?: number // set by model.firstToken
  } | null = null

  /** Pending tool-call data — populated by tool.before, finalised by tool.after. */
  private pendingTool: {
    callIndex: number
    toolName: string
  } | null = null

  reset(sessionId: string, traceId: string): void {
    this.sessionId = sessionId
    this.traceId = traceId
    this.modelCalls = []
    this.toolCalls = []
    this.compactions = []
    this.contextWindowTokens = undefined
    this.triggerTokens = undefined
    this.pendingModel = null
    this.pendingTool = null
  }

  // -- model hooks ----------------------------------------------------------

  onModelBefore(ctx: ModelBeforeContext): void {
    this.pendingModel = {
      callIndex: ctx.callIndex,
      model: ctx.model,
      systemPromptChars: ctx.systemPromptChars,
      estimatedSystemTokens: ctx.estimatedSystemTokens,
      estimatedHistoryTokens: ctx.estimatedHistoryTokens,
      contextTokens: ctx.contextTokens,
    }
  }

  onModelFirstToken(ctx: ModelFirstTokenContext): void {
    if (this.pendingModel) {
      this.pendingModel.ttftMs = ctx.latencyMs
    }
  }

  onModelAfter(ctx: ModelAfterContext): void {
    const p = this.pendingModel
    if (!p) {
      return
    }
    this.pendingModel = null

    this.modelCalls.push({
      callIndex: ctx.callIndex,
      model: ctx.model,
      ttftMs: p.ttftMs,
      inputTokens: ctx.inputTokens,
      outputTokens: ctx.outputTokens,
      ...(ctx.cachedInputTokens !== undefined ? { cachedInputTokens: ctx.cachedInputTokens } : {}),
      durationMs: ctx.durationMs,
      tokensPerSecond: ctx.durationMs > 0 ? Math.round((ctx.outputTokens / (ctx.durationMs / 1000)) * 10) / 10 : 0,
      systemPromptChars: p.systemPromptChars,
      estimatedSystemTokens: p.estimatedSystemTokens,
      estimatedHistoryTokens: p.estimatedHistoryTokens,
      contextTokens: p.contextTokens,
    })
  }

  onModelError(ctx: ModelErrorContext): void {
    const p = this.pendingModel
    this.pendingModel = null
    this.modelCalls.push({
      callIndex: ctx.callIndex,
      model: ctx.model,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: ctx.durationMs,
      tokensPerSecond: 0,
      systemPromptChars: p?.systemPromptChars ?? 0,
      estimatedSystemTokens: p?.estimatedSystemTokens ?? 0,
      estimatedHistoryTokens: p?.estimatedHistoryTokens ?? 0,
      contextTokens: p?.contextTokens ?? 0,
      error: ctx.error,
    })
  }

  // -- tool hooks -----------------------------------------------------------

  onToolBefore(ctx: ToolBeforeContext): void {
    this.pendingTool = {
      callIndex: ctx.callIndex,
      toolName: ctx.toolName,
    }
  }

  onToolAfter(ctx: ToolAfterContext): void {
    this.pendingTool = null

    this.toolCalls.push({
      callIndex: ctx.callIndex,
      toolName: ctx.toolName,
      isError: ctx.isError,
      errorKind: ctx.errorKind,
      durationMs: ctx.durationMs,
    })
  }

  // -- invoke hooks ---------------------------------------------------------

  onInvokeBefore(ctx: InvokeBeforeContext): void {
    this.reset(ctx.sessionId, ctx.traceId)
    this.contextWindowTokens = ctx.contextWindowTokens
    this.triggerTokens = ctx.triggerTokens
  }

  setPricing(pricing: MetricsPluginOptions['pricing']): void {
    this.pricing = { ...this.pricing, ...pricing }
  }

  onCompactionStarted(ctx: MemoryCompactionStartedContext): void {
    this.compactions.push({
      status: 'started',
      compactedCount: ctx.removedCount,
      timestamp: new Date(ctx.ts).toISOString(),
    })
  }

  onCompactionCompleted(ctx: MemoryCompactionContext): void {
    this.compactions.push({
      status: 'completed',
      compactedCount: ctx.removedCount,
      summaryChars: ctx.summary.length,
      timestamp: new Date(ctx.ts).toISOString(),
    })
  }

  buildReport(ctx: InvokeAfterContext): MetricsReport {
    this.finalizeCompactions()
    const summary = this.buildSummary()
    return {
      sessionId: this.sessionId,
      traceId: this.traceId,
      timestamp: new Date().toISOString(),
      ...(this.contextWindowTokens !== undefined ? { contextWindowTokens: this.contextWindowTokens } : {}),
      ...(this.triggerTokens !== undefined ? { triggerTokens: this.triggerTokens } : {}),
      durationMs: ctx.durationMs,
      aborted: ctx.aborted,
      stopReason: ctx.stopReason,
      modelCalls: this.modelCalls,
      toolCalls: this.toolCalls,
      compactions: this.compactions,
      summary,
    }
  }

  private finalizeCompactions(): void {
    const started = this.compactions.filter((event) => event.status === 'started').length
    const completed = this.compactions.filter((event) => event.status === 'completed').length
    for (let i = completed; i < started; i++) {
      const source = this.compactions.find((event) => event.status === 'started' && !event.summaryChars)
      this.compactions.push({
        status: 'failed',
        compactedCount: source?.compactedCount ?? 0,
        timestamp: new Date().toISOString(),
      })
    }
  }

  private buildSummary(): MetricsSummary {
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalCachedInputTokens = 0
    const errorByKind: Record<string, number> = {}
    let errorCount = 0

    for (const mc of this.modelCalls) {
      totalInputTokens += mc.inputTokens
      totalOutputTokens += mc.outputTokens
      totalCachedInputTokens += mc.cachedInputTokens ?? 0
    }

    for (const tc of this.toolCalls) {
      if (tc.isError) {
        errorCount++
        const kind = tc.errorKind ?? 'unknown'
        errorByKind[kind] = (errorByKind[kind] ?? 0) + 1
      }
    }

    return {
      totalInputTokens,
      totalOutputTokens,
      totalCachedInputTokens,
      totalToolCalls: this.toolCalls.length,
      errorCount,
      errorByKind,
      cost: {
        input: round((totalInputTokens / 1_000_000) * this.pricing.inputPerMillionTokens),
        output: round((totalOutputTokens / 1_000_000) * this.pricing.outputPerMillionTokens),
        total: round(
          (totalInputTokens / 1_000_000) * this.pricing.inputPerMillionTokens +
            (totalOutputTokens / 1_000_000) * this.pricing.outputPerMillionTokens,
        ),
      },
      points: round(
        ((totalInputTokens / 1_000_000) * this.pricing.inputPerMillionTokens +
          (totalOutputTokens / 1_000_000) * this.pricing.outputPerMillionTokens) *
          this.pricing.pointsPerCostUnit,
      ),
    }
  }
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

export interface MetricsPluginOptions {
  /** Directory where per-invoke JSON reports are written. */
  outputDir: string
  /** Price per one million input/output tokens. */
  pricing?: {
    inputPerMillionTokens?: number
    outputPerMillionTokens?: number
    pointsPerCostUnit?: number
  }
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
  const collector = new MetricsCollector()
  collector.setPricing(opts.pricing)

  const hooks: AgentLifecycleHooks = {
    invoke: {
      before: (ctx) => collector.onInvokeBefore(ctx),
      after: (ctx) => {
        const report = collector.buildReport(ctx)
        const dir = opts.outputDir
        ensureDir(dir)
        const filename = `${ctx.sessionId}-${Date.now()}.json`
        const filepath = join(dir, filename)
        writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8')
      },
    },
    model: {
      before: (ctx) => collector.onModelBefore(ctx),
      firstToken: (ctx) => collector.onModelFirstToken(ctx),
      after: (ctx) => collector.onModelAfter(ctx),
      error: (ctx) => collector.onModelError(ctx),
    },
    tool: {
      before: (ctx) => collector.onToolBefore(ctx),
      after: (ctx) => collector.onToolAfter(ctx),
    },
  }

  const memoryLifecycle = {
    onCompactionStarted: (ctx: MemoryCompactionStartedContext) => collector.onCompactionStarted(ctx),
    onCompaction: (ctx: MemoryCompactionContext) => collector.onCompactionCompleted(ctx),
  }

  return {
    name: 'metrics',
    version: '1.0.0',
    setup(api) {
      api.addHooks(hooks)
      api.addMemoryLifecycle(memoryLifecycle)
    },
  }
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dir: string): void {
  try {
    mkdirSync(dir, { recursive: true })
  } catch {
    // dir already exists — ok
  }
}
