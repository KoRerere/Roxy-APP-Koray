<template>
  <img v-if="iconUrl" :src="iconUrl" v-bind="$attrs">
</template>

<script setup lang="ts">
import { useThemeStore } from '/@/stores/theme'

const props = defineProps<{
  platformIconDark?: string
  platformIcon?: string
}>()

const themeStore = useThemeStore()

const iconUrl = computed(() => (themeStore.realTheme === 'dark' ? props.platformIconDark : props.platformIcon) || props.platformIcon)
</script>
