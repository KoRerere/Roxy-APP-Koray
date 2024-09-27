<script lang="ts" setup>
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'

defineOptions({
  inheritAttrs: false,
})

defineProps({
  name: String,
  icon: String as PropType<SvgNames>,
})

defineEmits(['change'])
</script>

<template>
  <Select filter show-clear option-label="label" v-bind="$attrs" :input-id="name" class="w-full"
    @change="$emit('change')">
    <template #value="{ value: option, placeholder }">
      <div v-if="option" class="select-item">
        <RxSvgIcon v-if="icon || option.icon" :name="icon || option.icon" />
        <img v-if="option.image" class="select-item-image" :src="option.image">
        <div>{{ option.label }}</div>
      </div>
      <span v-else>
        {{ placeholder }}
      </span>
    </template>
    <template #option="{ option }">
      <div class="select-item">
        <RxSvgIcon v-if="icon || option.icon" :name="icon || option.icon" />
        <img v-if="option.image" class="select-item-image" :src="option.image">
        <div>{{ option.label }}</div>
      </div>
    </template>
  </Select>
</template>

<style lang="scss" scoped>
.select-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs, 4px);

  &-image {
    width: 16px;
    height: 16px;
    aspect-ratio: 1;
  }
}
</style>
