<script setup lang="ts">
import { useThemeStore } from '/@/stores/theme'

interface Props {
  title?: string
  icon?: string
  desc?: string
}

const props = defineProps<Props>()

const themeStore = useThemeStore()

const imgSrc = computed(() => {
  return new URL(`../assets/images/${themeStore.realTheme === 'light' ? 'empty' : 'empty-dark'}/${props.icon}`, import.meta.url).href
})
</script>

<template>
  <div v-bind="$attrs" class="flex justify-center items-center w-full">
    <div class="empty-content">
      <img v-if="icon" class="empty-img" :src="imgSrc">
      <div class="empty-info" :class="[icon ? 'pl-5' : '']">
        <div v-if="title" class="empty-info-title">
          {{ title }}
        </div>
        <slot name="desc">
          <div v-if="desc" class="empty-info-desc">
            <div v-html="desc" />
          </div>
        </slot>
        <slot name="extra" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.empty-content {
  display: inline-flex;
  flex-direction: column;
  gap: var(--spacing-xl, 12px);
  max-width: var(--width-xs, 384px);
  user-select: none;
  -webkit-user-drag: none;
}

.empty-img {
  width: 90px;
  height: 90px;
  user-select: none;
  -webkit-user-drag: none;
}

.empty-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xl, 12px);
  align-self: stretch;
  text-align: left;

  &-title {
    color: var(--colors-text-text-secondary);
    font-family: Inter;
    font-size: 16px;
    font-weight: bold;
    line-height: normal;
  }

  &-desc {
    color: var(--colors-text-text-tertiary);
    font-family: Inter;
    font-size: 12px;
    line-height: 20px;
  }
}
</style>
