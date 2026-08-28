<script setup lang="ts">
import type { AgentMessage } from '../types'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { copyText } from '/@/utils/basic'
import AgentCopyNotification from './AgentCopyNotification.vue'
import ChatMessage from './ChatMessage.vue'
import { getSelectionMarkdown } from '../utils/markdownSelection'
import { FrameTaskScheduler } from '../scrollFrameScheduler'

const props = defineProps<{
  activeConversationId?: string
  hasEarlierMessages: boolean
  hasHeader?: boolean
  loadingEarlierMessages: boolean
  messages: AgentMessage[]
}>()

const emit = defineEmits<{
  addToChat: [text: string]
  loadEarlierMessages: []
  saveAsPrompt: [text: string]
}>()

interface SelectionMenuState {
  left: number
  markdownText: string
  text: string
  top: number
}

interface HistoryLoadAnchor {
  firstMessageId?: string
  scrollHeight: number
  scrollTop: number
}

const SELECTION_MENU_GAP = 10
const SELECTION_MENU_MARGIN = 8
const SELECTION_MENU_WIDTH = 160

const [, onlyErrorToast] = useResponseToast()
const copyNotificationRef = ref<{ show: () => void } | null>(null)
const listRef = ref<HTMLElement | null>(null)
const innerRef = ref<HTMLElement | null>(null)
const showScrollToBottom = ref(false)
const selectionMenuRef = ref<HTMLElement | null>(null)
const selectionMenu = ref<SelectionMenuState | null>(null)
let selectionFrame = 0
let shouldAutoScroll = true
let userPausedAutoScroll = false
let lastConversationId = props.activeConversationId
let lastScrollTop = 0
let programmaticScrollUntil = 0
let touchStartY = 0
let resizeObserver: ResizeObserver | null = null
let historyLoadAnchor: HistoryLoadAnchor | null = null
const scrollScheduler = new FrameTaskScheduler(window)

const SCROLL_BOTTOM_THRESHOLD = 96
const SCROLL_BOTTOM_RESUME_THRESHOLD = 4
const LOAD_EARLIER_THRESHOLD = 48

function closeSelectionMenu(clearSelection = false) {
  selectionMenu.value = null
  if (clearSelection)
    window.getSelection()?.removeAllRanges()
}

function getSelectionMenuPosition(selectionRect: DOMRect) {
  const maxLeft = Math.max(SELECTION_MENU_MARGIN, window.innerWidth - SELECTION_MENU_WIDTH - SELECTION_MENU_MARGIN)
  const left = Math.min(
    Math.max(SELECTION_MENU_MARGIN, selectionRect.left + selectionRect.width / 2 - SELECTION_MENU_WIDTH / 2),
    maxLeft,
  )

  return {
    left,
    top: selectionRect.bottom + SELECTION_MENU_GAP,
  }
}

function getCurrentTextSelection() {
  const selection = window.getSelection()
  const inner = innerRef.value
  if (
    !selection
    || selection.isCollapsed
    || !selection.anchorNode
    || !selection.focusNode
    || !inner?.contains(selection.anchorNode)
    || !inner.contains(selection.focusNode)
  ) {
    return null
  }

  const text = selection.toString()
  if (!text.trim())
    return null

  return {
    markdownText: getSelectionMarkdown(selection, inner),
    rect: selection.getRangeAt(0).getBoundingClientRect(),
    text,
  }
}

function showCurrentTextSelectionMenu() {
  const currentSelection = getCurrentTextSelection()
  if (!currentSelection) {
    closeSelectionMenu()
    return false
  }

  selectionMenu.value = {
    ...getSelectionMenuPosition(currentSelection.rect),
    markdownText: currentSelection.markdownText,
    text: currentSelection.text,
  }
  return true
}

function handlePointerUp(event: PointerEvent) {
  if (event.button !== 0)
    return

  cancelAnimationFrame(selectionFrame)
  selectionFrame = requestAnimationFrame(() => {
    showCurrentTextSelectionMenu()
  })
}

function handleContextMenu(event: MouseEvent) {
  const target = event.target
  const inner = innerRef.value
  if (!inner || !(target instanceof Node) || !inner.contains(target))
    return

  if (showCurrentTextSelectionMenu())
    event.preventDefault()
}
function handleDocumentPointerDown(event: PointerEvent) {
  if (selectionMenuRef.value?.contains(event.target as Node))
    return

  closeSelectionMenu()
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape')
    closeSelectionMenu(true)
}

function handleViewportChange() {
  closeSelectionMenu()
}

async function copyTextWithNotification(text: string) {
  try {
    await copyText(text)
    copyNotificationRef.value?.show()
  }
  catch (error) {
    console.error('Failed to copy agent chat text', error)
    onlyErrorToast(-1, $t('复制失败'))
  }
}

async function handleCopySelection() {
  const text = selectionMenu.value?.text
  if (!text)
    return

  try {
    await copyTextWithNotification(text)
  }
  finally {
    closeSelectionMenu(true)
  }
}

async function handleCopyUserMessage(text: string) {
  await copyTextWithNotification(text)
}

function handleAddToChat() {
  const text = selectionMenu.value?.markdownText
  if (!text)
    return

  closeSelectionMenu(true)
  emit('addToChat', text)
}

function handleSaveAsPrompt() {
  const text = selectionMenu.value?.text
  if (!text)
    return

  closeSelectionMenu(true)
  emit('saveAsPrompt', text)
}

const scrollSignature = computed(() => {
  const lastMessage = props.messages.at(-1)
  return [
    props.activeConversationId,
    props.messages.length,
    lastMessage?.conversationId,
    lastMessage?.id,
    lastMessage?.content,
    lastMessage?.status,
    lastMessage?.process?.durationState,
    lastMessage?.process?.durationStartedAt,
    lastMessage?.process?.durationEndedAt,
    lastMessage?.process?.revision,
    lastMessage?.process?.events.length,
  ].join('|')
})

function getBottomDistance() {
  const list = listRef.value
  if (!list)
    return 0

  return Math.max(0, list.scrollHeight - list.scrollTop - list.clientHeight)
}

function updateScrollButton() {
  showScrollToBottom.value = getBottomDistance() > SCROLL_BOTTOM_THRESHOLD
}

function markProgrammaticScroll(duration = 120) {
  programmaticScrollUntil = Math.max(programmaticScrollUntil, Date.now() + duration)
}

function isProgrammaticScroll() {
  return Date.now() < programmaticScrollUntil
}

function scrollToBottom(behavior: ScrollBehavior = 'auto') {
  const list = listRef.value
  if (!list)
    return

  userPausedAutoScroll = false
  markProgrammaticScroll(behavior === 'smooth' ? 480 : 120)
  list.scrollTo({
    top: list.scrollHeight,
    behavior,
  })

  if (behavior === 'auto')
    showScrollToBottom.value = false
}

function scheduleScrollToBottom() {
  scrollScheduler.schedule(() => {
    if (shouldAutoScroll) {
      scrollToBottom()
    }
    else {
      updateScrollButton()
    }
  })
}

function requestEarlierMessages() {
  const list = listRef.value
  if (
    !list
    || historyLoadAnchor
    || !props.hasEarlierMessages
    || props.loadingEarlierMessages
  ) {
    return
  }

  historyLoadAnchor = {
    firstMessageId: props.messages[0]?.id,
    scrollHeight: list.scrollHeight,
    scrollTop: list.scrollTop,
  }
  emit('loadEarlierMessages')
}

function handleScroll() {
  closeSelectionMenu()
  const list = listRef.value
  if (!list)
    return

  if (!isProgrammaticScroll()) {
    const currentScrollTop = list.scrollTop
    const bottomDistance = getBottomDistance()
    const isScrollingUp = currentScrollTop < lastScrollTop - 1

    if (isScrollingUp)
      userPausedAutoScroll = true

    if (bottomDistance <= SCROLL_BOTTOM_RESUME_THRESHOLD) {
      userPausedAutoScroll = false
      shouldAutoScroll = true
    }
    else {
      shouldAutoScroll = !userPausedAutoScroll && bottomDistance <= SCROLL_BOTTOM_THRESHOLD
    }

    if (isScrollingUp && currentScrollTop <= LOAD_EARLIER_THRESHOLD) {
      requestEarlierMessages()
    }
  }

  lastScrollTop = list.scrollTop
  updateScrollButton()
}

function pauseAutoScroll() {
  userPausedAutoScroll = true
  shouldAutoScroll = false
  scrollScheduler.cancel()
}

function handleWheel(event: WheelEvent) {
  if (event.deltaY < 0) {
    pauseAutoScroll()
    if ((listRef.value?.scrollTop ?? 0) <= LOAD_EARLIER_THRESHOLD) {
      requestEarlierMessages()
    }
  }
}

function handleTouchStart(event: TouchEvent) {
  touchStartY = event.touches[0]?.clientY ?? 0
}

function handleTouchMove(event: TouchEvent) {
  const touchY = event.touches[0]?.clientY ?? touchStartY
  if (touchY > touchStartY) {
    pauseAutoScroll()
    if ((listRef.value?.scrollTop ?? 0) <= LOAD_EARLIER_THRESHOLD) {
      requestEarlierMessages()
    }
  }
}

function handleScrollToBottomClick() {
  userPausedAutoScroll = false
  shouldAutoScroll = true
  scrollToBottom('smooth')
  window.setTimeout(updateScrollButton, 240)
}

function handleListResize() {
  scheduleScrollToBottom()
}

watch(() => props.activeConversationId, (conversationId) => {
  if (conversationId === lastConversationId)
    return

  lastConversationId = conversationId
  historyLoadAnchor = null
  userPausedAutoScroll = false
  shouldAutoScroll = true
  scheduleScrollToBottom()
})

watch(
  () => [props.messages[0]?.id, props.loadingEarlierMessages] as const,
  async ([firstMessageId, loadingEarlierMessages]) => {
    const anchor = historyLoadAnchor
    if (!anchor) {
      return
    }

    if (firstMessageId !== anchor.firstMessageId) {
      await nextTick()
      const list = listRef.value
      if (list) {
        markProgrammaticScroll()
        list.scrollTop = anchor.scrollTop + list.scrollHeight - anchor.scrollHeight
        lastScrollTop = list.scrollTop
        updateScrollButton()
      }
      historyLoadAnchor = null
      return
    }

    if (!loadingEarlierMessages) {
      historyLoadAnchor = null
    }
  },
  { flush: 'post' },
)

watch(scrollSignature, () => {
  scheduleScrollToBottom()
}, { flush: 'post' })

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
  document.addEventListener('keydown', handleDocumentKeydown)
  window.addEventListener('resize', handleViewportChange)

  userPausedAutoScroll = false
  shouldAutoScroll = true
  scheduleScrollToBottom()

  if (listRef.value) {
    resizeObserver = new ResizeObserver(handleListResize)
    resizeObserver.observe(listRef.value)
    if (innerRef.value)
      resizeObserver.observe(innerRef.value)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  document.removeEventListener('keydown', handleDocumentKeydown)
  window.removeEventListener('resize', handleViewportChange)
  scrollScheduler.cancel()
  cancelAnimationFrame(selectionFrame)
  resizeObserver?.disconnect()
})
</script>

<template>
  <AgentCopyNotification ref="copyNotificationRef" />

  <div class="message-list-shell" :class="{ 'message-list-shell--with-header': hasHeader }">
    <div
      ref="listRef"
      :aria-busy="loadingEarlierMessages"
      class="message-list"
      @pointerup="handlePointerUp"
      @contextmenu="handleContextMenu"
      @scroll="handleScroll"
      @touchmove.passive="handleTouchMove"
      @touchstart.passive="handleTouchStart"
      @wheel.passive="handleWheel"
    >
      <div ref="innerRef" class="message-list__inner">
        <ChatMessage v-for="message in messages" :key="message.id" :message="message" @copy="handleCopyUserMessage" />
      </div>
    </div>

    <button
      v-if="showScrollToBottom"
      class="scroll-to-bottom"
      type="button"
      :aria-label="$t('滚动到底部')"
      @click="handleScrollToBottomClick"
    >
      <SvgIcon name="roxy-agent/rx-ic-arrow" />
    </button>
  </div>

  <Teleport to="body">
    <div
      v-if="selectionMenu"
      ref="selectionMenuRef"
      class="selection-action-menu"
      role="menu"
      :aria-label="$t('选中文字操作')"
      :style="{ left: `${selectionMenu.left}px`, top: `${selectionMenu.top}px` }"
      @pointerdown.prevent
    >
      <button type="button" role="menuitem" @click="handleCopySelection">
        {{ $t('复制') }}
      </button>
      <button type="button" role="menuitem" @click="handleAddToChat">
        {{ $t('添加到当前对话') }}
      </button>
      <button type="button" role="menuitem" @click="handleSaveAsPrompt">
        {{ $t('保存为提示词') }}
      </button>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
.message-list-shell {
  --agent-message-list-top-inset: 0px;
  --agent-message-list-inner-top-padding: 90px;

  position: relative;
  z-index: 1;
  min-height: 0;
  flex: 1;
  width: 100%;
  padding-top: var(--agent-message-list-top-inset);
  box-sizing: border-box;
}

.message-list-shell--with-header {
  --agent-message-list-top-inset: 70px;
  --agent-message-list-inner-top-padding: 20px;
}

.message-list {
  display: block;
  width: 100%;
  height: 100%;
  overflow: auto;
  scrollbar-gutter: stable both-edges;
}

.message-list__inner {
  display: flex;
  width: var(--agent-chat-content-width, min(800px, calc(100% - 68px)));
  min-height: 100%;
  margin: 0 auto;
  flex-direction: column;
  gap: 32px;
  padding: var(--agent-message-list-inner-top-padding) 0 var(--agent-composer-reserved-bottom, 250px);
  box-sizing: border-box;
}

.message-list__inner :deep(.chat-message.user + .chat-message.assistant) {
  margin-top: 24px;
}

.selection-action-menu {
  position: fixed;
  z-index: 1400;
  display: flex;
  box-sizing: border-box;
  width: 160px;
  height: 106px;
  flex-direction: column;
  justify-content: center;
  padding: 4px;
  border: 1px solid var(--color-border-primary);
  border-radius: 12px;
  background: var(--color-bg-primary);
  box-shadow: 0 3px 7px rgb(0 0 0 / 8%);

  button {
    display: flex;
    width: 100%;
    height: 32px;
    flex: 0 0 32px;
    align-items: center;
    padding: 8px 10px;
    border: 0;
    border-radius: 8px;
    color: var(--color-text-primary);
    background: var(--color-bg-primary);
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
    text-align: left;

    &:hover,
    &:focus-visible {
      outline: none;
      background: var(--color-bg-quaternary);
    }
  }
}

.scroll-to-bottom {
  position: absolute;
  bottom: var(--agent-scroll-button-bottom, 172px);
  left: 50%;
  z-index: 4;
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  place-items: center;
  border: 1px solid var(--color-border-secondary);
  border-radius: 999px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  cursor: pointer;
  transform: translateX(-50%);

  &:hover {
    background: var(--color-bg-quaternary);
  }
}

.scroll-to-bottom__icon {
  position: relative;
  width: 14px;
  height: 14px;

  &::before {
    position: absolute;
    top: 2px;
    left: 6px;
    width: 1.5px;
    height: 9px;
    border-radius: 999px;
    background: currentColor;
    content: '';
  }

  &::after {
    position: absolute;
    right: 2px;
    bottom: 2px;
    width: 7px;
    height: 7px;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    content: '';
    transform: rotate(45deg);
    transform-origin: center;
  }
}
</style>
