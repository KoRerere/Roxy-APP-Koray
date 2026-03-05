<script setup lang="ts">
defineEmits(['close'])

const value = ref(0)
</script>

<template>
  <div class="w-100 inline-flex flex-col items-center pa-6 pt-4 gap-4">
    <div class="flex flex-col gap-1 items-center">
      <div>{{ $t('您对我们的体验满意吗？') }}</div>
      <div>{{ $t('请为我们的服务打分') }}</div>
    </div>

    <Rating v-model="value" :pt="{ root: '!gap-2.5', officon: '!w-8 !h-8', onicon: '!w-8 !h-8' }" />

    <div class="w-full flex flex-col gap-2">
      <RxButton size="lg" :label="$t('提交评分')"></RxButton>
      <RxButton size="lg" variant="outlined" severity="secondary" :label="$t('稍后再说')" @click="$emit('close')"></RxButton>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
