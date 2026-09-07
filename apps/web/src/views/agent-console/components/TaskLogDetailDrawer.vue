<script setup lang="ts">
import type {
  AgentTaskArtifactDTO,
  AgentTaskExecutionDetailDTO,
  AgentTaskLogDTO,
  AgentTaskLogStatus,
} from '@roxy/shared/channel'
import { formatTaskDateTime, getTaskDurationMs } from '../task-manager'
import MarkdownContent from './MarkdownContent.vue'

const props = defineProps<{
  log: AgentTaskLogDTO
  detail?: AgentTaskExecutionDetailDTO
  detailReady: boolean
  endReason: string
  windowLabels: Record<string, string>
  deletedWindowLabels: Record<string, boolean>
  windowLabelsReady: boolean
  fileUrl: (fileId: string, options?: { download?: boolean, fileName?: string }) => string
}>()

const emit = defineEmits<{
  close: []
}>()

const statusLabels = computed<Record<AgentTaskLogStatus, string>>(() => ({
  preparing: $t('准备中'),
  running: $t('执行中'),
  success: $t('成功'),
  partial_failed: $t('部分失败'),
  failed: $t('失败'),
  interrupted: $t('已停止'),
  skipped: $t('已跳过'),
}))

const selectedWindowKey = ref('')
const logViewer = ref<HTMLElement>()
const conversationPanel = ref<HTMLElement>()
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined

const scriptWindows = computed(() => props.detail?.scriptWindows ?? [])
const displayedScriptWindows = computed(() => {
  if (scriptWindows.value.length === 0) {
    return []
  }

  const existingWindows = scriptWindows.value.filter(item => !item.dirId || props.windowLabels[item.dirId])
  return existingWindows.length > 0
    ? existingWindows
    : [scriptWindows.value[0]]
})
const selectedWindow = computed(() => displayedScriptWindows.value.find(item => item.key === selectedWindowKey.value)
  ?? displayedScriptWindows.value[0])

const formattedDuration = computed(() => {
  const durationMs = getTaskDurationMs(props.log, now.value)
  if (durationMs === null) {
    return '-'
  }
  const totalSeconds = Math.floor(durationMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return hours > 0
    ? $t('{hours} 小时 {minutes} 分 {seconds} 秒', { hours, minutes, seconds })
    : $t('{minutes} 分 {seconds} 秒', { minutes, seconds })
})

function isWindowReferenceResolved(id: string) {
  return Boolean(props.windowLabels[id] || props.deletedWindowLabels[id])
}

const formattedWindows = computed(() => {
  if (props.log.windowDirIds.length === 0) {
    return '-'
  }

  if (!props.log.windowDirIds.every(isWindowReferenceResolved)) {
    return $t('加载中...')
  }

  const labels = props.log.windowDirIds
    .map(id => props.windowLabels[id])
    .filter((label): label is string => Boolean(label))
  return labels.length > 0
    ? labels.join('、')
    : $t('窗口不可用或无权限')
})

function displayWindowLabel(key: string, label: string, dirId: string | null) {
  if (!dirId) {
    return label || key
  }

  if (props.windowLabels[dirId]) {
    return props.windowLabels[dirId]
  }

  if (props.deletedWindowLabels[dirId]) {
    return $t('窗口不可用或无权限')
  }

  if (label && label !== dirId && label !== key) {
    return label
  }

  return $t('加载中...')
}

function artifactSize(size: number | null) {
  if (size === null) {
    return '-'
  }
  if (size < 1024) {
    return `${size} B`
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function artifactUrl(artifact: AgentTaskArtifactDTO) {
  return props.fileUrl(artifact.fileId, { download: true, fileName: artifact.fileName })
}

function fileName(path: string) {
  return path.split(/[\\/]/).at(-1) || path
}

function closeOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
  }
}

async function scrollToBottom(target: () => HTMLElement | undefined) {
  await nextTick()
  const element = target()
  if (element) {
    element.scrollTop = element.scrollHeight
  }
}

watch(scriptWindows, (items) => {
  if (!items.some(item => item.key === selectedWindowKey.value)) {
    selectedWindowKey.value = items[0]?.key ?? ''
  }
}, { immediate: true })

watch(
  [selectedWindowKey, () => selectedWindow.value?.log],
  () => void scrollToBottom(() => logViewer.value),
  { immediate: true },
)

watch(
  () => {
    const messages = props.detail?.messages ?? []
    const lastMessage = messages.at(-1)
    return `${messages.length}:${lastMessage?.id ?? ''}:${lastMessage?.content.length ?? 0}`
  },
  () => void scrollToBottom(() => conversationPanel.value),
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('keydown', closeOnEscape)
  clock = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', closeOnEscape)
  if (clock) {
    clearInterval(clock)
  }
})
</script>

<template>
  <div class="task-detail-overlay" role="presentation" @mousedown.self="emit('close')">
    <aside class="task-detail-drawer" role="dialog" aria-modal="true" :aria-label="$t('任务详情')">
      <header class="drawer-header">
        <div class="drawer-title">
          <span>{{ $t('任务详情') }}</span>
          <strong :title="log.taskName">{{ log.taskName }}</strong>
        </div>
        <button class="close-button" type="button" :aria-label="$t('关闭')" @click="emit('close')">
          <SvgIcon name="roxy-agent/rx-ic-close" size="20" />
        </button>
      </header>

      <div class="drawer-content">
        <section class="detail-section">
          <h3>{{ $t('执行信息') }}</h3>
          <div class="detail-card">
            <dl>
              <div><dt>{{ $t('模板') }}</dt><dd>{{ log.templateName }}</dd></div>
              <div><dt>{{ $t('窗口') }}</dt><dd>{{ formattedWindows }}</dd></div>
              <div><dt>{{ $t('开始时间') }}</dt><dd>{{ formatTaskDateTime(log.startedAt) }}</dd></div>
              <div><dt>{{ $t('结束时间') }}</dt><dd>{{ formatTaskDateTime(log.endedAt) }}</dd></div>
              <div><dt>{{ $t('执行时长') }}</dt><dd>{{ formattedDuration }}</dd></div>
              <div>
                <dt>{{ $t('状态') }}</dt>
                <dd><span class="detail-status" :class="log.status"><i />{{ statusLabels[log.status] }}</span></dd>
              </div>
              <div v-if="endReason">
                <dt>{{ $t('结束原因') }}</dt><dd class="error-text">
                  {{ endReason }}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section v-if="log.templateType === 'script'" class="detail-section execution-section">
          <div class="section-heading">
            <h3>{{ $t('运行日志') }}</h3>
            <p>{{ $t('并行执行时，可点击不同窗口查看对应的运行日志。') }}</p>
          </div>

          <div v-if="!windowLabelsReady" class="detail-placeholder">
            {{ $t('正在加载窗口编号...') }}
          </div>
          <div v-else-if="!detailReady" class="detail-placeholder">
            {{ $t('正在加载运行日志...') }}
          </div>
          <div v-else-if="!displayedScriptWindows.length" class="detail-placeholder">
            {{ $t('暂无运行日志') }}
          </div>
          <template v-else>
            <div class="window-tabs" role="tablist" :aria-label="$t('执行窗口')">
              <button
                v-for="item in displayedScriptWindows"
                :key="item.key"
                type="button"
                role="tab"
                :aria-selected="selectedWindow?.key === item.key"
                :class="{ active: selectedWindow?.key === item.key }"
                @click="selectedWindowKey = item.key"
              >
                <i :class="item.status" />
                {{ displayWindowLabel(item.key, item.label, item.dirId) }}
              </button>
            </div>

            <pre ref="logViewer" class="log-viewer">{{ selectedWindow?.log || $t('暂无运行日志') }}</pre>

            <div v-if="selectedWindow?.failedFiles.length" class="upload-warning">
              <img src="/@/assets/icons/status/warning.svg" alt="">
              <span>{{ $t('以下文件上传失败：{files}', { files: selectedWindow.failedFiles.map(fileName).join('、') }) }}</span>
            </div>

            <div class="output-block">
              <h3>{{ $t('产出文件') }}</h3>
              <div v-if="!selectedWindow?.artifacts.length" class="detail-placeholder compact">
                {{ $t('暂无产出文件') }}
              </div>
              <a
                v-for="artifact in selectedWindow?.artifacts"
                :key="artifact.fileId"
                class="artifact-row"
                :href="artifactUrl(artifact)"
                download
              >
                <span class="file-icon"><SvgIcon name="roxy-agent/rx-ic-prompts" size="16" /></span>
                <span class="artifact-name" :title="artifact.fileName">{{ artifact.fileName }}</span>
                <span class="artifact-size">{{ artifactSize(artifact.size) }}</span>
                <SvgIcon name="base/rx_ic_download" size="16" />
              </a>
            </div>
          </template>
        </section>

        <template v-else>
          <section class="detail-section">
            <h3>{{ $t('产出文件') }}</h3>
            <div v-if="!detail?.artifacts.length" class="detail-placeholder compact">
              {{ $t('暂无产出文件') }}
            </div>
            <a
              v-for="artifact in detail?.artifacts"
              :key="artifact.fileId"
              class="artifact-row"
              :href="artifactUrl(artifact)"
              download
            >
              <span class="file-icon"><SvgIcon name="roxy-agent/rx-ic-prompts" size="16" /></span>
              <span class="artifact-name" :title="artifact.fileName">{{ artifact.fileName }}</span>
              <span class="artifact-size">{{ artifactSize(artifact.size) }}</span>
              <SvgIcon name="base/rx_ic_download" size="16" />
            </a>
          </section>

          <section class="detail-section execution-section">
            <h3>{{ $t('会话记录') }}</h3>
            <div v-if="!detailReady" class="detail-placeholder">
              {{ $t('正在加载会话记录...') }}
            </div>
            <div v-else-if="!detail?.messages.length" class="detail-placeholder">
              {{ $t('暂无会话记录') }}
            </div>
            <div v-else ref="conversationPanel" class="conversation-panel" role="log" :aria-label="$t('会话记录')" aria-live="polite">
              <article
                v-for="message in detail.messages"
                :key="message.id"
                class="conversation-message"
                :class="message.role"
              >
                <div class="conversation-message__content">
                  <MarkdownContent :content="message.content || $t('暂无内容')" />
                </div>
                <time>{{ formatTaskDateTime(message.createdAt) }}</time>
              </article>
            </div>
          </section>
        </template>
      </div>
    </aside>
  </div>
</template>

<style scoped lang="scss">
.task-detail-overlay {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  isolation: isolate;

  &::before {
    position: absolute;
    z-index: -1;
    inset: 0;
    background: var(--color-bg-overlay, rgb(15 15 15 / 60%));
    content: '';
  }
}

.task-detail-drawer {
  width: min(560px, 100vw);
  height: 100%;
  overflow: hidden;
  border-left: 1px solid var(--color-border-secondary);
  background: var(--color-bg-primary);
  box-shadow: -12px 0 36px rgb(15 15 15 / 10%);
}

.drawer-header {
  display: flex;
  height: 72px;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid var(--color-border-secondary);
}

.drawer-title {
  min-width: 0;
}
.drawer-title > span {
  display: block;
  color: var(--color-text-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.drawer-title > strong {
  display: block;
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 18px;
  line-height: 26px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close-button {
  display: grid;
  width: 32px;
  height: 32px;
  flex: none;
  place-items: center;
  border: 0;
  border-radius: 8px;
  color: var(--color-text-secondary);
  background: transparent;
  cursor: pointer;
}
.close-button:hover {
  background: var(--color-bg-quaternary);
}

.drawer-content {
  height: calc(100% - 72px);
  overflow-y: auto;
  padding: 24px;
}

.detail-section + .detail-section {
  margin-top: 28px;
}
.detail-section h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}
.detail-card {
  margin-top: 12px;
  padding: 16px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 12px;
  background: var(--color-bg-primary);
}
.detail-card dl {
  display: grid;
  gap: 12px;
  margin: 0;
}
.detail-card dl > div {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 16px;
}
.detail-card dt {
  color: var(--color-text-tertiary);
  font-size: 13px;
}
.detail-card dd {
  min-width: 0;
  margin: 0;
  color: var(--color-text-primary);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.detail-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.detail-status i,
.window-tabs i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.detail-status.success,
.window-tabs i.success {
  color: #17b26a;
}
.detail-status.running,
.detail-status.preparing,
.window-tabs i.running {
  color: #2e90fa;
}
.detail-status.partial_failed {
  color: #f79009;
}
.detail-status.failed,
.detail-status.interrupted,
.window-tabs i.failed,
.window-tabs i.interrupted {
  color: #f04438;
}
.detail-status.skipped {
  color: var(--color-text-quaternary);
}
.error-text {
  color: #d92d20 !important;
}

.section-heading p {
  margin: 4px 0 0;
  color: var(--color-text-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.window-tabs {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  overflow-x: auto;
  padding-bottom: 2px;
}
.window-tabs button {
  display: inline-flex;
  min-height: 32px;
  flex: none;
  align-items: center;
  gap: 7px;
  padding: 5px 15px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 999px;
  color: var(--color-text-primary);
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
}
.window-tabs button:focus-visible {
  outline: 0;
  box-shadow: var(--agent-focus-ring);
}
.window-tabs button.active {
  color: var(--color-text-primary-inverse);
  background: var(--color-bg-primary-inverse);
}

.log-viewer {
  box-sizing: border-box;
  width: 100%;
  height: 240px;
  margin: 12px 0 0;
  overflow: auto;
  padding: 14px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 20px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.detail-placeholder {
  display: grid;
  min-height: 120px;
  margin-top: 12px;
  place-items: center;
  border: 1px dashed var(--color-border-secondary);
  border-radius: 10px;
  color: var(--color-text-tertiary);
  font-size: 13px;
}
.detail-placeholder.compact {
  min-height: 64px;
}

.upload-warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  color: #b54708;
  background: #fffaeb;
  font-size: 12px;
  line-height: 18px;
}
.upload-warning img {
  width: 16px;
  height: 16px;
  flex: none;
}
.output-block {
  margin-top: 24px;
}
.output-block > h3 {
  margin-bottom: 12px;
}

.artifact-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto 16px;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 8px 10px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  color: var(--color-text-primary);
  text-decoration: none;
}
.detail-section > h3 + .artifact-row {
  margin-top: 12px;
}
.artifact-row + .artifact-row {
  margin-top: 8px;
}
.artifact-row:hover {
  background: var(--color-bg-secondary);
}
.file-icon {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 8px;
  color: var(--color-text-secondary);
  background: var(--color-bg-quaternary);
}
.artifact-name {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.artifact-size {
  color: var(--color-text-tertiary);
  font-size: 12px;
}

.conversation-panel {
  display: flex;
  width: 100%;
  height: 320px;
  margin-top: 12px;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  padding: 16px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 8px;
  background: var(--color-bg-primary);
  box-sizing: border-box;
  scrollbar-gutter: stable;
}
.conversation-message {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.conversation-message.user {
  align-items: flex-end;
}
.conversation-message__content {
  max-width: 100%;
  color: var(--color-text-primary);
  font-size: 14px;
  line-height: 20px;
  overflow-wrap: anywhere;
}
.conversation-message.user .conversation-message__content {
  width: fit-content;
  padding: 12px;
  border-radius: 8px;
  background: var(--color-bg-tertiary);
}
.conversation-message.assistant .conversation-message__content {
  width: fit-content;
  padding: 12px;
  border-radius: 8px;
  background: var(--color-bg-secondary);
  font-weight: 500;
}
.conversation-message time {
  color: var(--color-text-tertiary);
  font-size: 12px;
  line-height: 20px;
}
.conversation-message.user time {
  text-align: right;
}
.conversation-message__content :deep(.agent-markdown > :first-child) {
  margin-top: 0;
}
.conversation-message__content :deep(.agent-markdown > :last-child) {
  margin-bottom: 0;
}

@media (max-width: 560px) {
  .drawer-header,
  .drawer-content {
    padding-right: 16px;
    padding-left: 16px;
  }
  .detail-card dl > div {
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 12px;
  }
}
</style>
