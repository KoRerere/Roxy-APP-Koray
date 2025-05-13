<script setup lang="ts">
import { isObject } from '/@/utils';
import type { ActionsItem } from './type'

const { model, total } = defineProps<{
  total: number
  model: ActionsItem[]
}>()

const emit = defineEmits(['more'])

const selectedProduct = defineModel<any[]>('selection')

const quickGourp = computed(() => {
  return Object.entries(model.reduce((acc, { multiple, ...item }) => {
    if (!multiple || !isObject(multiple) || item.onlyQuick) return acc
    const { name = 'default', render, ...props } = multiple
    acc[name] ??= []
    acc[name].push({
      ...item,
      render,
      props: {
        disabled: item.disabled,
        ...props,
      },
    })
    return acc
  }, {}))
    .toSorted((a, b) => a[0].localeCompare(b[0]))
    .map(([_, value]) => value)
})

const showMore = computed(() => quickGourp.value.length < model.length)

async function onCommand(event: Event, item: any) {
  const result = await item.command?.({ originalEvent: event, item, data: selectedProduct })
  // 如果返回 false 代表中断，不清空选择项
  if (result !== false) {
    selectedProduct.value = []
  }
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
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" color="#FAFAFA" @click="selectedProduct = []" />
    </div>
    <div v-for="(list, index) in quickGourp" :key="index" class="flex items-center icons">
      <template v-for="{ render, ...item } in list" :key="item.key ?? item.icon">
        <component v-if="render" :is="render" :item="item"></component>
        <RxButton v-else text severity="secondary" :icon="item.icon" v-bind="item.props" @click="onCommand($event, item)"></RxButton>
      </template>
    </div>
    <div class="icons">
      <RxButton v-if="showMore" text severity="secondary" icon="base/rx_ic_more-v" @click.stop="emit('more', $event)"></RxButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.actionbar {
  padding: var(--spacing-sm, 4px);
  gap: 4px;
  border-radius: 8px;
  background: var(--Business-ActionBar-bg, #111213);
  box-shadow: 0px 3px 8px 0px rgba(0, 0, 0, 0.07), 0px 2px 5px 0px rgba(0, 0, 0, 0.07), 0px 1px 1px 0px rgba(0, 0, 0, 0.07);
}

.baritem {
  padding: var(--spacing-lg, 8px) var(--spacing-xl, 12px);
  gap: 6px;
  border-radius: 5px;
  border: 1px solid var(--Business-ActionBar-btn-border, #34393D);
  background: var(--Business-ActionBar-btn, #2C2E30);

  color: var(--Business-ActionBar-text-subtle, #AFB7BB);
  font-size: 13px;
  line-height: var(--Line-Height-text-xs, 16px);
  user-select: none;

  &-light {
    color: var(--Business-ActionBar-text, #FAFAFA);
    font-weight: 600;
  }
}

.icons {
  border-radius: 5px;
  border: 1px solid var(--Business-ActionBar-btn-border, #34393D);
  background: var(--Business-ActionBar-btn, #2C2E30);

  :deep(.p-button-text.p-button-secondary) {
    color: var(--Business-ActionBar-text, #FAFAFA);

    svg {
      color: var(--Business-ActionBar-text, #FAFAFA);
    }
  }
}

.disabled {
  cursor: not-allowed;
}
</style>
