<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales'

const sortColumns: any[] = defineModel('columns')

const popRef = ref()

function toggle(event: Event) {
  popRef.value.getRef().toggle(event)
}
</script>

<template>
  <RxButton severity="secondary" size="sm" outlined icon="base/rx_ic_slider_v" :label="$t('Display')" @click="toggle" />
  <ryPopover ref="popRef">
    <div :class="display.content">
      <VueDraggable v-model="sortColumns" :animation="150" handle=".handle">
        <div v-for="item in sortColumns" :key="item.key" class="flex items-center" :class="display.column">
          <RxSvgIcon name="base/rx_ic_dots" class="cursor-grab handle" />
          <span class="flex-auto">{{ item.title }}</span>
          <rxToggleSwitch v-if="!item.disabledToggle" v-model="item._visible" />
        </div>
      </VueDraggable>
    </div>
    <template #footer>
      <slot name="footer" />
    </template>
  </ryPopover>
</template>

<style lang="scss" module="display">
.content {
  padding: var(--spacing-md, 6px) var(--spacing-sm, 4px);
}

.column {
  padding: var(--spacing-lg, 8px) var(--spacing-md, 6px);
  gap: var(--spacing-sm, 4px);
  min-width: 260px;
  color: var(--Color-neutrals-900, #171c1f);
  font-family: Inter;
  font-size: 13px;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
