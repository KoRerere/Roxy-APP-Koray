<script setup lang="ts">
import type { CheckboxProps } from 'primevue/checkbox'

interface Props extends Omit<CheckboxProps, 'size'> {
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | (string & {})
}

defineOptions({ inheritAttrs: false })

const { size = 'sm', ...props } = defineProps<Props>()

const attrs = useAttrs()
</script>

<template>
  <Checkbox v-bind="{ ...props, ...attrs }">
    <template #icon="slotProps">
      <slot name="icon" v-bind="slotProps">
        <SvgIcon v-if="slotProps.checked" :class="slotProps.class" name="base/rx_ic_checkmark" color="#ffffff" />
      </slot>
    </template>
  </Checkbox>
</template>

<style scoped></style>
