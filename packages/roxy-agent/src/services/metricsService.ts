import fs from 'node:fs/promises'
import path from 'node:path'
import { agentPaths } from '@/core/storage/agentPaths'

interface MetricsModelCall {
  ttftMs?: number
  inputTokens?: number
  outputTokens?: number
  durationMs?: number
  contextTokens?: number
}

interface MetricsToolCall {
  toolName?: string
  isError?: boolean
  errorKind?: string
  durationMs?: number
}

interface MetricsCompaction {
  status?: string
}

interface MetricsReport {
  sessionId: string
  traceId: string
  timestamp: string
  durationMs: number
  aborted: boolean
  stopReason?: string
  modelCalls: MetricsModelCall[]
  toolCalls: MetricsToolCall[]
  compactions: MetricsCompaction[]
  summary: {
    totalInputTokens?: number
    totalOutputTokens?: number
    totalToolCalls?: number
    errorCount?: number
    cost?: { total?: number }
    points?: number
  }
}

export interface MetricsRecommendation {
  id: string
  priority: 'high' | 'medium' | 'low'
  title: string
  action: string
  evidence: string[]
}

export interface MetricsDashboardSummary {
  generatedAt: string
  sampleSize: number
  skippedReports: number
  totals: {
    runs: number
    abortedRuns: number
    modelCalls: number
    toolCalls: number
    inputTokens: number
    outputTokens: number
    durationMs: number
    cost: number
    points: number
  }
  rates: {
    completionRate: number
    abortRate: number
    toolErrorRate: number
  }
  latency: {
    avgRunDurationMs: number
    p95RunDurationMs: number
    avgTtftMs: number | null
    p95TtftMs: number | null
  }
  context: {
    avgContextTokens: number
    maxContextTokens: number
    compactions: number
    compactionFailures: number
  }
  tools: Array<{
    toolName: string
    calls: number
    errors: number
    errorRate: number
    avgDurationMs: number
  }>
  errors: Array<{ kind: string, count: number }>
  trend: Array<{
    date: string
    runs: number
    completionRate: number
    toolErrorRate: number
    avgDurationMs: number
    totalTokens: number
  }>
  recentRuns: Array<{
    sessionId: string
    traceId: string
    timestamp: string
    durationMs: number
    aborted: boolean
    toolCalls: number
    toolErrors: number
    totalTokens: number
  }>
  capability: {
    status: 'unavailable'
    reason: string
    requiredSignals: string[]
  }
  recommendations: MetricsRecommendation[]
}

export interface ReadMetricsSummaryOptions {
  sessionsRoot?: string
  conversationId?: string
  limit?: number
}

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function round(value: number, digits = 4): number {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? round(numerator / denominator) : 0
}

function average(values: number[]): number {
  return values.length > 0 ? round(values.reduce((sum, value) => sum + value, 0) / values.length, 2) : 0
}

function percentile(values: number[], p: number): number {
  if (values.length === 0)
    return 0
  const ordered = [...values].sort((a, b) => a - b)
  return ordered[Math.max(0, Math.ceil(p * ordered.length) - 1)] ?? 0
}

function isMetricsReport(value: unknown): value is MetricsReport {
  if (!value || typeof value !== 'object')
    return false
  const report = value as Partial<MetricsReport>
  const validModelCalls = Array.isArray(report.modelCalls) && report.modelCalls.every(call => !!call && typeof call === 'object')
  const validToolCalls = Array.isArray(report.toolCalls) && report.toolCalls.every(call => !!call && typeof call === 'object')
  const validCompactions = Array.isArray(report.compactions) && report.compactions.every(event => !!event && typeof event === 'object')
  return typeof report.sessionId === 'string'
    && typeof report.traceId === 'string'
    && typeof report.timestamp === 'string'
    && typeof report.durationMs === 'number'
    && typeof report.aborted === 'boolean'
    && validModelCalls
    && validToolCalls
    && validCompactions
    && !!report.summary
    && typeof report.summary === 'object'
}

async function findReportFiles(sessionsRoot: string, conversationId?: string): Promise<string[]> {
  if (conversationId) {
    if (!/^[\w.-]+$/.test(conversationId))
      return []
    const metricsDir = path.join(sessionsRoot, conversationId, 'metrics')
    try {
      const entries = await fs.readdir(metricsDir, { withFileTypes: true })
      return entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
        .map(entry => path.join(metricsDir, entry.name))
    }
    catch {
      return []
    }
  }

  try {
    const entries = await fs.readdir(sessionsRoot, { recursive: true, withFileTypes: true })
    return entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.json') && entry.parentPath.endsWith(`${path.sep}metrics`))
      .map(entry => path.join(entry.parentPath, entry.name))
  }
  catch {
    return []
  }
}

async function readReports(files: string[], limit: number): Promise<{ reports: MetricsReport[], skipped: number }> {
  const reports: MetricsReport[] = []
  let skipped = 0
  const loaded: Array<{ file: string, report: MetricsReport }> = []
  for (const file of files) {
    try {
      const parsed: unknown = JSON.parse(await fs.readFile(file, 'utf8'))
      if (!isMetricsReport(parsed)) {
        skipped++
        continue
      }
      loaded.push({ file, report: parsed })
    }
    catch {
      skipped++
    }
  }
  loaded.sort((a, b) => Date.parse(a.report.timestamp) - Date.parse(b.report.timestamp))
  reports.push(...loaded.slice(-limit).map(item => item.report))
  return { reports, skipped }
}

function buildRecommendations(summary: Omit<MetricsDashboardSummary, 'recommendations'>): MetricsRecommendation[] {
  const recommendations: MetricsRecommendation[] = [{
    id: 'add-outcome-evaluation',
    priority: 'high',
    title: '建立任务结果评测集',
    action: '为核心任务族补充成功条件、人工反馈或 deterministic grader，并记录 agent/version/model/prompt 版本。',
    evidence: ['当前数据只有运行过程指标，没有任务结果标签，无法计算真实能力或回归。'],
  }]

  if (summary.rates.toolErrorRate >= 0.1) {
    const worstTool = summary.tools.find(tool => tool.errors > 0)
    recommendations.push({
      id: 'reduce-tool-errors',
      priority: summary.rates.toolErrorRate >= 0.25 ? 'high' : 'medium',
      title: '优先降低工具调用错误',
      action: `从 ${worstTool?.toolName ?? '高错误工具'} 的参数校验、错误反馈和重试策略开始修复。`,
      evidence: [`工具错误率 ${(summary.rates.toolErrorRate * 100).toFixed(1)}%。`],
    })
  }

  if (summary.rates.abortRate >= 0.1) {
    recommendations.push({
      id: 'reduce-aborts',
      priority: summary.rates.abortRate >= 0.25 ? 'high' : 'medium',
      title: '定位中止任务的共同路径',
      action: '按任务类型和最后一个 tool/model step 切分中止样本，区分用户取消、超时和 runtime 异常。',
      evidence: [`中止率 ${(summary.rates.abortRate * 100).toFixed(1)}%。`],
    })
  }

  if (summary.context.compactionFailures > 0) {
    recommendations.push({
      id: 'stabilize-compaction',
      priority: 'medium',
      title: '修复上下文压缩失败',
      action: '保留失败样本的 context size 和 summary provider 错误，验证压缩后的任务完成率。',
      evidence: [`发现 ${summary.context.compactionFailures} 次压缩失败。`],
    })
  }

  if (summary.latency.p95RunDurationMs >= 30_000) {
    recommendations.push({
      id: 'reduce-tail-latency',
      priority: 'medium',
      title: '降低长尾任务耗时',
      action: '在 trace 瀑布中拆分模型等待、工具执行与重试时间，先优化占比最高的阶段。',
      evidence: [`P95 任务耗时 ${(summary.latency.p95RunDurationMs / 1000).toFixed(1)} 秒。`],
    })
  }

  return recommendations
}

export async function readMetricsSummary(options: ReadMetricsSummaryOptions = {}): Promise<MetricsDashboardSummary> {
  const sessionsRoot = options.sessionsRoot ?? path.join(agentPaths.home, 'sessions')
  const files = await findReportFiles(sessionsRoot, options.conversationId)
  const { reports, skipped } = await readReports(files, Math.min(Math.max(options.limit ?? 1_000, 1), 10_000))
  reports.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))

  const runDurations = reports.map(report => finite(report.durationMs))
  const modelCalls = reports.flatMap(report => report.modelCalls)
  const toolCalls = reports.flatMap(report => report.toolCalls)
  const ttfts = modelCalls.map(call => call.ttftMs).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const contextTokens = modelCalls.map(call => finite(call.contextTokens))
  const abortedRuns = reports.filter(report => report.aborted).length
  const toolErrors = toolCalls.filter(call => call.isError).length

  const totals = {
    runs: reports.length,
    abortedRuns,
    modelCalls: modelCalls.length,
    toolCalls: toolCalls.length,
    inputTokens: reports.reduce((sum, report) => sum + finite(report.summary.totalInputTokens), 0),
    outputTokens: reports.reduce((sum, report) => sum + finite(report.summary.totalOutputTokens), 0),
    durationMs: runDurations.reduce((sum, value) => sum + value, 0),
    cost: round(reports.reduce((sum, report) => sum + finite(report.summary.cost?.total), 0), 6),
    points: round(reports.reduce((sum, report) => sum + finite(report.summary.points), 0), 6),
  }

  const toolMap = new Map<string, { calls: number, errors: number, durationMs: number }>()
  const errorMap = new Map<string, number>()
  for (const call of toolCalls) {
    const toolName = call.toolName || 'unknown'
    const aggregate = toolMap.get(toolName) ?? { calls: 0, errors: 0, durationMs: 0 }
    aggregate.calls++
    aggregate.durationMs += finite(call.durationMs)
    if (call.isError) {
      aggregate.errors++
      const kind = call.errorKind || 'unknown'
      errorMap.set(kind, (errorMap.get(kind) ?? 0) + 1)
    }
    toolMap.set(toolName, aggregate)
  }

  const tools = [...toolMap.entries()]
    .map(([toolName, value]) => ({
      toolName,
      calls: value.calls,
      errors: value.errors,
      errorRate: ratio(value.errors, value.calls),
      avgDurationMs: average(Array.from({ length: value.calls }, () => value.durationMs / value.calls)),
    }))
    .sort((a, b) => b.errors - a.errors || b.calls - a.calls || a.toolName.localeCompare(b.toolName))

  const trendMap = new Map<string, MetricsReport[]>()
  for (const report of reports) {
    const date = report.timestamp.slice(0, 10)
    trendMap.set(date, [...(trendMap.get(date) ?? []), report])
  }
  const trend = [...trendMap.entries()].map(([date, dayReports]) => {
    const dayTools = dayReports.flatMap(report => report.toolCalls)
    const dayErrors = dayTools.filter(call => call.isError).length
    const completed = dayReports.filter(report => !report.aborted).length
    return {
      date,
      runs: dayReports.length,
      completionRate: ratio(completed, dayReports.length),
      toolErrorRate: ratio(dayErrors, dayTools.length),
      avgDurationMs: average(dayReports.map(report => report.durationMs)),
      totalTokens: dayReports.reduce((sum, report) => sum + finite(report.summary.totalInputTokens) + finite(report.summary.totalOutputTokens), 0),
    }
  }).slice(-30)

  const baseSummary: Omit<MetricsDashboardSummary, 'recommendations'> = {
    generatedAt: new Date().toISOString(),
    sampleSize: reports.length,
    skippedReports: skipped,
    totals,
    rates: {
      completionRate: ratio(totals.runs - abortedRuns, totals.runs),
      abortRate: ratio(abortedRuns, totals.runs),
      toolErrorRate: ratio(toolErrors, toolCalls.length),
    },
    latency: {
      avgRunDurationMs: average(runDurations),
      p95RunDurationMs: percentile(runDurations, 0.95),
      avgTtftMs: ttfts.length ? average(ttfts) : null,
      p95TtftMs: ttfts.length ? percentile(ttfts, 0.95) : null,
    },
    context: {
      avgContextTokens: average(contextTokens),
      maxContextTokens: contextTokens.length ? Math.max(...contextTokens) : 0,
      compactions: reports.reduce((sum, report) => sum + report.compactions.filter(item => item.status === 'completed').length, 0),
      compactionFailures: reports.reduce((sum, report) => sum + report.compactions.filter(item => item.status === 'failed').length, 0),
    },
    tools,
    errors: [...errorMap.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count),
    trend,
    recentRuns: [...reports].reverse().slice(0, 20).map(report => ({
      sessionId: report.sessionId,
      traceId: report.traceId,
      timestamp: report.timestamp,
      durationMs: report.durationMs,
      aborted: report.aborted,
      toolCalls: report.toolCalls.length,
      toolErrors: report.toolCalls.filter(call => call.isError).length,
      totalTokens: finite(report.summary.totalInputTokens) + finite(report.summary.totalOutputTokens),
    })),
    capability: {
      status: 'unavailable',
      reason: '当前 metrics 没有任务 outcome/结果标签，不能据此判断 Agent 是否完成了用户目标。',
      requiredSignals: ['任务类型与难度', '成功条件或 grader 结果', '用户反馈与人工复核', 'agent/model/prompt/tool 版本'],
    },
  }

  return {
    ...baseSummary,
    recommendations: buildRecommendations(baseSummary),
  }
}
