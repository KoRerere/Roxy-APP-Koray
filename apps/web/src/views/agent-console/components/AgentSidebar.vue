<script setup lang="ts">
import type { ResourceUpdateMessage } from '@roxy/electron-preload'
import { useSimpleLocale } from '/@/stores/locale'
import { agentNavItems, secondaryNavItems } from '../mock'
import type { AgentConversation, AgentNavId } from '../types'
import AgentNav from './AgentNav.vue'
import BrandHeader from './BrandHeader.vue'
import ConversationList from './ConversationList.vue'
import SidebarFooter from './SidebarFooter.vue'
import TemplateMenu from './TemplateMenu.vue'

const props = defineProps<{
  activeConversationId?: string
  conversations: AgentConversation[]
  hasMoreConversations: boolean
  loadingMoreConversations: boolean
  maxWidth: number
  minWidth: number
  pendingApprovalConversationIds: string[]
  sidebarWidth: number
  updateInfo?: ResourceUpdateMessage | null
}>()

const emit = defineEmits<{
  openFeedback: []
  newChat: []
  deleteConversation: [id: string]
  renameConversation: [id: string]
  resizeStart: [event: PointerEvent]
  resizeStep: [delta: number]
  restartAgentForUpdate: []
  selectConversation: [id: string]
  loadMoreConversations: []
}>()

const localeStore = useSimpleLocale()

const newChatItem = computed(() => agentNavItems.find(item => item.id === 'new-chat'))
const newChatLabel = computed(() => localeStore.currentLocale.startsWith('zh') ? '新对话' : $t('新建对话'))
const primaryNavItems = computed(() => agentNavItems.filter(item => item.id !== 'new-chat'))
const agentUpdateAvailable = computed(() => {
  return props.updateInfo?.type === 'agent' && ['update', 'downloaded', 'downloading', 'failed'].includes(props.updateInfo.status!)
})
const agentUpdateTitle = computed(() => {
  const version = props.updateInfo?.version
  return version
    ? $t('更新 AI Agent 到 v{version}', { version })
    : $t('更新 AI Agent')
})
const agentUpdateLabel = computed(() => {
  const updateInfo = props.updateInfo
  if (updateInfo?.type !== 'agent')
    return $t('更新')

  if (updateInfo.status === 'downloading') {
    return `${$t('正在下载')} ${Math.floor(updateInfo.percent ?? 0)}%`
  }

  if (updateInfo.status === 'downloaded')
    return $t('更新')

  if (updateInfo.status === 'failed')
    return $t('重试')

  return $t('更新')
})
const agentUpdateDisabled = computed(() => props.updateInfo?.status === 'downloading')
const sidebarScrollRef = ref<HTMLElement | null>(null)
const sidebarCanScrollUp = ref(false)
const sidebarCanScrollDown = ref(false)
let sidebarScrollResizeObserver: ResizeObserver | null = null

function onNavSelect(id: AgentNavId) {
  if (id === 'new-chat') {
    emit('newChat')
  }
}

function syncSidebarScrollMask() {
  const element = sidebarScrollRef.value
  if (!element) {
    sidebarCanScrollUp.value = false
    sidebarCanScrollDown.value = false
    return
  }

  const scrollRange = element.scrollHeight - element.clientHeight
  if (scrollRange <= 1) {
    sidebarCanScrollUp.value = false
    sidebarCanScrollDown.value = false
    if (props.hasMoreConversations && !props.loadingMoreConversations) {
      emit('loadMoreConversations')
    }
    return
  }

  sidebarCanScrollUp.value = element.scrollTop > 1
  sidebarCanScrollDown.value = element.scrollTop < scrollRange - 1
  if (props.hasMoreConversations
    && !props.loadingMoreConversations
    && element.scrollTop >= scrollRange - 80) {
    emit('loadMoreConversations')
  }
}

watch(
  () => [
    props.conversations.length,
    props.conversations.map(conversation => `${conversation.id}:${conversation.title}`).join('|'),
    props.hasMoreConversations,
    props.loadingMoreConversations,
  ],
  () => {
    nextTick(() => syncSidebarScrollMask())
  },
  { immediate: true },
)

onMounted(() => {
  nextTick(() => {
    syncSidebarScrollMask()

    const element = sidebarScrollRef.value
    if (!element || typeof ResizeObserver === 'undefined') {
      return
    }

    sidebarScrollResizeObserver = new ResizeObserver(() => syncSidebarScrollMask())
    sidebarScrollResizeObserver.observe(element)
    Array.from(element.children).forEach(child => sidebarScrollResizeObserver?.observe(child))
  })
})

onBeforeUnmount(() => {
  sidebarScrollResizeObserver?.disconnect()
  sidebarScrollResizeObserver = null
})
</script>

<template>
  <aside class="agent-sidebar">
    <BrandHeader class="sidebar-brand" />

    <div class="sidebar-new-chat-wrap">
      <RouterLink v-if="newChatItem" v-slot="{ href, isExactActive }" custom :to="newChatItem.to">
        <a
          :href="href"
          class="sidebar-new-chat"
          :class="{ active: isExactActive }"
          @click.prevent="emit('newChat')"
        >
          <SvgIcon :name="newChatItem.icon" size="18" />
          <span>{{ newChatLabel }}</span>
        </a>
      </RouterLink>
    </div>

    <div
      ref="sidebarScrollRef"
      class="sidebar-scroll"
      :class="{
        'sidebar-scroll--can-scroll-up': sidebarCanScrollUp,
        'sidebar-scroll--can-scroll-down': sidebarCanScrollDown,
      }"
      @scroll.passive="syncSidebarScrollMask"
    >
      <div class="sidebar-menu">
        <AgentNav :items="secondaryNavItems" @select="onNavSelect" />
        <AgentNav :items="primaryNavItems" @select="onNavSelect" />
        <TemplateMenu />
      </div>
      <ConversationList
        :active-conversation-id="activeConversationId"
        :pending-approval-conversation-ids="pendingApprovalConversationIds"
        :conversations="conversations"
        :loading-more="loadingMoreConversations"
        @delete="emit('deleteConversation', $event)"
        @rename="emit('renameConversation', $event)"
        @select="emit('selectConversation', $event)"
      />
    </div>

    <SidebarFooter
      :update-available="agentUpdateAvailable"
      :update-disabled="agentUpdateDisabled"
      :update-label="agentUpdateLabel"
      :update-title="agentUpdateTitle"
      @feedback="emit('openFeedback')"
      @update="emit('restartAgentForUpdate')"
    />

    <div
      class="agent-sidebar-resize-handle"
      role="separator"
      aria-orientation="vertical"
      :aria-label="$t('调整会话栏宽度')"
      :aria-valuemax="maxWidth"
      :aria-valuemin="minWidth"
      :aria-valuenow="sidebarWidth"
      tabindex="0"
      @keydown.left.prevent="emit('resizeStep', -16)"
      @keydown.right.prevent="emit('resizeStep', 16)"
      @pointerdown="emit('resizeStart', $event)"
    />
  </aside>
</template>

<style lang="scss" scoped>
.agent-sidebar {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  padding: 16px 0 16px 16px;
}

.agent-sidebar-resize-handle {
  position: absolute;
  z-index: 2;
  top: 16px;
  bottom: 16px;
  right: -5px;
  width: 10px;
  border-radius: 999px;
  cursor: col-resize;
  outline: none;

  &::after {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 4px;
    width: 2px;
    border-radius: inherit;
    background: transparent;
    content: '';
    transition: background-color 0.16s ease;
  }

  &:hover::after,
  &:focus-visible::after {
    background: var(--color-border-primary);
  }
}

.sidebar-brand {
  margin-bottom: 16px;
}

.sidebar-new-chat-wrap {
  margin-bottom: 1px;
  padding-right: 16px;
}

.sidebar-new-chat {
  display: flex;
  align-items: center;
  width: 100%;
  height: 32px;
  gap: 8px;
  padding: 6px 8px;
  border: 0;
  border-radius: 10px;
  color: var(--color-text-primary);
  background: transparent;
  font-size: 14px;
  line-height: 20px;
  text-align: left;
  text-decoration: none;
  cursor: pointer;

  &:hover {
    background: var(--color-bg-tertiary-hover);
  }

  &.active {
    background: var(--color-bg-tertiary-hover);
    font-weight: 500;
  }
}

.sidebar-scroll {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 16px;
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 6px;
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
  &::-webkit-scrollbar {
    width: 10px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }
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

:global(html[data-theme='dark']) .sidebar-scroll,
:global(html.app-dark) .sidebar-scroll {
  --sidebar-scroll-mask-top-hold-stop: 0px;
  --sidebar-scroll-mask-top-solid-stop: calc(0px + 1px);
  --sidebar-scroll-mask-bottom-solid-stop: calc(calc(100% - 46px) - 40px);
  --sidebar-scroll-mask-bottom-strong-stop: calc(calc(100% - 46px) - 0.25rem * 6);
  --sidebar-scroll-mask-bottom-mid-stop: calc(calc(100% - 46px) - 0.25rem * 3);
  --sidebar-scroll-mask-bottom-weak-stop: calc(calc(100% - 46px) - 0.25rem);
  --sidebar-scroll-mask-bottom-end-stop: calc(100% - 46px);
}

.sidebar-menu {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
</style>
