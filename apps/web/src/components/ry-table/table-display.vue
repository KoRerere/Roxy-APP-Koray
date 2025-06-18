<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales'
import { getSortIcon, type SortOrderNumber } from '/@/utils'
const sortColumns: any[] = defineModel('columns')

const sortField = defineModel('sortField')
const sortOrder = defineModel('sortOrder')

const popRef = ref()

function toggle(event: Event) {
  popRef.value.getRef().toggle(event)
}
</script>

<template>
  <slot name="before"></slot>
  <div class="position-relative flex">
    <RxButton severity="secondary" size="xxs" outlined icon="base/rx_ic_slider_v" :label="$t('自定义排版')"
      @click="toggle" />
    <!-- <div class="changed" /> -->
  </div>
  <RyPopover ref="popRef">
    <div :class="display.content">
      <VueDraggable v-model="sortColumns" :animation="150" handle=".handle">
        <div v-for="item in sortColumns" :key="item.key" class="flex items-center" :class="display.column">
          <RxSvgIcon name="base/rx_ic_dots" class="cursor-grab handle" />
          <span class="flex-auto" :class="display.label">
            {{ item.title }}
            <RxSvgIcon v-if="sortField === item.key" :name="getSortIcon(sortOrder as SortOrderNumber)" size="12px"
              color="var(--colors-icon-icon-note)" />
          </span>
          <rxToggleSwitch v-if="!item.disabledToggle" v-model="item._visible" />
        </div>
      </VueDraggable>
    </div>
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </RyPopover>
</template>

<style lang="scss" module="display">
.content {
  padding: 6px 4px;
}

.label {
  font-weight: 500;
}

.column {
  padding: 8px 6px;
  gap: 4px;
  min-width: 260px;
  color: var(--colors-text-text-primary);
  font-family: Inter;
  font-size: 13px;
  line-height: var(--Line-Height-text-xs, 16px);
}

.changed {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #12a3fc;
}
</style>
