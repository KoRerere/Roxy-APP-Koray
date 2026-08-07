<script setup lang="ts">
import type { AgentAttachment, AgentFolderSelection, AgentHitlRequest, AgentHitlSubmitPayload, AgentMessage, AgentPathSelection, AgentTodoProgress } from '../types'
import ChatWorkspace from '../components/ChatWorkspace.vue'

defineProps<{
  activeConversationId?: string
  composerFocusKey?: number
  conversationTitle?: string
  hitlRequest?: AgentHitlRequest
  messages: AgentMessage[]
  pendingAttachments: AgentAttachment[]
  routeTitle?: string | symbol
  thinking: boolean
  todoProgress?: AgentTodoProgress
}>()

const emit = defineEmits<{
  addAttachments: [files: File[]]
  addFolder: [folder: AgentFolderSelection]
  addPathAttachment: [selection: AgentPathSelection]
  removeAttachment: [fileId: string]
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
      :messages="messages"
      :pending-attachments="pendingAttachments"
      :thinking="thinking"
      :todo-progress="todoProgress"
      @add-attachments="emit('addAttachments', $event)"
      @add-folder="emit('addFolder', $event)"
      @add-path-attachment="emit('addPathAttachment', $event)"
      @remove-attachment="emit('removeAttachment', $event)"
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
