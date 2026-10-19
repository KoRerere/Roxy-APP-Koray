<script setup lang="ts">
import { isObject } from '/@/utils'
import { RxSvgIcon } from '/@/components/rx-icon/'
import type { ActionsItem, ActionsItemMultiple } from './type'

const { model, total, isPending = () => false } = defineProps<{
  total: number
  model: ActionsItem[]
  /** 只标记正在执行的那一项 */
  isPending?: (item: ActionsItem) => boolean
}>()

const emit = defineEmits(['more'])

const selectedProduct = defineModel<any[]>('selection')
const loadingMap = ref<Record<string, boolean>>({})

function isBatchItem(item: ActionsItem) {
  return !item.onlyQuick && !!item.multiple
}

const quickGroup = computed(() => {
  return Object.entries(model.reduce<Record<string, any[]>>((acc, item) => {
    if (!isBatchItem(item) || !isObject(item.multiple) || item.separator) {
      return acc
    }
    const multiple = item.multiple as ActionsItemMultiple
    const { name = 'default', render, showLabel, iconProps, discountBadge, ...props } = multiple
    acc[name] ??= []
    acc[name].push({
      ...item,
      render,
      showLabel,
      iconProps,
      discountBadge,
      props,
    })
    return acc
  }, {}))
    .toSorted((a, b) => a[0].localeCompare(b[0]))
    .map(([, value]) => value)
})

/** 更多菜单是全量批量操作；快捷区只是其中带外观配置的子集 */
const showMore = computed(() => {
  const batchCount = model.filter(isBatchItem).length
  const quickCount = quickGroup.value.reduce((sum, list) => sum + list.length, 0)
  return batchCount > quickCount
})

function actionKey(item: ActionsItem) {
  return String(item.key ?? item.icon ?? item.label ?? '')
}

function isItemLoading(item: ActionsItem) {
  return !!loadingMap.value[actionKey(item)] || isPending(item)
}

async function onCommand(event: Event, item: any) {
  if (item.disabled || isItemLoading(item)) {
    return
  }
  const token = actionKey(item)
  loadingMap.value[token] = true
  try {
    const result = await item.command?.({ originalEvent: event, item, data: selectedProduct.value })
    if (result !== false) {
      selectedProduct.value = []
    }
  }
  finally {
    loadingMap.value[token] = false
  }
}

function onMore(event: Event) {
  emit('more', event)
}

function onClear() {
  selectedProduct.value = []
}
</script>

<template>
  <div class="absolute bottom-3/20 left-1/2 -translate-x-1/2 flex items-center z-100 actionbar">
    <div class="flex items-center baritem">
      <i18n-t tag="div" :keypath="$t('{selected} / {total} 已选中', { selected: '{selected}', total: '{total}' })" scope="global">
        <template #selected>
          <span class="baritem-light">{{ selectedProduct?.length }}</span>
        </template>
        <template #total>
          <span class="baritem-light">{{ total }}</span>
        </template>
      </i18n-t>
      <RxSvgIcon class="cursor-pointer" name="base/rx_ic_delete" color="#FAFAFA" @click="onClear" />
    </div>
    <div v-for="(list, index) in quickGroup" :key="index" class="icons" :class="{ 'has-label': list.some(item => item.showLabel) }">
      <template v-for="item in list" :key="item.key ?? item.icon">
        <component :is="item.render" v-if="item.render" :item="item" />
        <div
          v-else
          v-tooltip.top="{ value: item.disabled ? item.disabledTooltip : '', showDelay: 500 }"
          class="icon-item"
          :class="{ disabled: item.disabled || isItemLoading(item) }"
          @click="onCommand($event, item)"
        >
          <RxSvgIcon
            class="pointer-events-none"
            :name="isItemLoading(item) ? 'base/rx_ic_progress_bar' : item.icon"
            :class="{ 'animate-spin': isItemLoading(item) }"
            color="#FAFAFA"
            v-bind="isItemLoading(item) ? {} : item.iconProps"
          />
          <span v-if="item.showLabel" class="icon-label">{{ item.label }}</span>
          <span v-if="item.discountBadge" class="discount-badge">{{ item.discountBadge }}</span>
        </div>
      </template>
    </div>
    <div>
      <slot />
    </div>
    <div v-if="showMore" class="icons cursor-pointer" @click.stop="onMore($event)">
      <RxSvgIcon name="base/rx_ic_more-v" class="pointer-events-none" color="#FAFAFA" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.actionbar {
  padding: var(--spacing-sm, 4px);
  gap: 4px;
  border-radius: 8px;
  background: var(--pattern-actionbar-bg, #111213);
  box-shadow:
    0px 3px 8px 0px rgba(0, 0, 0, 0.07),
    0px 2px 5px 0px rgba(0, 0, 0, 0.07),
    0px 1px 1px 0px rgba(0, 0, 0, 0.07);
}

.baritem,
.icons {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 5px;
  border: 1px solid var(--pattern-actionbar-btn-border, #34393d);
  background: var(--pattern-actionbar-btn, #2c2e30);
  white-space: nowrap;
}

.baritem {
  gap: 6px;
  color: var(--pattern-actionbar-text-subtle, #afb7bb);
  font-size: 13px;
  line-height: var(--Line-Height-text-xs, 16px);
  user-select: none;

  &-light {
    color: var(--pattern-actionbar-text, #fafafa);
    font-weight: 600;
  }
}

.icons {
  gap: 12px;
  color: var(--pattern-actionbar-text, #fafafa);

  &.has-label {
    padding: 0;

    .icon-item {
      padding: 8px 12px;
    }
  }
}

.icon-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--pattern-actionbar-text, #fafafa);
  font-size: 13px;
  font-weight: 600;
  line-height: 16px;
  cursor: pointer;
  user-select: none;
}

.icon-label {
  white-space: nowrap;
}

.discount-badge {
  padding: 2px 8px;
  border-radius: 9999px;
  background: #fc9d12;
  color: #fff;
  font-size: 12px;
  line-height: normal;
  white-space: nowrap;
}

.disabled {
  cursor: not-allowed;
  opacity: 0.4;
  pointer-events: none;
}
</style>
