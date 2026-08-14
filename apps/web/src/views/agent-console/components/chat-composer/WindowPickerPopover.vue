<script setup lang="ts">
import { getWorkspaceNamePrefix } from '/@/utils/workspace'
import AgentButton from '../form/AgentButton.vue'
import AgentCheckbox from '../form/AgentCheckbox.vue'
import AgentSelect from '../form/AgentSelect.vue'
import AgentBadge from '../form/AgentBadge.vue'
import type { AgentComposerItem, AgentComposerProjectOption } from './types'

const props = defineProps<{
  allSelected: boolean
  activeItem?: AgentComposerItem
  hasMore: boolean
  items: AgentComposerItem[]
  loadError: string
  loadingMore: boolean
  projectOptions: AgentComposerProjectOption[]
  query: string
  selectedCount: number
  selectedIds: Set<string>
  selectedProjectId: string
  selectAllLoading: boolean
}>()

const emit = defineEmits<{
  cancel: []
  choose: [item: AgentComposerItem]
  confirm: []
  hover: [item: AgentComposerItem]
  loadMore: []
  projectChange: [projectId: string]
  retry: []
  search: [query: string]
  toggleAll: []
}>()

function isSelected(item: AgentComposerItem) {
  return props.selectedIds.has(item.id)
}

function getWindowCode(item: AgentComposerItem) {
  const { workspaceName, windowSortNum } = item.payload

  if (!windowSortNum)
    return item.payload.windowName ? '' : item.title

  const prefix = getWorkspaceNamePrefix(workspaceName)
  return prefix ? `${prefix}-${windowSortNum}` : windowSortNum
}

function handleSearchInput(event: Event) {
  emit('search', (event.target as HTMLInputElement).value)
}

function handleListScroll(event: Event) {
  const element = event.currentTarget as HTMLElement
  if (
    props.hasMore
    && !props.loadingMore
    && !props.selectAllLoading
    && !props.loadError
    && element.scrollHeight - element.scrollTop - element.clientHeight <= 24
  ) {
    emit('loadMore')
  }
}

function chooseActiveItem(event?: KeyboardEvent) {
  if (event?.isComposing || event?.keyCode === 229)
    return

  const item = props.activeItem ?? props.items[0]

  if (item)
    emit('choose', item)
}
</script>

<template>
  <div class="window-picker-popover">
    <div class="window-picker-header">
      <span>{{ $t('选择窗口') }}</span>
      <span class="window-picker-count">{{ $t('已选择{count}项', { count: selectedCount }) }}</span>
    </div>

    <div class="window-picker-search-wrap">
      <AgentCheckbox
        :model-value="allSelected"
        class="window-picker-select-all"
        input-id="window-picker-select-all"
        :disabled="selectAllLoading || (!items.length && !hasMore)"
        @update:model-value="emit('toggleAll')"
      >
        <i v-if="selectAllLoading" class="pi pi-spin pi-spinner" aria-hidden="true" />
        <span>{{ $t('全选') }}</span>
      </AgentCheckbox>

      <AgentSelect
        class="window-picker-project-select"
        :model-value="selectedProjectId"
        :options="projectOptions"
        :aria-label="$t('项目')"
        @mousedown.stop
        @update:model-value="emit('projectChange', String($event ?? ''))"
      />

      <label class="window-picker-search" @mousedown.stop>
        <SvgIcon name="base/rx_ic_magnify" size="16" />
        <input
          :value="query"
          :placeholder="$t('搜索窗口')"
          type="text"
          @input="handleSearchInput"
          @keydown.enter.prevent="chooseActiveItem"
        >
      </label>
    </div>

    <div
      class="window-picker-list"
      :aria-busy="loadingMore || selectAllLoading"
      @scroll.passive="handleListScroll"
    >
      <AgentCheckbox
        v-for="item in items"
        :key="item.id"
        :model-value="isSelected(item)"
        class="window-picker-item"
        :class="{
          'window-picker-item--active': activeItem?.id === item.id,
          'window-picker-item--selected': isSelected(item),
        }"
        :input-id="`window-picker-${item.id}`"
        @mouseenter="emit('hover', item)"
        @update:model-value="emit('choose', item)"
      >
        <SvgIcon class="window-picker-flag" :name="item.iconName || 'base/rx_ic_route2'" fallback="base/rx_ic_route2" size="16" color="var(--colors-icon-icon-tertiary)" />
        <span class="window-picker-title">
          <span v-if="getWindowCode(item)" class="window-picker-title__code">{{ getWindowCode(item) }}</span>
          <span v-if="item.payload.windowName" class="window-picker-title__name">
            {{ getWindowCode(item) ? '· ' : '' }}{{ item.payload.windowName }}
          </span>
          <span v-if="item.payload.windowRemark" class="window-picker-title__remark">
            {{ getWindowCode(item) || item.payload.windowName ? '· ' : '' }}{{ item.payload.windowRemark }}
          </span>
        </span>
        <AgentBadge v-if="item.isOpen" class="window-open-badge" type="open" :label="$t('窗口已打开')" />
      </AgentCheckbox>

      <div v-if="loadingMore" class="window-picker-list-state" role="status">
        <i class="pi pi-spin pi-spinner" aria-hidden="true" />
        <span>{{ $t('加载中...') }}</span>
      </div>

      <div v-else-if="loadError" class="window-picker-list-state window-picker-list-state--error" role="alert">
        <span>{{ loadError }}</span>
        <button type="button" @click="emit('retry')">
          {{ $t('重试') }}
        </button>
      </div>

      <div v-else-if="items.length === 0" class="window-picker-list-state">
        {{ $t('没有找到结果') }}
      </div>
    </div>

    <div class="window-picker-footer">
      <div class="window-picker-actions">
        <AgentButton :icon="false" class="window-picker-cancel" variant="secondary" @mousedown.prevent="emit('cancel')">
          {{ $t('取消') }}
        </AgentButton>
        <AgentButton :icon="false" class="window-picker-done" variant="primary" @mousedown.prevent="emit('confirm')">
          {{ $t('完成') }} ({{ selectedCount }})
        </AgentButton>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.window-picker-popover {
  display: flex;
  width: 100%;
  max-height: inherit;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-border-secondary, var(--color-border-secondary));
  border-radius: 16px;
  color: var(--color-text-primary, var(--color-text-primary));
  background: var(--color-bg-primary, var(--color-bg-primary));
}

.window-picker-header {
  display: flex;
  min-height: 44px;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-border-secondary, var(--color-border-secondary));
  color: var(--color-text-quaternary, #737373);
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  white-space: nowrap;
}

.window-picker-header > span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.window-picker-header > span:last-child {
  flex: none;
}

.window-picker-count {
  color: var(--color-text-primary, var(--color-text-primary));
}

.window-picker-list {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  padding: 0 12px 12px;
}

.window-picker-list-state {
  display: flex;
  min-height: 40px;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px;
  color: var(--color-text-quaternary, #737373);
  font-size: 12px;
  line-height: 16px;
  text-align: center;
}

.window-picker-list-state--error {
  flex-direction: column;
}

.window-picker-list-state--error button {
  padding: 4px 10px;
  border: 1px solid var(--color-border-secondary, var(--color-border-secondary));
  border-radius: 8px;
  color: var(--color-text-primary, var(--color-text-primary));
  background: var(--color-bg-primary, var(--color-bg-primary));
  cursor: pointer;
}

.window-picker-search-wrap {
  z-index: 1;
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 12px 12px 4px;
  background: var(--color-bg-primary, var(--color-bg-primary));
}

.window-picker-select-all {
  min-height: 36px;
  flex: none;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  color: var(--color-text-primary, var(--color-text-primary));
  background: transparent;
  font-weight: 400;

  &:hover:not(.agent-checkbox--disabled) {
    background: var(--color-bg-secondary-hover, var(--color-bg-quaternary));
  }
}

.window-picker-project-select {
  width: calc((100% - 8px) / 3);
  flex: 0 0 calc((100% - 8px) / 3);
}

.window-picker-project-select :deep(.p-select-label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.window-picker-search {
  display: flex;
  width: auto;
  min-width: 0;
  flex: 2 1 0;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 7px 8px;
  border: 1px solid var(--color-border-secondary, var(--color-border-secondary));
  border-radius: 8px;
  color: var(--color-text-quaternary, #737373);
  background: var(--color-bg-primary, var(--color-bg-primary));
  box-sizing: border-box;
  cursor: text;
}

.window-picker-search input {
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

.window-picker-search input::placeholder {
  color: var(--color-text-quaternary, #737373);
}

.window-picker-item {
  display: flex;
  width: 100% !important;
  min-height: 36px;
  align-items: center;
  gap: 9px;
  padding: 8px;
  border: 0;
  border-radius: 8px;
  color: var(--color-text-primary, var(--color-text-primary));
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  text-align: left;

  :deep(.agent-checkbox__label) {
    display: flex;
    min-width: 0;
    flex: 1 1 0;
    align-items: center;
    gap: 9px;
  }
}

.window-picker-item:hover,
.window-picker-item--selected {
  background: var(--color-bg-secondary-hover, var(--color-bg-quaternary));
}

.window-picker-item--active:not(.window-picker-item--selected) {
  background: transparent;
}

.window-picker-flag {
  width: 16px;
  height: 16px;
  flex: none;
}

.window-picker-title {
  display: inline-flex;
  min-width: 0;
  flex: 1 1 0;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  white-space: nowrap;
}

.window-picker-title__code,
.window-picker-title__name {
  flex: none;
  color: var(--color-text-primary, #141414);
}

.window-picker-title__remark {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  color: var(--color-text-disabled, #a3a3a3);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.window-open-badge {
  flex: none;
}

.window-picker-footer {
  display: flex;
  min-height: 56px;
  flex: none;
  align-items: center;
  justify-content: flex-start;
  padding: 12px 20px;
  border-top: 1px solid var(--color-border-secondary, var(--color-border-secondary));
}

.window-picker-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 4px;
}
</style>
