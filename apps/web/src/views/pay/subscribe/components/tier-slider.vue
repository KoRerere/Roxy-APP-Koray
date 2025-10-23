<script setup lang="ts">
import { formatNumberToKMB } from '/@/utils/basic';

interface Tier {
  start: number
  end: number
  step?: number
}

interface Props {
  min?: number
  max?: number
  step?: number
  tiers?: Tier[]
  hideLabels?: number[]
  useLogarithmic?: boolean
  useKMB?: boolean
  tooltip?: boolean
  tooltipFormatter?: ((value: number) => string) | null
  numberFormatter?: ((value: number) => string) | null
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 100,
  step: 1,
  tiers: () => [],
  hideLabels: () => [],
  useLogarithmic: true,
  useKMB: true,
  tooltip: true,
  tooltipFormatter: null,
  numberFormatter: null,
})

const emit = defineEmits<{
  (e: 'change', value: number): void
}>()

const selectedValue = defineModel<number>('modelValue', { required: true, default: 0 })
/**
 * 11px内边距
 */
const VISUAL_PADDING_PX = 11
const isDragging = ref(false)
const sliderTrack = useTemplateRef('slider')
const thumbExtra = useTemplateRef('thumbex')

const currentPosition = computed(() => getPosition(selectedValue.value))
// 额外提示框的位置，处理边界情况
const thumbExtraPosition = computed(() => {
  if (!sliderTrack.value || !thumbExtra.value)
    return {}

  const trackWidth = sliderTrack.value.clientWidth
  const extraWidth = thumbExtra.value.clientWidth
  const position = currentPosition.value

  // 将百分比转换为像素
  const thumbPosition = (position * trackWidth) / 100

  // 计算左边界和右边界
  const leftBoundary = extraWidth / 2
  const rightBoundary = trackWidth - extraWidth / 2

  let translateX = -50
  // 如果 thumb 位置小于左边界
  if (thumbPosition < leftBoundary) {
    translateX = -(thumbPosition / leftBoundary * 50)
  }
  // 如果 thumb 位置大于右边界
  else if (thumbPosition > rightBoundary) {
    const overflowRatio = (thumbPosition - rightBoundary) / (trackWidth - rightBoundary)
    translateX = -(50 + overflowRatio * 50)
  }

  return {
    left: `${position}%`,
    transform: `translateX(${translateX}%)`,
  }
})

// 计算所有可选值
const values = computed<number[]>(() => {
  // 非区间模式：根据 min、max 和 step 生成等间距值数组
  if (!props.tiers.length) {
    return Array.from(
      { length: Math.floor((props.max - props.min) / props.step) + 1 },
      (_, i) => props.min + i * props.step,
    )
  }
  // 区间模式：根据每个区间的配置生成值数组
  const result: number[] = []
  let currentValue = props.min
  props.tiers.forEach((tier) => {
    // 添加当前区间的值
    while (currentValue < tier.end) {
      result.push(currentValue)
      currentValue += tier.step || props.step
    }

    // 确保区间端点被包含
    if (props.min < tier.end && !result.includes(tier.end)) {
      result.push(tier.end)
    }
  })
  // 处理最后一个区间到 max
  const lastTier = props.tiers[props.tiers.length - 1]
  if (lastTier && lastTier.end < props.max) {
    currentValue = lastTier.end
    while (currentValue < props.max) {
      currentValue += lastTier.step || props.step
      if (currentValue <= props.max) {
        result.push(currentValue)
      }
    }
  }
  // 确保包含最大值
  if (!result.includes(props.max)) {
    result.push(props.max)
  }
  return result
})

// 计算主要刻度值
const majorValues = computed<number[]>(() => {
  // 区间模式：使用区间的起始点和结束点作为主要刻度
  if (props.tiers.length) {
    return [...new Set([
      props.min,
      ...props.tiers.flatMap(tier => [tier.start, tier.end]),
      props.max,
    ])].sort((a, b) => a - b)
  }

  // 非区间模式：平均分配5个主要刻度
  const stepCount = 5
  return Array.from(
    { length: stepCount + 1 },
    (_, i) => Math.round(props.min + (props.max - props.min) * (i / stepCount)),
  )
})

// 计算刻度标签的位置
const labelPositions = computed(() => {
  return majorValues.value.map(value => ({ value, position: getPosition(value), hide: props.hideLabels.includes(value) }))
})

// 当前滑块值 tooltip
const tooltipValue = computed(() => {
  return props.tooltipFormatter?.(selectedValue.value) ?? formatter(selectedValue.value)
})

/**
 * 获取值对应的位置（百分比）
 */
function getPosition(value: number): number {
  if (!sliderTrack.value) return 0

  const trackWidth = sliderTrack.value.clientWidth

  if (!props.tiers.length) {
    const normalizedPosition = props.useLogarithmic
      ? calculateLogarithmicPosition(value)
      : normalizeToRange(value, props.min, props.max)

    const pixelPosition = (normalizedPosition * (trackWidth - 2 * VISUAL_PADDING_PX) / 100) + VISUAL_PADDING_PX
    return pixelToPercent(pixelPosition, trackWidth)
  }

  // Tiers 模式下的位置计算
  const sortedValues = majorValues.value
  const segmentWidth = (trackWidth - 2 * VISUAL_PADDING_PX) / (sortedValues.length - 1)
  const valueIndex = sortedValues.indexOf(value)

  const pixelPosition = valueIndex !== -1
    ? VISUAL_PADDING_PX + valueIndex * segmentWidth
    : calculateInterpolatedPosition(value, sortedValues, segmentWidth)

  return pixelToPercent(pixelPosition, trackWidth)
}

/**
 * 计算对数刻度下的位置
 */
function calculateLogarithmicPosition(value: number): number {
  const epsilon = props.max * 1e-6
  const minValue = value === 0 && props.min === 0 ? epsilon : value || epsilon
  const minLog = Math.log(props.min || epsilon)
  return ((Math.log(minValue) - minLog) / (Math.log(props.max) - minLog)) * 100
}

/**
 * 将值标准化到0-100范围
 */
function normalizeToRange(value: number, min: number, max: number): number {
  return ((value - min) / (max - min)) * 100
}

/**
 * 将像素值转换为百分比
 */
function pixelToPercent(pixels: number, trackWidth: number): number {
  return (pixels / trackWidth) * 100
}

/**
 * 计算插值位置（用于区间模式）
 */
function calculateInterpolatedPosition(value: number, sortedValues: number[], segmentWidth: number): number {
  const index = sortedValues.findIndex(v => v > value)
  const start = sortedValues[index - 1]
  const end = sortedValues[index]
  return VISUAL_PADDING_PX + ((index - 1) + (value - start) / (end - start)) * segmentWidth
}

/**
 * 找到最接近点击位置的值
 */
function findClosestValue(clientX: number): number {
  if (!sliderTrack.value)
    return props.min

  const rect = sliderTrack.value.getBoundingClientRect()
  const trackWidth = rect.width
  const adjustedWidth = trackWidth - 2 * VISUAL_PADDING_PX
  const adjustedLeft = rect.left + VISUAL_PADDING_PX
  const clickPosition = ((clientX - adjustedLeft) / adjustedWidth) * 100

  // 使用二分查找找到最接近的值
  const possibleValues = values.value
  let left = 0
  let right = possibleValues.length - 1

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const midValue = possibleValues[mid]
    const midPosition = ((getPosition(midValue) * trackWidth / 100 - VISUAL_PADDING_PX) / adjustedWidth) * 100

    if (midPosition === clickPosition)
      return midValue

    // 检查相邻值，返回最接近的
    if (mid > 0) {
      const prevValue = possibleValues[mid - 1]
      const prevPosition = ((getPosition(prevValue) * trackWidth / 100 - VISUAL_PADDING_PX) / adjustedWidth) * 100
      if (prevPosition <= clickPosition && clickPosition <= midPosition) {
        return Math.abs(clickPosition - prevPosition) < Math.abs(clickPosition - midPosition)
          ? prevValue
          : midValue
      }
    }

    if (mid < possibleValues.length - 1) {
      const nextValue = possibleValues[mid + 1]
      const nextPosition = ((getPosition(nextValue) * trackWidth / 100 - VISUAL_PADDING_PX) / adjustedWidth) * 100
      if (midPosition <= clickPosition && clickPosition <= nextPosition) {
        return Math.abs(clickPosition - midPosition) < Math.abs(clickPosition - nextPosition)
          ? midValue
          : nextValue
      }
    }

    if (midPosition < clickPosition)
      left = mid + 1
    else
      right = mid - 1
  }

  // 如果二分查找没有找到精确匹配，返回最接近的边界值
  return possibleValues[left] || possibleValues[right]
}

/**
 * 格式化数字显示（支持K/M/B格式）
 */
function formatter(value: number): string {
  if (props.numberFormatter)
    return props.numberFormatter(value)

  if (props.useKMB)
    return formatNumberToKMB(value, 1)

  return value.toLocaleString('en-US')
}

function handleLabelClick(value: number): void {
  if (value < props.min)
    return
  selectedValue.value = value
  emit('change', value)
}

function updateValue(clientX: number): void {
  const closestValue = findClosestValue(clientX)
  selectedValue.value = closestValue
  emit('change', closestValue)
}

function handleMouseDown(e: MouseEvent): void {
  isDragging.value = true
  updateValue(e.clientX)
}

function handleMouseMove(e: MouseEvent): void {
  if (isDragging.value)
    updateValue(e.clientX)
}

function handleMouseUp(): void {
  isDragging.value = false
}

onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)

  // 创建 ResizeObserver 监听滑动条尺寸变化
  let resizeObserver: ResizeObserver | null = new ResizeObserver(() => {
    // 强制重新计算 thumbExtraPosition
    nextTick(() => {
      if (thumbExtra.value) {
        thumbExtra.value.style.transition = 'none'
        // 触发重新计算
        const position = thumbExtraPosition.value
        Object.assign(thumbExtra.value.style, {
          left: position.left,
          transform: position.transform,
        })
        // 恢复过渡效果
        setTimeout(() => {
          if (thumbExtra.value) {
            thumbExtra.value.style.transition = ''
          }
        }, 0)
      }
    })
  })

  if (sliderTrack.value) {
    resizeObserver.observe(sliderTrack.value)
  }

  onUnmounted(() => {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  })
})
</script>

<template>
  <div class="relative w-full select-none">
    <!-- 滑动轨道 -->
    <div ref="slider" class="relative h-5 rounded-full cursor-pointer bg-gradient-to-r from-[#12A3FC] to-[#EC51F7]" @mousedown="handleMouseDown">
      <!-- 未选中部分的轨道 -->
      <div class="absolute top-0 right-0 h-full rounded-r-full track-slider" :style="{ width: `calc(${100 - currentPosition}% - 8px)`, transition: isDragging ? 'none' : 'all 0.3s ease' }" />
      <!-- 刻度标记和标签 -->
      <div v-for="{ value, position } in labelPositions" :key="value" class="absolute top-1/2 -translate-1/2 w-2.5 h-2.5 rounded-full" :class="[
        position < currentPosition
          ? 'bg-white opacity-30'
          : Math.abs(position - currentPosition) < 2 ? 'bg-white opacity-80' : 'track-dot',
      ]" :style="{ left: `${position}%` }" />
      <!-- 滑块 -->
      <div class="absolute top-1/2 -translate-1/2 thumb" :class="{ 'tooltip': tooltip }" :style="{
        left: `${currentPosition}%`,
        transition: isDragging ? 'none' : 'all 0.3s ease',
      }" :data-tooltip="tooltipValue">
        <div class="cursor-grab active:cursor-grabbing thumb-grabbing" />
        <!-- Thumb Extra -->
        <div ref="thumbex" class="absolute top-15" :style="[thumbExtraPosition, { transition: isDragging ? 'none' : 'all 0.3s ease' }]">
          <slot name="thumb-extra" />
        </div>
      </div>
    </div>
    <!-- 底部数值标签 -->
    <div class="relative h-5 mt-2">
      <div v-for="{ value, position, hide } in labelPositions" :key="value" class="absolute text-sm transform -translate-x-1/2 cursor-pointer track-marker"
        :class="{ 'foucs font-semibold': value === selectedValue, 'hidden': hide }" :style="{ left: `${position}%` }" @click="handleLabelClick(value)">{{ formatter(value) }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.track-slider {
  background: var(--pattern-pay-plan-bg-slider);
}

.track-dot {
  background: var(--pattern-pay-plan-bg-slider-dot);
}

.track-marker {
  color: var(--colors-text-text-tertiary);

  &:not(:hover).foucs {
    color: var(--colors-text-text-primary);
  }

  &:hover {
    color: #EC51F7;
  }
}

.thumb {
  &.tooltip::before {
    content: attr(data-tooltip);
    position: absolute;
    top: -110%;
    left: 50%;
    transform: translateX(-50%);
    padding: var(--spacing-sm, 4px) var(--spacing-lg, 8px);
    border-radius: var(--radius-sm, 4px);
    background: var(--primitives-neutrals-900, #171c1f);
    box-shadow:
      0px 3px 8px 0px rgba(0, 0, 0, 0.07),
      0px 2px 5px 0px rgba(0, 0, 0, 0.07),
      0px 1px 1px 0px rgba(0, 0, 0, 0.07);
    color: var(--primitives-neutrals-0, #fff);
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    line-height: var(--Line-Height-text-xs, 16px);
    transition: opacity 0.3s ease;
    white-space: nowrap;
  }

  &-grabbing {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 5px solid #ffffff;
    box-shadow: 0px 0px 2px rgba(0, 0, 0, 0.1);
    background: transparent;
  }
}
</style>
