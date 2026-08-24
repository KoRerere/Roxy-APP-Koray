<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRolloutViewerApi } from './api'
import type { RolloutViewerParsedEvent, RolloutViewerSessionDetail, RolloutViewerSessionItem } from './api'
import { buildImportedSessionDetail } from './rolloutFile'
import { buildToolResultDetails } from './toolResult'

type EventFilter = 'all' | 'user_input' | 'assistant_turn' | 'tool_result' | 'compaction' | 'thinking' | 'content' | 'error'

const SOURCE_FILTER_ALL = 'all'
const SOURCE_FILTER_IMPORTED = 'imported'

const api = useRolloutViewerApi()
const loading = ref(true)
const detailLoading = ref(false)
const error = ref('')
const roots = ref<string[]>([])
const sessions = ref<RolloutViewerSessionItem[]>([])
const importedSessions = ref<RolloutViewerSessionDetail[]>([])
const selectedKey = ref('')
const selectedSession = ref<RolloutViewerSessionDetail | null>(null)
const search = ref('')
const selectedSourceFilter = ref(SOURCE_FILTER_ALL)
const activeFilter = ref<EventFilter>('all')
const fileInput = ref<HTMLInputElement | null>(null)
const isDraggingFile = ref(false)
const dragDepth = ref(0)

const allSessions = computed<RolloutViewerSessionItem[]>(() => [
  ...importedSessions.value,
  ...sessions.value,
])

const sourceFilteredSessions = computed(() => {
  if (selectedSourceFilter.value === SOURCE_FILTER_ALL) {
    return allSessions.value
  }
  return allSessions.value.filter(item => sourceFilterKey(item) === selectedSourceFilter.value)
})

const filteredSessions = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) {
    return sourceFilteredSessions.value
  }
  return sourceFilteredSessions.value.filter(item => [
    item.sessionId,
    item.relPath,
    item.preview,
    item.lastEventType,
    Object.keys(item.counts).join(' '),
  ].join(' ').toLowerCase().includes(keyword))
})

const importedSessionMap = computed(() => new Map(importedSessions.value.map(item => [item.key, item])))

const sourceFilterItems = computed(() => {
  const counts = new Map<string, number>()
  for (const item of allSessions.value) {
    const key = sourceFilterKey(item)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const items = [{
    key: SOURCE_FILTER_ALL,
    label: '全部',
    title: '全部来源',
    count: allSessions.value.length,
  }]
  if (importedSessions.value.length) {
    items.push({
      key: SOURCE_FILTER_IMPORTED,
      label: '导入文件',
      title: '导入文件',
      count: counts.get(SOURCE_FILTER_IMPORTED) ?? 0,
    })
  }
  for (const root of roots.value) {
    const key = `root:${root}`
    items.push({
      key,
      label: formatRootPath(root),
      title: root,
      count: counts.get(key) ?? 0,
    })
  }
  return items
})

const visibleEvents = computed(() => {
  const events = selectedSession.value?.events ?? []
  return events.filter((entry) => {
    if (activeFilter.value === 'all') {
      return true
    }
    if (activeFilter.value === 'error') {
      return eventHasError(entry)
    }
    if (activeFilter.value === 'thinking') {
      return hasThinking(entry)
    }
    if (activeFilter.value === 'content') {
      return hasContent(entry)
    }
    return entry.event.type === activeFilter.value
  })
})

const filterItems = computed(() => {
  const events = selectedSession.value?.events ?? []
  const count = (predicate: (event: RolloutViewerParsedEvent) => boolean) => events.filter(predicate).length
  return [
    { key: 'all' as const, label: '全部', count: events.length },
    { key: 'user_input' as const, label: '用户', count: count(item => item.event.type === 'user_input') },
    { key: 'assistant_turn' as const, label: '助手', count: count(item => item.event.type === 'assistant_turn') },
    { key: 'tool_result' as const, label: '工具结果', count: count(item => item.event.type === 'tool_result') },
    { key: 'thinking' as const, label: '思考', count: count(hasThinking) },
    { key: 'content' as const, label: '内容', count: count(hasContent) },
    { key: 'compaction' as const, label: '压缩', count: count(item => item.event.type === 'compaction') },
    { key: 'error' as const, label: '错误', count: count(eventHasError) },
  ]
})

const selectedStats = computed(() => {
  const events = selectedSession.value?.events ?? []
  return [
    { label: '总事件', value: events.length, hint: 'rollout event' },
    { label: '压缩记录', value: events.filter(item => item.event.type === 'compaction').length, hint: 'compaction' },
  ]
})

const toolResultDetails = computed(
  () => buildToolResultDetails(selectedSession.value?.events ?? []),
)

const contextWindow = computed(() => selectedSession.value?.contextWindow)
const tokenUsage = computed(() => selectedSession.value?.tokenUsage)

const contextUsagePercent = computed(() => Math.min(100, Math.round((contextWindow.value?.usageRatio ?? 0) * 100)))
const compressionThresholdPercent = computed(() => {
  if (!contextWindow.value?.contextWindowTokens) {
    return 0
  }
  return Math.min(100, Math.round((contextWindow.value.compressionThresholdTokens / contextWindow.value.contextWindowTokens) * 100))
})
const compressionThresholdPosition = computed(() => {
  if (!contextWindow.value?.contextWindowTokens) {
    return 0
  }
  const raw = (contextWindow.value.compressionThresholdTokens / contextWindow.value.contextWindowTokens) * 100
  return Math.min(96, Math.max(4, raw))
})

function formatDate(value: number, long = false) {
  if (!value) {
    return '无时间戳'
  }
  return new Intl.DateTimeFormat('zh-CN', {
    year: long ? 'numeric' : undefined,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: long ? '2-digit' : undefined,
    hour12: false,
  }).format(new Date(value))
}

function formatRootPath(root: string) {
  return root.replace(/^.*\/\.roxy-agent(-dev)?/, '~/.roxy-agent$1')
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) {
    return '未知'
  }
  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return String(Math.round(value))
}

function formatInteger(value: number) {
  if (!Number.isFinite(value)) {
    return '0'
  }
  return new Intl.NumberFormat('zh-CN').format(Math.round(value))
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return '0%'
  }
  return `${Math.round(value * 1000) / 10}%`
}

function formatCny(value: number) {
  if (!Number.isFinite(value)) {
    return '¥0'
  }
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: value > 0 && value < 0.01 ? 6 : 4,
    maximumFractionDigits: value > 0 && value < 0.01 ? 6 : 4,
  }).format(value)
}

function stringify(value: unknown) {
  if (typeof value === 'string') {
    return value
  }
  try {
    return JSON.stringify(value, null, 2)
  }
  catch {
    return String(value)
  }
}

function formatDuration(value?: number) {
  if (value === undefined) {
    return '未知'
  }
  if (value < 1000) {
    return `${value} ms`
  }
  return `${(value / 1000).toFixed(value < 10_000 ? 2 : 1)} s`
}

function textFromBlock(block: Record<string, unknown>) {
  if (typeof block.text === 'string') {
    return block.text
  }
  if (typeof block.delta === 'string') {
    return block.delta
  }
  if (typeof block.thinking === 'string') {
    return block.thinking
  }
  if (typeof block.content === 'string') {
    return block.content
  }
  return stringify(block)
}

function pushTextValue(target: string[], value: unknown) {
  if (typeof value === 'string') {
    target.push(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === 'object') {
        target.push(textFromBlock(item as Record<string, unknown>))
      }
      else if (item !== undefined && item !== null) {
        target.push(stringify(item))
      }
    }
    return
  }
  if (value !== undefined && value !== null) {
    target.push(stringify(value))
  }
}

function messageOf(entry: RolloutViewerParsedEvent) {
  return entry.event.message as { content?: unknown, providerState?: { data?: unknown } } | undefined
}

function assistantSections(entry: RolloutViewerParsedEvent) {
  const message = messageOf(entry)
  const sections = {
    thinking: [] as string[],
    content: [] as string[],
    toolUse: [] as unknown[],
    provider: [] as unknown[],
  }

  function appendBlock(block: unknown) {
    if (typeof block === 'string') {
      sections.content.push(block)
      return
    }
    if (Array.isArray(block)) {
      block.forEach(appendBlock)
      return
    }
    if (!block || typeof block !== 'object') {
      return
    }

    const record = block as Record<string, unknown>
    const type = typeof record.type === 'string' ? record.type : ''
    if (type === 'message') {
      appendBlock(record.content)
      const providerData = (record.providerState as { data?: unknown } | undefined)?.data
      if (providerData) {
        sections.provider.push(providerData)
      }
      return
    }
    if (type === 'thinking' || type === 'reasoning' || type === 'redacted_thinking') {
      sections.thinking.push(textFromBlock(record))
      return
    }
    if (type === 'text' || type === 'output_text' || type === 'content_delta' || type === 'output_text_delta') {
      sections.content.push(textFromBlock(record))
      return
    }
    if (type === 'tool_use' || type === 'tool_call') {
      sections.toolUse.push(record)
      return
    }

    if (typeof record.thinking === 'string') {
      sections.thinking.push(record.thinking)
      return
    }
    if (Array.isArray(record.content)) {
      appendBlock(record.content)
      return
    }
    if (typeof record.text === 'string' || typeof record.content === 'string') {
      sections.content.push(textFromBlock(record))
      return
    }
    sections.provider.push(record)
  }

  if (Array.isArray(entry.event.items)) {
    entry.event.items.forEach(appendBlock)
  }
  appendBlock(message?.content)

  const event = entry.event as Record<string, unknown>
  pushTextValue(sections.thinking, event.thinking)
  appendBlock(event.content)

  const providerData = message?.providerState?.data ?? (event.providerState as { data?: unknown } | undefined)?.data ?? event.providerState
  if (providerData && typeof providerData === 'object' && 'items' in providerData && Array.isArray((providerData as { items?: unknown[] }).items)) {
    ;(providerData as { items: unknown[] }).items.forEach(appendBlock)
  }

  return sections
}

function sectionMeta(value: unknown, fallback = 'raw') {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return String(record.name ?? record.type ?? fallback)
  }
  return fallback
}

function hasThinking(entry: RolloutViewerParsedEvent) {
  if (entry.event.type !== 'assistant_turn') {
    return false
  }
  const sections = assistantSections(entry)
  return sections.thinking.length > 0 || sections.provider.some(item => item && typeof item === 'object' && (item as { type?: string }).type === 'reasoning')
}

function hasContent(entry: RolloutViewerParsedEvent) {
  if (entry.event.type === 'user_input' || entry.event.type === 'tool_result' || entry.event.type === 'compaction') {
    return true
  }
  return entry.event.type === 'assistant_turn' && assistantSections(entry).content.length > 0
}

function eventHasError(entry: RolloutViewerParsedEvent) {
  if (entry.event.type === 'turn_failed') {
    return true
  }
  if (entry.event.type === 'turn_error') {
    return true
  }
  if (entry.event.type === 'tool_result') {
    return Boolean((entry.event.result as { is_error?: boolean } | undefined)?.is_error)
  }
  return false
}

function errorDetails(entry: RolloutViewerParsedEvent) {
  const event = entry.event as Record<string, unknown>
  if (event.type !== 'turn_error') {
    return null
  }
  return {
    name: typeof event.name === 'string' ? event.name : 'Error',
    message: typeof event.message === 'string' ? event.message : '未知错误',
    cause: typeof event.cause === 'string' ? event.cause : '',
    phase: typeof event.phase === 'string' ? event.phase : '',
    stack: typeof event.stack === 'string' ? event.stack : '',
  }
}

function eventTitle(entry: RolloutViewerParsedEvent) {
  const event = entry.event
  if (event.type === 'session_start') {
    return '会话开始'
  }
  if (event.type === 'user_input') {
    return '用户输入'
  }
  if (event.type === 'assistant_turn') {
    return '助手回合'
  }
  if (event.type === 'tool_result') {
    return `工具返回 · ${toolResultDetails.value.get(entry.lineNo)?.toolName ?? 'unknown'}`
  }
  if (event.type === 'compaction') {
    return `上下文压缩 · ${String(event.compactedCount ?? 0)} 条消息`
  }
  if (event.type === 'turn_aborted') {
    return '回合中止'
  }
  if (event.type === 'turn_failed') {
    return '回合失败'
  }
  if (event.type === 'turn_error') {
    return '回合错误'
  }
  return String(event.type ?? '事件')
}

function eventSummary(entry: RolloutViewerParsedEvent) {
  const event = entry.event
  if (event.type === 'user_input') {
    return ''
  }
  if (event.type === 'assistant_turn') {
    const sections = assistantSections(entry)
    return sections.content[0] || sections.thinking[0] || entry.summary
  }
  if (event.type === 'tool_result') {
    return ''
  }
  if (event.type === 'compaction') {
    return stringify(event.summary)
  }
  return entry.summary
}

function selectSession(item: RolloutViewerSessionItem) {
  selectedKey.value = item.key
  activeFilter.value = 'all'
}

function sourceFilterKey(item: RolloutViewerSessionItem) {
  if (item.rootLabel === '导入文件') {
    return SOURCE_FILTER_IMPORTED
  }
  return `root:${item.root}`
}

function selectSourceFilter(key: string) {
  selectedSourceFilter.value = selectedSourceFilter.value === key ? SOURCE_FILTER_ALL : key
  if (filteredSessions.value.some(item => item.key === selectedKey.value)) {
    return
  }
  selectedKey.value = filteredSessions.value[0]?.key ?? sourceFilteredSessions.value[0]?.key ?? ''
  activeFilter.value = 'all'
}

function isFileDrag(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

function fileReadError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function importRolloutFile(file: File) {
  detailLoading.value = true
  error.value = ''
  try {
    const detail = buildImportedSessionDetail({
      fileName: file.name,
      size: file.size,
      updatedAt: file.lastModified || Date.now(),
      text: await file.text(),
    })
    importedSessions.value = [
      detail,
      ...importedSessions.value.filter(item => item.key !== detail.key),
    ]
    selectedSession.value = detail
    selectedKey.value = detail.key
    activeFilter.value = 'all'
  }
  catch (cause) {
    error.value = fileReadError(cause)
  }
  finally {
    detailLoading.value = false
  }
}

function chooseRolloutFile() {
  fileInput.value?.click()
}

async function handleFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) {
    await importRolloutFile(file)
  }
}

function handleDragEnter(event: DragEvent) {
  if (!isFileDrag(event)) {
    return
  }
  event.preventDefault()
  dragDepth.value += 1
  isDraggingFile.value = true
}

function handleDragOver(event: DragEvent) {
  if (!isFileDrag(event)) {
    return
  }
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

function handleDragLeave(event: DragEvent) {
  if (!isFileDrag(event)) {
    return
  }
  dragDepth.value = Math.max(0, dragDepth.value - 1)
  if (dragDepth.value === 0) {
    isDraggingFile.value = false
  }
}

async function handleDrop(event: DragEvent) {
  if (!isFileDrag(event)) {
    return
  }
  event.preventDefault()
  dragDepth.value = 0
  isDraggingFile.value = false
  const file = Array.from(event.dataTransfer?.files ?? []).find(item => item.name.endsWith('.jsonl')) ?? event.dataTransfer?.files?.[0]
  if (file) {
    await importRolloutFile(file)
  }
}

async function loadSessions() {
  loading.value = true
  error.value = ''
  try {
    const response = await api.sessions()
    roots.value = response.roots
    sessions.value = response.sessions
    if (!selectedKey.value || !allSessions.value.some(item => item.key === selectedKey.value)) {
      selectedKey.value = filteredSessions.value[0]?.key ?? allSessions.value[0]?.key ?? ''
    }
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
  finally {
    loading.value = false
  }
}

async function loadSession() {
  if (!selectedKey.value) {
    selectedSession.value = null
    return
  }
  const importedSession = importedSessionMap.value.get(selectedKey.value)
  if (importedSession) {
    selectedSession.value = importedSession
    return
  }
  detailLoading.value = true
  try {
    selectedSession.value = await api.session(selectedKey.value)
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
    selectedSession.value = null
  }
  finally {
    detailLoading.value = false
  }
}

async function refresh() {
  await loadSessions()
  await loadSession()
}

watch(selectedKey, () => void loadSession())
onMounted(() => void loadSessions())
</script>

<template>
  <main
    class="app-shell"
    :class="{ 'is-dragging-file': isDraggingFile }"
    @dragenter="handleDragEnter"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <div v-if="isDraggingFile" class="drop-overlay" aria-hidden="true">
      <div>
        <strong>释放导入 rollout</strong>
        <span>JSONL 文件会立即显示在这里</span>
      </div>
    </div>
    <aside class="session-sidebar">
      <div class="sidebar-heading">
        <div>
          <div class="sidebar-kicker">
            本地文件
          </div>
          <h2>会话列表</h2>
          <span>{{ filteredSessions.length }} 个文件 · {{ roots.length + (importedSessions.length ? 1 : 0) }} 个来源</span>
        </div>
        <span class="count-badge">{{ allSessions.length }}</span>
      </div>

      <label class="search-box">
        <span>⌕</span>
        <input v-model="search" type="search" placeholder="搜索 session、路径、内容">
      </label>

      <button class="import-button" type="button" @click="chooseRolloutFile">
        导入 rollout
      </button>
      <input ref="fileInput" class="file-input" type="file" accept=".jsonl,.json,text/plain,application/json" @change="handleFileInputChange">

      <div class="root-list">
        <button
          v-for="item in sourceFilterItems"
          :key="item.key"
          type="button"
          :title="item.title"
          :class="{ active: selectedSourceFilter === item.key }"
          @click="selectSourceFilter(item.key)"
        >
          <span>{{ item.label }}</span>
          <em>{{ item.count }}</em>
        </button>
      </div>

      <div class="session-list">
        <button
          v-for="item in filteredSessions"
          :key="item.key"
          type="button"
          class="session-item"
          :class="{ selected: item.key === selectedKey }"
          @click="selectSession(item)"
        >
          <div class="session-title">
            <strong>{{ item.sessionId }}</strong>
            <time>{{ formatDate(item.updatedAt) }}</time>
          </div>
          <div class="session-meta">
            <span>{{ item.eventCount }} 个事件</span>
            <span>{{ formatBytes(item.size) }}</span>
            <span v-if="item.rootLabel === '导入文件'">导入</span>
            <span>{{ item.lastEventType || 'unknown' }}</span>
          </div>
          <p>{{ item.preview || item.relPath }}</p>
          <div class="type-counts">
            <span v-for="(count, type) in item.counts" :key="type">{{ type }} {{ count }}</span>
          </div>
        </button>
        <div v-if="!filteredSessions.length" class="empty">
          没有匹配的 rollout 文件
        </div>
      </div>
    </aside>

    <section class="main-pane">
      <header class="app-header">
        <div>
          <h1>Agent Inspect</h1>
        </div>
        <div class="header-actions">
          <button class="button" type="button" :disabled="loading" @click="refresh">
            刷新
          </button>
        </div>
      </header>

      <div v-if="error" class="error-banner">
        {{ error }}
      </div>

      <section class="event-pane">
        <section v-if="selectedSession" class="session-summary">
          <div v-for="item in selectedStats" :key="item.label" class="stat">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <small>{{ item.hint }}</small>
          </div>

          <div class="context-window-card" :class="contextWindow?.status ?? 'unknown'">
            <div class="context-window-title">
              <span>上下文窗口</span>
            </div>
            <template v-if="contextWindow">
              <div class="context-window-badges">
                <span :class="contextWindow.status">当前 {{ contextUsagePercent }}%</span>
                <em>{{ formatCompactNumber(contextWindow.compressionThresholdTokens) }}/{{ formatCompactNumber(contextWindow.contextWindowTokens) }}</em>
              </div>
              <div class="context-window-scale">
                <div class="context-window-track">
                  <i :style="{ width: `${contextUsagePercent}%` }" />
                </div>
                <b :style="{ left: `${compressionThresholdPosition}%` }" aria-hidden="true">
                  <em class="threshold-label">{{ compressionThresholdPercent }}%</em>
                  <em class="distance-label">距压缩 {{ formatCompactNumber(contextWindow.distanceToCompressionTokens) }}</em>
                </b>
              </div>
              <div class="context-window-meta">
                <span>已用：<strong>{{ formatCompactNumber(contextWindow.usedTokens) }}</strong></span>
              </div>
            </template>
            <template v-else>
              <p>这个会话还没有可用的 metrics 记录。</p>
            </template>
          </div>

          <div class="token-usage-card">
            <div class="token-usage-title">
              <span>Token 用量</span>
              <em v-if="tokenUsage">deepseek-v4-flash · {{ tokenUsage.modelCalls }} 次模型调用</em>
            </div>
            <template v-if="tokenUsage">
              <div class="token-usage-grid">
                <div class="cost-total">
                  <span>费用</span>
                  <strong>{{ formatCny(tokenUsage.costCny.total) }}</strong>
                </div>
                <div>
                  <span>总 tokens</span>
                  <strong>{{ formatInteger(tokenUsage.totalTokens) }}</strong>
                </div>
                <div>
                  <span>输入</span>
                  <strong>{{ formatInteger(tokenUsage.inputTokens) }}</strong>
                </div>
                <div>
                  <span>未命中输入</span>
                  <strong>{{ formatInteger(tokenUsage.uncachedInputTokens) }}</strong>
                </div>
                <div>
                  <span>输出</span>
                  <strong>{{ formatInteger(tokenUsage.outputTokens) }}</strong>
                </div>
                <div>
                  <span>缓存</span>
                  <strong>{{ formatInteger(tokenUsage.cachedInputTokens) }}</strong>
                </div>
                <div>
                  <span>缓存率</span>
                  <strong>{{ formatPercent(tokenUsage.cacheHitRate) }}</strong>
                </div>
                <div>
                  <span>未命中输入费</span>
                  <strong>{{ formatCny(tokenUsage.costCny.uncachedInput) }}</strong>
                </div>
                <div>
                  <span>缓存输入费</span>
                  <strong>{{ formatCny(tokenUsage.costCny.cachedInput) }}</strong>
                </div>
                <div>
                  <span>输出费</span>
                  <strong>{{ formatCny(tokenUsage.costCny.output) }}</strong>
                </div>
              </div>
            </template>
            <p v-else>这个会话还没有可用的 token metrics。</p>
          </div>
        </section>

        <section v-if="selectedSession" class="session-details">
          <div class="file-info">
            <div>
              <span>文件路径 <em>{{ formatBytes(selectedSession.size) }}</em></span>
              <code>{{ selectedSession.filePath }}</code>
            </div>
            <div>
              <span>最后更新</span>
              <code>{{ formatDate(selectedSession.updatedAt, true) }}</code>
            </div>
          </div>
        </section>

        <nav v-if="selectedSession" class="filter-tabs" aria-label="事件筛选">
          <button v-for="item in filterItems" :key="item.key" type="button" :class="{ active: activeFilter === item.key }" @click="activeFilter = item.key">
            {{ item.label }} <em>{{ item.count }}</em>
          </button>
        </nav>

        <div v-if="loading || detailLoading" class="empty large">
          正在读取 rollout…
        </div>
        <div v-else-if="!selectedSession" class="empty large">
          左侧选择或导入一个 rollout.jsonl，这里会展示每一行的完整内容。
        </div>
        <div v-else-if="!visibleEvents.length" class="empty large">
          当前筛选没有事件。
        </div>
        <div v-else class="events">
          <article
            v-for="entry in visibleEvents"
            :key="`${selectedSession.key}-${entry.lineNo}`"
            class="event"
            :class="{
              failure: eventHasError(entry),
              'user-input-event': entry.event.type === 'user_input',
              'tool-result-failed-event': entry.event.type === 'tool_result' && eventHasError(entry),
            }"
          >
            <div class="event-marker">
              <span>{{ entry.lineNo }}</span>
            </div>
            <div class="event-content">
              <header class="event-header">
                <div>
                  <strong>{{ eventTitle(entry) }}</strong>
                  <span class="event-type">{{ String(entry.event.type ?? 'event') }}</span>
                  <time>{{ formatDate(Number(entry.event.ts ?? entry.event.createdAt ?? 0), true) }}</time>
                </div>
                <span v-if="eventHasError(entry)" class="error-pill">错误</span>
              </header>
              <p v-if="eventSummary(entry)" class="event-summary">
                {{ eventSummary(entry) }}
              </p>

              <div v-if="entry.event.type === 'user_input'" class="payload-block user-block">
                <pre>{{ stringify((entry.event.message as { content?: unknown } | undefined)?.content) }}</pre>
              </div>

              <template v-else-if="entry.event.type === 'assistant_turn'">
                <details v-for="(text, index) in assistantSections(entry).thinking" :key="`thinking-${index}`" class="payload-block collapsible-block thinking-block">
                  <summary class="payload-label">
                    <span>思考内容 {{ index + 1 }}</span>
                    <em>{{ text.length }} 字符</em>
                  </summary>
                  <pre>{{ text }}</pre>
                </details>
                <details v-for="(text, index) in assistantSections(entry).content" :key="`content-${index}`" class="payload-block collapsible-block content-block">
                  <summary class="payload-label">
                    <span>正文内容 {{ index + 1 }}</span>
                    <em>{{ text.length }} 字符</em>
                  </summary>
                  <pre>{{ text }}</pre>
                </details>
                <details v-for="(tool, index) in assistantSections(entry).toolUse" :key="`tool-${index}`" class="payload-block collapsible-block tool-block">
                  <summary class="payload-label">
                    <span>工具调用 · 入参 {{ index + 1 }}</span>
                    <em>{{ sectionMeta(tool, 'tool') }}</em>
                  </summary>
                  <pre>{{ stringify(tool) }}</pre>
                </details>
                <details v-for="(item, index) in assistantSections(entry).provider" :key="`provider-${index}`" class="payload-block collapsible-block provider-block">
                  <summary class="payload-label">
                    <span>Provider 原始状态 {{ index + 1 }}</span>
                    <em>{{ sectionMeta(item) }}</em>
                  </summary>
                  <pre>{{ stringify(item) }}</pre>
                </details>
                <details
                  v-if="!assistantSections(entry).thinking.length && !assistantSections(entry).content.length && !assistantSections(entry).toolUse.length && !assistantSections(entry).provider.length"
                  class="payload-block collapsible-block event-json"
                >
                  <summary class="payload-label">
                    <span>助手回合原始数据</span>
                    <em>raw</em>
                  </summary>
                  <pre>{{ stringify(entry.event) }}</pre>
                </details>
              </template>

              <div v-else-if="entry.event.type === 'tool_result'" class="tool-result-details">
                <div class="tool-result-row">
                  <span>工具名称</span>
                  <code>{{ toolResultDetails.get(entry.lineNo)?.toolName ?? 'unknown' }}</code>
                </div>
                <div class="tool-result-row tool-result-row-input">
                  <span>入参</span>
                  <pre>{{ stringify(toolResultDetails.get(entry.lineNo)?.input ?? {}) }}</pre>
                </div>
                <div class="tool-result-row tool-result-row-output">
                  <span>返回结果</span>
                  <pre class="tool-result-output">{{ toolResultDetails.get(entry.lineNo)?.content ?? '' }}</pre>
                </div>
                <div class="tool-result-footer">
                  <span
                    class="result-status"
                    :class="toolResultDetails.get(entry.lineNo)?.failed ? 'result-status-failed' : 'result-status-success'"
                  >
                    {{ toolResultDetails.get(entry.lineNo)?.failed ? '失败' : '成功' }}
                  </span>
                  <span>调用时长 {{ formatDuration(toolResultDetails.get(entry.lineNo)?.durationMs) }}</span>
                </div>
              </div>
              <div v-else-if="entry.event.type === 'compaction'" class="payload-block compaction-block">
                <div class="payload-label">
                  压缩摘要
                </div>
                <pre>{{ stringify(entry.event.summary) }}</pre>
                <pre v-if="entry.event.keptMessages">{{ stringify(entry.event.keptMessages) }}</pre>
              </div>
              <div v-else-if="entry.event.type === 'turn_error'" class="payload-block error-block">
                <div class="payload-label">
                  错误详情
                </div>
                <div class="error-detail-grid">
                  <div><span>名称</span><code>{{ errorDetails(entry)?.name }}</code></div>
                  <div><span>阶段</span><code>{{ errorDetails(entry)?.phase || 'unknown' }}</code></div>
                  <div><span>消息</span><code>{{ errorDetails(entry)?.message }}</code></div>
                  <div v-if="errorDetails(entry)?.cause"><span>Cause</span><pre>{{ errorDetails(entry)?.cause }}</pre></div>
                  <div v-if="errorDetails(entry)?.stack"><span>Stack</span><pre>{{ errorDetails(entry)?.stack }}</pre></div>
                </div>
              </div>
              <div v-else class="payload-block event-json">
                <div class="payload-label">
                  事件数据
                </div><pre>{{ stringify(entry.event) }}</pre>
              </div>
            </div>
          </article>
        </div>
      </section>
    </section>
  </main>
</template>

<style>
:root {
  color-scheme: light;
  font-family:
    Inter,
    ui-sans-serif,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
  background: #f5f7fb;
  color: #1f2937;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}
html,
body,
#app {
  width: 100%;
  min-width: 320px;
  height: 100%;
  margin: 0;
}
body {
  overflow: hidden;
  background: #f5f7fb;
}
button,
input {
  font: inherit;
}
button {
  color: inherit;
}

.app-shell {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #f5f7fb;
}

.drop-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.18);
}

.drop-overlay div {
  display: grid;
  min-width: min(360px, 100%);
  gap: 5px;
  padding: 18px 20px;
  border: 1px solid #2563eb;
  border-radius: 7px;
  background: #ffffff;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.18);
  text-align: center;
}

.drop-overlay strong {
  color: #111827;
  font-size: 16px;
  line-height: 22px;
}

.drop-overlay span {
  color: #64748b;
  font-size: 12px;
  line-height: 18px;
}

.session-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  min-width: 0;
  overflow: hidden;
  border-right: 1px solid #d8dee9;
  background: #ffffff;
}

.main-pane {
  min-width: 0;
  height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 22px 24px 40px;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  padding: 0 0 18px;
  border-bottom: 1px solid #dbe2ea;
}

.sidebar-kicker {
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  margin: 4px 0 6px;
  color: #111827;
  font-size: 26px;
  line-height: 34px;
  letter-spacing: 0;
}

h2 {
  margin: 0;
  color: #111827;
  font-size: 15px;
  line-height: 22px;
  letter-spacing: 0;
}

.header-actions,
.event-header > div,
.sidebar-heading,
.panel-heading > div {
  display: flex;
  align-items: center;
}

.header-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 32px;
  padding: 6px 11px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  color: #1f2937;
  background: #ffffff;
  cursor: pointer;
  font-size: 12px;
}

.button:hover:not(:disabled) {
  border-color: #2563eb;
  color: #1d4ed8;
  background: #eff6ff;
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.error-banner {
  margin: 14px 0;
  padding: 10px 12px;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #b91c1c;
  background: #fef2f2;
  font:
    12px/18px ui-monospace,
    monospace;
}

.session-summary {
  display: grid;
  grid-template-columns: minmax(120px, 0.55fr) minmax(120px, 0.55fr) minmax(360px, 1.55fr) minmax(520px, 2fr);
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid #e2e8f0;
  background: #fbfdff;
}

.stat,
.event-pane {
  border: 1px solid #dbe2ea;
  background: #ffffff;
}

.stat {
  min-height: 78px;
  padding: 13px;
  border-radius: 7px;
}

.stat span,
.stat small,
.sidebar-heading span,
.session-meta,
.event-header time,
.event-type {
  color: #64748b;
  font-size: 11px;
}

.stat strong {
  display: block;
  margin: 6px 0 4px;
  color: #111827;
  font-size: 22px;
  line-height: 27px;
}

.stat small {
  display: block;
  line-height: 16px;
}

.red {
  color: #dc2626 !important;
}

.sidebar-heading {
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
}

.sidebar-heading > div {
  min-width: 0;
}

.sidebar-heading h2 {
  margin-top: 3px;
}

.sidebar-heading span {
  display: block;
  margin-top: 3px;
}

.count-badge {
  display: grid;
  width: 28px;
  height: 24px;
  place-items: center;
  margin: 0 !important;
  border-radius: 6px;
  color: #1d4ed8 !important;
  background: #dbeafe;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 12px;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #f8fafc;
}

.search-box span {
  color: #94a3b8;
  font-size: 16px;
}

.search-box input {
  width: 100%;
  border: 0;
  outline: 0;
  color: #1f2937;
  background: transparent;
  font-size: 12px;
}

.search-box input::placeholder {
  color: #94a3b8;
}

.import-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: calc(100% - 24px);
  min-height: 32px;
  margin: 0 12px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  color: #1d4ed8;
  background: #eff6ff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.import-button:hover {
  border-color: #2563eb;
  background: #dbeafe;
}

.file-input {
  display: none;
}

.root-list {
  display: flex;
  gap: 5px;
  padding: 0 12px 12px;
  overflow: auto;
}

.root-list button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
  max-width: 190px;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 4px 6px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  color: #475569;
  background: #f8fafc;
  cursor: pointer;
  font:
    10px/14px ui-monospace,
    monospace;
  white-space: nowrap;
}

.root-list button:hover,
.root-list button.active {
  border-color: #2563eb;
  color: #1d4ed8;
  background: #eff6ff;
}

.root-list button span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.root-list button em {
  flex: 0 0 auto;
  color: #64748b;
  font-style: normal;
}

.root-list button.active em {
  color: #1d4ed8;
}

.session-list {
  height: calc(100vh - 186px);
  padding: 0 10px 14px;
  overflow: auto;
}

.session-item {
  display: block;
  width: 100%;
  margin-bottom: 7px;
  padding: 11px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  color: #334155;
  background: #ffffff;
  cursor: pointer;
  text-align: left;
}

.session-item:hover {
  border-color: #93c5fd;
  background: #f8fbff;
}

.session-item.selected {
  border-color: #2563eb;
  background: #eff6ff;
  box-shadow: inset 3px 0 0 #2563eb;
}

.session-title {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.session-title strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #111827;
  font:
    12px/17px ui-monospace,
    monospace;
}

.session-title time {
  flex: 0 0 auto;
  color: #64748b;
  font-size: 10px;
}

.session-meta {
  display: flex;
  gap: 7px;
  margin-top: 5px;
  overflow: hidden;
  white-space: nowrap;
}

.session-meta span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-item p {
  display: -webkit-box;
  max-height: 34px;
  margin: 7px 0;
  overflow: hidden;
  color: #64748b;
  font-size: 11px;
  line-height: 17px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.type-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.type-counts span {
  padding: 2px 4px;
  border-radius: 3px;
  color: #475569;
  background: #eef2f7;
  font:
    10px/13px ui-monospace,
    monospace;
}

.event-pane {
  container-type: inline-size;
  min-width: 0;
  min-height: calc(100vh - 86px);
  border-radius: 7px;
}

.session-details {
  padding: 0 16px 14px;
  border-bottom: 1px solid #e2e8f0;
  background: #fbfdff;
}

.file-info {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(190px, auto);
  gap: 12px;
  min-width: 0;
}

.file-info div {
  min-width: 0;
}

.file-info span {
  display: block;
  margin-bottom: 4px;
  color: #64748b;
  font-size: 11px;
}

.file-info span em {
  margin-left: 6px;
  color: #334155;
  font-style: normal;
  font-weight: 700;
}

.file-info code {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 7px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
  color: #334155;
  background: #ffffff;
  font:
    11px/16px ui-monospace,
    monospace;
  white-space: nowrap;
}

.context-window-card {
  min-width: 0;
  min-height: 106px;
  padding: 10px 16px 11px;
  border: 1px solid #c7d2fe;
  border-radius: 7px;
  background: #f8fafc;
}

.context-window-card.ok {
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.context-window-card.warning {
  border-color: #fed7aa;
  background: #fff7ed;
}

.context-window-card.over {
  border-color: #fecaca;
  background: #fef2f2;
}

.context-window-title,
.context-window-badges,
.context-window-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.context-window-title span {
  color: #334155;
  font-size: 13px;
  font-weight: 700;
}

.context-window-title strong {
  color: #111827;
  font:
    14px/18px ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
}

.context-window-badges {
  margin-top: 6px;
}

.context-window-badges span,
.context-window-badges em {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  font-style: normal;
  line-height: 16px;
}

.context-window-badges span.ok {
  color: #166534;
  background: #dcfce7;
}

.context-window-badges span.warning {
  color: #c2410c;
  background: #ffedd5;
}

.context-window-badges span.over {
  color: #b91c1c;
  background: #fee2e2;
}

.context-window-badges em {
  color: #475569;
  background: #e2e8f0;
}

.context-window-scale {
  position: relative;
  margin: 24px 0 17px;
  padding: 0;
}

.context-window-track {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #e2e8f0;
}

.context-window-track i {
  display: block;
  height: 100%;
  max-width: 100%;
  border-radius: inherit;
  background: #22c55e;
}

.context-window-scale b {
  position: absolute;
  top: -18px;
  bottom: -5px;
  display: block;
  width: 2px;
  background: #94a3b8;
  transform: translateX(-50%);
}

.context-window-scale b::before {
  position: absolute;
  bottom: 3px;
  left: 50%;
  width: 0;
  height: 0;
  border-right: 4px solid transparent;
  border-bottom: 5px solid #94a3b8;
  border-left: 4px solid transparent;
  content: '';
  transform: translateX(-50%);
}

.context-window-meta {
  margin-top: 12px;
  color: #475569;
  font-size: 11px;
  line-height: 17px;
}

.context-window-meta span:last-child {
  color: #111827;
  font-weight: 700;
}

.context-window-meta strong {
  color: #111827;
  font-weight: 800;
}

.context-window-meta.source {
  margin-top: 8px;
}

.context-window-meta.source span:last-child {
  color: #64748b;
  font-weight: 600;
}

.context-window-scale b em {
  position: absolute;
  left: 50%;
  border-radius: 999px;
  color: #475569;
  font-style: normal;
  font-weight: 800;
  line-height: 14px;
  transform: translateX(-50%);
  white-space: nowrap;
}

.context-window-scale b .threshold-label {
  top: -2px;
  padding: 1px 7px;
  background: #e2e8f0;
  font-size: 10px;
}

.context-window-scale b .distance-label {
  top: 28px;
  padding: 0;
  color: #475569;
  background: transparent;
  font-size: 11px;
  font-weight: 700;
}

.context-window-card p {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 11px;
  line-height: 16px;
}

.token-usage-card {
  min-width: 0;
  min-height: 106px;
  padding: 10px 12px 12px;
  border: 1px solid #dbe2ea;
  border-radius: 7px;
  background: #ffffff;
}

.token-usage-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 9px;
}

.token-usage-title span {
  color: #334155;
  font-size: 13px;
  font-weight: 700;
}

.token-usage-title em {
  min-width: 0;
  overflow: hidden;
  color: #64748b;
  font-size: 11px;
  font-style: normal;
  font-weight: 600;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.token-usage-grid {
  display: grid;
  grid-template-columns: minmax(116px, 1.18fr) repeat(4, minmax(86px, 1fr));
  gap: 8px;
}

.token-usage-grid div {
  min-width: 0;
  padding: 7px 8px;
  border-radius: 5px;
  background: #f8fafc;
}

.token-usage-grid .cost-total {
  background: #ecfdf5;
  box-shadow: inset 3px 0 0 #22c55e;
}

.token-usage-grid span {
  display: block;
  margin-bottom: 4px;
  color: #64748b;
  font-size: 11px;
}

.token-usage-grid strong {
  display: block;
  overflow: visible;
  color: #111827;
  font:
    13px/18px ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  overflow-wrap: anywhere;
  white-space: normal;
}

.token-usage-grid .cost-total strong {
  color: #047857;
}

.token-usage-card p {
  margin: 10px 0 0;
  color: #64748b;
  font-size: 11px;
}

.filter-tabs {
  display: flex;
  gap: 4px;
  padding: 9px 12px;
  overflow-x: auto;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.filter-tabs button {
  flex: 0 0 auto;
  padding: 6px 9px;
  border: 1px solid transparent;
  border-radius: 5px;
  color: #475569;
  background: transparent;
  cursor: pointer;
  font-size: 11px;
}

.filter-tabs button:hover,
.filter-tabs button.active {
  border-color: #bfdbfe;
  color: #1d4ed8;
  background: #eff6ff;
}

.filter-tabs em {
  margin-left: 3px;
  color: #94a3b8;
  font-style: normal;
}

.events {
  padding: 14px;
}

.event {
  display: grid;
  grid-template-columns: 45px minmax(0, 1fr);
  position: relative;
}

.event.user-input-event {
  position: sticky;
  top: 0;
  z-index: 8;
  padding: 4px 0;
  background: #fbfdff;
}

.event:not(:last-child)::before {
  position: absolute;
  top: 28px;
  bottom: -14px;
  left: 15px;
  width: 1px;
  background: #cbd5e1;
  content: '';
}

.event-marker {
  position: relative;
  z-index: 1;
  padding-top: 13px;
}

.event-marker span {
  display: grid;
  width: 31px;
  min-height: 21px;
  place-items: center;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  color: #64748b;
  background: #ffffff;
  font:
    10px/14px ui-monospace,
    monospace;
}

.failure .event-marker span {
  border-color: #fecaca;
  color: #dc2626;
  background: #fef2f2;
}

.event-content {
  min-width: 0;
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid #dbe2ea;
  border-radius: 6px;
  background: #ffffff;
}

.user-input-event .event-content {
  position: relative;
  overflow: hidden;
  border-color: #7dd3fc;
  background: #f0fdfa;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
}

.user-input-event .event-content::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: #0891b2;
  content: '';
}

.user-input-event .event-header strong {
  color: #0f766e;
}

.user-input-event .event-type {
  color: #0e7490;
  background: #cffafe;
}

.user-input-event .event-summary {
  color: #155e75;
}

.user-input-event .event-marker {
  padding-top: 17px;
  background: #fbfdff;
}

.user-input-event .event-marker span {
  border-color: #67e8f9;
  color: #0e7490;
  background: #ecfeff;
}

.failure .event-content {
  border-color: #fecaca;
}

.tool-result-failed-event .event-content {
  position: relative;
  overflow: hidden;
  border-color: #f87171;
  background: #fff7f7;
  box-shadow: 0 0 0 1px rgba(248, 113, 113, 0.2);
}

.tool-result-failed-event .event-content::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: #dc2626;
  content: '';
}

.tool-result-failed-event .event-header strong {
  color: #991b1b;
}

.tool-result-failed-event .event-type,
.tool-result-failed-event .error-pill {
  color: #991b1b;
  background: #fee2e2;
}

.event-header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.event-header > div {
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 7px;
  min-width: 0;
}

.event-header strong {
  color: #111827;
  font-size: 13px;
}

.event-type {
  padding: 2px 5px;
  border-radius: 3px;
  color: #1d4ed8;
  background: #dbeafe;
  font:
    10px/14px ui-monospace,
    monospace;
}

.event-header time {
  margin-left: auto;
  white-space: nowrap;
}

.error-pill {
  flex: 0 0 auto;
  padding: 2px 6px;
  border-radius: 3px;
  color: #b91c1c;
  background: #fee2e2;
  font:
    10px/14px ui-monospace,
    monospace;
}

.event-summary {
  display: -webkit-box;
  max-height: 38px;
  margin: 8px 0 10px;
  overflow: hidden;
  color: #64748b;
  font:
    11px/17px ui-monospace,
    monospace;
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.payload-block {
  margin-top: 9px;
  overflow: hidden;
  border: 1px solid #dbe2ea;
  border-radius: 5px;
  background: #f8fafc;
}

.payload-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 9px;
  border-bottom: 1px solid #dbe2ea;
  color: #475569;
  background: #f1f5f9;
  font:
    10px/14px ui-monospace,
    monospace;
  letter-spacing: 0.04em;
}

.payload-label em {
  min-width: 0;
  overflow: hidden;
  color: #64748b;
  font-style: normal;
  font-weight: 600;
  text-overflow: ellipsis;
  letter-spacing: 0;
  white-space: nowrap;
}

.collapsible-block > .payload-label {
  cursor: pointer;
  list-style: none;
  user-select: none;
}

.collapsible-block > .payload-label::-webkit-details-marker {
  display: none;
}

.collapsible-block > .payload-label::before {
  flex: 0 0 auto;
  width: 12px;
  color: #64748b;
  content: '›';
  font-size: 14px;
  line-height: 12px;
}

.collapsible-block[open] > .payload-label::before {
  transform: rotate(90deg);
}

.collapsible-block:not([open]) > .payload-label {
  border-bottom: 0;
}

.collapsible-block > .payload-label span {
  flex: 1 1 auto;
  min-width: 0;
}

.payload-block pre {
  max-height: 320px;
  margin: 0;
  padding: 10px;
  overflow: auto;
  color: #1f2937;
  font:
    11px/17px ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.thinking-block {
  border-color: #fde68a;
  background: #fffbeb;
}
.thinking-block .payload-label {
  color: #92400e;
  border-color: #fde68a;
  background: #fef3c7;
}
.content-block {
  border-color: #bbf7d0;
  background: #f0fdf4;
}
.content-block .payload-label {
  color: #166534;
  border-color: #bbf7d0;
  background: #dcfce7;
}
.tool-block {
  border-color: #bfdbfe;
  background: #eff6ff;
}
.tool-block .payload-label {
  color: #1d4ed8;
  border-color: #bfdbfe;
  background: #dbeafe;
}
.result-block {
  border-color: #c7d2fe;
  background: #eef2ff;
}
.result-block .payload-label {
  color: #3730a3;
  border-color: #c7d2fe;
  background: #e0e7ff;
}
.provider-block {
  border-color: #e9d5ff;
  background: #faf5ff;
}
.provider-block .payload-label {
  color: #7e22ce;
  border-color: #e9d5ff;
  background: #f3e8ff;
}
.compaction-block {
  border-color: #fed7aa;
  background: #fff7ed;
}
.compaction-block .payload-label {
  color: #9a3412;
  border-color: #fed7aa;
  background: #ffedd5;
}

.user-block {
  border-color: #99f6e4;
  background: #ffffff;
}

.user-block pre {
  max-height: 160px;
  color: #134e4a;
  background: #f8fffd;
}

.tool-result-details {
  margin-top: 10px;
  overflow: hidden;
  border: 1px solid #c7d2fe;
  border-radius: 5px;
  background: #eef2ff;
}

.tool-result-failed-event .tool-result-details {
  border-color: #fca5a5;
  background: #fee2e2;
}

.tool-result-failed-event .tool-result-row {
  border-bottom-color: #fecaca;
}

.tool-result-failed-event .tool-result-row > span {
  color: #991b1b;
}

.tool-result-failed-event .tool-result-row code {
  color: #991b1b;
}

.tool-result-failed-event .tool-result-row pre {
  border-color: #fecaca;
  background: #fffafa;
}

.tool-result-failed-event .tool-result-footer {
  color: #991b1b;
  background: #fee2e2;
}

.tool-result-row {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  padding: 10px;
  border-bottom: 1px solid #dbe3f4;
}

.tool-result-row > span {
  padding-top: 2px;
  color: #475569;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.tool-result-row code {
  min-width: 0;
  color: #3730a3;
  font:
    12px/18px ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  overflow-wrap: anywhere;
}

.tool-result-row pre {
  max-height: 240px;
  margin: 0;
  padding: 8px 9px;
  overflow: auto;
  border: 1px solid #dbe3f4;
  border-radius: 4px;
  color: #1f2937;
  background: #ffffffaa;
  font:
    11px/17px ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.tool-result-output {
  min-width: 0;
  max-height: 360px;
  margin: 0;
  overflow: auto;
  color: #1f2937;
  font:
    11px/17px ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.tool-result-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 10px;
  color: #64748b;
  font-size: 11px;
}

.event-json pre {
  max-height: 320px;
}

.error-detail-grid {
  display: grid;
  gap: 10px;
}

.error-detail-grid > div {
  display: grid;
  gap: 4px;
}

.error-detail-grid span {
  color: #6b7280;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: uppercase;
}

.error-detail-grid code,
.error-detail-grid pre {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #fecaca;
  border-radius: 4px;
  color: #7f1d1d;
  background: #fff7f7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.result-status {
  padding: 2px 7px;
  border-radius: 3px;
  font-weight: 700;
}

.result-status-success {
  color: #166534;
  background: #dcfce7;
}
.result-status-failed {
  border: 1px solid #f87171;
  color: #b91c1c;
  background: #fecaca;
  box-shadow: 0 0 0 2px rgba(248, 113, 113, 0.18);
}

.empty {
  padding: 20px 0;
  color: #64748b;
  text-align: center;
  font-size: 12px;
}

.empty.large {
  min-height: 240px;
  display: grid;
  place-items: center;
}

@media (max-width: 1180px) {
  .session-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .context-window-card,
  .token-usage-card {
    grid-column: 1 / -1;
  }
  .token-usage-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

@container (max-width: 980px) {
  .session-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .context-window-card {
    grid-column: span 2;
  }
  .token-usage-card {
    grid-column: 1 / -1;
  }
  .token-usage-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

@container (max-width: 720px) {
  .token-usage-title {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
  }
  .token-usage-title em {
    max-width: 100%;
    text-align: left;
  }
  .token-usage-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@container (max-width: 500px) {
  .session-summary {
    grid-template-columns: 1fr;
  }
  .context-window-card,
  .token-usage-card {
    grid-column: auto;
  }
  .token-usage-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 820px) {
  body {
    overflow: auto;
  }
  .app-shell {
    display: block;
    height: auto;
    overflow: visible;
  }
  .session-sidebar {
    position: static;
    height: 420px;
    border-right: 0;
    border-bottom: 1px solid #d8dee9;
  }
  .main-pane {
    height: auto;
    overflow: visible;
    padding: 16px 12px 28px;
  }
  .app-header {
    flex-direction: column;
  }
  .header-actions {
    justify-content: flex-start;
  }
  .session-details {
    padding-top: 0;
  }
  .file-info {
    grid-template-columns: 1fr;
  }
  .event.user-input-event {
    top: 0;
  }
}

@media (max-width: 560px) {
  .session-summary {
    grid-template-columns: 1fr;
  }
  .context-window-card {
    grid-column: auto;
  }
  .token-usage-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .stat {
    min-height: 88px;
    padding: 10px;
  }
  .stat strong {
    font-size: 18px;
  }
  .event {
    grid-template-columns: 35px minmax(0, 1fr);
  }
  .event-marker span {
    width: 25px;
  }
  .event:not(:last-child)::before {
    left: 12px;
  }
  .events {
    padding: 9px;
  }
  .tool-result-row {
    grid-template-columns: 1fr;
    gap: 5px;
  }
}
</style>
