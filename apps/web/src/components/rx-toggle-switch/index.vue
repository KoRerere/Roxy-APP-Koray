<script setup lang="ts">
import type { ToggleSwitchProps } from 'primevue/toggleswitch'

interface Props extends /* @vue-ignore */ ToggleSwitchProps {
  label?: string
}

defineOptions({
  inheritAttrs: false,
})

defineProps<Props>()
</script>

<template>
  <div class="flex gap-2">
    <ToggleSwitch v-bind="$attrs" />
    <div v-if="label">
      {{ label }}
    </div>
  </div>
</template>

<style scoped></style>
