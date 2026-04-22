<script setup lang="ts">
defineEmits(['close'])
</script>

<template>
  <div class="w-110 inline-flex flex-col items-center gap-8 pa-6 pt-12 select-none rounded-2">
    <div class="flex flex-col gap-2 items-center">
      <div class="thanks">
        🙏
      </div>
      <div class="title">
        {{ $t('感谢支持') }}
      </div>
      <div class="desc text-center">
        {{ $t('感谢您的评分，我们会继续努力') }}
      </div>
    </div>
    <div class="w-full flex flex-col gap-3">
      <RxButton size="lg" :label="$t('关闭')" @click="$emit('close')" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.thanks {
  font-size: 58.667px;
  font-weight: 600;
  line-height: 80px;
}

.title {
  color: var(--colors-text-text-primary);
  font-size: 24px;
  font-style: normal;
  font-weight: 700;
  line-height: 36px;
}

.desc {
  color: var(--colors-text-text-placeholder);
  font-size: 13px;
  line-height: 18px;
}
</style>
