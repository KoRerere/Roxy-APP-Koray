<script setup lang="ts">
import type {
  AgentContentProcessEvent,
  AgentConversationProcess,
  AgentFileArtifact,
  AgentFileProcessEvent,
  AgentMessageStatus,
  AgentParallelDispatchProcessEvent,
  AgentProcessEvent,
  AgentScriptLogProcessEvent,
  AgentSkillLoadProcessEvent,
  AgentThinkingProcessEvent,
  AgentToolCallProcessEvent,
  AgentWorkerTaskProcessEvent,
} from '../types'
import type { SvgNames } from '/@/components/rx-icon'
import { useAgentConsoleApi } from '../api'
import MarkdownContent from './MarkdownContent.vue'

const props = defineProps<{
  process: AgentConversationProcess
  messageStatus?: AgentMessageStatus
}>()

interface ProcessContentItem {
  type: 'content'
  event: AgentContentProcessEvent
}

interface ProcessEventItem {
  type: 'event'
  event: AgentProcessEvent
}

interface ProcessEventGroupItem {
  type: 'group'
  id: string
  title: string
  icon?: SvgNames
  events: AgentProcessEvent[]
}

type ProcessRenderItem = ProcessContentItem | ProcessEventItem | ProcessEventGroupItem

function isProcessRunning(status?: AgentMessageStatus) {
  return status === 'thinking' || status === 'streaming'
}

function isEventRunning(event: AgentProcessEvent) {
  return event.status === 'pending' || event.status === 'running'
}

function shouldShimmerEvent(event: AgentProcessEvent) {
  return (event.type === 'thinking' || event.type === 'tool_call' || event.type === 'script_log') && isEventRunning(event)
}

function getDefaultProcessExpanded(process: AgentConversationProcess, status?: AgentMessageStatus) {
  if (isProcessRunning(status))
    return true

  return process.collapsed === false
}

const processExpanded = ref(getDefaultProcessExpanded(props.process, props.messageStatus))
const expandedByEventId = ref<Record<string, boolean>>({})
const eventGroupScrollStates = ref<Record<string, { canScrollUp: boolean, canScrollDown: boolean }>>({})
const now = ref(Date.now())
const agentApi = useAgentConsoleApi()
let durationTimer: NodeJS.Timeout | null
let eventGroupScrollResizeObserver: ResizeObserver | null = null
const eventGroupScrollRefs = new Map<string, HTMLElement>()
const answerEvent = computed(() => getProcessAnswerEvent(props.process.events))
const resultEvents = computed(() => props.process.events.filter((event): event is AgentFileProcessEvent => {
  return isAgentFileEvent(event) && getVisibleAgentFiles(event).length > 0
}))
const processCompleted = computed(() => props.process.completed === true || (props.process.completed === undefined && props.process.collapsed === true))
const processEvents = computed(() => props.process.events.filter((event) => {
  if (event.type === 'final_answer')
    return false

  if (isAgentFileEvent(event))
    return false

  return event.id !== answerEvent.value?.id
}))
const processItems = computed(() => groupProcessEvents(processEvents.value))
const durationDisplayLabel = computed(() => {
  if (isProcessRunning(props.messageStatus) && props.process.durationStartedAt) {
    const prefix = props.process.durationState === 'thinking' ? $t('思考中') : $t('已处理')
    return `${prefix} ${formatElapsed(now.value - props.process.durationStartedAt)}`
  }

  return props.process.durationLabel
})

function getProcessItems(): ProcessRenderItem[] {
  return processItems.value
}

function hasProcessItems() {
  return processItems.value.length > 0 || resultEvents.value.length > 0
}

function getProcessItemKey(item: ProcessRenderItem) {
  return item.type === 'group' ? item.id : item.event.id
}

function isProcessContentItem(item: ProcessRenderItem): item is ProcessContentItem {
  return item.type === 'content'
}

function isProcessEventItem(item: ProcessRenderItem): item is ProcessEventItem {
  return item.type === 'event'
}

function isProcessEventGroupItem(item: ProcessRenderItem): item is ProcessEventGroupItem {
  return item.type === 'group'
}

function isAgentFileEvent(event: AgentProcessEvent): event is AgentFileProcessEvent {
  return event.type === 'agent_file'
}

function getEventGroupScrollState(id: string) {
  return eventGroupScrollStates.value[id] ?? { canScrollUp: false, canScrollDown: false }
}

function setEventGroupScrollState(id: string, canScrollUp: boolean, canScrollDown: boolean) {
  const current = getEventGroupScrollState(id)
  if (current.canScrollUp === canScrollUp && current.canScrollDown === canScrollDown)
    return

  eventGroupScrollStates.value = {
    ...eventGroupScrollStates.value,
    [id]: { canScrollUp, canScrollDown },
  }
}

function syncEventGroupScrollMask(id: string) {
  const element = eventGroupScrollRefs.get(id)
  if (!element) {
    setEventGroupScrollState(id, false, false)
    return
  }

  const scrollRange = element.scrollHeight - element.clientHeight
  if (scrollRange <= 1) {
    setEventGroupScrollState(id, false, false)
    return
  }

  setEventGroupScrollState(
    id,
    element.scrollTop > 1,
    element.scrollTop < scrollRange - 1,
  )
}

function syncAllEventGroupScrollMasks() {
  eventGroupScrollRefs.forEach((_element, id) => syncEventGroupScrollMask(id))
}

function pruneEventGroupScrollStates() {
  const activeGroupIds = new Set(
    processItems.value
      .filter((item): item is ProcessEventGroupItem => item.type === 'group')
      .map(item => item.id),
  )
  const nextStates = Object.fromEntries(
    Object.entries(eventGroupScrollStates.value).filter(([id]) => activeGroupIds.has(id)),
  )

  if (Object.keys(nextStates).length !== Object.keys(eventGroupScrollStates.value).length)
    eventGroupScrollStates.value = nextStates
}

function setEventGroupScrollRef(id: string, element: HTMLElement | null) {
  const previousElement = eventGroupScrollRefs.get(id)
  if (previousElement === element)
    return

  if (previousElement)
    eventGroupScrollResizeObserver?.unobserve(previousElement)

  if (element) {
    eventGroupScrollRefs.set(id, element)
    eventGroupScrollResizeObserver?.observe(element)
    requestAnimationFrame(() => syncEventGroupScrollMask(id))
  }
  else {
    eventGroupScrollRefs.delete(id)
    setEventGroupScrollState(id, false, false)
  }
}

watch(
  [
    () => props.process.id,
    () => props.process.collapsed,
    () => props.messageStatus,
  ],
  () => {
    processExpanded.value = getDefaultProcessExpanded(props.process, props.messageStatus)
    expandedByEventId.value = {}
  },
  { immediate: true },
)

watch(
  [
    () => props.messageStatus,
    () => props.process.durationStartedAt,
  ],
  () => syncDurationTimer(),
  { immediate: true },
)

watch(
  [processItems, expandedByEventId],
  () => {
    nextTick(() => {
      pruneEventGroupScrollStates()
      syncAllEventGroupScrollMasks()
    })
  },
  { flush: 'post' },
)

onMounted(() => {
  if (typeof ResizeObserver === 'undefined')
    return

  eventGroupScrollResizeObserver = new ResizeObserver(() => syncAllEventGroupScrollMasks())
  eventGroupScrollRefs.forEach(element => eventGroupScrollResizeObserver?.observe(element))
  nextTick(() => syncAllEventGroupScrollMasks())
})

onUpdated(() => {
  nextTick(() => syncAllEventGroupScrollMasks())
})

onBeforeUnmount(() => stopDurationTimer())

onBeforeUnmount(() => {
  eventGroupScrollResizeObserver?.disconnect()
  eventGroupScrollResizeObserver = null
  eventGroupScrollRefs.clear()
})

function formatElapsed(ms: number) {
  if (ms < 1000)
    return '1s'

  const seconds = Math.round(ms / 1000)
  if (seconds < 60)
    return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  const restSeconds = seconds % 60
  return restSeconds > 0 ? `${minutes}m ${restSeconds}s` : `${minutes}m`
}

function stopDurationTimer() {
  if (!durationTimer)
    return

  window.clearInterval(durationTimer)
  durationTimer = null
}

function syncDurationTimer() {
  now.value = Date.now()
  stopDurationTimer()

  if (!isProcessRunning(props.messageStatus) || !props.process.durationStartedAt)
    return

  durationTimer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
}

function isExpanded(event: AgentProcessEvent) {
  return expandedByEventId.value[event.id] ?? false
}

function toggleEvent(event: AgentProcessEvent) {
  expandedByEventId.value = {
    ...expandedByEventId.value,
    [event.id]: !isExpanded(event),
  }
}

function isScriptLogExpanded(event: AgentScriptLogProcessEvent) {
  return expandedByEventId.value[event.id] ?? event.expanded !== false
}

function toggleProcess() {
  processExpanded.value = !processExpanded.value
}

function isGroupExpanded(item: ProcessEventGroupItem) {
  return expandedByEventId.value[item.id] ?? false
}

function toggleGroup(item: ProcessEventGroupItem) {
  expandedByEventId.value = {
    ...expandedByEventId.value,
    [item.id]: !isGroupExpanded(item),
  }
}

function getToolLabel(event: AgentToolCallProcessEvent) {
  if (event.label)
    return event.label

  const target = event.target ? ` ${event.target}` : ''
  return `${getFriendlyToolLabel(event.toolName, event.status)}${target}`
}

function getSkillLabel(event: AgentSkillLoadProcessEvent) {
  return event.status === 'success' ? `已加载 skill：${event.skillPath}` : `加载 skill：${event.skillPath}`
}

function getParallelTitle(event: AgentParallelDispatchProcessEvent) {
  return event.title || $t('创建 {count} 个并行任务', { count: event.count })
}

function getFriendlyToolLabel(toolName: string, status?: string) {
  const done = status === 'success'
  const labels: Record<string, [string, string]> = {
    read_file: [$t('读取文件'), $t('已读取文件')],
    write_file: [$t('写入文件'), $t('已写入文件')],
    edit_file: [$t('编辑文件'), $t('已编辑文件')],
    ls: [$t('浏览目录'), $t('已浏览目录')],
    glob: [$t('匹配文件'), $t('已匹配文件')],
    grep: [$t('搜索内容'), $t('已搜索内容')],
    execute: [$t('执行命令'), $t('已执行命令')],
    list_scripts: [$t('获取脚本列表'), $t('已获取脚本列表')],
    run_script: [$t('运行脚本'), $t('已运行脚本')],
    roxy_browser_launch: [$t('启动浏览器'), $t('已启动浏览器')],
    roxy_open_browsers: [$t('启动浏览器'), $t('已启动浏览器')],
    get_script_self_description: [$t('获取脚本详情信息'), $t('已获取脚本详情信息')],
    validate_script: [$t('校验脚本'), $t('已校验脚本')],
    save_script: [$t('保存脚本'), $t('已保存脚本')],
    roxy_workspace_list: [$t('获取工作区列表'), $t('已获取工作区列表')],
    roxy_project_list: [$t('获取项目列表'), $t('已获取项目列表')],
    roxy_health_check: [$t('检查 RoxyBrowser 连接'), $t('已检查 RoxyBrowser 连接')],
    roxy_browser_list: [$t('获取浏览器列表'), $t('已获取浏览器列表')],
    roxy_browser_create: [$t('创建浏览器'), $t('已创建浏览器')],
    roxy_browser_open: [$t('启动浏览器'), $t('已启动浏览器')],
    roxy_browser_connect: [$t('启动浏览器'), $t('已启动浏览器')],
    roxy_browser_close: [$t('关闭浏览器'), $t('已关闭浏览器')],
    roxy_browser_update: [$t('更新浏览器'), $t('已更新浏览器')],
    roxy_browser_delete: [$t('删除浏览器'), $t('已删除浏览器')],
    roxy_browser_detail: [$t('获取浏览器详情'), $t('已获取浏览器详情')],
    roxy_browser_connection_info: [$t('获取浏览器连接信息'), $t('已获取浏览器连接信息')],
    roxy_browser_clear_local_cache: [$t('清理浏览器本地缓存'), $t('已清理浏览器本地缓存')],
    roxy_browser_clear_server_cache: [$t('清理浏览器云端缓存'), $t('已清理浏览器云端缓存')],
    roxy_browser_list_labels: [$t('获取浏览器标签'), $t('已获取浏览器标签')],
    roxy_proxy_list: [$t('获取代理 IP 列表'), $t('已获取代理 IP 列表')],
    roxy_proxy_detail: [$t('获取代理 IP 详情'), $t('已获取代理 IP 详情')],
    roxy_proxy_create: [$t('创建代理 IP'), $t('已创建代理 IP')],
    roxy_proxy_detect: [$t('检测代理 IP'), $t('已检测代理 IP')],
    roxy_proxy_modify: [$t('修改代理 IP'), $t('已修改代理 IP')],
    roxy_proxy_delete: [$t('删除代理 IP'), $t('已删除代理 IP')],
    roxy_account_list: [$t('获取平台账号列表'), $t('已获取平台账号列表')],
    roxy_account_create: [$t('创建平台账号'), $t('已创建平台账号')],
    roxy_account_modify: [$t('修改平台账号'), $t('已修改平台账号')],
    roxy_account_delete: [$t('删除平台账号'), $t('已删除平台账号')],
  }

  const label = labels[toolName]
  if (label)
    return done ? label[1] : label[0]

  if (toolName.startsWith('browser_'))
    return $t('控制浏览器')

  return `使用工具：${toolName}`
}

function getScriptLogTitle(event: AgentScriptLogProcessEvent) {
  if (event.title)
    return event.title

  return event.scriptName ? `${$t('运行脚本')} ${event.scriptName}` : $t('运行脚本')
}

function formatFileSize(bytes?: number) {
  const size = Number(bytes) || 0
  if (size < 1024)
    return `${size} B`
  if (size < 1024 * 1024)
    return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function isRuntimeLogFile(file: AgentFileArtifact) {
  return /\.log$/i.test(file.fileName)
}

function getVisibleAgentFiles(event: AgentFileProcessEvent) {
  return event.files.filter(file => !isRuntimeLogFile(file))
}

function getFileIconName(file: AgentFileArtifact): SvgNames {
  const ext = file.fileName.split('.').pop()?.toLowerCase()
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'json', 'html', 'css', 'md', 'yaml', 'yml'].includes(ext || ''))
    return 'base/rx_ic_doc_code'
  if (file.mimeType?.includes('json') || file.mimeType?.startsWith('text/'))
    return 'base/rx_ic_doc_api'
  return 'base/rx_ic_doc_article'
}

function getAgentFileUrl(file: AgentFileArtifact) {
  return agentApi.getFileUrl(file.fileId, { download: true, fileName: file.fileName })
}

function getEventTitle(event: AgentProcessEvent) {
  if (event.type === 'tool_call')
    return getToolLabel(event)

  if (event.type === 'skill_load')
    return getSkillLabel(event)

  if (event.type === 'script_log')
    return getScriptLogTitle(event)

  if (event.type === 'agent_file')
    return event.title || $t('产物文件')

  if (event.type === 'parallel_dispatch')
    return getParallelTitle(event)

  if (event.type === 'worker_task')
    return event.title

  if (event.type === 'thinking')
    return event.title

  return event.title || $t('执行过程')
}

function getEventIcon(event: AgentProcessEvent): SvgNames | undefined {
  if (event.type === 'skill_load')
    return 'roxy-agent/rx-ic-skills'

  if (event.type === 'parallel_dispatch' || event.type === 'worker_task')
    return 'roxy-agent/rx-ic-task-manager'

  if (event.type === 'thinking')
    return 'roxy-agent/rx-ic-thinking'

  if (event.type === 'script_log')
    return 'roxy-agent/rx-ic-scripts'

  if (event.type === 'agent_file')
    return 'roxy-agent/rx-ic-property'

  return 'roxy-agent/rx-ic-tool'
}

function getGroupPrimaryEvent(events: AgentProcessEvent[]) {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]
    if (event.type !== 'thinking')
      return event
  }

  return events.at(-1)
}

function shouldShimmerGroup(item: ProcessEventGroupItem) {
  const event = getGroupPrimaryEvent(item.events)
  return Boolean(event && shouldShimmerEvent(event))
}

function getGroupTitle(events: AgentProcessEvent[]) {
  const event = getGroupPrimaryEvent(events)
  return event ? getEventTitle(event) : $t('执行过程')
}

function getGroupIcon(events: AgentProcessEvent[]) {
  const event = getGroupPrimaryEvent(events)
  return event ? getEventIcon(event) : undefined
}

function groupProcessEvents(events: AgentProcessEvent[]): ProcessRenderItem[] {
  const items: ProcessRenderItem[] = []
  let group: AgentProcessEvent[] = []

  function flushGroup() {
    if (!group.length)
      return

    if (group.length === 1) {
      items.push({
        type: 'event',
        event: group[0],
      })
      group = []
      return
    }

    items.push({
      type: 'group',
      id: `event-group-${group[0].id}-${group[group.length - 1].id}`,
      title: getGroupTitle(group),
      icon: getGroupIcon(group),
      events: group,
    })
    group = []
  }

  for (const event of events) {
    if (event.type === 'content') {
      flushGroup()
      if (event.content.trim())
        items.push({ type: 'content', event })
      continue
    }

    group.push(event)
  }

  flushGroup()
  return items
}

function getProcessAnswerEvent(events: AgentProcessEvent[]) {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]
    if (event.type === 'final_answer' && event.content.trim())
      return event
  }
}
</script>

<template>
  <section class="agent-process" data-node-id="3994:44959">
    <!-- 过程头部：展示任务耗时，并控制整段过程时间线展开/收起。 -->
    <button v-if="durationDisplayLabel" class="process-duration" type="button" @click="toggleProcess">
      <span>{{ durationDisplayLabel }}</span>
      <SvgIcon
        v-if="hasProcessItems()"
        name="base/rx_ic_chevron_down"
        size="12"
        :class="{ collapsed: !processExpanded }"
      />
    </button>

    <Transition name="agent-collapse">
      <div v-if="processExpanded" class="process-events">
        <!--
          processItems 已在 script 中预分组：
          - content 是助手输出内容，需要保持自然高度
          - event/group 是思考、工具调用、worker 等可折叠过程
        -->
        <template
          v-for="item in getProcessItems()"
          :key="getProcessItemKey(item)"
        >
          <!-- 助手流式输出内容：不属于可折叠过程区，不限制最大高度。 -->
          <div
            v-if="isProcessContentItem(item)"
            class="process-content"
            :class="{ emphasized: item.event.emphasis }"
          >
            <MarkdownContent :content="item.event.content" :variant="item.event.emphasis ? 'answer' : 'default'" />
          </div>

          <!-- 单个过程事件：当它没有和其他过程事件相邻时直接展示。 -->
          <template v-else-if="isProcessEventItem(item)">
            <div v-if="item.event.type === 'thinking'" class="process-event thinking-event">
              <button class="event-title" type="button" @click="toggleEvent(item.event)">
                <SvgIcon name="roxy-agent/rx-ic-thinking" size="16" />
                <span :class="{ 'process-running-text': shouldShimmerEvent(item.event) }">{{ (item.event as AgentThinkingProcessEvent).title }}</span>
                <SvgIcon name="base/rx_ic_chevron_down" size="12" :class="{ collapsed: !isExpanded(item.event) }" />
              </button>
              <Transition name="agent-collapse">
                <div v-if="isExpanded(item.event)" class="quoted-text">
                  <div class="quote-line" />
                  <p>{{ (item.event as AgentThinkingProcessEvent).content }}</p>
                </div>
              </Transition>
            </div>

            <div v-else-if="item.event.type === 'tool_call'" class="inline-event">
              <SvgIcon name="roxy-agent/rx-ic-tool" size="16" />
              <span :class="{ 'process-running-text': shouldShimmerEvent(item.event) }">{{ getToolLabel(item.event as AgentToolCallProcessEvent) }}</span>
            </div>

            <div v-else-if="item.event.type === 'script_log'" class="script-log-event process-event">
              <button class="inline-event script-log-trigger" type="button" @click="toggleEvent(item.event)">
                <SvgIcon name="base/rx_ic_browser_hammer" size="16" />
                <span :class="{ 'process-running-text': shouldShimmerEvent(item.event) }">{{ getScriptLogTitle(item.event as AgentScriptLogProcessEvent) }}</span>
                <SvgIcon name="base/rx_ic_chevron_down" size="12" :class="{ collapsed: !isScriptLogExpanded(item.event as AgentScriptLogProcessEvent) }" />
              </button>

              <Transition name="agent-collapse">
                <div v-if="isScriptLogExpanded(item.event as AgentScriptLogProcessEvent)" class="script-log-output">
                  <p
                    v-for="(line, index) in (item.event as AgentScriptLogProcessEvent).lines"
                    :key="`${item.event.id}-${index}`"
                    :class="`script-log-output__line--${line.level || 'info'}`"
                  >
                    <span v-if="line.level && line.level !== 'info'" class="script-log-output__level">{{ line.level }}</span>
                    <span>{{ line.message }}</span>
                  </p>
                </div>
              </Transition>
            </div>

            <div v-else-if="item.event.type === 'parallel_dispatch'" class="parallel-event">
              <!-- 并行调度包含嵌套 worker，每个 worker 可独立展开。 -->
              <button class="inline-event parallel-trigger" type="button" @click="toggleEvent(item.event)">
                <SvgIcon name="roxy-agent/rx-ic-task-manager" size="16" />
                <span>{{ getParallelTitle(item.event as AgentParallelDispatchProcessEvent) }}</span>
                <SvgIcon name="base/rx_ic_chevron_down" size="12" :class="{ collapsed: !isExpanded(item.event) }" />
              </button>

              <Transition name="agent-collapse">
                <div v-if="isExpanded(item.event)" class="parallel-body">
                  <div class="quote-line" />
                  <div class="worker-list">
                    <section
                      v-for="task in (item.event as AgentParallelDispatchProcessEvent).tasks"
                      :key="task.id"
                      class="worker-task"
                    >
                      <button class="worker-title" type="button" @click="toggleEvent(task)">
                        <span>{{ task.title }}</span>
                        <SvgIcon name="base/rx_ic_chevron_down" size="12" :class="{ collapsed: !isExpanded(task) }" />
                      </button>

                      <Transition name="agent-collapse">
                        <div v-if="isExpanded(task)" class="worker-card">
                          <template v-for="child in (task as AgentWorkerTaskProcessEvent).events" :key="child.id">
                            <div v-if="child.type === 'thinking'" class="worker-thinking">
                              <button class="event-title" type="button" @click="toggleEvent(child)">
                                <SvgIcon name="roxy-agent/rx-ic-thinking" size="16" />
                                <span :class="{ 'process-running-text': shouldShimmerEvent(child) }">{{ (child as AgentThinkingProcessEvent).title }}</span>
                                <SvgIcon name="base/rx_ic_chevron_down" size="12" :class="{ collapsed: !isExpanded(child) }" />
                              </button>
                              <Transition name="agent-collapse">
                                <div v-if="isExpanded(child)" class="quoted-text worker-quote">
                                  <div class="quote-line" />
                                  <p>{{ (child as AgentThinkingProcessEvent).content }}</p>
                                </div>
                              </Transition>
                            </div>

                            <div v-else-if="child.type === 'skill_load'" class="inline-event">
                              <SvgIcon name="base/rx_ic_doc_code" size="16" />
                              <span>{{ getSkillLabel(child as AgentSkillLoadProcessEvent) }}</span>
                            </div>

                            <div v-else-if="child.type === 'tool_call'" class="inline-event">
                              <SvgIcon name="roxy-agent/rx-ic-tool" size="16" />
                              <span :class="{ 'process-running-text': shouldShimmerEvent(child) }">{{ getToolLabel(child as AgentToolCallProcessEvent) }}</span>
                            </div>

                            <div v-else-if="child.type === 'script_log'" class="script-log-event process-event">
                              <button class="inline-event script-log-trigger" type="button" @click="toggleEvent(child)">
                                <SvgIcon name="base/rx_ic_browser_hammer" size="16" />
                                <span :class="{ 'process-running-text': shouldShimmerEvent(child) }">{{ getScriptLogTitle(child as AgentScriptLogProcessEvent) }}</span>
                                <SvgIcon name="base/rx_ic_chevron_down" size="12" :class="{ collapsed: !isScriptLogExpanded(child as AgentScriptLogProcessEvent) }" />
                              </button>

                              <Transition name="agent-collapse">
                                <div v-if="isScriptLogExpanded(child as AgentScriptLogProcessEvent)" class="script-log-output">
                                  <p
                                    v-for="(line, index) in (child as AgentScriptLogProcessEvent).lines"
                                    :key="`${child.id}-${index}`"
                                    :class="`script-log-output__line--${line.level || 'info'}`"
                                  >
                                    <span v-if="line.level && line.level !== 'info'" class="script-log-output__level">{{ line.level }}</span>
                                    <span>{{ line.message }}</span>
                                  </p>
                                </div>
                              </Transition>
                            </div>

                            <div
                              v-else-if="child.type === 'content'"
                              class="process-content"
                              :class="{ emphasized: (child as AgentContentProcessEvent).emphasis }"
                            >
                              <MarkdownContent
                                :content="(child as AgentContentProcessEvent).content"
                                :variant="(child as AgentContentProcessEvent).emphasis ? 'answer' : 'default'"
                              />
                            </div>
                          </template>
                        </div>
                      </Transition>
                    </section>
                  </div>
                </div>
              </Transition>
            </div>

            <div v-else-if="item.event.type === 'skill_load'" class="inline-event">
              <SvgIcon name="base/rx_ic_doc_code" size="16" />
              <span>{{ getSkillLabel(item.event as AgentSkillLoadProcessEvent) }}</span>
            </div>
          </template>

          <!-- 连续的非 content 过程事件会合并成组，只有这块可折叠区域限制最大高度并内部滚动。 -->
          <div
            v-else-if="isProcessEventGroupItem(item)"
            :ref="(element) => setEventGroupScrollRef(item.id, element as HTMLElement | null)"
            class="process-event-group"
            :class="{
              'sidebar-scroll--can-scroll-up': getEventGroupScrollState(item.id).canScrollUp,
              'sidebar-scroll--can-scroll-down': getEventGroupScrollState(item.id).canScrollDown,
            }"
            @scroll.passive="syncEventGroupScrollMask(item.id)"
          >
            <button class="event-group-trigger" type="button" @click="toggleGroup(item)">
              <SvgIcon v-if="item.icon" :name="item.icon" size="16" />
              <span :class="{ 'process-running-text': !isGroupExpanded(item) && shouldShimmerGroup(item) }">{{ item.title }}</span>
              <SvgIcon name="base/rx_ic_chevron_down" size="12" :class="{ collapsed: !isGroupExpanded(item) }" />
            </button>

            <Transition name="agent-collapse">
              <div v-if="isGroupExpanded(item)" class="event-group-body">
                <template v-for="event in item.events" :key="event.id">
                  <div v-if="event.type === 'thinking'" class="process-event thinking-event">
                    <button class="event-title" type="button" @click="toggleEvent(event)">
                      <SvgIcon name="roxy-agent/rx-ic-thinking" size="16" />
                      <span :class="{ 'process-running-text': shouldShimmerEvent(event) }">{{ (event as AgentThinkingProcessEvent).title }}</span>
                      <SvgIcon name="base/rx_ic_chevron_down" size="12" :class="{ collapsed: !isExpanded(event) }" />
                    </button>
                    <Transition name="agent-collapse">
                      <div v-if="isExpanded(event)" class="quoted-text">
                        <div class="quote-line" />
                        <p>{{ (event as AgentThinkingProcessEvent).content }}</p>
                      </div>
                    </Transition>
                  </div>

                  <div v-else-if="event.type === 'tool_call'" class="inline-event">
                    <SvgIcon name="roxy-agent/rx-ic-tool" size="16" />
                    <span :class="{ 'process-running-text': shouldShimmerEvent(event) }">{{ getToolLabel(event as AgentToolCallProcessEvent) }}</span>
                  </div>

                  <div v-else-if="event.type === 'script_log'" class="script-log-event process-event">
                    <button class="inline-event script-log-trigger" type="button" @click="toggleEvent(event)">
                      <SvgIcon name="base/rx_ic_browser_hammer" size="16" />
                      <span :class="{ 'process-running-text': shouldShimmerEvent(event) }">{{ getScriptLogTitle(event as AgentScriptLogProcessEvent) }}</span>
                      <SvgIcon name="base/rx_ic_chevron_down" size="12" :class="{ collapsed: !isScriptLogExpanded(event as AgentScriptLogProcessEvent) }" />
                    </button>

                    <Transition name="agent-collapse">
                      <div v-if="isScriptLogExpanded(event as AgentScriptLogProcessEvent)" class="script-log-output">
                        <p
                          v-for="(line, index) in (event as AgentScriptLogProcessEvent).lines"
                          :key="`${event.id}-${index}`"
                          :class="`script-log-output__line--${line.level || 'info'}`"
                        >
                          <span v-if="line.level && line.level !== 'info'" class="script-log-output__level">{{ line.level }}</span>
                          <span>{{ line.message }}</span>
                        </p>
                      </div>
                    </Transition>
                  </div>

                  <div v-else-if="event.type === 'parallel_dispatch'" class="parallel-event">
                    <!-- 分组内复用同一套并行 worker 渲染结构。 -->
                    <button class="inline-event parallel-trigger" type="button" @click="toggleEvent(event)">
                      <SvgIcon name="roxy-agent/rx-ic-task-manager" size="16" />
                      <span>{{ getParallelTitle(event as AgentParallelDispatchProcessEvent) }}</span>
                      <SvgIcon name="base/rx_ic_chevron_down" size="12" :class="{ collapsed: !isExpanded(event) }" />
                    </button>

                    <Transition name="agent-collapse">
                      <div v-if="isExpanded(event)" class="parallel-body">
                        <div class="quote-line" />
                        <div class="worker-list">
                          <section
                            v-for="task in (event as AgentParallelDispatchProcessEvent).tasks"
                            :key="task.id"
                            class="worker-task"
                          >
                            <button class="worker-title" type="button" @click="toggleEvent(task)">
                              <span>{{ task.title }}</span>
                              <SvgIcon name="base/rx_ic_chevron_down" size="12" :class="{ collapsed: !isExpanded(task) }" />
                            </button>

                            <Transition name="agent-collapse">
                              <div v-if="isExpanded(task)" class="worker-card">
                                <template v-for="child in (task as AgentWorkerTaskProcessEvent).events" :key="child.id">
                                  <div v-if="child.type === 'thinking'" class="worker-thinking">
                                    <button class="event-title" type="button" @click="toggleEvent(child)">
                                      <SvgIcon name="roxy-agent/rx-ic-thinking" size="16" />
                                      <span>{{ (child as AgentThinkingProcessEvent).title }}</span>
                                      <SvgIcon name="base/rx_ic_chevron_down" size="12" :class="{ collapsed: !isExpanded(child) }" />
                                    </button>
                                    <Transition name="agent-collapse">
                                      <div v-if="isExpanded(child)" class="quoted-text worker-quote">
                                        <div class="quote-line" />
                                        <p>{{ (child as AgentThinkingProcessEvent).content }}</p>
                                      </div>
                                    </Transition>
                                  </div>

                                  <div v-else-if="child.type === 'skill_load'" class="inline-event">
                                    <SvgIcon name="base/rx_ic_doc_code" size="16" />
                                    <span>{{ getSkillLabel(child as AgentSkillLoadProcessEvent) }}</span>
                                  </div>

                                  <div v-else-if="child.type === 'tool_call'" class="inline-event">
                                    <SvgIcon name="roxy-agent/rx-ic-tool" size="16" />
                                    <span :class="{ 'process-running-text': shouldShimmerEvent(child) }">{{ getToolLabel(child as AgentToolCallProcessEvent) }}</span>
                                  </div>

                                  <div v-else-if="child.type === 'script_log'" class="script-log-event process-event">
                                    <button class="inline-event script-log-trigger" type="button" @click="toggleEvent(child)">
                                      <SvgIcon name="base/rx_ic_browser_hammer" size="16" />
                                      <span :class="{ 'process-running-text': shouldShimmerEvent(child) }">{{ getScriptLogTitle(child as AgentScriptLogProcessEvent) }}</span>
                                      <SvgIcon name="base/rx_ic_chevron_down" size="12" :class="{ collapsed: !isScriptLogExpanded(child as AgentScriptLogProcessEvent) }" />
                                    </button>

                                    <Transition name="agent-collapse">
                                      <div v-if="isScriptLogExpanded(child as AgentScriptLogProcessEvent)" class="script-log-output">
                                        <p
                                          v-for="(line, index) in (child as AgentScriptLogProcessEvent).lines"
                                          :key="`${child.id}-${index}`"
                                          :class="`script-log-output__line--${line.level || 'info'}`"
                                        >
                                          <span v-if="line.level && line.level !== 'info'" class="script-log-output__level">{{ line.level }}</span>
                                          <span>{{ line.message }}</span>
                                        </p>
                                      </div>
                                    </Transition>
                                  </div>

                                  <div
                                    v-else-if="child.type === 'content'"
                                    class="process-content"
                                    :class="{ emphasized: (child as AgentContentProcessEvent).emphasis }"
                                  >
                                    <MarkdownContent
                                      :content="(child as AgentContentProcessEvent).content"
                                      :variant="(child as AgentContentProcessEvent).emphasis ? 'answer' : 'default'"
                                    />
                                  </div>
                                </template>
                              </div>
                            </Transition>
                          </section>
                        </div>
                      </div>
                    </Transition>
                  </div>

                  <div v-else-if="event.type === 'skill_load'" class="inline-event">
                    <SvgIcon name="base/rx_ic_doc_code" size="16" />
                    <span>{{ getSkillLabel(event as AgentSkillLoadProcessEvent) }}</span>
                  </div>
                </template>
              </div>
            </Transition>
          </div>
        </template>
      </div>
    </Transition>

    <!-- 最终回答从过程事件中提升出来，避免和工具/思考细节混在一起。 -->
    <div v-if="answerEvent && processCompleted && messageStatus !== 'error'" class="final-answer">
      <MarkdownContent :content="answerEvent.content" variant="answer" />
    </div>

    <div v-if="resultEvents.length" class="result-events">
      <template v-for="event in resultEvents" :key="event.id">
        <div v-if="isAgentFileEvent(event)" class="agent-file-list">
          <article v-for="file in getVisibleAgentFiles(event)" :key="file.fileId" class="agent-file-card">
            <div class="agent-file-card__icon">
              <SvgIcon :name="getFileIconName(file)" size="24" color="var(--color-text-disabled)" />
            </div>

            <div class="agent-file-card__meta">
              <div class="agent-file-card__name">
                {{ file.fileName }}
              </div>
              <div v-if="file.size" class="agent-file-card__size">
                {{ formatFileSize(file.size) }}
              </div>
            </div>

            <a class="agent-file-card__download" :href="getAgentFileUrl(file)" :download="file.fileName">
              {{ $t('下载') }}
            </a>
          </article>
        </div>
      </template>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.agent-process {
  interpolate-size: allow-keywords;
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 20px;
  color: var(--color-text-primary, var(--color-text-primary));
  font-size: 14px;
  line-height: 20px;
}

.process-duration {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 4px;
  padding: 0 0 12px;
  border: 0;
  border-bottom: 1px solid var(--color-border-secondary, var(--color-border-secondary));
  color: inherit;
  background: transparent;
  cursor: pointer;
  font: inherit;
}

.process-duration :deep(.svg) {
  transition: transform 0.18s ease;
}

.process-duration :deep(.collapsed) {
  transform: rotate(-90deg);
}

.process-events,
.process-event-group,
.event-group-body,
.process-event,
.parallel-event,
.worker-list,
.worker-task,
.worker-card,
.worker-thinking {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.process-events {
  gap: 20px;
}

.process-event-group {
  max-height: min(320px, 38vh);
  overflow-y: auto;
  padding-right: 8px;
  scrollbar-gutter: stable;
  --sidebar-scroll-mask-top-edge: #000;
  --sidebar-scroll-mask-top-hold: #000;
  --sidebar-scroll-mask-top-hold-stop: 0.25rem;
  --sidebar-scroll-mask-top-solid-stop: calc(0.25rem + calc(0.25rem * 4));
  --sidebar-scroll-mask-bottom-strong: #000;
  --sidebar-scroll-mask-bottom-mid: #000;
  --sidebar-scroll-mask-bottom-weak: #000;
  --sidebar-scroll-mask-bottom-end: #000;
  --sidebar-scroll-mask-bottom-solid-stop: calc(100% - 1.5rem);
  --sidebar-scroll-mask-bottom-strong-stop: calc(100% - 1rem);
  --sidebar-scroll-mask-bottom-mid-stop: calc(100% - 0.5rem);
  --sidebar-scroll-mask-bottom-weak-stop: calc(100% - 0.25rem);
  --sidebar-scroll-mask-bottom-end-stop: 100%;
  --sidebar-scroll-mask-image: linear-gradient(
    to bottom,
    var(--sidebar-scroll-mask-top-edge) 0,
    var(--sidebar-scroll-mask-top-hold) var(--sidebar-scroll-mask-top-hold-stop),
    black var(--sidebar-scroll-mask-top-solid-stop),
    black var(--sidebar-scroll-mask-bottom-solid-stop),
    var(--sidebar-scroll-mask-bottom-strong) var(--sidebar-scroll-mask-bottom-strong-stop),
    var(--sidebar-scroll-mask-bottom-mid) var(--sidebar-scroll-mask-bottom-mid-stop),
    var(--sidebar-scroll-mask-bottom-weak) var(--sidebar-scroll-mask-bottom-weak-stop),
    var(--sidebar-scroll-mask-bottom-end) var(--sidebar-scroll-mask-bottom-end-stop),
    transparent 100%
  );

  mask-image: var(--sidebar-scroll-mask-image);
  mask-repeat: no-repeat;
  mask-size: 100% 100%;
  -webkit-mask-image: var(--sidebar-scroll-mask-image);
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-size: 100% 100%;
}

.sidebar-scroll--can-scroll-up {
  --sidebar-scroll-mask-top-edge: transparent;
  --sidebar-scroll-mask-top-hold: transparent;
}

.sidebar-scroll--can-scroll-down {
  --sidebar-scroll-mask-bottom-strong: #000000e0;
  --sidebar-scroll-mask-bottom-mid: #00000085;
  --sidebar-scroll-mask-bottom-weak: #0000002e;
  --sidebar-scroll-mask-bottom-end: transparent;
}

.process-event-group,
.event-group-body,
.process-event,
.parallel-event,
.worker-list,
.worker-task {
  gap: 12px;
}

.event-title,
.worker-title,
.inline-event,
.event-group-trigger {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
  color: var(--color-text-disabled, #a3a3a3);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
}

.event-title,
.worker-title,
.parallel-trigger,
.event-group-trigger {
  width: fit-content;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  font: inherit;
}

.event-title :deep(.svg),
.worker-title :deep(.svg),
.parallel-trigger :deep(.svg),
.event-group-trigger :deep(.svg) {
  flex: 0 0 auto;
  color: currentColor;
  transition: transform 0.18s ease;
}

.event-title :deep(.collapsed),
.worker-title :deep(.collapsed),
.parallel-trigger :deep(.collapsed),
.event-group-trigger :deep(.collapsed) {
  transform: rotate(-90deg);
}

.quoted-text,
.parallel-body {
  display: flex;
  min-width: 0;
  gap: 12px;
}

.quoted-text p {
  flex: 1 1 0;
  min-width: 0;
  margin: 0;
  color: var(--color-text-quaternary, #737373);
  white-space: pre-wrap;
  word-break: break-word;
}

.quote-line {
  width: 1px;
  flex: 0 0 1px;
  align-self: stretch;
  background: var(--color-border-secondary, var(--color-border-secondary));
}

.process-content {
  width: 100%;
  color: var(--color-text-primary, var(--color-text-primary));
}

.inline-event {
  width: 100%;
}

.event-group-trigger {
  max-width: 100%;
}

.inline-event span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.process-running-text {
  color: transparent;
  background-image: linear-gradient(
    90deg,
    var(--color-text-disabled, #a3a3a3) 35%,
    var(--color-text-primary, #27272a) 50%,
    var(--color-text-disabled, #a3a3a3) 65%
  );
  background-position: 150% center;
  background-size: 200% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: agent-process-shimmer-text 1.4s linear infinite;
}

.event-group-trigger span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.parallel-trigger {
  display: flex;
}

.parallel-body {
  width: 100%;
}

.worker-list {
  flex: 1 1 0;
  gap: 10px;
}

.worker-card {
  gap: 12px;
  padding-left: 20px;
  border-radius: 5px;
}

.worker-thinking {
  gap: 10px;
}

.process-content.emphasized {
  font-weight: 500;
}

.final-answer {
  width: 100%;
  margin: 0;
}

.result-events {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
}

.script-log-event {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
}

.script-log-trigger {
  width: fit-content;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  font: inherit;
}

.script-log-trigger :deep(.svg) {
  flex: 0 0 auto;
  color: currentColor;
  transition: transform 0.18s ease;
}

.script-log-trigger :deep(.collapsed) {
  transform: rotate(-90deg);
}

.script-log-output {
  display: flex;
  width: 100%;
  max-height: 220px;
  flex-direction: column;
  gap: 2px;
  padding: 12px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 8px;
  color: var(--color-text-quaternary);
  background: var(--color-bg-tertiary);
  box-sizing: border-box;
  overflow-y: auto;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
}

.script-log-output p {
  display: flex;
  min-width: 0;
  gap: 6px;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.script-log-output__level {
  flex: 0 0 auto;
  color: var(--color-text-disabled);
  text-transform: uppercase;
}

.script-log-output__line--warn {
  color: var(--color-text-warning-primary);
}

.script-log-output__line--error,
.script-log-output__line--stderr {
  color: var(--color-text-error-primary);
}

.agent-file-list {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.agent-file-card {
  display: flex;
  width: 100%;
  min-height: 56px;
  min-width: 0;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 8px;
  background: var(--color-bg-primary);
  box-sizing: border-box;
}

.agent-file-card__icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  place-items: center;
  border-radius: 4px;
  background: var(--color-bg-tertiary);
}

.agent-file-card__meta {
  display: flex;
  min-width: 0;
  flex: 1 1 0;
  flex-direction: column;
}

.agent-file-card__name,
.agent-file-card__size {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-file-card__name {
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.agent-file-card__size {
  color: var(--color-text-tertiary);
  font-size: 12px;
  line-height: 16px;
}

.agent-file-card__download {
  display: inline-flex;
  min-height: 32px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  box-sizing: border-box;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-decoration: none;
  white-space: nowrap;
}

.agent-file-card__download:hover {
  background: var(--color-bg-secondary-hover);
}

@media (max-width: 720px) {
  .quoted-text,
  .parallel-body {
    gap: 10px;
  }

  .worker-card {
    padding-left: 16px;
  }
}

.agent-collapse-enter-active,
.agent-collapse-leave-active {
  overflow: clip;
  transition:
    height 180ms cubic-bezier(0.2, 0, 0, 1),
    opacity 120ms ease,
    transform 150ms cubic-bezier(0.2, 0, 0, 1);
  contain: layout paint;
  will-change: height, opacity, transform;
}

.agent-collapse-enter-from,
.agent-collapse-leave-to {
  height: 0;
  opacity: 0;
  transform: translateY(-2px);
}

.agent-collapse-enter-to,
.agent-collapse-leave-from {
  height: calc-size(auto, size);
  opacity: 1;
  transform: translateY(0);
}

@keyframes agent-process-shimmer-text {
  0% {
    background-position: 150% center;
  }

  100% {
    background-position: -50% center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .process-running-text {
    color: var(--color-text-disabled, #a3a3a3);
    background-image: none;
    -webkit-text-fill-color: currentColor;
    animation: none;
  }

  .agent-collapse-enter-active,
  .agent-collapse-leave-active {
    transition: none;
  }
}
</style>
