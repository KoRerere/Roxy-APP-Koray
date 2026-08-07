<script setup lang="ts">
import type { AgentConversation } from '../types'
import AgentPopover from './AgentPopover.vue'

const props = defineProps<{
  activeConversationId?: string
  conversations: AgentConversation[]
  loadingMore?: boolean
  pendingApprovalConversationIds: string[]
}>()

const emit = defineEmits<{
  delete: [id: string]
  rename: [id: string]
  select: [id: string]
}>()

type ConversationTaskState = 'idle' | 'running' | 'ended'

interface ConversationMetaState {
  actionOpen: boolean
  hovered: boolean
  isAwaitingApproval: boolean
  isActive: boolean
  showAction: boolean
  showEndedHint: boolean
  showRunning: boolean
  taskState: ConversationTaskState
  title: string
}

const deleteMenuConversationId = ref('')
const focusedActionConversationId = ref('')
const hoveredConversationId = ref('')

function onSelect(event: MouseEvent, conversation: AgentConversation) {
  event.preventDefault()
  closeDeleteMenu()
  emit('select', conversation.id)
}

function closeDeleteMenu() {
  deleteMenuConversationId.value = ''
}

function onDeleteMenuOpenChange(open: boolean, id: string) {
  deleteMenuConversationId.value = open ? id : ''
}

function onDelete(event: MouseEvent, id: string) {
  event.preventDefault()
  event.stopPropagation()
  closeDeleteMenu()
  emit('delete', id)
}

function onRename(event: MouseEvent, id: string) {
  event.preventDefault()
  event.stopPropagation()
  closeDeleteMenu()
  emit('rename', id)
}

function onConversationEnter(id: string) {
  hoveredConversationId.value = id
}

function onConversationLeave(id: string) {
  if (hoveredConversationId.value === id)
    hoveredConversationId.value = ''
}

function onActionFocus(id: string) {
  focusedActionConversationId.value = id
}

function onActionBlur(id: string) {
  if (focusedActionConversationId.value === id)
    focusedActionConversationId.value = ''
}

function getConversationTaskState(conversation: AgentConversation): ConversationTaskState {
  if (conversation.runningRunIds.length > 0 || conversation.latestRunStatus === 'queued' || conversation.latestRunStatus === 'streaming')
    return 'running'

  if (conversation.latestRunStatus === 'completed' || conversation.latestRunStatus === 'failed' || conversation.latestRunStatus === 'cancelled')
    return 'ended'

  return 'idle'
}

function isActiveConversation(conversation: AgentConversation) {
  return conversation.id === props.activeConversationId
}

function isActionOpen(conversation: AgentConversation) {
  return deleteMenuConversationId.value === conversation.id
}

function isActionVisible(conversation: AgentConversation) {
  return hoveredConversationId.value === conversation.id
    || focusedActionConversationId.value === conversation.id
    || isActionOpen(conversation)
}

function getConversationMetaState(conversation: AgentConversation): ConversationMetaState {
  const state = getConversationTaskState(conversation)
  const active = isActiveConversation(conversation)
  const actionOpen = isActionOpen(conversation)
  const actionVisible = isActionVisible(conversation)
  const showRunning = state === 'running'
  const showUnreadEndedHint = state === 'ended'
    && conversation.unread
    && !active
    && !actionVisible

  return {
    actionOpen,
    isAwaitingApproval: props.pendingApprovalConversationIds.includes(conversation.id),
    hovered: hoveredConversationId.value === conversation.id,
    isActive: active,
    showAction: !showRunning && actionVisible,
    showEndedHint: showUnreadEndedHint,
    showRunning,
    taskState: state,
    title: showRunning ? $t('对话中') : showUnreadEndedHint ? $t('对话结束') : $t('删除'),
  }
}

function getConversationItemClasses(conversation: AgentConversation) {
  const metaState = getConversationMetaState(conversation)

  return [
    { active: metaState.isActive },
    `conversation-item--${metaState.taskState}`,
    {
      'conversation-item--action-visible': metaState.showAction,
      'delete-menu-open': metaState.actionOpen,
    },
  ]
}
</script>

<template>
  <section class="conversation-section">
    <div class="section-title">
      {{ $t('对话') }}
    </div>
    <div class="conversation-list">
      <RouterLink
        v-for="conversation in conversations"
        :key="conversation.id"
        v-slot="{ href }"
        custom
        :to="{ name: 'agent-console-conversation', params: { conversationId: conversation.id } }"
      >
        <a
          :href="href"
          class="conversation-item"
          :class="getConversationItemClasses(conversation)"
          @mouseenter="onConversationEnter(conversation.id)"
          @mouseleave="onConversationLeave(conversation.id)"
          @click="onSelect($event, conversation)"
        >
          <span class="conversation-content">
            <span class="conversation-title">{{ conversation.title }}</span>
            <span
              v-if="getConversationMetaState(conversation).isAwaitingApproval"
              class="conversation-approval-badge"
              role="status"
            >
              {{ $t('等待批准') }}
            </span>
          </span>
          <span class="conversation-meta" :aria-label="getConversationMetaState(conversation).title">
            <span
              v-if="getConversationMetaState(conversation).showRunning"
              class="conversation-status conversation-status--running"
              :title="$t('对话中')"
              role="status"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.5 6C10.5 3.51472 8.48528 1.5 6 1.5C3.51472 1.5 1.5 3.51472 1.5 6C1.5 8.48528 3.51472 10.5 6 10.5C8.48528 10.5 10.5 8.48528 10.5 6ZM11.5 6C11.5 9.03757 9.03757 11.5 6 11.5C2.96243 11.5 0.5 9.03757 0.5 6C0.5 2.96243 2.96243 0.5 6 0.5C9.03757 0.5 11.5 2.96243 11.5 6Z" fill="var(--color-bg-quaternary)" />
                <path d="M0.498047 6C0.498047 2.96243 2.96048 0.500003 5.99805 0.5C6.27419 0.5 6.49805 0.723858 6.49805 1C6.49805 1.27614 6.27419 1.5 5.99805 1.5C3.51277 1.5 1.49805 3.51472 1.49805 6C1.49805 8.48526 3.51277 10.5 5.99805 10.5C8.4833 10.5 10.498 8.48526 10.498 6C10.498 5.72386 10.7219 5.5 10.998 5.5C11.2742 5.5 11.498 5.72386 11.498 6C11.498 9.03754 9.03559 11.5 5.99805 11.5C2.96048 11.5 0.498047 9.03754 0.498047 6Z" fill="var(--color-bg-primary-inverse)" />
              </svg>
            </span>

            <AgentPopover
              v-if="getConversationMetaState(conversation).showAction"
              :open="getConversationMetaState(conversation).actionOpen"
              trigger-class="conversation-delete"
              content-class="conversation-action-menu"
              placement="top-end"
              :offset="8"
              role="button"
              tabindex="0"
              :title="$t('删除')"
              :aria-label="$t('删除')"
              :aria-expanded="getConversationMetaState(conversation).actionOpen"
              @update:open="onDeleteMenuOpenChange($event, conversation.id)"
              @focus="onActionFocus(conversation.id)"
              @blur="onActionBlur(conversation.id)"
            >
              <SvgIcon name="base/rx_ic_more-h" size="12" />
              <template #content="{ close }">
                <button
                  type="button"
                  class="conversation-action-menu__action"
                  @click.stop="close(); onRename($event, conversation.id)"
                >
                  <SvgIcon name="base/rx_ic_agent_edit" size="16" aria-hidden="true" />
                  <span>{{ $t('重命名对话') }}</span>
                </button>
                <button
                  type="button"
                  class="conversation-action-menu__action conversation-action-menu__action--danger"
                  @click.stop="close(); onDelete($event, conversation.id)"
                >
                  <SvgIcon name="base/rx_ic_bin_1" size="16" aria-hidden="true" />
                  <span>{{ $t('删除') }}</span>
                </button>
              </template>
            </AgentPopover>
            <span
              v-if="getConversationMetaState(conversation).showEndedHint"
              class="conversation-status conversation-status--ended"
              :title="$t('对话结束')"
              aria-hidden="true"
            />
          </span>
        </a>
      </RouterLink>
      <div v-if="loadingMore" class="conversation-loading-more" role="status">
        {{ $t('加载中...') }}
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.conversation-section {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 6px;
}

.section-title {
  padding: 0 8px;
  color: var(--color-text-quaternary);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
}

.conversation-list {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 1px;
}

.conversation-loading-more {
  padding: 8px;
  color: var(--color-text-quaternary);
  font-size: 12px;
  line-height: 16px;
  text-align: center;
}

.conversation-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 36px;
  padding: 8px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
  text-align: left;
  text-decoration: none;

  &:hover,
  &.active,
  &.delete-menu-open {
    background: var(--color-bg-tertiary-hover);
  }
}

.conversation-content {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 4px;
}

.conversation-title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 14px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-approval-badge {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 40px;
  color: var(--color-text-success-primary);
  background: var(--color-bg-success-primary);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  white-space: nowrap;
}

.conversation-meta {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  color: var(--color-text-primary);
}

.conversation-status,
:global(.conversation-delete) {
  display: block;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.conversation-status--running {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
}

.conversation-status--running svg {
  display: block;
  flex: none;
  width: 12px;
  height: 12px;
  transform-origin: center;
  animation: conversation-status-spin 0.8s linear infinite;
}

.conversation-status--ended {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #f359dc;
}

:global(.conversation-delete) {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--color-text-primary);
  opacity: 0;
  outline: none;
  pointer-events: none;
  z-index: 1;
}

.conversation-item--action-visible :global(.conversation-delete),
:global(.conversation-delete:focus-visible) {
  opacity: 1;
  pointer-events: auto;
}

:global(.conversation-action-menu) {
  display: flex;
  width: 140px;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 16px;
  background: var(--color-bg-primary);
  box-sizing: border-box;
  box-shadow:
    0 1px 1px rgb(0 0 0 / 4%),
    0 2px 8px rgb(0 0 0 / 4%),
    0 3px 17px rgb(0 0 0 / 4%),
    0 4px 30px rgb(0 0 0 / 12%);
  overflow: hidden;
}

:global(.conversation-action-menu__action) {
  display: flex;
  width: 100%;
  height: 36px;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  text-align: left;
  cursor: pointer;
}

:global(.conversation-action-menu__action--danger) {
  color: var(--color-text-error-primary, #f04438);
}

:global(.conversation-action-menu__action:hover),
:global(.conversation-action-menu__action:focus-visible) {
  background: var(--color-bg-secondary-hover, #f5f5f5);
  outline: none;
}

@keyframes conversation-status-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
