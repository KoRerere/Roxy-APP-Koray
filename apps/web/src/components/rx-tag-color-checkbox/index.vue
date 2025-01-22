<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'

defineProps<{
  colorOptions: string[]
}>()

const selectedColor = defineModel()
</script>

<template>
  <div class="rx-tag-color-checkbox">
    <template v-for="color in colorOptions" :key="color">
      <RxSvgIcon v-if="color === selectedColor" name="base/rx_ic_check_line" :size="20" :color="color" />
      <div v-else class="rx-tag-color-checkbox-item cursor-pointer" :style="{ backgroundColor: color }"
        @click="selectedColor = color" />
    </template>
  </div>
</template>

<style lang="scss" scoped>
.rx-tag-color-checkbox {
  display: flex;
  align-items: center;
  gap: 20px;

  &-item {
    width: 20px;
    height: 20px;
    border-radius: 50%;
  }
}
</style>
