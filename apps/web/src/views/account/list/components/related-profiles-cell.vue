<script setup lang="ts">
import RelatedInfo from '/@/components/related-info.vue'

defineProps<{
  list: string[]
  showAdd?: boolean
}>()

const emit = defineEmits<{
  add: []
}>()
</script>

<template>
  <div class="related-profiles-cell">
    <RelatedInfo :list="list" :disabled="true">
      <template #empty>
        <span class="text-tertiary">--</span>
      </template>
    </RelatedInfo>
    <RxButton v-if="showAdd" v-tooltip.top="{ value: $t('选择窗口'), showDelay: 500 }" class="shrink-0 related-add-btn row-hover-action" text severity="secondary" size="xxs"
              icon="base/rx_ic_plus" @click.stop="emit('add')"
    />
  </div>
</template>

<style lang="scss" scoped>
.text-tertiary {
  color: var(--colors-text-text-tertiary);
  font-size: 12px;
}

.related-profiles-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
}

.related-add-btn {
  opacity: 0;
  transition: opacity 0.15s ease;
}
</style>
