<script setup lang="ts">
import type { CheckboxProps } from 'primevue/checkbox'

interface Props extends /* @vue-ignore */ Omit<CheckboxProps, 'size'> {
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | (string & {})
  iconClass?: string
}

defineOptions({ inheritAttrs: false })

const { size = 'sm', iconClass, ...props } = defineProps<Props>()

const attrs = useAttrs()
</script>

<template>
  <Checkbox v-bind="{ ...props, ...attrs }">
    <template #icon="slotProps">
      <slot name="icon" v-bind="slotProps">
        <SvgIcon v-if="slotProps.checked" :class="iconClass" name="base/rx_ic_checkmark" color="#ffffff" />
      </slot>
    </template>
  </Checkbox>
</template>

<style scoped></style>
