<script setup lang="ts">
interface Data {
  title?: string
  items: {
    label?: string
    value?: number | string
    class?: string
    separator?: boolean
    slot?: string
    render?: () => any
    [key: string]: any
  }[]
}

const { list } = defineProps<{
  list: Data[]
}>()
</script>

<template>
  <div class="flex flex-col gap-3 pa-4 rounded-md" :class="$style.subscribe">
    <slot name="before" />
    <template v-for="(detail, index) in list" :key="detail.title">
      <RxDivider v-if="index > 0" line-style="dashed" line-only line-color="var(--colors-border-divider-dashed)" />
      <slot :name="detail.title" :class="$style.title">
        <div v-if="detail.title" :class="$style.title">
          {{ detail.title }}
        </div>
      </slot>
      <template v-for="item in detail.items" :key="item.label">
        <div v-if="item.separator" class="w-full border-0 border-b border-dashed border-[var(--colors-border-divider-dashed)]" />
        <component :is="item.render" v-else-if="item.render" :class="$style.value" />
        <slot v-else :name="item.slot" :item="item">
          <div class="flex justify-between" :class="[$style.value, item.class]">
            <div>{{ item.label }}</div>
            <div>{{ item.value }}</div>
          </div>
        </slot>
      </template>
    </template>
    <slot name="after" />
  </div>
</template>

<style lang="scss" module>
.subscribe {
  border: 1px solid var(--colors-border-border-overlay);
  background: var(--pattern-pay-plan-bg-bill);
}

.title {
  color: var(--colors-text-text-primary);
  font-family: Inter;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.value {
  color: var(--colors-text-text-secondary);
  font-family: Inter;
  font-size: 14px;
  line-height: 20px;
}
</style>
