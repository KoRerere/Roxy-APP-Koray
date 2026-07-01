<script setup lang="ts">
defineProps<{
  list: string[]
  showAdd?: boolean
}>()

const emit = defineEmits<{
  add: []
}>()
</script>

<template>
  <div class="flex items-center gap-1.5 min-h-6">
    <RelatedInfo :list="list" disabled>
      <template #empty>
        <span class="row-hover-empty">--</span>
      </template>
    </RelatedInfo>
    <RxButton v-if="showAdd" v-tooltip.top="{ value: $t('选择窗口'), showDelay: 500 }" class="shrink-0 row-hover-action" text severity="secondary" size="xxs" icon="base/rx_ic_plus"
              @click.stop="emit('add')"
    />
  </div>
</template>

<style lang="scss" scoped>
.row-hover-action {
  opacity: 0;
  // transition: opacity 0.15s ease;
}
</style>
