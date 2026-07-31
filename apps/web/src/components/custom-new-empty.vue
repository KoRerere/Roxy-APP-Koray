<script setup lang="ts">
import { useThemeStore } from '/@/stores/theme'
import type { SvgNames } from './rx-icon/src/svg-icon-types'

interface Props {
  icon?: SvgNames
  title?: string
  desc?: string
  img?: string
}

const { img } = defineProps<Props>()

const themeStore = useThemeStore()

const imageSrc = computed(() => {
  return new URL(`../assets/icons/${themeStore.realTheme === 'light' ? 'empty' : 'empty-dark'}/${img}`, import.meta.url).href
})
</script>

<template>
  <div class="w-full flex justify-center items-center text-left">
    <div class="flex items-center w-192 h-95.5 pl-8 gap-8 rounded-xl overflow-hidden select-none content">
      <div class="flex flex-col w-83.5 gap-4">
        <slot name="icon">
          <SvgIcon v-if="icon" :name="icon" size="24" color="var(--colors-icon-icon-primary)" />
        </slot>
        <div v-if="title" class="title">
          {{ title }}
        </div>
        <div v-if="desc" class="desc">
          {{ desc }}
        </div>
        <slot name="extra" />
      </div>
      <div class="h-full flex-1 pt-11 overflow-hidden">
        <slot name="img">
          <img v-if="img" class="pointer-events-none h-87.5" :src="imageSrc">
        </slot>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.content {
  border: 1px solid var(--colors-border-border-inactive);
  background:
    linear-gradient(216deg, var(--pattern-empty-bg-start) -47.04%, var(--pattern-empty-bg-end) 28.15%),
    var(--colors-background-bg-page, #05101a);
  box-shadow:
    0 4px 4px -1px rgba(0, 0, 0, 0.02),
    0 1px 1px 0 rgba(0, 0, 0, 0.06);
}

.title {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.desc {
  color: var(--colors-text-text-tertiary);
  font-size: 14px;
  line-height: 21px;
}
</style>
