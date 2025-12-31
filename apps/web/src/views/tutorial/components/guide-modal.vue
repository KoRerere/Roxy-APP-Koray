<script setup lang="ts">
import { isString } from 'es-toolkit';
;
import type { JSX } from 'vue/jsx-runtime'

const { desc } = defineProps<{
  title: string
  desc: string | ((props: { class: string }) => JSX.Element)
  video?: string
  image?: string
}>()

defineEmits(['close', 'confirm'])

const cssModule = useCssModule('guide')

const descriptions = computed(() => isString(desc) ? () => h('div', { class: cssModule.text }, desc) : desc)

</script>

<template>
  <div class="w-120 inline-flex flex-col pa-6 pt-4 gap-4">
    <div class="flex justify-between items-center">
      <span class="header">{{ title }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="$emit('close')" />
    </div>
    <video v-if="video" class="block w-full rounded-md" autoplay muted loop playsinline>
      <source :src="video" type="video/webm" />
    </video>
    <img v-if="image" class="block w-full rounded-md" :src="image">
    <div class="flex flex-col gap-6">
      <component :is="descriptions" :class="guide.text" />
    </div>
    <RxButton class="self-end" size="md" :label="$t('了解')" @click="$emit('confirm')" />
  </div>
</template>

<style module="guide">
.text {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: 21px;
}
</style>

<style lang="scss" scoped>
.header {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}
</style>
