<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'

const props = defineProps({
  type: {
    type: String as PropType<'default' | 'checkbox' | 'radio'>,
    default: 'default',
  },
  operation: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
  operationHandler: {
    type: Function as PropType<(item: MenuItem) => void>,
    default: () => () => { },
  },
  selected: {
    type: Array as PropType<any>,
    default: undefined,
  },
  onHide: {
    type: Function as PropType<(select: any) => void>,
    default: () => () => { },
  },
  onChange: {
    type: Function as PropType<(select: any) => void>,
    default: () => () => { },
  },
})

const selected = ref(props.selected)

const ctxMenu = ref()

function onHide() {
  props.onHide?.(toRaw(selected.value))
  selected.value = undefined
}

function onChange() {
  props.onChange?.(toRaw(selected.value))
}
</script>

<template>
  <ContextMenu ref="ctxMenu" :model="operation" @before-hide="onHide">
    <template #item="{ item, props: ctxProps }">
      <a v-ripple class="!pa-0" v-bind="ctxProps.action">
        <label v-if="type === 'radio'" class="cursor-pointer" :class="menu.item" :for="item.value" @click.stop>
          <RadioButton v-model="selected" name="radio" :input-id="item.value" :value="item.value" @click.stop @change="onChange" />
          <span>{{ item.label }}</span>
        </label>

        <label v-if="type === 'checkbox'" class="cursor-pointer" :class="menu.item" :for="item.value" @click.stop>
          <RxCheckbox v-model="selected" name="checkbox" :input-id="item.value" :value="item.value" @click.stop />
          <span>{{ item.label }}</span>
        </label>

        <div v-if="type === 'default'" :class="menu.item" @click="operationHandler(item)">
          <RxSvgIcon v-if="item.icon" :class="item.iconClass" :name="(item.icon as SvgNames)" />
          <span class="flex-1">{{ item.label }}</span>
          <RxSvgIcon v-if="item.items" :class="item.iconClass" name="base/rx_ic_chevron_right" />
        </div>
      </a>
    </template>
  </ContextMenu>
</template>

<style lang="scss" module="menu">
.item {
  display: flex;
  align-items: center;
  padding: 8px var(--spacing-md, 6px) 8px 10px !important;
  gap: var(--spacing-md, 6px) !important;
  width: 100%;
  font-size: 13px;
}
</style>
