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
  <Button v-bind="{ ...$attrs, ...$props, onClick: handleClick }" class="w-full" :loading="loading">
    <template #icon>
      <slot name="icon">
        <RxSvgIcon v-if="icon" :name="icon" :size="16" />
      </slot>
    </template>
    <template v-if="loading" #loadingicon>
      <slot name="loadingicon">
        <RxSvgIcon name="base/rx_ic_spin" class="icon-spin" :size="16" />
      </slot>
    </template>
    <template v-if="$slots.default" #default>
      <RxSvgIcon v-if="loading" class="icon-spin" name="base/rx_ic_spin" :size="16" />
      <slot />
    </template>
  </Button>
</template>

<style lang="scss" scoped>
.icon-spin {
  display: inline-block;
  animation: loadingCircle 1s infinite linear;
}

@keyframes loadingCircle {
  100% {
    transform: rotate(360deg);
  }
}
</style>
