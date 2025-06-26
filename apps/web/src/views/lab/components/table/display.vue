<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales'

const columns = defineModel<any[]>({ default: [] })

const popRef = useTemplateRef('popover')

function toggle(event: Event) {
  popRef.value?.instance?.toggle(event)
}
</script>

<template>
  <div class="relative flex">
    <RxButton severity="secondary" size="xxs" outlined icon="base/rx_ic_slider_v" :label="$t('自定义排版')" @click="toggle" />
    <RyPopover ref="popover">
      <div class="py-1.5 px-1">
        <VueDraggable v-model="columns" :animation="150" handle=".handle">
          <div v-for="item in columns" :key="item.field" class="flex items-center" :class="display.item">
            <RxSvgIcon name="base/rx_ic_dots_drag" class="cursor-grab handle" />
            <span class="flex-auto font-500">{{ item.header }}</span>
            <RxToggleSwitch v-if="!item.disabledToggle" v-model="item._visible" />
          </div>
        </VueDraggable>
      </div>
      <template v-if="$slots.footer" #footer>
        <slot name="footer"></slot>
      </template>
    </RyPopover>
  </div>
</template>

<style lang="scss" module="display">
.item {
  padding: var(--spacing-lg, 8px) var(--spacing-md, 6px);
  gap: var(--spacing-sm, 4px);
  min-width: 260px;
  color: var(--primitives-neutrals-900, #171c1f);
  font-family: Inter;
  font-size: 13px;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
