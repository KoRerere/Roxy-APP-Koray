<script setup lang="ts">
import Menu from 'primevue/menu'
import type { MenuProps } from '../type';

import normalMenuItem from './menu-item.vue'
import selectionMenuItem from './menu-selection-item.vue'

interface Props extends Omit<MenuProps, 'slots'> { }

const slots: Record<string, any> = useSlots()

const { mode, model, menuProps = {} } = defineProps<Props>()
const menuRef = useTemplateRef('menu')

const _model = mode?.options || model
const _selected = ref(mode?.value)

const { onHide, ...props } = menuProps

function _onHide() {
  onHide?.({
    type: mode!.type,
    value: toRaw(_selected.value),
  })
}

defineExpose({
  toggle(event: Event) {
    menuRef.value?.toggle(event)
  }
})
</script>

<template>
  <Menu ref="menu" v-bind="props" :model="_model" popup :pt="{ list: '!py-1.5 !px-1 overflow-y-auto max-h-80' }" @hide="_onHide">
    <template #item="{ item: { render, ...item }, props }">
      <normalMenuItem v-if="!mode" v-ripple v-bind="props.action" :item="item">
        <component v-if="render" :is="render" :item="item" :props="props"></component>
      </normalMenuItem>
      <selectionMenuItem v-else v-ripple v-bind="props.action" v-model="_selected" :type="mode.type" :field="mode.field" :item="item" @click.stop>
        <component v-if="render" :is="render" :item="item" :props="props"></component>
      </selectionMenuItem>
    </template>
    <template v-for="(_, name) in slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps"></slot>
    </template>
  </Menu>
</template>

<style scoped lang="scss"></style>