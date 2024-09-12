<script lang="ts" setup>
import { RxSvgIcon } from '/@/components/rx-icon/'

const props = defineProps({
  type: {
    type: String as PropType<'success' | 'info' | 'warning' | 'error'>,
    default: 'success',
  },
  title: {
    type: String,
    default: '',
  },
  content: {
    type: String,
    default: '',
  },
})

const iconMap = {
  success: 'success',
  info: 'info',
  warning: 'warning',
  error: 'error',
}

</script>

<template>
  <div class="rx-alert">
    <RxSvgIcon></RxSvgIcon>
    <div class="rx-alert-body">
      <div class="rx-alert__title">
       <slot name="title">{{ title }}</slot>
      </div>
      <div class="rx-alert__content">
        <slot name="content">{{ content }}</slot>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.rx-alert {
  display: flex;
padding: var(--spacing-xl, 12px);
flex-direction: column;
align-items: flex-start;
gap: 10px;
align-self: stretch;
border-radius: var(--radius-md, 6px);
background: var(--Color-green-100, #EBFCF0);
}

.rx-alert-body {
  display: flex;
justify-content: space-between;
align-items: flex-start;
align-self: stretch;
}
</style>