import type { IncomingMessage, ServerResponse } from 'node:http'
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { PluginOption } from 'vite'
import { describeEvent, parseRolloutText, summarizeText } from './rolloutFile'

interface SessionKeyPayload {
  root: string
  relPath: string
}

interface RolloutSessionSummary {
  key: string
  root: string
  rootLabel: string
  relPath: string
  filePath: string
  sessionId: string
  size: number
  createdAt: number
  updatedAt: number
  eventCount: number
  counts: Record<string, number>
  preview: string
  lastEventType?: string
  parseError?: string
}

interface ContextWindowSummary {
  usedTokens: number
  contextWindowTokens: number
  compressionThresholdTokens: number
  distanceToCompressionTokens: number
  usageRatio: number
  compressionRatio: number
  status: 'ok' | 'warning' | 'over'
  source: 'metrics' | 'current-chat-default'
  model?: string
  callIndex?: number
  updatedAt?: string
}

interface TokenUsageSummary {
  totalTokens: number
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  uncachedInputTokens: number
  cacheHitRate: number
  costCny: {
    cachedInput: number
    uncachedInput: number
    output: number
    total: number
  }
  modelCalls: number
  reports: number
  source: 'metrics'
}

interface ParsedRolloutEvent {
  lineNo: number
  raw: string
  event: Record<string, unknown>
  summary: string
}

interface RolloutSessionDetail extends RolloutSessionSummary {
  events: ParsedRolloutEvent[]
  contextWindow?: ContextWindowSummary
  tokenUsage?: TokenUsageSummary
}

interface MetricsModelCall {
  ttftMs?: number
  inputTokens?: number
  outputTokens?: number
  cachedInputTokens?: number
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
  contextWindowTokens?: number
  triggerTokens?: number
  durationMs: number
  aborted: boolean
  stopReason?: string
  modelCalls: MetricsModelCall[]
  toolCalls: MetricsToolCall[]
  compactions: MetricsCompaction[]
  summary: {
    totalInputTokens?: number
    totalOutputTokens?: number
    totalCachedInputTokens?: number
    totalToolCalls?: number
    errorCount?: number
    cost?: { total?: number }
    points?: number
  }
}

interface MetricsRecommendation {
  id: string
  priority: 'high' | 'medium' | 'low'
  title: string
  action: string
  evidence: string[]
}

interface MetricsSummary {
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

const DEFAULT_ROOTS = [
  path.join(os.homedir(), '.roxy-agent-dev', 'sessions'),
  path.join(os.homedir(), '.roxy-agent', 'sessions'),
]
// Fallback for old metrics reports that predate persisted runtime settings.
// Current chat defaults come from packages/roxy-agent/src/runtime/compaction.ts.
export const CURRENT_CHAT_CONTEXT_WINDOW_TOKENS = 1_000_000
export const CURRENT_CHAT_COMPRESSION_TRIGGER_RATIO = 0.5
export const CURRENT_CHAT_COMPRESSION_THRESHOLD_TOKENS = Math.floor(
  CURRENT_CHAT_CONTEXT_WINDOW_TOKENS * CURRENT_CHAT_COMPRESSION_TRIGGER_RATIO,
)
const DEEPSEEK_V4_FLASH_CNY_PER_MILLION = {
  cachedInput: 0.02,
  uncachedInput: 1,
  output: 2,
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
  if (values.length === 0) {
    return 0
  }
  const ordered = [...values].sort((a, b) => a - b)
  return ordered[Math.max(0, Math.ceil(p * ordered.length) - 1)] ?? 0
}

function resolveAgentHome(isProd?: boolean): string {
  return path.join(os.homedir(), `.roxy-agent${!isProd ? '-dev' : ''}`)
}

function getViewerRoots() {
  const envValue = process.env.ROLLOUT_VIEWER_ROOTS ?? process.env.ROXY_ROLLOUT_ROOT
  const roots = envValue
    ? String(envValue).split(',').map(item => item.trim()).filter(Boolean)
    : [...DEFAULT_ROOTS]
  return roots
    .map(item => path.resolve(item))
    .filter((item, index, array) => array.indexOf(item) === index)
    .filter(root => fs.existsSync(root) && fs.statSync(root).isDirectory())
}

function formatRootLabel(root: string) {
  const devHome = resolveAgentHome(false)
  const prodHome = resolveAgentHome(true)
  if (root.startsWith(devHome)) {
    return '~/.roxy-agent-dev'
  }
  if (root.startsWith(prodHome)) {
    return '~/.roxy-agent'
  }
  return root
}

function encodeSessionKey(root: string, filePath: string): string {
  const payload: SessionKeyPayload = { root, relPath: path.relative(root, filePath) }
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function decodeSessionKey(key: string): SessionKeyPayload | null {
  try {
    const payload = JSON.parse(Buffer.from(String(key), 'base64url').toString('utf8')) as Partial<SessionKeyPayload>
    if (typeof payload.root !== 'string' || typeof payload.relPath !== 'string') {
      return null
    }
    const root = path.resolve(payload.root)
    const filePath = path.resolve(root, payload.relPath)
    if (!filePath.startsWith(root + path.sep)) {
      return null
    }
    return { root, relPath: payload.relPath }
  }
  catch {
    return null
  }
}

function safeStat(filePath: string) {
  try {
    return fs.statSync(filePath)
  }
  catch {
    return null
  }
}

function walkFiles(root: string, onFile: (filePath: string) => void) {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(root, { withFileTypes: true })
  }
  catch {
    return
  }
  for (const entry of entries) {
    const filePath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      walkFiles(filePath, onFile)
      continue
    }
    if (entry.isFile()) {
      onFile(filePath)
    }
  }
}

export { describeEvent }

function parseSessionFile(filePath: string): { events: ParsedRolloutEvent[], parseError?: string } {
  const text = fs.readFileSync(filePath, 'utf8')
  return parseRolloutText(text)
}

function buildSessionSummary(root: string, filePath: string): RolloutSessionSummary | null {
  const stat = safeStat(filePath)
  if (!stat) {
    return null
  }
  const { events, parseError } = parseSessionFile(filePath)
  if (events.length === 0) {
    return null
  }

  const counts: Record<string, number> = {}
  let preview = ''
  let lastEventType: string | undefined
  for (const item of events) {
    const type = String(item.event.type ?? 'unknown')
    counts[type] = (counts[type] ?? 0) + 1
    lastEventType = type
    if (!preview) {
      preview = summarizeText(item.event.message) || summarizeText(item.event.result) || item.summary
    }
  }

  return {
    key: encodeSessionKey(root, filePath),
    root,
    rootLabel: formatRootLabel(root),
    relPath: path.relative(root, filePath),
    filePath,
    sessionId: path.basename(path.dirname(filePath)),
    size: stat.size,
    createdAt: Number.isFinite(stat.birthtimeMs) ? stat.birthtimeMs : stat.mtimeMs,
    updatedAt: stat.mtimeMs,
    eventCount: events.length,
    counts,
    preview,
    lastEventType,
    parseError,
  }
}

function listRolloutSessions(): RolloutSessionSummary[] {
  const sessions: RolloutSessionSummary[] = []
  for (const root of getViewerRoots()) {
    walkFiles(root, (filePath) => {
      if (path.basename(filePath) !== 'rollout.jsonl') {
        return
      }
      const summary = buildSessionSummary(root, filePath)
      if (summary) {
        sessions.push(summary)
      }
    })
  }
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt || a.relPath.localeCompare(b.relPath))
}

function readSessionContextWindow(root: string, sessionId: string): ContextWindowSummary | undefined {
  const reports = readSessionMetricReports(root, sessionId)
  reports.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
  for (let index = reports.length - 1; index >= 0; index -= 1) {
    const report = reports[index]
    const modelCall = [...report.modelCalls].reverse().find(call => finite(call.contextTokens) > 0 || finite(call.inputTokens) > 0)
    if (!modelCall) {
      continue
    }
    const usedTokens = finite(modelCall.contextTokens) || finite(modelCall.inputTokens)
    const reportContextWindowTokens = finite(report.contextWindowTokens)
    const reportTriggerTokens = finite(report.triggerTokens)
    const contextWindowTokens = reportContextWindowTokens || CURRENT_CHAT_CONTEXT_WINDOW_TOKENS
    const compressionThresholdTokens = reportTriggerTokens || CURRENT_CHAT_COMPRESSION_THRESHOLD_TOKENS
    const distanceToCompressionTokens = compressionThresholdTokens - usedTokens
    const compressionRatio = ratio(usedTokens, compressionThresholdTokens)
    return {
      usedTokens,
      contextWindowTokens,
      compressionThresholdTokens,
      distanceToCompressionTokens,
      usageRatio: ratio(usedTokens, contextWindowTokens),
      compressionRatio,
      status: distanceToCompressionTokens <= 0 ? 'over' : compressionRatio >= 0.8 ? 'warning' : 'ok',
      source: reportContextWindowTokens || reportTriggerTokens ? 'metrics' : 'current-chat-default',
      model: modelCall.model,
      callIndex: modelCall.callIndex,
      updatedAt: report.timestamp,
    }
  }
  return undefined
}

function readSessionMetricReports(root: string, sessionId: string): MetricsReport[] {
  const reports: MetricsReport[] = []
  const metricsFiles = findReportFiles(root, sessionId)
  for (const file of metricsFiles) {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (isMetricsReport(parsed)) {
        reports.push(parsed)
      }
    }
    catch {}
  }
  return reports
}

function readSessionTokenUsage(root: string, sessionId: string): TokenUsageSummary | undefined {
  const reports = readSessionMetricReports(root, sessionId)
  if (reports.length === 0) {
    return undefined
  }
  const modelCalls = reports.flatMap(report => report.modelCalls)
  const inputTokens = reports.reduce((sum, report) => {
    const summaryValue = finite(report.summary.totalInputTokens)
    return sum + (summaryValue || report.modelCalls.reduce((callSum, call) => callSum + finite(call.inputTokens), 0))
  }, 0)
  const outputTokens = reports.reduce((sum, report) => {
    const summaryValue = finite(report.summary.totalOutputTokens)
    return sum + (summaryValue || report.modelCalls.reduce((callSum, call) => callSum + finite(call.outputTokens), 0))
  }, 0)
  const cachedInputTokens = reports.reduce((sum, report) => {
    const summaryValue = finite(report.summary.totalCachedInputTokens)
    return sum + (summaryValue || report.modelCalls.reduce((callSum, call) => callSum + finite(call.cachedInputTokens), 0))
  }, 0)
  const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens)
  const costCny = {
    cachedInput: round((cachedInputTokens / 1_000_000) * DEEPSEEK_V4_FLASH_CNY_PER_MILLION.cachedInput, 6),
    uncachedInput: round((uncachedInputTokens / 1_000_000) * DEEPSEEK_V4_FLASH_CNY_PER_MILLION.uncachedInput, 6),
    output: round((outputTokens / 1_000_000) * DEEPSEEK_V4_FLASH_CNY_PER_MILLION.output, 6),
    total: 0,
  }
  costCny.total = round(costCny.cachedInput + costCny.uncachedInput + costCny.output, 6)
  return {
    totalTokens: inputTokens + outputTokens,
    inputTokens,
    outputTokens,
    cachedInputTokens,
    uncachedInputTokens,
    cacheHitRate: ratio(cachedInputTokens, inputTokens),
    costCny,
    modelCalls: modelCalls.length,
    reports: reports.length,
    source: 'metrics',
  }
}

function readSessionDetail(key: string): RolloutSessionDetail | null {
  const payload = decodeSessionKey(key)
  if (!payload) {
    return null
  }
  const filePath = path.resolve(payload.root, payload.relPath)
  if (!fs.existsSync(filePath)) {
    return null
  }
  const summary = buildSessionSummary(payload.root, filePath)
  if (!summary) {
    return null
  }
  const { events } = parseSessionFile(filePath)
  return {
    ...summary,
    events,
    contextWindow: readSessionContextWindow(payload.root, summary.sessionId),
    tokenUsage: readSessionTokenUsage(payload.root, summary.sessionId),
  }
}

function isMetricsReport(value: unknown): value is MetricsReport {
  if (!value || typeof value !== 'object') {
    return false
  }
  const report = value as Partial<MetricsReport>
  const validModelCalls = Array.isArray(report.modelCalls) && report.modelCalls.every(call => !!call && typeof call === 'object')
  const validToolCalls = Array.isArray(report.toolCalls) && report.toolCalls.every(call => !!call && typeof call === 'object')
  const validCompactions = Array.isArray(report.compactions) && report.compactions.every(item => !!item && typeof item === 'object')
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

function findReportFiles(sessionsRoot: string, conversationId?: string): string[] {
  if (conversationId) {
    if (!/^[\w.-]+$/.test(conversationId)) {
      return []
    }
    const metricsDir = path.join(sessionsRoot, conversationId, 'metrics')
    try {
      return fs.readdirSync(metricsDir, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
        .map(entry => path.join(metricsDir, entry.name))
    }
    catch {
      return []
    }
  }

  const files: string[] = []
  walkFiles(sessionsRoot, (filePath) => {
    if (path.basename(path.dirname(filePath)) === 'metrics' && filePath.endsWith('.json')) {
      files.push(filePath)
    }
  })
  return files
}

function readMetricsSummary(conversationId?: string, limit = 1000): MetricsSummary {
  const sessionsRoot = getViewerRoots()[0] ?? resolveAgentHome(false)
  const files = findReportFiles(sessionsRoot, conversationId)
  const loaded: Array<{ file: string, report: MetricsReport }> = []
  let skipped = 0

  for (const file of files) {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (!isMetricsReport(parsed)) {
        skipped += 1
        continue
      }
      loaded.push({ file, report: parsed })
    }
    catch {
      skipped += 1
    }
  }

  loaded.sort((a, b) => Date.parse(a.report.timestamp) - Date.parse(b.report.timestamp))
  const reports = loaded.slice(-Math.max(1, Math.min(limit, 10_000))).map(item => item.report)

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
    aggregate.calls += 1
    aggregate.durationMs += finite(call.durationMs)
    if (call.isError) {
      aggregate.errors += 1
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
      avgDurationMs: value.calls > 0 ? round(value.durationMs / value.calls, 2) : 0,
    }))
    .sort((a, b) => b.errors - a.errors || b.calls - a.calls || a.toolName.localeCompare(b.toolName))

  const summary: MetricsSummary = {
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
    recommendations: [{
      id: 'add-outcome-evaluation',
      priority: 'high',
      title: '建立任务结果评测集',
      action: '为核心任务族补充成功条件、人工反馈或 deterministic grader，并记录 agent/version/model/prompt 版本。',
      evidence: ['当前数据只有运行过程指标，没有任务结果标签，无法计算真实能力或回归。'],
    }],
  }

  if (summary.rates.toolErrorRate >= 0.1) {
    const worstTool = summary.tools.find(tool => tool.errors > 0)
    summary.recommendations.push({
      id: 'reduce-tool-errors',
      priority: summary.rates.toolErrorRate >= 0.25 ? 'high' : 'medium',
      title: '优先降低工具调用错误',
      action: `从 ${worstTool?.toolName ?? '高错误工具'} 的参数校验、错误反馈和重试策略开始修复。`,
      evidence: [`工具错误率 ${(summary.rates.toolErrorRate * 100).toFixed(1)}%。`],
    })
  }

  if (summary.rates.abortRate >= 0.1) {
    summary.recommendations.push({
      id: 'reduce-aborts',
      priority: summary.rates.abortRate >= 0.25 ? 'high' : 'medium',
      title: '定位中止任务的共同路径',
      action: '按任务类型和最后一个 tool/model step 切分中止样本，区分用户取消、超时和 runtime 异常。',
      evidence: [`中止率 ${(summary.rates.abortRate * 100).toFixed(1)}%。`],
    })
  }

  if (summary.context.compactionFailures > 0) {
    summary.recommendations.push({
      id: 'stabilize-compaction',
      priority: 'medium',
      title: '修复上下文压缩失败',
      action: '保留失败样本的 context size 和 summary provider 错误，验证压缩后的任务完成率。',
      evidence: [`发现 ${summary.context.compactionFailures} 次压缩失败。`],
    })
  }

  if (summary.latency.p95RunDurationMs >= 30_000) {
    summary.recommendations.push({
      id: 'reduce-tail-latency',
      priority: 'medium',
      title: '降低长尾任务耗时',
      action: '在 trace 瀑布中拆分模型等待、工具执行与重试时间，先优化占比最高的阶段。',
      evidence: [`P95 任务耗时 ${(summary.latency.p95RunDurationMs / 1000).toFixed(1)} 秒。`],
    })
  }

  return summary
}

function sendJson(res: ServerResponse, data: unknown) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

function sendNotFound(res: ServerResponse) {
  res.statusCode = 404
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ error: 'not found' }))
}

function handleRolloutViewerRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (req.method !== 'GET') {
    sendNotFound(res)
    return true
  }

  if (url.pathname === '/__agent-inspect__/sessions') {
    sendJson(res, { roots: getViewerRoots(), sessions: listRolloutSessions() })
    return true
  }

  if (url.pathname === '/__agent-inspect__/session') {
    const key = url.searchParams.get('key')
    if (!key) {
      sendJson(res, { error: 'missing key' })
      return true
    }
    const detail = readSessionDetail(key)
    if (!detail) {
      sendJson(res, { error: 'session not found' })
      return true
    }
    sendJson(res, detail)
    return true
  }

  if (url.pathname === '/__agent-inspect__/metrics') {
    const conversationId = url.searchParams.get('conversationId') ?? undefined
    const limit = Number(url.searchParams.get('limit') ?? '1000')
    sendJson(res, readMetricsSummary(conversationId, Number.isFinite(limit) ? limit : 1000))
    return true
  }

  return false
}

export function createRolloutViewerDevPlugin(): PluginOption {
  return {
    name: 'agent-inspect-dev-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/__agent-inspect__/') && handleRolloutViewerRequest(req, res)) {
          return
        }
        next()
      })
    },
  }
}
