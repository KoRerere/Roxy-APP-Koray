<script lang="ts" setup>
import type { CSSProperties } from 'vue'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'
import { hexToRgba } from '/@/utils'

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
  closable: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['close'])

const visibleModel = defineModel('visible', { default: true })

const iconMap: Record<string, [string, SvgNames]> = {
  success: ['#52c41a', 'status/rx_ic_check_fill'],
  info: ['#7C8387', 'base/rx_ic_info_fill'],
  warning: ['#faad14', 'base/rx_ic_info_fill'],
  error: ['#ff4d4f', 'base/rx_ic_delete_fill'],
}

const styles = computed<CSSProperties>(() => {
  return {
    backgroundColor: {
      success: '#ebfcf0',
      info: '#f0f5ff',
      warning: '#fffbe6',
      error: '#fff1f0',
    }[props.type],
    border: `1px solid ${hexToRgba(iconMap[props.type][0], 0.3)}`,
  }
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
  <div class="rx-alert" :class="{ hide: !visibleModel }">
    <slot name="tips-icon">
      <RxSvgIcon v-bind="iconProps" />
    </slot>
    <div class="rx-alert-body">
      <div class="rx-alert__title">
        <slot name="title">
          {{ title }}
        </slot>
      </div>
      <div class="rx-alert__content">
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
</template>

<style lang="scss" scoped>
:where(.rx-alert) {
  display: flex;
  padding: var(--spacing-xl, 12px);
  align-items: flex-start;
  gap: 10px;
  align-self: stretch;
  border-radius: var(--radius-md, 6px);
  background: v-bind('styles.backgroundColor');
  border: v-bind('styles.border');
  transition: all 0.2s;

  &.hide {
    height: 0;
    padding: 0;
    border: none;
    overflow: hidden;
  }

  .rx-alert-body {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    align-self: stretch;

    .rx-alert__title {
      color: var(--Colors-Text-text-primary, #171c1f);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 600;
      line-height: normal;
    }

    .rx-alert__content {
      color: var(--Colors-Text-text-secondary, #575d61);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 400;
      line-height: 18px; /* 150% */
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
