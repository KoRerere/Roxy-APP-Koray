<script setup lang="ts">
import type { MenuItem } from 'primevue/menuitem'
import { RxSvgIcon } from '/@/components/rx-icon/'

const props = defineProps({
  type: {
    type: String as PropType<'default' | 'checkbox' | 'radio'>,
    default: 'default',
  },
  // selected: {
  //   type: Array as PropType<any>,
  // },
  operation: {
    type: Array as PropType<MenuItem[]>,
    /**
     * required: true,
     */
    default: () => [],
  },
  operationHandler: {
    type: Function as PropType<(item: MenuItem) => void>,
    /**
     * required: true,
     */
    default: () => () => { },
  },
})

// const emit = defineEmits(['update:selected'])

const selected = defineModel('selected')

const ctxMenu = ref()

// const selectedCategories = computed({
//   get: () => props.selected,
//   set: (val: string[]) => {
//     console.log('🚀 ~ val:', val)
//     emit('update:selected', val)
//   },
// })

function onHide() {
}
</script>

<template>
  <ContextMenu ref="ctxMenu" :model="operation" @hide="onHide">
    <template #item="{ item, props: ctxProps }">
      <a v-ripple class="!pa-0" v-bind="ctxProps.action">
        <label v-if="type === 'checkbox'" class="cursor-pointer" :class="classes['context-item']" :for="item.value"
          @click.stop>
          <Checkbox v-model="selected" name="checkbox" :input-id="item.value" :value="item.value" @click.stop />
          <span>{{ item.label }}</span>
        </label>
        <div v-if="type === 'default'" :class="classes['context-item']" @click="operationHandler(item)">
          <RxSvgIcon v-if="item.icon" :name="item.icon" :size="16" />
          <span>{{ item.label }}</span>
        </div>
      </a>
    </template>
  </ContextMenu>
</template>

<style lang="scss" module="classes">
.context {
  &-content {
    padding: var(--spacing-md, 6px) var(--spacing-sm, 4px) !important;
  }

  &-separator {
    margin: var(--spacing-md, 6px) 0;
  }

  &-item {
    display: flex;
    align-items: center;
    padding: 8px var(--spacing-md, 6px) 8px 10px !important;
    gap: var(--spacing-md, 6px) !important;
    width: 100%;
  }
}
</style>
