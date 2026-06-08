<script setup lang="ts">
import CopyableImage from './copyable-image.vue'

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

    <CopyableImage
      :src="imageUrl"
      :alt="fileName || 'Generated image'"
      class="block max-w-[calc(90vw-140px)] max-h-[calc(90vh-140px)] object-contain rounded-xl"
    />

    <div class="h-8 rounded-1.5 bg-black/50 absolute bottom-3 right-3 px-3 flex items-center justify-center cursor-pointer gap-1.5" @click="$emit('download')">
      <SvgIcon name="base/rx_ic_download" size="16" color="#FFF" />
      <span class="text-[var(--component-button-primary-text)]">{{ $t('下载') }}</span>
    </div>
  </div>
</template>
