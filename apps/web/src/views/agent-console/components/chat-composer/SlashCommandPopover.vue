<script setup lang="ts">
import type { AgentComposerItem } from './types'
import type { SuggestionNavigationDirection } from './selection'

const props = defineProps<{
  activeItem?: AgentComposerItem
  items: AgentComposerItem[]
  query: string
}>()

const emit = defineEmits<{
  choose: [item: AgentComposerItem]
  hover: [item: AgentComposerItem]
  navigate: [direction: SuggestionNavigationDirection]
  read: [item: AgentComposerItem]
  search: [query: string]
  toggleTop: [item: AgentComposerItem]
}>()

const TEMPLATE_UNREAD_HOVER_DELAY_MS = 300

const router = useRouter()
let unreadHoverTimer: number | null = null
let unreadHoverItemId: string | undefined

function handleSearchInput(event: Event) {
  emit('search', (event.target as HTMLInputElement).value)
}

function openTemplateStore() {
  router.push({ name: 'agent-console-template-store' })
}

function clearUnreadHoverTimer(itemId?: string) {
  if (itemId && unreadHoverItemId !== itemId)
    return

  if (unreadHoverTimer !== null)
    window.clearTimeout(unreadHoverTimer)

  unreadHoverTimer = null
  unreadHoverItemId = undefined
}

function handleItemMouseEnter(item: AgentComposerItem) {
  emit('hover', item)
  clearUnreadHoverTimer()

  if (!item.unread)
    return

  unreadHoverItemId = item.id
  unreadHoverTimer = window.setTimeout(() => {
    unreadHoverTimer = null
    unreadHoverItemId = undefined
    emit('read', item)
  }, TEMPLATE_UNREAD_HOVER_DELAY_MS)
}

function handleItemMouseLeave(item: AgentComposerItem) {
  clearUnreadHoverTimer(item.id)
}

function chooseActiveItem(event?: KeyboardEvent) {
  if (event?.isComposing || event?.keyCode === 229)
    return

  const item = props.activeItem ?? props.items[0]

  if (item)
    emit('choose', item)
}

watch(
  () => props.items,
  (items) => {
    if (unreadHoverItemId && !items.some(item => item.id === unreadHoverItemId && item.unread))
      clearUnreadHoverTimer()
  },
)

onBeforeUnmount(clearUnreadHoverTimer)

function getTemplateTypeLabel(item: AgentComposerItem) {
  if (item.payload.templateType === 'script')
    return $t('脚本')

  if (item.payload.templateType === 'skills' || item.payload.templateType === 'skill')
    return 'Skill'

  if (item.payload.templateType === 'prompt')
    return $t('提示词')

  return $t('模板')
}
</script>

<template>
  <div class="slash-command-popover">
    <div class="slash-command-header">
      <label class="slash-command-search" @mousedown.stop>
        <SvgIcon name="base/rx_ic_magnify" size="16" />
        <input
          :value="query"
          :placeholder="$t('搜索模板')"
          type="text"
          @input="handleSearchInput"
          @keydown.down.prevent="emit('navigate', 'next')"
          @keydown.enter.prevent="chooseActiveItem"
          @keydown.up.prevent="emit('navigate', 'previous')"
        >
      </label>

      <button
        class="slash-command-more"
        type="button"
        @click="openTemplateStore"
        @mousedown.prevent.stop
      >
        <SvgIcon name="roxy-agent/rx-ic-templates-store" size="18" />
        <span>{{ $t('更多模板') }}</span>
      </button>
    </div>

    <div class="slash-command-list">
      <TransitionGroup
        v-if="items.length"
        class="slash-command-items"
        name="slash-command-item"
        tag="div"
      >
        <div
          v-for="item in items"
          :key="item.id"
          class="slash-command-item"
          :class="{ 'slash-command-item--active': activeItem?.id === item.id }"
          @mouseenter="handleItemMouseEnter(item)"
          @mouseleave="handleItemMouseLeave(item)"
        >
          <button
            class="slash-command-select"
            type="button"
            @mousedown.prevent="emit('choose', item)"
          >
            <span class="slash-command-icon-wrap">
              <SvgIcon class="slash-command-icon" :name="item.iconName" size="16" />
              <img
                v-if="item.unread"
                class="slash-command-unread"
                src="/images/agent-console/template-unread-dot.svg"
                alt=""
                aria-hidden="true"
              >
            </span>
            <span class="slash-command-copy">
              <span class="slash-command-title">{{ item.title }}</span>
              <span class="slash-command-desc">{{ item.description }}</span>
            </span>
          </button>
          <button
            class="slash-command-top"
            :class="{ 'slash-command-top--active': item.isTopped }"
            type="button"
            :disabled="item.isTopping"
            :aria-label="item.isTopped ? $t('取消置顶') : $t('置顶')"
            :aria-pressed="item.isTopped"
            @click.stop="emit('toggleTop', item)"
            @mousedown.prevent.stop
          >
            <SvgIcon
              :name="item.isTopped ? 'base/rx_ic_pin_solid' : 'base/rx_ic_pin_line'"
              size="16"
              aria-hidden="true"
            />
          </button>
          <span class="slash-command-type">{{ getTemplateTypeLabel(item) }}</span>
        </div>
      </TransitionGroup>

      <div v-else class="slash-command-empty">
        {{ $t('没有找到模板') }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.slash-command-popover {
  display: flex;
  width: 100%;
  max-height: inherit;
  flex-direction: column;
  overflow: hidden;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--color-border-secondary, var(--color-border-secondary));
  border-radius: 16px;
  background: var(--color-bg-primary, var(--color-bg-primary));
}

.slash-command-header {
  display: flex;
  width: 100%;
  flex: none;
  align-items: flex-start;
  gap: 4px;
}

.slash-command-search {
  display: flex;
  min-width: 0;
  flex: 1 1 0;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border: 1px solid var(--color-border-secondary, var(--color-border-secondary));
  border-radius: 8px;
  color: var(--color-text-quaternary, #737373);
  background: var(--color-bg-primary, var(--color-bg-primary));
  cursor: text;
}

.slash-command-more {
  display: inline-flex;
  min-height: 34px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid #ee46bc;
  border-radius: 10px;
  color: #ee46bc;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;

  &:hover {
    background: #fce7f6;
  }
}

:global(html[data-theme='dark'] .slash-command-more:hover),
:global(html.app-dark .slash-command-more:hover) {
  background: #300f27;
}

.slash-command-search input {
  min-width: 0;
  flex: 1;
  padding: 0;
  border: 0;
  outline: 0;
  color: var(--color-text-primary, var(--color-text-primary));
  background: transparent;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
}

.slash-command-search input::placeholder {
  color: var(--color-text-quaternary, #737373);
}

.slash-command-list {
  position: relative;
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.slash-command-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.slash-command-item-move,
.slash-command-item-enter-active,
.slash-command-item-leave-active {
  transition:
    transform 180ms ease,
    opacity 180ms ease;
}

.slash-command-item-enter-from,
.slash-command-item-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.slash-command-item-leave-active {
  position: absolute;
  width: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .slash-command-item-move,
  .slash-command-item-enter-active,
  .slash-command-item-leave-active {
    transition: none;
  }
}

.slash-command-item {
  display: flex;
  width: 100%;
  min-height: 36px;
  align-items: center;
  gap: 9px;
  padding: 8px;
  border: 0;
  border-radius: 8px;
  color: var(--color-text-primary, var(--color-text-primary));
  background: transparent;
  text-align: left;
}

.slash-command-item:hover,
.slash-command-item--active {
  background: var(--color-bg-secondary-hover, var(--color-bg-quaternary));
}

.slash-command-select {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 9px;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.slash-command-icon-wrap {
  position: relative;
  display: inline-flex;
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
}

.slash-command-icon {
  width: 16px;
  height: 16px;
  flex: none;
  color: var(--color-fg-primary);
}

.slash-command-unread {
  position: absolute;
  top: -2px;
  right: -4px;
  display: block;
  width: 6px;
  height: 6px;
  pointer-events: none;
}

.slash-command-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 8px;
}

.slash-command-title,
.slash-command-desc,
.slash-command-type {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slash-command-top {
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 7px;
  color: var(--color-text-quaternary);
  background: transparent;
  cursor: pointer;

  &:hover,
  &--active {
    color: var(--color-text-primary);
    background: var(--color-bg-quaternary);
  }

  &:disabled {
    cursor: wait;
    opacity: 0.5;
  }
}

.slash-command-title {
  color: var(--color-text-primary, var(--color-text-primary));
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
}

.slash-command-desc {
  flex: 1;
  color: var(--color-text-quaternary, #737373);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
}

.slash-command-type {
  flex: none;
  color: var(--color-text-disabled, #a3a3a3);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
}

.slash-command-empty {
  padding: 16px 8px;
  color: var(--color-text-quaternary, #737373);
  font-size: 13px;
  line-height: 18px;
  text-align: center;
}
</style>
