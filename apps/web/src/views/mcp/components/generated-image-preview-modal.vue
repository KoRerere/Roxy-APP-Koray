<script setup lang="ts">
defineProps<{
  imageUrl: string
  fileName?: string
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'download'): void
}>()
</script>

<template>
  <div class="relavite" @click.stop>
    <div class="size-9 rounded-full bg-black/50 absolute translate-x-100% -right-4 top-0 p-2 flex items-center justify-center cursor-pointer" type="button" @click="$emit('close')">
      <SvgIcon name="base/rx_ic_delete" size="18" color="#FFF" />
    </div>

    <img :src="imageUrl" :alt="fileName || 'Generated image'" class="preview-modal__image">

    <div class="h-8 rounded-1.5 bg-black/50 absolute bottom-3 right-3 px-3 flex items-center justify-center cursor-pointer gap-1.5" @click="$emit('download')">
      <SvgIcon name="base/rx_ic_download" size="16" color="#FFF" />
      <span class="text-[var(--component-button-primary-text)]">{{ $t('下载') }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.preview-modal__body {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  padding: 20px;
  overflow: auto;
  border-radius: 18px;
  background: var(--colors-background-bg-block);
}

.preview-modal__image {
  display: block;
  max-width: 100%;
  max-height: calc(90vh - 140px);
  object-fit: contain;
  border-radius: 12px;
}
</style>
