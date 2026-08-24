import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, it } from 'vitest'
import { readMetricsSummary } from './metricsService'

const roots: string[] = []

async function writeReport(
  root: string,
  conversationId: string,
  name: string,
  report: Record<string, unknown>,
) {
  const dir = path.join(root, conversationId, 'metrics')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, name), JSON.stringify(report), 'utf8')
}

function report(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'conversation-1',
    traceId: 'trace-1',
    timestamp: '2026-08-12T08:00:00.000Z',
    durationMs: 1_000,
    aborted: false,
    stopReason: 'end_turn',
    modelCalls: [{
      callIndex: 0,
      model: 'deepseek-chat',
      ttftMs: 120,
      inputTokens: 100,
      outputTokens: 50,
      durationMs: 500,
      tokensPerSecond: 100,
      systemPromptChars: 400,
      estimatedSystemTokens: 100,
      estimatedHistoryTokens: 20,
      contextTokens: 120,
    }],
    toolCalls: [{ callIndex: 0, toolName: 'read_file', isError: false, durationMs: 100 }],
    compactions: [],
    summary: {
      totalInputTokens: 100,
      totalOutputTokens: 50,
      totalToolCalls: 1,
      errorCount: 0,
      errorByKind: {},
      cost: { input: 0.1, output: 0.1, total: 0.2 },
      points: 0.2,
    },
    ...overrides,
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

describe('metricsService', () => {
  it('aggregates run, latency, token, tool and trend metrics', async () => {
    // Regression: metrics were isolated per-invoke JSON files, so the product could not compare runs or expose trends.
    // Fixed by: aggregate valid reports into a stable dashboard summary.
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'roxy-metrics-summary-'))
    roots.push(root)
    await writeReport(root, 'conversation-1', 'a.json', report())
    await writeReport(root, 'conversation-2', 'b.json', report({
      sessionId: 'conversation-2',
      traceId: 'trace-2',
      timestamp: '2026-08-12T09:00:00.000Z',
      durationMs: 3_000,
      aborted: true,
      stopReason: 'aborted',
      modelCalls: [{
        callIndex: 0,
        model: 'deepseek-chat',
        ttftMs: 280,
        inputTokens: 300,
        outputTokens: 100,
        durationMs: 1_000,
        tokensPerSecond: 100,
        systemPromptChars: 400,
        estimatedSystemTokens: 100,
        estimatedHistoryTokens: 100,
        contextTokens: 200,
      }],
      toolCalls: [{ callIndex: 0, toolName: 'read_file', isError: true, errorKind: 'handler_error', durationMs: 300 }],
      compactions: [{ status: 'failed', compactedCount: 4, timestamp: '2026-08-12T09:00:00.000Z' }],
      summary: {
        totalInputTokens: 300,
        totalOutputTokens: 100,
        totalToolCalls: 1,
        errorCount: 1,
        errorByKind: { handler_error: 1 },
        cost: { input: 0.3, output: 0.2, total: 0.5 },
        points: 0.5,
      },
    }))

    const summary = await readMetricsSummary({ sessionsRoot: root })

    assert.equal(summary.sampleSize, 2)
    assert.deepEqual(summary.totals, {
      runs: 2,
      abortedRuns: 1,
      modelCalls: 2,
      toolCalls: 2,
      inputTokens: 400,
      outputTokens: 150,
      durationMs: 4_000,
      cost: 0.7,
      points: 0.7,
    })
    assert.equal(summary.rates.completionRate, 0.5)
    assert.equal(summary.rates.abortRate, 0.5)
    assert.equal(summary.rates.toolErrorRate, 0.5)
    assert.equal(summary.latency.avgRunDurationMs, 2_000)
    assert.equal(summary.latency.p95RunDurationMs, 3_000)
    assert.equal(summary.latency.avgTtftMs, 200)
    assert.equal(summary.context.maxContextTokens, 200)
    assert.equal(summary.context.compactionFailures, 1)
    assert.deepEqual(summary.tools[0], {
      toolName: 'read_file',
      calls: 2,
      errors: 1,
      errorRate: 0.5,
      avgDurationMs: 200,
    })
    assert.equal(summary.trend[0]?.date, '2026-08-12')
    assert.equal(summary.trend[0]?.runs, 2)
  })

  it('ignores malformed files and filters by conversation', async () => {
    // Regression: one partial metrics write could make all historical metrics unreadable.
    // Fixed by: skip malformed reports and scope discovery to a validated conversation directory.
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'roxy-metrics-summary-'))
    roots.push(root)
    await writeReport(root, 'conversation-1', 'valid.json', report())
    await writeReport(root, 'conversation-2', 'other.json', report({ sessionId: 'conversation-2' }))
    const corruptDir = path.join(root, 'conversation-1', 'metrics')
    await fs.writeFile(path.join(corruptDir, 'corrupt.json'), '{', 'utf8')

    const summary = await readMetricsSummary({ sessionsRoot: root, conversationId: 'conversation-1' })

    assert.equal(summary.sampleSize, 1)
    assert.equal(summary.skippedReports, 1)
  })

  it('does not claim capability without outcome labels and emits evidence-backed recommendations', async () => {
    // Regression: runtime efficiency metrics could be mistaken for agent capability or task correctness.
    // Fixed by: capability remains explicitly unavailable and recommendations expose their metric evidence.
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'roxy-metrics-summary-'))
    roots.push(root)
    await writeReport(root, 'conversation-1', 'a.json', report({
      aborted: true,
      stopReason: 'aborted',
      toolCalls: [{ callIndex: 0, toolName: 'exec_command', isError: true, errorKind: 'handler_error', durationMs: 100 }],
      summary: {
        totalInputTokens: 100,
        totalOutputTokens: 50,
        totalToolCalls: 1,
        errorCount: 1,
        errorByKind: { handler_error: 1 },
        cost: { input: 0.1, output: 0.1, total: 0.2 },
        points: 0.2,
      },
    }))

    const summary = await readMetricsSummary({ sessionsRoot: root })

    assert.equal(summary.capability.status, 'unavailable')
    assert.match(summary.capability.reason, /outcome|结果/i)
    assert.ok(summary.recommendations.some(item => item.id === 'add-outcome-evaluation'))
    assert.ok(summary.recommendations.some(item => item.id === 'reduce-tool-errors'))
    assert.ok(summary.recommendations.every(item => item.evidence.length > 0))
  })
})
