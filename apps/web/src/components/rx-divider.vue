<script setup lang="ts">
import { $t } from '/@/locales'

interface Props {
  vertical?: boolean
  lineOnly?: boolean
  text?: string
  color?: string
  lineWidth?: number | string
  lineStyle?: 'solid' | 'dashed'
  lineColor?: string
}

const {
  lineOnly = false,
  vertical = false,
  text = $t('或'),
  color = 'var(--colors-text-text-primary)',
  lineWidth = 1,
  lineStyle = 'solid',
  lineColor = 'var(--colors-border-divider)',
} = defineProps<Props>()

const _lineWidth = computed(() => {
  return Number.isNaN(Number(lineWidth)) ? lineWidth : CSS.px(lineWidth as number).toString()
})

</script>

<template>
  <div :class="[vertical ? 'vertical' : 'horizontal']">
    <span v-if="!lineOnly" class="text">{{ text }}</span>
  </div>
</template>

<style lang="scss" scoped>
.text {
  color: v-bind(color);
  text-align: center;
  font-size: 12px;
  font-weight: 500;
}

.horizontal {
  width: 100%;
  display: inline-flex;
  align-items: center;

  .text {
    width: 40px;
  }

  &::before,
  &::after {
    content: '';
    flex: 1;
    border-bottom-width: v-bind(_lineWidth);
    border-bottom-style: v-bind(lineStyle);
    border-bottom-color: v-bind(lineColor);
  }
}

.vertical {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  height: 100%;

  .text {
    height: 40px;
    line-height: 40px;
  }

  &::before,
  &::after {
    content: '';
    flex: 1;
    border-left-width: v-bind(_lineWidth);
    border-left-style: v-bind(lineStyle);
    border-left-color: v-bind(lineColor);
  }
}
</style>
