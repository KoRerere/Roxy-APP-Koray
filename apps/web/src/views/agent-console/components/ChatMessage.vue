<script setup lang="ts">
import type { AgentConversationProcess, AgentMessage, AgentProcessEvent } from '../types'
import { useAgentStore } from '/@/stores/agent'
import AgentCopyControl from './AgentCopyControl.vue'
import AgentProcessTimeline from './AgentProcessTimeline.vue'
import AgentStatusMessage from './AgentStatusMessage.vue'
import MarkdownContent from './MarkdownContent.vue'

const props = defineProps<{
  message: AgentMessage
}>()

const emit = defineEmits<{
  copy: [text: string]
}>()

const agentStore = useAgentStore()
const copyContent = computed(() => getCopyContent())

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

    if (event.type === 'worker_task') {
      const content = getFinalAnswerFromEvents(event.events)
      if (content)
        return content
    }

    if (event.type === 'parallel_dispatch') {
      for (let taskIndex = event.tasks.length - 1; taskIndex >= 0; taskIndex--) {
        const content = getFinalAnswerFromEvents(event.tasks[taskIndex].events)
        if (content)
          return content
      }
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

function shouldShowActions() {
  return Boolean(props.message.createdAt) && !isAssistantRunning()
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

function getAttachmentPreview(attachment: NonNullable<AgentMessage['attachments']>[number]) {
  return resolveAttachmentUrl(attachment.preview)
    || resolveAttachmentUrl(attachment.url)
    || resolveAttachmentUrl(attachment.localUrl)
    || resolveAttachmentUrl(attachment.fileUrl)
    || resolveAttachmentUrl(attachment.remoteUrl)
}

function isImageFileName(fileName: string) {
  return /\.(?:png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(fileName)
}

function isImageAttachment(attachment: NonNullable<AgentMessage['attachments']>[number]) {
  return attachment.kind === 'file'
    && (attachment.mimeType.startsWith('image/') || isImageFileName(attachment.fileName))
    && Boolean(getAttachmentPreview(attachment))
}

function getFileExtension(fileName: string) {
  const ext = fileName.split('.').pop()
  return ext && ext !== fileName ? ext.toUpperCase() : $t('文件')
}

function getAttachmentTypeLabel(attachment: NonNullable<AgentMessage['attachments']>[number]) {
  return attachment.kind === 'folder' ? 'Folder' : getFileExtension(attachment.fileName)
}
</script>

<template>
  <article class="chat-message" :class="message.role">
    <div class="message-body">
      <!-- <div v-if="message.role === 'assistant'" class="assistant-heading">
        <span class="assistant-logo-mark" aria-hidden="true">
          <SvgIcon name="roxy-agent/rx-ic-logo" size="32" />
        </span>
        <div class="assistant-title">
          {{ message.author }}
        </div>
      </div> -->

      <AgentProcessTimeline
        v-if="message.role === 'assistant' && message.process"
        :process="message.process"
        :message-status="message.status"
      />

      <AgentStatusMessage
        v-if="shouldShowErrorStatus()"
        :data="message.errorData"
      />

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

      <div v-if="message.role === 'user' && message.attachments?.length" class="message-attachments">
        <article v-for="attachment in message.attachments" :key="attachment.fileId" class="message-attachment">
          <div class="message-attachment__preview">
            <img v-if="isImageAttachment(attachment)" :src="getAttachmentPreview(attachment)" :alt="attachment.fileName">
            <SvgIcon v-else-if="attachment.kind === 'folder'" name="base/rx_ic_folder" size="20" color="var(--color-text-disabled)" />
            <SvgIcon v-else name="base/rx_ic_doc_article" size="20" color="var(--color-text-disabled)" />
          </div>
          <div class="message-attachment__meta">
            <span class="message-attachment__name">{{ attachment.fileName }}</span>
            <span class="message-attachment__type">{{ getAttachmentTypeLabel(attachment) }}</span>
          </div>
        </article>
      </div>

      <div v-if="shouldShowActions()" class="message-actions">
        <span>{{ message.createdAt }}</span>
        <AgentCopyControl v-if="shouldShowCopyButton()" :text="copyContent" />
      </div>
    </div>
  </article>
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

.assistant-heading {
  display: flex;
  align-items: center;
  gap: 5px;
}

.assistant-logo-mark {
  display: grid;
  position: relative;
  width: 32px;
  height: 32px;
  place-items: center;
  flex: 0 0 32px;
  border-radius: 999px;
  background: var(--agent-gradient);
  overflow: hidden;

  :deep(.svg) {
    position: relative;
    z-index: 1;
    display: block;
    width: 32px;
    height: 32px;
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

.assistant-title {
  color: var(--color-text-primary);
  font-family: Archivo, Inter, sans-serif;
  font-size: 18px;
  font-weight: 600;
  line-height: 28px;
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

.message-attachment {
  display: flex;
  width: 160px;
  max-width: 100%;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 8px;
  background: var(--color-bg-primary);
  box-sizing: border-box;
}

.message-attachment__preview {
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  place-items: center;
  overflow: hidden;
  border-radius: 4px;
  background: var(--color-bg-tertiary);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.message-attachment__meta {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  font-size: 13px;
  line-height: 18px;
}

.message-attachment__name,
.message-attachment__type {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-attachment__name {
  color: var(--color-text-primary);
  font-weight: 500;
}

.message-attachment__type {
  color: var(--color-text-disabled);
}
</style>
