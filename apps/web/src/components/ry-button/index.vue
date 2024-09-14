<script setup lang="ts">
import type { ButtonProps } from 'primevue/button'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'

interface Props extends /* @vue-ignore */ ButtonProps {
  icon?: SvgNames
  onClick?: (e: MouseEvent) => Promise<void> | void
}

const props = defineProps<Props>()

const loading = defineModel('loading', { default: false })

async function handleClick(e: MouseEvent) {
  // if (loading.value) {
  //   return
  // }

  if (props.onClick) {
    loading.value = true
    try {
      await props.onClick(e)
    }
    finally {
      loading.value = false
    }
  }
}
</script>

<template>
  <Button v-bind="{ ...$attrs, ...$props, onClick: handleClick }" :loading="loading">
    <template v-if="icon || $slots.icon" #icon>
      <slot name="icon">
        <RxSvgIcon :name="icon" :size="16" />
      </slot>
    </template>
    <template #loadingicon>
      <slot name="loadingicon">
        <RxSvgIcon name="base/rx_ic_spin" class="loading-circle" :size="16" />
      </slot>
    </template>
    <template v-if="$slots.default" #default>
      <RxSvgIcon v-if="loading" class="loading-circle" name="base/rx_ic_spin" :size="16" />
      <RxSvgIcon v-if="icon" :name="icon" :size="16" />
      <slot />
    </template>
  </Button>
</template>

<style lang="scss" scoped>
</style>
