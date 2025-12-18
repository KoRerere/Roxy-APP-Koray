<script setup lang="ts">
const { autoplay = true } = defineProps<{
  video: string
  external?: string
  autoplay?: boolean
}>()

defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <div class="relative max-w-80vw flex flex-col items-center gap-4 bg-transparent">
    <div class="absolute top-4 right-4 flex items-center pa-1.5 rounded-full z-1 cursor-pointer bg-black bg-opacity-20 hover:bg-opacity-35 transition-all duration-300" @click.stop="$emit('close')">
      <SvgIcon class="text-white" name="base/rx_ic_delete" />
    </div>
    <roxy-video-player fullscreen :src="video" :autoplay="autoplay" />
    <a v-if="external" class="self-end" :href="external" target="_blank">
      <RxButton severity="secondary" variant="outlined" size="lg" icon="base/rx_ic_outlink" :label="$t('Youtube 观看')" />
    </a>
  </div>
</template>

<style lang="scss" scoped></style>
