<script setup lang="ts">
import ShopSimple from './shop/simple.vue'

defineOptions({ inheritAttrs: false })

const { data, isBatch, createCount, onConfirm } = defineProps<{
  data?: any
  isBatch?: boolean
  /** 批量勾选时的目标窗口数；ShopSimple 用于关联数量提示 */
  createCount?: number
  onConfirm: (data: any) => void | Promise<void>
}>()

const attrs = useAttrs()
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <ShopSimple v-bind="attrs" :data="data" :is-batch="isBatch" :create-count="createCount" @confirm="onConfirm" />
  </div>
</template>

<style lang="scss" scoped>
.mark {
  font-size: 12px;
  color: #ffffff;
  background-color: var(--colors-background-bg-error);
}
</style>
