<script lang="ts" setup>
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'

interface Props {
  type?: 'success' | 'info' | 'warn' | 'error'
  title?: string
  content?: string
  closable?: boolean
  announcement?: boolean
}

const { type = 'success', announcement = false, closable = true } = defineProps<Props>()

const emit = defineEmits(['close'])

const visibleModel = defineModel('visible', { default: true })

const iconMap: Record<string, [string, SvgNames]> = {
  success: ['var(--colors-icon-icon-success)', 'status/rx_ic_check_fill'],
  error: ['var(--colors-icon-icon-error)', 'base/rx_ic_delete_fill'],
  info: ['var(--colors-icon-icon-info)', 'base/rx_ic_info_fill'],
  warn: ['var(--colors-icon-icon-warning)', 'base/rx_ic_warn_fill'],
}

const colorType = computed(() => {
  const [titleColor, borderColor, bgColor] = {
    success: ['var(--component-alert-announcement-text-success)', 'var(--component-alert-announcement-border-success)', 'var(--component-alert-bg-success)'],
    error: ['var(--component-alert-announcement-text-error)', 'var(--component-alert-announcement-border-error)', 'var(--component-alert-bg-error)'],
    info: ['var(--component-alert-announcement-text-info)', 'var(--component-alert-announcement-border-info)', 'var(--component-alert-bg-info)'],
    warn: ['var(--component-alert-announcement-text-warning)', 'var(--component-alert-announcement-border-warning)', 'var(--component-alert-bg-warn)'],
  }
  [type]
  return {
    titleColor: announcement ? titleColor : 'var(--colors-text-text-primary)',
    borderColor: announcement ? borderColor : bgColor,
    bgColor
  }
})

const alignItems = computed(() => announcement ? 'center' : 'flex-start')
const titleColor = computed(() => colorType.value.titleColor)
const borderColor = computed(() => colorType.value.borderColor)
const bgColor = computed(() => colorType.value.bgColor)

const iconProps = computed(() => {
  const [color, name] = iconMap[type]
  return { color, name }
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
  padding: 10px 12px;
  align-items: v-bind(alignItems);
  gap: 10px;
  border-radius: 6px;
  background: v-bind(bgColor);
  overflow: hidden;
  transition: height 0.2s;
  border-width: 1px;
  border-style: solid;
  border-color: v-bind(borderColor);

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
      color: v-bind(titleColor);
      font-family: Inter;
      font-size: 12px;
      font-weight: 600;
      line-height: normal;
    }

    .rx-alert__content {
      width: 100%;
      color: var(--colors-text-text-secondary);
      font-family: Inter;
      font-size: 12px;
      line-height: 18px;
    }
  }

  .rx-alert-close {
    width: 16px;
    height: 16px;
    cursor: pointer;
    color: var(--colors-icon-icon-tertiary);
    transition: color 0.2s;

    &:hover {
      color: var(--colors-icon-icon-tertiary-hover);
    }
  }
}
</style>
