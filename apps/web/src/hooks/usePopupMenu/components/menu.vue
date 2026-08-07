<script setup lang="ts">
import Menu from 'primevue/menu'
import type { MenuItem } from 'primevue/menuitem'
import SelectionMenuItem from './menu-selection-item.vue'
import type { PropType } from 'vue'
import type { SvgNames } from '/@/components/rx-icon'
import { usePreventMask } from '/@/hooks/usePreventMask'

// 用「运行时」defineProps 显式声明 props。本文件用类型式 defineProps<Props>() 会静默不生成运行时 prop
// （编译器在本文件上下文下未产出 props 声明 → mode/model/menuProps 落入 $attrs → __props.x 为 undefined
//  → menuProps 解构崩溃，且 _model 拿不到 model 导致菜单空列表）。运行时对象声明不依赖类型解析，稳定注册。
// 注意：曾经的 `extends /* @vue-ignore */ Omit<MenuProps,'slots'>` 更糟——@vue-ignore 直接让 prop 不注册。
const { mode, model, menuProps = {} } = defineProps({
  mode: {
    type: Object as PropType<{ type: 'single' | 'multiple', value?: any, options: any[], field?: string, props?: Record<string, any> }>,
    required: false,
  },
  model: { type: Array as PropType<any[]>, required: false },
  menuProps: { type: Object as PropType<Record<string, any>>, required: false },
})
const slots: Record<string, any> = useSlots()
const { showPreventMask, hidePreventMask } = usePreventMask()
const menuRef = useTemplateRef('menu')
const _model = mode?.options || model
const _selected = ref(mode?.value)

const { onHide, ...otherProps } = menuProps

function _onHide() {
  onHide?.({
    type: mode!.type,
    value: toRaw(_selected.value),
  })
  hidePreventMask()
}

async function onMenuCommand(event: Event, item: any) {
  await item.command?.({ originalEvent: event, item })
  menuRef.value?.hide()
}

defineExpose({
  toggle(event: Event) {
    menuRef.value?.toggle(event)
  },
})
</script>

<template>
  <Menu ref="menu" v-bind="otherProps" :model="_model" popup :pt="{ root: menuClass.root, item: menuClass.item, list: 'overflow-y-auto max-h-80' }" @hide="_onHide" @show="showPreventMask">
    <template #item="{ item: { render, ...item }, props }">
      <a v-if="!mode" v-bind="props.action" class="max-w-80 !pa-0">
        <component :is="render" v-if="render" :item="item" :props="props" :btn-pt="{ root: menuClass.button }" @click.stop="onMenuCommand($event, item)" />
        <RxButton v-else class="w-full !justify-start" :disabled="(item.disabled as boolean)" :icon="(item.icon as SvgNames)" :label="(item.label as string)" severity="secondary" text
                  :pt="{ root: menuClass.button }" @click.stop="onMenuCommand($event, item)"
        />
      </a>
      <SelectionMenuItem v-else v-bind="props.action" v-model="_selected" v-ripple :type="mode.type" :field="mode.field" :item="item" @click.stop>
        <component :is="render" v-if="render" :item="item" :props="props" />
      </SelectionMenuItem>
    </template>
    <template v-for="(_, name) in slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps" />
    </template>
  </Menu>
</template>

<style lang="scss" module="menuClass">
.root {
  border-width: 0.5px;
  background: var(--component-dropdown-bg, #293038);
}

.item {
  &:global(.p-focus .p-menu-item-content),
  &:global(.p-menu-item:not(.p-disabled) .p-menu-item-content:hover) {
    background: var(--component-dropdown-bg-hover, #e2e9ee) !important;
  }

  &:global(.p-disabled),
  &:global(.p-component:disabled) {
    opacity: 1;
  }
}

.button {
  &:not(:disabled):hover {
    background: transparent !important;
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
