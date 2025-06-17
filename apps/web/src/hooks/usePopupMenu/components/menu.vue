<script setup lang="ts">
import Menu from 'primevue/menu'
import SelectionMenuItem from './menu-selection-item.vue'
import type { SvgNames } from '/@/components/rx-icon'
import type { MenuProps } from '../type';

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

async function onMenuCommand(event: Event, item: any) {
  await item.command?.({ originalEvent: event, item })
  menuRef.value?.hide()
}

defineExpose({
  toggle(event: Event) {
    menuRef.value?.toggle(event)
  }
})
</script>

<template>
  <Menu ref="menu" v-bind="props" :model="_model" popup :pt="{ root: menuClass.root, item: menuClass.item, list: 'overflow-y-auto max-h-80' }" @hide="_onHide">
    <template #item="{ item: { render, ...item }, props }">
      <a v-if="!mode" v-bind="props.action" class="max-w-80 !pa-0">
        <component v-if="render" :is="render" :item="item" :props="props"></component>
        <RxButton v-else class="w-full !justify-start" :disabled="(item.disabled as boolean)" :icon="(item.icon as SvgNames)" :label="(item.label as string)" severity="secondary" text
          :pt="{ root: menuClass.button }" @click.stop="onMenuCommand($event, item)" />
      </a>
      <SelectionMenuItem v-else v-ripple v-bind="props.action" v-model="_selected" :type="mode.type" :field="mode.field" :item="item" @click.stop>
        <component v-if="render" :is="render" :item="item" :props="props"></component>
      </SelectionMenuItem>
    </template>
    <template v-for="(_, name) in slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps"></slot>
    </template>
  </Menu>
</template>

<style lang="scss" module="menuClass">
.root {
  background: var(--component-dropdown-bg, #293038);
}

.item {

  &:global(.p-focus .p-menu-item-content),
  &:global(.p-menu-item:not(.p-disabled) .p-menu-item-content:hover) {
    background: var(--component-dropdown-bg-hover, #E2E9EE) !important;
  }

  &:global(.p-disabled),
  &:global(.p-component:disabled) {
    opacity: 1;
  }
}

.button {
  // font-size: 16px;

  &:not(:disabled):hover {
    background: var(--component-dropdown-bg-hover, #E2E9EE) !important;
  }

  &:disabled {
    background: transparent !important;
  }

  &:global(.p-button .p-button-label) {
    font-size: 13px;
    font-weight: 400;
  }
}
</style>