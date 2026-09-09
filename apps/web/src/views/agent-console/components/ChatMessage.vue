<script setup lang="ts">
import type { AgentConversationProcess, AgentMessage, AgentProcessEvent, AgentTaskReportSaveRequest } from '../types'
import { useAgentStore } from '/@/stores/agent'
import AgentCopyControl from './AgentCopyControl.vue'
import AgentFileCard from './AgentFileCard.vue'
import AgentProcessTimeline from './AgentProcessTimeline.vue'
import AgentStatusMessage from './AgentStatusMessage.vue'
import MarkdownContent from './MarkdownContent.vue'

type MessageAttachment = NonNullable<AgentMessage['attachments']>[number]

const props = defineProps<{
  message: AgentMessage
}>()

const emit = defineEmits<{
  copy: [text: string]
  saveTemplate: [payload: AgentTaskReportSaveRequest]
}>()

const agentStore = useAgentStore()
const copyContent = computed(() => getCopyContent())
const previewAttachment = ref<MessageAttachment | null>(null)
const previewDialogRef = ref<HTMLElement | null>(null)
const previewScale = ref(1)
const previewUrl = computed(() => previewAttachment.value ? getAttachmentPreview(previewAttachment.value) : '')
const previewDownloadUrl = computed(() => previewAttachment.value ? getAttachmentDownloadUrl(previewAttachment.value) : '')
const previewZoomLabel = computed(() => `${Math.round(previewScale.value * 100)}%`)

function getCopyContent() {
  if (props.message.role === 'user')
    return props.message.content

  return getFinalAnswerFromProcess(props.message.process) || props.message.content
}

function getFinalAnswerFromProcess(process?: AgentConversationProcess) {
  return process ? getFinalAnswerFromEvents(process.events) : ''
}

function getFinalAnswerFromEvents(events: AgentProcessEvent[]): string {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]

    if (event.type === 'final_answer' && event.content.trim())
      return event.content

    if (event.type === 'agent_lifecycle') {
      const content = getFinalAnswerFromEvents(event.events) || getFinalAnswerFromEvents(event.children)
      if (content)
        return content
    }
  }

  return ''
}

function hasFinalAnswer(process?: AgentConversationProcess) {
  const completed = process?.completed === true || (process?.completed === undefined && process?.collapsed === true)
  return completed && Boolean(getFinalAnswerFromProcess(process))
}

function isAssistantRunning() {
  return props.message.role === 'assistant' && (props.message.status === 'thinking' || props.message.status === 'streaming')
}

function shouldRenderMessage() {
  if (props.message.role === 'assistant') {
    return Boolean(props.message.process || props.message.content.trim() || props.message.errorData)
  }

  return Boolean(props.message.content.trim() || props.message.attachments?.length)
}

function shouldShowActions() {
  return shouldRenderMessage() && Boolean(props.message.createdAt) && !isAssistantRunning()
}

function shouldShowCopyButton() {
  return Boolean(copyContent.value)
}

function shouldShowErrorStatus() {
  return props.message.role === 'assistant' && props.message.status === 'error' && Boolean(props.message.errorData)
}

function handleUserBubbleContextMenu(event: MouseEvent) {
  if (props.message.role !== 'user' || !copyContent.value)
    return

  const target = event.target
  if (target instanceof HTMLElement && target.closest('a,button,input,textarea,select'))
    return

  const selection = window.getSelection()
  if (selection && !selection.isCollapsed && selection.toString().trim())
    return

  emit('copy', copyContent.value)
}

function resolveAttachmentUrl(url?: string) {
  if (!url)
    return ''

  if (/^(?:https?:|data:|blob:)/i.test(url))
    return url

  if (url.startsWith('/api/files/') && agentStore.serverUrl)
    return `${agentStore.serverUrl}${url}`

  return url
}

function getAttachmentPreview(attachment: MessageAttachment) {
  return resolveAttachmentUrl(attachment.preview)
    || resolveAttachmentUrl(attachment.url)
    || resolveAttachmentUrl(attachment.localUrl)
    || resolveAttachmentUrl(attachment.fileUrl)
    || resolveAttachmentUrl(attachment.remoteUrl)
}

function getAttachmentDownloadUrl(attachment: MessageAttachment) {
  if (!agentStore.serverUrl || !attachment.fileId) {
    return getAttachmentPreview(attachment)
  }

  const params = new URLSearchParams({
    download: '1',
    filename: attachment.fileName,
  })
  return `${agentStore.serverUrl}/api/files/${encodeURIComponent(attachment.fileId)}?${params}`
}

function isImageFileName(fileName: string) {
  return /\.(?:png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(fileName)
}

function isImageAttachment(attachment: MessageAttachment) {
  return attachment.kind === 'file'
    && (attachment.mimeType.startsWith('image/') || isImageFileName(attachment.fileName))
    && Boolean(getAttachmentPreview(attachment))
}

function openImagePreview(attachment: MessageAttachment) {
  if (!isImageAttachment(attachment)) {
    return
  }

  previewAttachment.value = attachment
  previewScale.value = 1
  nextTick(() => previewDialogRef.value?.focus())
}

function closeImagePreview() {
  previewAttachment.value = null
  previewScale.value = 1
}

function updatePreviewScale(delta: number) {
  previewScale.value = Math.min(3, Math.max(0.5, Number((previewScale.value + delta).toFixed(2))))
}

function resetPreviewScale() {
  previewScale.value = 1
}

function handlePreviewWheel(event: WheelEvent) {
  updatePreviewScale(event.deltaY < 0 ? 0.1 : -0.1)
}

function handlePreviewKeydown(event: KeyboardEvent) {
  if (!previewAttachment.value) {
    return
  }

  if (event.key === 'Escape') {
    closeImagePreview()
    return
  }

  if (event.key === '+' || event.key === '=') {
    updatePreviewScale(0.25)
  }
  else if (event.key === '-') {
    updatePreviewScale(-0.25)
  }
  else if (event.key === '0') {
    resetPreviewScale()
  }
}

onMounted(() => document.addEventListener('keydown', handlePreviewKeydown))
onUnmounted(() => document.removeEventListener('keydown', handlePreviewKeydown))
</script>

<template>
  <article v-if="shouldRenderMessage()" class="chat-message" :class="message.role">
    <div class="message-body">
      <AgentProcessTimeline
        v-if="message.role === 'assistant' && message.process"
        :conversation-id="message.conversationId"
        :has-message-content="Boolean(message.content.trim())"
        :process="message.process"
        :message-status="message.status"
        @save-template="emit('saveTemplate', $event)"
      />

      <AgentStatusMessage
        v-if="shouldShowErrorStatus()"
        :data="message.errorData"
      />

      <div v-if="message.role === 'user' && message.attachments?.length" class="message-attachments">
        <AgentFileCard
          v-for="attachment in message.attachments"
          :key="attachment.fileId"
          :attachment="attachment"
          :preview-url="getAttachmentPreview(attachment)"
          :previewable="isImageAttachment(attachment)"
          size="message"
          @preview="openImagePreview(attachment)"
        />
      </div>

      <div
        v-if="message.content && !(message.role === 'assistant' && (message.status === 'thinking' || shouldShowErrorStatus() || hasFinalAnswer(message.process)))"
        class="message-bubble"
        :class="{ thinking: message.status === 'thinking' }"
        @contextmenu.prevent="handleUserBubbleContextMenu"
      >
        <MarkdownContent
          :content="message.content"
          :preserve-line-breaks="message.role === 'user'"
        />
      </div>

      <div v-if="shouldShowActions()" class="message-actions">
        <span>{{ message.createdAt }}</span>
        <AgentCopyControl v-if="shouldShowCopyButton()" :text="copyContent" />
      </div>
    </div>
  </article>

  <Teleport to="body">
    <div
      v-if="previewAttachment"
      ref="previewDialogRef"
      class="attachment-image-preview"
      role="dialog"
      aria-modal="true"
      :aria-label="previewAttachment.fileName"
      tabindex="-1"
      @click="closeImagePreview"
      @wheel.prevent="handlePreviewWheel"
    >
      <div class="attachment-image-preview__actions" @click.stop>
        <a :href="previewDownloadUrl" :download="previewAttachment.fileName" :aria-label="$t('下载')">
          <SvgIcon name="base/rx_ic_download" size="20" color="currentColor" />
        </a>
        <button type="button" :aria-label="$t('关闭')" @click="closeImagePreview">
          <SvgIcon name="roxy-agent/rx-ic-close" size="20" color="currentColor" />
        </button>
      </div>

      <div class="attachment-image-preview__stage">
        <img
          :src="previewUrl"
          :alt="previewAttachment.fileName"
          :style="{ transform: `scale(${previewScale})` }"
          @click.stop
          @dblclick.stop="resetPreviewScale"
        >
      </div>

      <div class="attachment-image-preview__zoom" @click.stop>
        <button type="button" aria-label="-" :disabled="previewScale <= 0.5" @click="updatePreviewScale(-0.25)">
          <SvgIcon name="base/rx_ic_minus" size="18" color="currentColor" />
        </button>
        <button type="button" :aria-label="$t('重置')" class="attachment-image-preview__zoom-label" @click="resetPreviewScale">
          {{ previewZoomLabel }}
        </button>
        <button type="button" aria-label="+" :disabled="previewScale >= 3" @click="updatePreviewScale(0.25)">
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
.chat-message {
  display: flex;
  width: 100%;

  &.user {
    justify-content: flex-end;

    .message-body {
      align-items: flex-end;
    }

    .message-bubble {
      max-width: 564px;
      color: #18181b;
      background: var(--color-bg-tertiary);
      cursor: pointer;
    }
  }

  &.assistant {
    justify-content: flex-start;

    .message-body {
      max-width: 100%;
      gap: 18px;
    }

    .message-bubble {
      padding: 0;
      background: transparent;
      font-size: 16px;
      font-weight: 500;
      line-height: 24px;
    }
  }
}

.message-body {
  display: flex;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  flex-direction: column;
  gap: 12px;
}

.message-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-tertiary);
  font-size: 14px;
  line-height: 20px;
}

.user .message-actions {
  justify-content: flex-end;
}

.message-bubble {
  width: fit-content;
  max-width: 100%;
  padding: 12px;
  border-radius: 8px;
  color: #27272a;
  background: #fff;
  font-size: 14px;
  line-height: 20px;
  overflow-wrap: anywhere;

  &.thinking {
    color: #c11574;
    font-weight: 600;
  }
}

.message-attachments {
  display: flex;
  max-width: min(100%, 520px);
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.attachment-image-preview {
  position: fixed;
  z-index: 2200;
  inset: 0;
  display: grid;
  overflow: hidden;
  padding: 72px 48px 88px;
  background: rgb(9 9 11 / 82%);
  backdrop-filter: blur(2px);
  box-sizing: border-box;
  place-items: center;
}

.attachment-image-preview__stage {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  align-items: center;
  justify-content: center;

  img {
    display: block;
    max-width: 100%;
    max-height: 100%;
    border-radius: 8px;
    box-shadow: 0 24px 64px rgb(0 0 0 / 35%);
    object-fit: contain;
    transition: transform 0.18s ease;
    user-select: none;
  }
}

.attachment-image-preview__actions {
  position: absolute;
  z-index: 1;
  top: 16px;
  right: 16px;
  display: flex;
  gap: 10px;

  button,
  a {
    display: grid;
    width: 42px;
    height: 42px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    color: #18181b;
    background: rgb(255 255 255 / 94%);
    box-shadow: 0 4px 16px rgb(0 0 0 / 16%);
    cursor: pointer;
    place-items: center;

    &:hover,
    &:focus-visible {
      background: #fff;
      outline: 2px solid rgb(255 255 255 / 50%);
      outline-offset: 2px;
    }
  }
}

.attachment-image-preview__zoom {
  position: absolute;
  z-index: 1;
  bottom: 18px;
  left: 50%;
  display: flex;
  height: 44px;
  align-items: center;
  padding: 4px;
  border-radius: 24px;
  background: rgb(255 255 255 / 94%);
  box-shadow: 0 6px 24px rgb(0 0 0 / 22%);
  transform: translateX(-50%);

  button {
    display: grid;
    min-width: 36px;
    height: 36px;
    padding: 0;
    border: 0;
    border-radius: 18px;
    color: #18181b;
    background: transparent;
    cursor: pointer;
    font-size: 24px;
    line-height: 1;
    place-items: center;

    &:hover:not(:disabled),
    &:focus-visible {
      background: #f4f4f5;
      outline: none;
    }

    &:disabled {
      color: #a1a1aa;
      cursor: not-allowed;
    }
  }
}

.attachment-image-preview__zoom .attachment-image-preview__zoom-label {
  min-width: 64px;
  padding: 0 8px;
  font-size: 13px;
  font-weight: 500;
}

@media (max-width: 640px) {
  .attachment-image-preview {
    padding: 64px 16px 80px;
  }

  .message-attachment {
    width: 176px;
  }
}
</style>
