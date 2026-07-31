<script setup lang="ts">
import { useProfileEntityLabels } from '/@/composables/useProfileEntityLabels'

const props = defineProps<{
  list: string[]
  showAdd?: boolean
  /** 添加关联项按钮的 tooltip，默认按 workspace 模式为「选择窗口/账号」 */
  addTooltip?: string
}>()

const emit = defineEmits<{
  add: []
}>()

const profileLabels = useProfileEntityLabels()
const resolvedAddTooltip = computed(() => props.addTooltip ?? profileLabels.value.selectEntityTooltip)
</script>

<template>
  <div class="flex items-center gap-1.5 min-h-6">
    <RelatedInfo :list="list" disabled>
      <template #empty>
        <span class="row-hover-empty">--</span>
      </template>
    </RelatedInfo>
    <RxButton v-if="showAdd" v-tooltip.top="{ value: resolvedAddTooltip, showDelay: 500 }" class="shrink-0 row-hover-action" text severity="secondary" size="xxs" icon="base/rx_ic_plus"
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
