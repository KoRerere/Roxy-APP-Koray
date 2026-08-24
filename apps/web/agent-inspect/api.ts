export interface RolloutViewerMetricsSummary {
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
  recommendations: Array<{
    id: string
    priority: 'high' | 'medium' | 'low'
    title: string
    action: string
    evidence: string[]
  }>
}

export interface RolloutViewerSessionItem {
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

export interface RolloutViewerParsedEvent {
  lineNo: number
  raw: string
  event: Record<string, unknown>
  summary: string
}

export interface RolloutViewerSessionDetail extends RolloutViewerSessionItem {
  events: RolloutViewerParsedEvent[]
  contextWindow?: {
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
  tokenUsage?: {
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
}

export interface RolloutViewerRootsResponse {
  roots: string[]
  sessions: RolloutViewerSessionItem[]
}

export interface RolloutViewerSessionResponse extends RolloutViewerSessionDetail {
  error?: string
}

export interface RolloutViewerMetricsResponse extends RolloutViewerMetricsSummary {}

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  const payload = await response.json() as T
  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'error' in payload
      ? String((payload as { error?: unknown }).error ?? 'Request failed')
      : `Request failed: ${response.status}`
    throw new Error(message)
  }
  return payload
}

export function useRolloutViewerApi() {
  return {
    sessions() {
      return readJson<RolloutViewerRootsResponse>('/__agent-inspect__/sessions')
    },
    session(key: string) {
      return readJson<RolloutViewerSessionResponse>(`/__agent-inspect__/session?key=${encodeURIComponent(key)}`)
    },
    metrics(conversationId?: string) {
      const query = new URLSearchParams()
      if (conversationId) {
        query.set('conversationId', conversationId)
      }
      query.set('limit', '1000')
      return readJson<RolloutViewerMetricsResponse>(`/__agent-inspect__/metrics?${query.toString()}`)
    },
  }
}
