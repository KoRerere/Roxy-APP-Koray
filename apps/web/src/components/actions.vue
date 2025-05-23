<script setup lang="ts">
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'
import { type Operation, operationPower, deepClone } from '/@/utils'

interface Props {
  operation: Operation[]
  loadingOperationMap?: Record<string, boolean>
  showMenu?: boolean
  actionIcon?: SvgNames
}

const { operation, loadingOperationMap, showMenu = true, actionIcon = 'base/rx_ic_more-v' } = defineProps<Props>()

const emit = defineEmits(['quickClick', 'more'])

const _operation = computed(() => operationPower(operation))
const quickOperation = computed(() => _operation.value.filter(item => item.quick))

function quickClick(event: MouseEvent, item: Operation) {
  if (item.disabled || loadingOperationMap?.[item.name as string]) {
    return
  }
  emit('quickClick', { ...deepClone(toRaw(item)), _event: event, _type: 'quick' })
}

function onMore(event: Event) {
  emit('more', { event, operation: toRaw(_operation.value) })
}
</script>

<template>
  <div class="flex items-center">
    <div class="flex items-center gap-2 quick">
      <div class="quick-item" :class="{ 'disabled': item.disabled || loadingOperationMap?.[item.name as string] }" v-for="item in quickOperation" :key="item.name">
        <component :is="item.render" v-if="item.render" />
        <div v-else class="flex items-center" v-tooltip.top="{ value: item.disabled ? item.disabledTooltip : item.tooltip, showDelay: 500, pt: { root: '!max-w-sm' } }"
          @click.stop="quickClick($event, item)">
          <RxSvgIcon class="pointer-events-none quick-icon" :name="loadingOperationMap?.[item.name as string] ? 'base/rx_ic_progress_bar' : item.icon" :size="16"
            :class="[item.iconClass, { 'pi-spin': loadingOperationMap?.[item.name as string] }]" />
        </div>
      </div>
      <div v-tooltip.top="{ value: $t('更多操作'), showDelay: 500, pt: { text: { class: '!whitespace-nowrap !break-keep' } } }" v-if="showMenu && _operation.length" class="quick-item"
        @click.stop="onMore">
        <slot name="more-icon">
          <RxSvgIcon :name="actionIcon" class="pointer-events-none quick-icon" />
        </slot>
      </div>
    </div>
  </div>
  <!-- <RxButton v-else v-tooltip.top="{ value: item.disabled ? item.disabledTooltip : item.tooltip, showDelay: 500, pt: { root: '!max-w-sm' } }" text severity="secondary" size="xxs"
  :icon="loadingOperationMap?.[item.name as string] ? 'base/rx_ic_progress_bar' : item.icon" :loading="loadingOperationMap?.[item.name as string]" @click.stop="quickClick(item)"></RxButton> -->
</template>

<style lang="scss" scoped>
.quick-item {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease-in-out;

  &:hover:not(.disabled) {
    background-color: rgba(0, 0, 0, 0.05);
  }

  &.disabled {
    cursor: not-allowed;

    :deep(svg) {
      color: #d1d5db;
    }
  }
}

:where(.quick-icon) {
  color: var(--colors-icon-icon-secondary, #575D60);
}
</style>
