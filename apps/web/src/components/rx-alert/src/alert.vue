<script lang="ts" setup>
import type { CSSProperties } from 'vue'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'
// import { hexToRgba } from '/@/utils'

const props = defineProps({
  type: {
    type: String as PropType<'success' | 'info' | 'warn' | 'error'>,
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
  closable: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['close'])

const visibleModel = defineModel('visible', { default: true })



const iconMap: Record<string, [string, SvgNames]> = {
  success: ['var(--colors-icon-icon-success, #1DC94D)', 'status/rx_ic_check_fill'],
  error: ['var(--colors-icon-icon-error, #F53838)', 'base/rx_ic_delete_fill'],
  info: ['var(--colors-icon-icon-info, #12A3FC)', 'base/rx_ic_info_fill'],
  warn: ['var(--colors-icon-icon-warn, #FC9D12)', 'base/rx_ic_warn_fill'],
}

const bgColor = computed(() => {
  return {
    success: 'var(--component-alert-bg-success, #CEF8D4)',
    error: 'var(--component-alert-bg-error, #FDD6D3)',
    info: 'var(--colors-background-bg-info, #DEF3FF)',
    warn: 'var(--component-alert-bg-warn, #FEEAC7)',
  }[props.type]
})

const iconProps = computed(() => {
  const [color, name] = iconMap[props.type]
  return {
    color,
    name,
  }
})

function handleClose() {
  visibleModel.value = false
  emit('close')
}
</script>

<template>
  <Transition>
    <div v-if="visibleModel" class="rx-alert" v-bind="$attrs">
      <slot name="tips-icon">
        <RxSvgIcon v-bind="iconProps" />
      </slot>
      <div class="rx-alert-body">
        <div v-if="title || $slots.title" class="rx-alert__title">
          <slot name="title">
            {{ title }}
          </slot>
        </div>
        <div v-if="content || $slots.content" class="rx-alert__content">
          <slot name="content">
            {{ content }}
          </slot>
        </div>
      </div>
      <div v-if="closable" class="rx-alert-close" @click="handleClose">
        <slot name="close-icon">
          <RxSvgIcon name="base/rx_ic_delete" />
        </slot>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.v-enter-active,
.v-leave-active {
  transition: opacity 0.5s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}

:where(.rx-alert) {
  display: flex;
  width: 360px;
  padding: var(--spacing-xl, 12px);
  align-items: flex-start;
  gap: 10px;
  border-radius: var(--radius-md, 6px);
  background: v-bind(bgColor);
  overflow: hidden;
  transition: height 0.2s;

  &.hide {
    height: 0 !important;
    padding: 0 !important;
    border: none !important;
  }

  .rx-alert-body {
    flex: auto;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    align-self: stretch;

    .rx-alert__title {
      width: 100%;
      color: var(--colors-text-text-primary, #111213);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 600;
      line-height: normal;
    }

    .rx-alert__content {
      width: 100%;
      color: var(--colors-text-text-secondary, #34393D);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 400;
      line-height: 18px;
      /* 150% */
    }
  }

  .rx-alert-close {
    width: 16px;
    height: 16px;
    cursor: pointer;
    color: rgba(0, 0, 0, 0.45);
    transition: color 0.2s;

    &:hover {
      color: rgba(0, 0, 0, 0.88);
    }
  }
}
</style>
