<script setup lang="ts">
import type { ActionsItem } from './type'

const { model, data } = defineProps<{
  model: ActionsItem[]
  data?: any
}>()
defineEmits(['more'])

const quickActions = computed(() => model.filter(item => item.quick && item.icon && !item.onlyMultiple))
</script>

<template>
  <div class="flex items-center gap-1">
    <RxButton v-for="item of quickActions" :key="item.key ?? item.icon" :icon="item.icon" :disabled="item.disabled" text size="xxs" severity="secondary"
      @click="item.command?.({ originalEvent: $event, item, data })" />
    <RxButton text size="xxs" severity="secondary" icon="base/rx_ic_more-v" @click="$emit('more', $event)" />
  </div>
</template>

<style lang="scss" scoped></style>
