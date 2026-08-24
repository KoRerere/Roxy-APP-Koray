<script setup lang="ts">
import type { AgentAttachment, AgentFolderSelection, AgentHitlRequest, AgentHitlSubmitPayload, AgentMessage, AgentPathSelection, AgentQueuedPrompt, AgentTodoProgress } from '../types'
import ChatWorkspace from '../components/ChatWorkspace.vue'

defineProps<{
  activeConversationId?: string
  composerFocusKey?: number
  conversationTitle?: string
  hitlRequest?: AgentHitlRequest
  hasEarlierMessages: boolean
  loadingEarlierMessages: boolean
  messages: AgentMessage[]
  pendingAttachments: AgentAttachment[]
  queuedPrompts: AgentQueuedPrompt[]
  routeTitle?: string | symbol
  thinking: boolean
  todoProgress?: AgentTodoProgress
}>()

const emit = defineEmits<{
  addAttachments: [files: File[]]
  addFolder: [folder: AgentFolderSelection]
  addPathAttachment: [selection: AgentPathSelection]
  loadEarlierMessages: []
  removeAttachment: [fileId: string]
  removeQueuedPrompt: [promptId: string]
  reorderQueuedPrompt: [payload: { promptId: string, targetIndex: number }]
  restoreQueuedPrompt: [promptId: string]
  send: []
  stop: []
  submitHitl: [payload: AgentHitlSubmitPayload]
}>()

const prompt = defineModel<string>('prompt', { required: true })
</script>

<template>
  <div class="agent-chat-route">
    <ChatWorkspace
      v-model:prompt="prompt"
      :active-conversation-id="activeConversationId"
      :composer-focus-key="composerFocusKey"
      :conversation-title="conversationTitle"
      :hitl-request="hitlRequest"
      :has-earlier-messages="hasEarlierMessages"
      :loading-earlier-messages="loadingEarlierMessages"
      :messages="messages"
      :pending-attachments="pendingAttachments"
      :queued-prompts="queuedPrompts"
      :thinking="thinking"
      :todo-progress="todoProgress"
      @add-attachments="emit('addAttachments', $event)"
      @add-folder="emit('addFolder', $event)"
      @add-path-attachment="emit('addPathAttachment', $event)"
      @load-earlier-messages="emit('loadEarlierMessages')"
      @remove-attachment="emit('removeAttachment', $event)"
      @remove-queued-prompt="emit('removeQueuedPrompt', $event)"
      @reorder-queued-prompt="emit('reorderQueuedPrompt', $event)"
      @restore-queued-prompt="emit('restoreQueuedPrompt', $event)"
      @send="emit('send')"
      @stop="emit('stop')"
      @submit-hitl="emit('submitHitl', $event)"
    />
  </div>
</template>

<style lang="scss" scoped>
.agent-chat-route {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}
</style>
