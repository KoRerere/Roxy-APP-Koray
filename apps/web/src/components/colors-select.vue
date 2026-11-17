<script setup lang="ts">
defineProps<{
  colors: string[]
}>()

const selectedColor = defineModel()
</script>

<template>
  <div class="flex items-center gap-5" role="radiogroup">
    <button v-for="color in colors" :key="color" type="button" role="radio" :aria-label="color" :aria-checked="color === selectedColor" class="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 p-0" :style="{ backgroundColor: color === selectedColor ? 'transparent' : color }" @click="selectedColor = color">
      <SvgIcon v-if="color === selectedColor" name="base/rx_ic_check_line" :size="20" :color="color" />
    </button>
  </div>
</template>

<style lang="scss" scoped></style>
