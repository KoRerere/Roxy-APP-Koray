<script setup lang="ts">
import type { AgentConversationProcess, AgentFileArtifact, AgentFileProcessEvent, AgentMessageStatus, AgentTaskReportSaveRequest } from '../types'
import type { TaskReportWindowInfo } from '../task-report-window-info'
import { useAgentConsoleApi } from '../api'
import { splitProcessEventBlocks } from '../processEventGrouping'
import { fetchTaskReportWindowInfo } from '../task-report-window-info'
import { shouldCollapseProcessBeforeTaskReport } from '../task-report-presentation'
import AgentCollapse from './AgentCollapse.vue'
import AgentLifecycleTree from './AgentLifecycleTree.vue'
import AgentProcessEventList from './AgentProcessEventList.vue'
import AgentTaskReportCard from './AgentTaskReportCard.vue'
import MarkdownContent from './MarkdownContent.vue'

const props = defineProps<{
  conversationId: string
  hasMessageContent?: boolean
  process: AgentConversationProcess
  messageStatus?: AgentMessageStatus
}>()

const emit = defineEmits<{
  saveTemplate: [payload: AgentTaskReportSaveRequest]
}>()

const processExpanded = ref(props.process.collapsed === false || props.messageStatus === 'thinking' || props.messageStatus === 'streaming')
const reportWindowInfo = ref<ReadonlyMap<string, TaskReportWindowInfo>>(new Map())
const now = ref(Date.now())
const api = useAgentConsoleApi()
let timer: number | undefined

const rootEvents = computed(() => props.process.events.filter(event => event.type !== 'final_answer' && event.type !== 'agent_file' && event.type !== 'task_report'))
const rootBlocks = computed(() => splitProcessEventBlocks(rootEvents.value, 'root'))
const lastRootBlockId = computed(() => rootBlocks.value.at(-1)?.id)
const answer = computed(() => props.process.events.find(event => event.type === 'final_answer'))
const files = computed(() => props.process.events.filter((event): event is AgentFileProcessEvent => event.type === 'agent_file').flatMap(event => event.files.filter(file => !/\.log$/i.test(file.fileName))))
const reports = computed(() => props.process.events.filter((event): event is Extract<typeof event, { type: 'task_report' }> => event.type === 'task_report' && !event.superseded))
const answerStreaming = computed(() => props.messageStatus === 'thinking' || props.messageStatus === 'streaming')
const showWaitingPlaceholder = computed(() => {
  const running = props.messageStatus === 'thinking' || props.messageStatus === 'streaming'
  const hasVisibleRootEvent = rootEvents.value.some((event) => {
    return event.type !== 'content' || Boolean(event.content.trim())
  })
  const hasAnswer = answer.value?.type === 'final_answer' && Boolean(answer.value.content.trim())

  return running && !props.hasMessageContent && !hasVisibleRootEvent && !hasAnswer && files.value.length === 0
})
const durationLabel = computed(() => {
  if (props.messageStatus === 'thinking' || props.messageStatus === 'streaming') {
    const started = props.process.durationStartedAt
    if (started) {
      const seconds = Math.max(0, Math.floor((now.value - started) / 1000))
      if (seconds < 60) {
        return `${$t('任务耗时')} ${seconds}s`
      }

      const minutes = Math.floor(seconds / 60)
      const restSeconds = seconds % 60
      return restSeconds > 0
        ? `${$t('任务耗时')} ${minutes}m${restSeconds}s`
        : `${$t('任务耗时')} ${minutes}m`
    }
  }
  return props.process.durationLabel
})

function toggleProcess() {
  processExpanded.value = !processExpanded.value
}

function fileUrl(file: AgentFileArtifact) {
  return api.getFileUrl(file.fileId, { download: true, fileName: file.fileName })
}

function syncTimer() {
  now.value = Date.now()
  if (timer) {
    window.clearTimeout(timer)
    timer = undefined
  }

  const startedAt = props.process.durationStartedAt
  if ((props.messageStatus === 'thinking' || props.messageStatus === 'streaming') && startedAt) {
    const elapsed = Math.max(0, now.value - startedAt)
    const nextSecondDelay = 1000 - (elapsed % 1000)
    timer = window.setTimeout(syncTimer, nextSecondDelay)
  }
}

watch(() => [props.messageStatus, props.process.durationStartedAt] as const, ([status]) => {
  if (status === 'thinking' || status === 'streaming') {
    processExpanded.value = true
  }
  syncTimer()
}, { immediate: true })

watch(reports, async (nextReports) => {
  const dirIds = nextReports.flatMap(report => report.report.windows.map(window => window.dirId))
  if (dirIds.length === 0) {
    reportWindowInfo.value = new Map()
    return
  }

  try {
    reportWindowInfo.value = await fetchTaskReportWindowInfo(dirIds)
  }
  catch (error) {
    console.warn('[agent-console] Failed to load task report window info:', error)
    reportWindowInfo.value = new Map()
  }
}, { immediate: true })

watch(
  [() => props.messageStatus, () => props.process.revision],
  ([status]) => {
    if (shouldCollapseProcessBeforeTaskReport(props.process.events, status)) {
      processExpanded.value = false
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (timer) {
    window.clearTimeout(timer)
  }
})
</script>

<template>
  <section class="agent-process">
    <div v-if="durationLabel || processExpanded" class="process-round">
      <button v-if="durationLabel" class="process-duration" type="button" @click="toggleProcess">
        <span>{{ durationLabel }}</span>
        <SvgIcon name="base/rx_ic_chevron_down" size="12" :class="{ collapsed: !processExpanded }" />
      </button>

      <AgentCollapse :expanded="processExpanded">
        <div class="process-collapse-content" :class="{ 'process-collapse-content--spaced': durationLabel }">
          <div class="process-events">
            <div v-if="showWaitingPlaceholder" class="process-waiting-placeholder">
              <SvgIcon name="roxy-agent/rx-ic-thinking" size="16" />
              <span>{{ $t('正在思考') }}</span>
            </div>
            <template v-else>
              <template v-for="block in rootBlocks" :key="block.id">
                <AgentProcessEventList
                  v-if="block.type === 'events'"
                  :events="block.events"
                  :running="(messageStatus === 'thinking' || messageStatus === 'streaming') && block.id === lastRootBlockId"
                  :scope="block.id"
                />
                <AgentLifecycleTree
                  v-else
                  v-memo="[block.event.renderRevision, block.event.lifecycleStatus]"
                  :event="block.event"
                />
              </template>
            </template>
          </div>
        </div>
      </AgentCollapse>
    </div>

    <MarkdownContent
      v-if="answer?.type === 'final_answer'"
      :content="answer.content"
      :streaming="answerStreaming"
      variant="answer"
    />

    <AgentTaskReportCard
      v-for="report in reports"
      :key="report.id"
      :conversation-id="conversationId"
      :event="report"
      :window-info="reportWindowInfo"
      @save-template="emit('saveTemplate', $event)"
    />

    <div v-if="files.length" class="agent-file-list">
      <article v-for="file in files" :key="file.fileId" class="agent-file-card">
        <div class="agent-file-main">
          <span class="agent-file-icon" aria-hidden="true">
            <SvgIcon name="base/rx_ic_doc_line" size="24" />
          </span>
          <span class="agent-file-name" :title="file.fileName">{{ file.fileName }}</span>
        </div>
        <a class="agent-file-download" :href="fileUrl(file)" :download="file.fileName">{{ $t('下载') }}</a>
      </article>
    </div>
  </section>
</template>

<style scoped>
.agent-process {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 20px;
  color: var(--color-text-primary);
  font-size: 14px;
  line-height: 20px;
}
.process-round {
  min-width: 0;
}
.process-duration {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 4px;
  padding: 0 0 12px;
  border: 0;
  border-bottom: 1px solid var(--color-border-secondary);
  color: var(--color-text-primary);
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-align: left;
}
.process-duration :deep(.svg) {
  transition: transform 0.18s ease;
}
.process-duration :deep(.collapsed) {
  transform: rotate(-90deg);
}
.process-events {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 18px;
}
.process-collapse-content--spaced {
  padding-top: 20px;
}
.process-waiting-placeholder {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
  color: var(--color-text-disabled, #a3a3a3);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
}
.process-waiting-placeholder span {
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
  animation: agent-process-waiting-shimmer 1.4s linear infinite;
}
.agent-file-list {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}
.agent-file-card {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border: 1px solid var(--color-border-secondary, #e5e5e5);
  border-radius: 8px;
  color: var(--color-text-primary, #141414);
  background: var(--color-bg-primary, #fcfcfc);
}
.agent-file-main {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 4px;
}
.agent-file-icon {
  display: inline-flex;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 4px;
  color: var(--colors-icon-icon-tertiary, #737373);
  background: var(--color-bg-tertiary, #f5f5f5);
}
.agent-file-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--color-text-primary, #141414);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.agent-file-download {
  display: inline-flex;
  min-height: 34px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border: 1px solid var(--color-border-primary, #d6d6d6);
  border-radius: 10px;
  color: var(--color-text-primary, #141414);
  background: var(--color-bg-primary, #fcfcfc);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-decoration: none;
  white-space: nowrap;
}
.agent-file-download:hover {
  border-color: var(--color-border-primary-hover, var(--color-border-primary, #d6d6d6));
  background: var(--color-bg-tertiary, #f5f5f5);
}
.agent-file-download:focus-visible {
  outline: 2px solid var(--color-border-primary-inverse, #141414);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .process-waiting-placeholder span {
    color: var(--color-text-disabled, #a3a3a3);
    background: none;
    -webkit-text-fill-color: currentcolor;
    animation: none;
  }
}

@keyframes agent-process-waiting-shimmer {
  from {
    background-position: 150% center;
  }

  to {
    background-position: -50% center;
  }
}
</style>
