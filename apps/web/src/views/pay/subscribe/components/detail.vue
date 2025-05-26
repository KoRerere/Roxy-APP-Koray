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
  <div class="flex flex-col gap-3 pa-4 rounded-md subscribe">
    <slot name="before" />
    <template v-for="(detail, index) in list" :key="detail.title">
      <div v-if="index > 0" class="w-full border-0 border-b border-dashed border-[var(--colors-border-border-base)]" />
      <div v-if="detail.title" class="subscribe-title">
        {{ detail.title }}
      </div>
      <template v-for="item in detail.items" :key="item.label">
        <div v-if="item.separator"
          class="w-full border-0 border-b border-dashed border-[var(--colors-border-border-base)]" />
        <component :is="item.render" v-else-if="item.render" class="subscribe-value" />
        <slot v-else :name="item.slot" :item="item">
          <div class="flex justify-between subscribe-value" :class="item.class">
            <div>{{ item.label }}</div>
            <div>{{ item.value }}</div>
          </div>
        </slot>
      </template>
    </template>
    <slot name="after" />
  </div>
</template>

<style scoped lang="scss">
.subscribe {
  border: 1px solid var(--colors-border-border-base, #48555b);
  background: var(--pattern-pay-plan-bg-bill, #293038);

  &-title {
    color: var(--colors-text-text-primary, #fafafa);
    font-family: Inter;
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
  }

  &-value {
    color: var(--colors-text-text-secondary, #b2b6b8);
    font-family: Inter;
    font-size: 14px;
    line-height: 20px;
  }
}
</style>
