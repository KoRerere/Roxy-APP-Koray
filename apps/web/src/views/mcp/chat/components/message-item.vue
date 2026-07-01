<script setup lang="ts">
import type { AgentFileItem, FormattedMessage, GeneratedImageInfo, HitlDecision, MessageEntryView, ScriptLogLine } from '/@/views/mcp/types'
import { copyText } from '/@/utils/basic'
import ThinkingBlockVue from './thinking-block.vue'
import ToolCallBlockVue from './tool-call-block.vue'
import GeneratedImagePreviewModal from './generated-image-preview-modal.vue'
import CopyableImage from './copyable-image.vue'
import { formatElapsedDuration, getBlockKey, getStatusIconProps, useMessageItem } from '../../hooks/useMessageItem'
import { useSharedNow } from '../../hooks/useSharedNow'
import { useDialog } from '/@/hooks/useDialog'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { markedParse } from '/@/views/mcp/util'
import StatusMessage from './status-message.vue'
import HitlInterrupt from './hitl-interrupt.vue'
import Loading from './loading.vue'
import { useAgentApi } from '/@/views/mcp/agent-api'

const props = defineProps<{
  item: FormattedMessage
  handleHitlInterrupt: (decisions: HitlDecision[]) => Promise<void>
  isChatting: boolean
  isLast: boolean
}>()

const emit = defineEmits<{
  (e: 'useReference', image: GeneratedImageInfo): void
}>()

const taskExpandMap = reactive<{ [key: string]: boolean }>({})
const { toggleThinkingExpand, isThinkingExpanded } = useMessageItem()
const [showModal] = useDialog()
const [showToast, onlyErrorToast] = useResponseToast()
const agentApi = useAgentApi()
const copied = ref(false)
let copiedResetTimer: ReturnType<typeof window.setTimeout> | null = null

const hasActiveWorkerThinking = computed(() =>
  props.item.messageBlocks?.some(block =>
    block.type === 'worker' && block.workers?.some(worker => worker.type === 'thinking' && worker.isThinking),
  ) ?? false,
)

// 共享时间源：仅在本消息存在进行中的 worker 思考时参与全局 100ms 计时
const now = useSharedNow(() => hasActiveWorkerThinking.value)

const markdownContent = computed(() => buildMessageMarkdown(props.item))
const showCopyMarkdown = computed(() =>
  props.isLast && !props.isChatting && !props.item.isStreaming && Boolean(markdownContent.value),
)

onBeforeUnmount(() => {
  if (copiedResetTimer != null)
    window.clearTimeout(copiedResetTimer)
})

function toggleTaskExpand(id: string) {
  taskExpandMap[id] = !taskExpandMap[id]
}

function normalizeMarkdownText(text: string) {
  return text.trim().replace(/\n{3,}/g, '\n\n')
}

function escapeMarkdownAlt(text: string) {
  return text.replace(/[[\]]/g, '\\$&')
}

function buildImageMarkdown(images: GeneratedImageInfo[]) {
  return images
    .filter(image => !image.isPending && image.url)
    .map((image, index) => {
      const alt = escapeMarkdownAlt(image.fileName?.trim() || `generated-image-${index + 1}`)
      return `![${alt}](<${image.url}>)`
    })
    .join('\n\n')
}

function formatToolStatus(status: unknown) {
  if (status === 'success')
    return $t('成功')
  if (status === 'failed')
    return $t('失败')
  return $t('处理中...')
}

function stringifyToolArgs(args: unknown) {
  if (args == null)
    return '{}'

  try {
    return JSON.stringify(args, null, 2) || '{}'
  }
  catch {
    return String(args)
  }
}

function buildToolMarkdown(tool: { meta?: Record<string, unknown> }) {
  const toolName = typeof tool.meta?.toolName === 'string' && tool.meta.toolName
    ? tool.meta.toolName
    : 'unknown'
  const args = stringifyToolArgs(tool.meta?.args)
  const status = formatToolStatus(tool.meta?.status)

  return [
    `### ${$t('调用工具')} ${toolName}`,
    '',
    `- ${$t('状态')}: ${status}`,
    `- ${$t('参数')}:`,
    '```json',
    args,
    '```',
  ].join('\n')
}

function buildThinkingMarkdown(text: string) {
  return [
    `### ${$t('思考')}`,
    '',
    normalizeMarkdownText(text),
  ].join('\n')
}

function buildWorkerMarkdown(block: MessageEntryView) {
  const toolCalls = (block.workers ?? []).filter(worker => worker.type === 'tool_call')
  const successCount = toolCalls.filter(worker => worker.meta?.status === 'success').length
  const failedCount = toolCalls.filter(worker => worker.meta?.status === 'failed').length

  return [
    `### ${$t('执行任务')}：${block.meta?.title || block.id}`,
    '',
    `- ${$t('状态')}: ${formatToolStatus(block.status)}`,
    `- ${$t('成功工具数量')}: ${successCount}`,
    `- ${$t('失败工具数量')}: ${failedCount}`,
  ].join('\n')
}

function formatFileSize(bytes?: number) {
  const size = Number(bytes) || 0
  if (size < 1024)
    return `${size} B`
  if (size < 1024 * 1024)
    return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function getFileIconName(file: AgentFileItem) {
  const ext = file.fileName.split('.').pop()?.toLowerCase()
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'json', 'html', 'css', 'md', 'yaml', 'yml'].includes(ext || ''))
    return 'base/rx_ic_doc_code'
  if (file.mimeType?.includes('json') || file.mimeType?.startsWith('text/'))
    return 'base/rx_ic_doc_api'
  return 'base/rx_ic_doc_article'
}

function getAgentFileUrl(file: AgentFileItem) {
  return agentApi.getFileUrl(file.fileId, { download: true, fileName: file.fileName })
}

function serializeMessageEntry(block: MessageEntryView): string[] {
  if (block.type === 'thinking' && block.text?.trim())
    return [buildThinkingMarkdown(block.text)]

  if (block.type === 'content' && block.text?.trim())
    return [normalizeMarkdownText(block.text)]

  if (block.type === 'tool_call')
    return [buildToolMarkdown(block)]

  if (block.type === 'worker')
    return [buildWorkerMarkdown(block)]

  if (block.type === 'error' && block.text.trim?.())
    return [`> ${normalizeMarkdownText(block.text)}`]

  if (block.type === 'image' && Array.isArray(block.meta?.images)) {
    const imageMarkdown = buildImageMarkdown(block.meta.images as GeneratedImageInfo[])
    return imageMarkdown ? [imageMarkdown] : []
  }

  return []
}

function buildMessageMarkdown(item: FormattedMessage) {
  const blocks = item.messageBlocks ?? []
  return blocks
    .flatMap(block => serializeMessageEntry(block))
    .filter(Boolean)
    .join('\n\n')
    .trim()
}

async function copyMarkdown() {
  if (!markdownContent.value) {
    onlyErrorToast(-1, $t('复制失败，请重试'))
    return
  }

  try {
    await copyText(markdownContent.value)
    copied.value = true
    if (copiedResetTimer != null)
      window.clearTimeout(copiedResetTimer)
    copiedResetTimer = window.setTimeout(() => {
      copied.value = false
    }, 2000)
    showToast(0, $t('复制成功'))
  }
  catch (error) {
    console.error('Failed to copy markdown:', error)
    onlyErrorToast(-1, $t('复制失败，请重试'))
  }
}

function resolveImageExtension(image: GeneratedImageInfo) {
  const mimeType = image.mimeType?.split('/')[1]
  if (mimeType)
    return mimeType === 'jpeg' ? 'jpg' : mimeType

  if (image.url) {
    try {
      const { pathname } = new URL(image.url, window.location.href)
      const matched = pathname.match(/\.([a-z0-9]+)$/i)
      if (matched?.[1])
        return matched[1]
    }
    catch {
    }
  }

  return 'png'
}

function resolveImageFileName(image: GeneratedImageInfo) {
  if (image.fileName?.trim())
    return image.fileName

  return `generated-image-${image.fileId}.${resolveImageExtension(image)}`
}

async function downloadImage(image: GeneratedImageInfo) {
  if (!image.url) {
    onlyErrorToast(-1, 'Image download link is unavailable')
    return
  }

  try {
    const response = await fetch(image.url)

    if (!response.ok)
      throw new Error(`Failed to fetch image: ${response.status}`)

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = objectUrl
    link.download = resolveImageFileName(image)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(objectUrl)
  }
  catch (error) {
    console.error('Failed to download generated image:', error)
    onlyErrorToast(-1, 'Image download failed, please retry')
  }
}

function previewImage(image: GeneratedImageInfo) {
  if (!image.url) {
    onlyErrorToast(-1, 'Image preview is unavailable')
    return
  }

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    dismissableMask: true,
    pt: {
      root: '!bg-transparent !border-none !shadow-none',
    },
    slots: {
      container: ({ hideModal }) => h(GeneratedImagePreviewModal, {
        imageUrl: image.url,
        fileName: resolveImageFileName(image),
        onClose: hideModal,
        onDownload: () => downloadImage(image),
      }),
      footer: () => null,
    },
  })
}

/**
 * 获取 worker 任务的摘要文字
 */
function getTaskSummary(block: MessageEntryView): string {
  const activeThinking = block.workers?.find(worker => worker.type === 'thinking' && worker.isThinking)
  if (activeThinking)
    return $t('思考中... ({duration})', { duration: formatElapsedDuration(activeThinking.start, now.value) })

  const lastChunk = block.workers?.[block.workers.length - 1]

  if (block.status === 'success')
    return $t('成功')
  if (block.status === 'failed')
    return $t('失败')
  if (lastChunk?.type === 'tool_call')
    return $t(`正在执行: {name}`, { name: lastChunk.meta?.toolName })

  return $t('思考中...')
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div v-if="!item.messageBlocks?.length && isChatting && isLast" class="flex items-center gap-1">
      <span class="text-3 leading-[1.4] text-[var(--colors-text-text-primary)] font-600">{{ $t('规划中...') }}</span>
      <SvgIcon class="loading-circle" name="base/rx_ic_spin" size="14" color="var(--colors-icon-icon-tertiary)" />
    </div>

    <!-- Message Blocks (按顺序渲染 thinking, content, tool_call, worker, image) -->
    <template v-for="block in item.messageBlocks" v-else :key="getBlockKey(block)">
      <!-- Thinking -->
      <ThinkingBlockVue
        v-if="block.type === 'thinking' && block.text && block.text?.trim()"
        :thinking="block"
        :expanded="isThinkingExpanded(block.id)"
        @toggle="toggleThinkingExpand(block.id)"
      />

      <!-- 顶层 Tool Call（非 worker 子任务） -->
      <ToolCallBlockVue v-else-if="block.type === 'tool_call'" :tool="block" />

      <!-- Content 文本 -->
      <div v-else-if="block.type === 'content' && block.text && block.text?.trim()" class="text" :class="mode.content" v-html="markedParse(block.text)" />

      <!-- Worker 子任务 -->
      <div v-else-if="block.type === 'worker'" class="flex flex-col gap-1.5 px-3 py-1.5 rounded-2 worker" @click.stop="toggleTaskExpand(block.id)">
        <div class="flex items-center justify-between">
          <span class="select-none worker-title">{{ $t('执行任务') }} {{ block.meta?.title || block.id }}</span>
          <SvgIcon v-bind="getStatusIconProps(block.status)" />
        </div>
        <div v-if="!taskExpandMap[block.id]" class="ellipsis-1 worker-summary">
          {{ getTaskSummary(block) }}
        </div>
        <template v-else>
          <div v-if="block.workers?.length" class="flex flex-col gap-1">
            <template v-for="event in block.workers" :key="event.type + event.id">
              <ThinkingBlockVue
                v-if="event.type === 'thinking' && event.text && event.text?.trim()"
                class="worker-think"
                :thinking="event"
                :expanded="isThinkingExpanded(event.id)"
                @toggle="toggleThinkingExpand(event.id)"
              />
              <ToolCallBlockVue v-else-if="event.type === 'tool_call'" :tool="event" @click.stop />
              <div v-else-if="event.type === 'content' && event.text && event.text?.trim()" class="worker-desc" v-html="markedParse(event.text)" />
            </template>
          </div>
        </template>
      </div>

      <HitlInterrupt
        v-else-if="block.type === 'hitl_interrupt'"
        :review-configs="block.meta?.reviewConfigs"
        :action-requests="block.meta?.actionRequests"
        :decisions="block.meta?.decisions"
        :is-chatting="isChatting"
        @decide="(decisions) => handleHitlInterrupt(decisions)"
      />

      <!-- Error/Interrupt 状态 -->
      <StatusMessage
        v-else-if="block.type === 'error'"
        :data="block.text"
      />

      <!-- 脚本运行日志：字体颜色稍轻的日志行列表 -->
      <div
        v-else-if="block.type === 'script_log'"
        class="script-log-block"
      >
        <template v-for="(line, idx) in (block.meta?.lines as ScriptLogLine[])" :key="idx">
          <div
            class="script-log-line"
            :class="{
              'script-log-warn': line.level === 'warn',
              'script-log-error': line.level === 'error',
            }"
          >
            <span v-if="line.level && line.level !== 'info'" class="script-log-badge" :class="`script-log-badge--${line.level}`">{{ line.level }}</span>
            <span class="script-log-text">{{ line.text }}</span>
          </div>
        </template>
      </div>

      <!-- Agent 生成的文件卡片（write_file / edit_file / run_script）：可下载文件 -->
      <div
        v-else-if="block.type === 'agent_file' && block.meta?.files?.length"
        class="flex flex-col gap-2"
      >
        <div
          v-for="file in (block.meta.files as AgentFileItem[])"
          :key="file.fileId"
          class="flex items-center gap-3 px-3 py-2.5 rounded-2 border border-[var(--colors-border-border-inactive)] bg-[var(--colors-background-bg-block)] max-w-[360px]"
        >
          <div class="size-9 rounded-1.5 bg-[var(--colors-background-bg-page)] flex items-center justify-center shrink-0">
            <SvgIcon :name="getFileIconName(file)" size="22" color="var(--colors-icon-icon-brand)" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-3.5 font-600 text-[var(--colors-text-text-primary)] truncate m-0 leading-5">
              {{ file.fileName }}
            </p>
            <p class="text-3 text-[var(--colors-text-text-tertiary)] m-0 leading-4">
              {{ formatFileSize(file.size) }}
            </p>
          </div>
          <a
            v-tooltip.top="$t('下载')"
            :href="getAgentFileUrl(file)"
            :download="file.fileName"
            class="size-8 inline-flex items-center justify-center rounded-1.5 hover:bg-[var(--colors-background-bg-page)] cursor-pointer shrink-0"
          >
            <SvgIcon name="base/rx_ic_download" size="16" color="var(--colors-icon-icon-secondary)" />
          </a>
        </div>
      </div>

      <!-- 模型调用网络中断自动重试提示 -->
      <div v-else-if="block.type === 'retry'" class="flex items-center gap-1.5 retry-tip">
        <SvgIcon :class="{ 'loading-circle': block.meta?.retrying }" name="base/rx_ic_spin" size="14" color="var(--colors-icon-icon-tertiary)" />
        <span class="text-3 leading-[1.4] text-[var(--colors-text-text-tertiary)]">
          {{ $t('网络不稳定，重试中...') }} ({{ block.meta?.attempt }}/{{ block.meta?.maxAttempts }})
        </span>
      </div>

      <!-- 生成图片 -->
      <div v-else-if="block.type === 'image' && block.meta?.images?.length" class="flex gap-3 flex-wrap">
        <div
          v-for="(image, index) in (block.meta?.images as GeneratedImageInfo[])"
          :key="`${image.url}-${index}`"
          class="group flex flex-col overflow-hidden rounded-lg max-w-[140px] relative"
        >
          <!-- 生成中占位 -->
          <div v-if="image.isPending" class="relative bg-[var(--colors-background-bg-block)] size-140px rounded-2">
            <div class="size-12 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <Loading />
            </div>
          </div>

          <template v-else>
            <div class="block p-0 border-none cursor-zoom-in" type="button" @click="previewImage(image)">
              <CopyableImage :src="image.url" :alt="resolveImageFileName(image)" class="block w-full aspect-square object-cover" />

              <div class="flex gap-1.5 absolute bottom-2 right-2">
                <div
                  v-tooltip.top="$t('编辑')"
                  class="size-5 rounded-1 bg-black/30 p-1 flex items-center justify-center cursor-pointer"
                  @click.stop="emit('useReference', image)"
                >
                  <SvgIcon name="base/rx_ic_edit" size="16" color="#FFF" />
                </div>
                <div
                  v-tooltip.top="$t('下载')"
                  class="size-5 rounded-1 bg-black/30 p-1 flex items-center justify-center cursor-pointer"
                  @click.stop="downloadImage(image)"
                >
                  <SvgIcon name="base/rx_ic_download" size="16" color="#FFF" />
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>

    <div v-if="showCopyMarkdown" class="flex">
      <div class="px-1.5 py-1 flex gap-1 items-center rounded-1 bg-[var(--component-button-pale-bg)] cursor-pointer" @click="copyMarkdown">
        <SvgIcon :name="copied ? 'base/rx_ic_check' : 'base/rx_ic_copy'" color="var(--component-button-pale-icon)" />
        <p class="my-0 text-3 font-500 text-[var(--component-button-pale-text)]">
          {{ copied ? $t('已复制') : $t('复制内容') }}
        </p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" module="mode">
.content {
  h1 {
    margin: 14px 0;
    font-size: 16px;
  }

  h2 {
    margin: 14px 0;
    font-size: 15px;
  }

  h3,
  h4,
  h5,
  h6 {
    margin: 14px 0;
    font-size: 14px;
  }

  code {
    font-size: 12px;
    font-family: JetBrains Mono;
    color: var(--colors-text-text-tertiary);
    text-wrap: auto;
  }
}
</style>

<style lang="scss" scoped>
.worker {
  border: 1px solid var(--colors-border-border-action);
  background: var(--colors-background-bg-action);
  cursor: pointer;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--colors-border-border-action-hover);
  }

  &-title {
    color: var(--colors-text-text-primary);
    font-size: 14px;
    font-weight: 700;
    line-height: 20px;
  }

  &-summary {
    color: var(--colors-text-text-tertiary);
    font-size: 12px;
    line-height: 18px;
  }

  &-desc {
    color: var(--colors-text-text-secondary);
    font-size: 12px;
    line-height: 18px;
  }

  &-think {
    padding: 4px 0;
  }

  :deep(.tool-loading) {
    color: var(--colors-icon-icon-tertiary);
  }

  :deep(.tool-success) {
    color: var(--colors-icon-icon-success);
  }

  :deep(.tool-failed) {
    color: var(--colors-icon-icon-error);
  }
}

.text {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: 1.4;
  display: flex;
  flex-direction: column;
  gap: 12px;

  :deep(p) {
    margin: 0;
  }

  :deep(h1) {
    margin: 0;
  }

  :deep(h2) {
    margin: 0;
  }

  :deep(h3) {
    margin: 0;
  }

  :deep(h4) {
    margin: 0;
  }

  :deep(h5) {
    margin: 0;
  }

  :deep(h6) {
    margin: 0;
  }

  :deep(ul) {
    margin: 0;
  }

  :deep(ol) {
    margin: 0;
  }

  :deep(table) {
    width: 100%;
    border-collapse: collapse; /* 合并相邻边框，这是最常用的设置 */
    margin-bottom: 20px;
    border: 1px solid var(--colors-border-border-inactive); /* 线条粗细、样式（实线）、颜色 */
  }

  :deep(td) {
    border: 1px solid var(--colors-border-border-inactive); /* 线条粗细、样式（实线）、颜色 */
    padding: 8px; /* 顺便加点内边距，让文字不挤在一起 */
  }

  :deep(th) {
    border: 1px solid var(--colors-border-border-inactive); /* 线条粗细、样式（实线）、颜色 */
    padding: 8px; /* 顺便加点内边距，让文字不挤在一起 */
  }

  :deep(hr) {
    display: none;
  }
}

.planning {
  color: var(--colors-text-text-secondary);
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
}

/* 脚本运行日志：字体颜色稍轻，与正文区分 */
.script-log-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--colors-background-bg-block);
}

.script-log-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
  /* 字体颜色稍轻 */
  color: var(--colors-text-text-tertiary);
  font-size: 12px;
  line-height: 18px;
  font-family: 'JetBrains Mono', monospace;
  word-break: break-word;
}

.script-log-warn {
  color: var(--colors-text-text-warning, #b8860b);
}

.script-log-error {
  color: var(--colors-text-text-error, var(--colors-icon-icon-error));
}

.script-log-badge {
  flex-shrink: 0;
  padding: 0 4px;
  border-radius: 3px;
  font-size: 10px;
  line-height: 14px;
  text-transform: uppercase;
  color: var(--colors-text-text-inactive);
  background: var(--colors-background-bg-action);
}

.script-log-badge--warn {
  color: var(--colors-text-text-warning, #b8860b);
}

.script-log-badge--error {
  color: var(--colors-icon-icon-error);
}

.script-log-text {
  white-space: pre-wrap;
}
</style>
