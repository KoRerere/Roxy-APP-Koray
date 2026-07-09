<script setup lang="ts">
defineProps<{
  onNext: (type: 'commerce' | 'normal') => void
  onClose: () => void
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-4">
    <div class="grid grid-cols-2 gap-2">
      <div v-for="(value, index) in ['bg-orange', 'bg-green', 'bg-blue', 'bg-purple']" :key="value" :class="value" class="w-30 h-30 rounded-3 cursor-pointer"
           @click="onNext(index % 2 === 0 ? 'commerce' : 'normal')"
      />
    </div>
    <RxButton class="shrink-0" text severity="secondary" :label="$t('先跳过，直接进入')" @click="onClose" />
  </div>
</template>

<style scoped></style>
