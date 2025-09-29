<script setup lang="ts">
defineProps<{
  colors: string[]
}>()

const selectedColor = defineModel()
</script>

<template>
  <div class="flex items-center gap-5">
    <template v-for="color in colors" :key="color">
      <SvgIcon v-if="color === selectedColor" name="base/rx_ic_check_line" :size="20" :color="color" />
      <div v-else class="w-5 h-5 rounded-full cursor-pointer" :style="{ backgroundColor: color }" @click="selectedColor = color" />
    </template>
  </div>
</template>

<style lang="scss" scoped></style>
