<script setup lang="ts">
import { useDebounceFn, useResizeObserver } from '@vueuse/core'
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'

interface SliderMark {
  /** 刻度的数值 */
  value: number
  /**
   * 从该刻度到下一个刻度之间的步长。
   * 要求能整除区间长度（即 (nextMark.value - value) % step === 0）。
   * 省略时默认整段只有一步，即直接跳到下一个刻度值。
   */
  step?: number
}

const props = withDefaults(defineProps<{
  /** 刻度定义数组，至少需要两个元素 */
  marks: SliderMark[]
  /**
   * v-model 绑定的当前值。
   * 若该值不在可选列表中（如初始值 0 表示免费档），滑块会停在最左侧刻度处。
   */
  // modelValue 由 defineModel 处理，此处不在 props 里声明
  /**
   * 最小可选值。小于该值的刻度点不可点击，拖动也不会越过它。
   * 该值必须存在于可选列表中，否则约束不生效（滑块停在第一个可选值处）。
   */
  min?: number
  /**
   * 两端留白比例（0–1）。
   * 控制第一个和最后一个刻度距离滑块两端的距离，避免刻度标签被裁剪。
   * 0 = 无留白，0.015 ≈ 定价页效果。
   */
  padding?: number
  /** 滑块（圆形拖拽点）的直径，单位 px，默认 26 */
  thumbSize?: number
  /** 刻度点的直径，单位 px，默认 10 */
  markSize?: number
  /**
   * 默认插槽浮动卡片的宽度，单位 px。
   * 组件用它来防止卡片超出右边界：卡片以 -translate-x-50% 居中，
   * 所以其中心最多停在 (100 - cardWidth/2/sliderWidth×100)% 处。
   * 不传（或传 0）则不做限制。
   */
  cardWidth?: number

  hideTooltip?: boolean
}>(), {
  min: 0,
  padding: 0,
  thumbSize: 26,
  markSize: 10,
  cardWidth: 0,
  hideTooltip: false,
})

const modelValue = defineModel<number>({ default: 0 })

// ─── CSS variable bindings ────────────────────────────────────────────────────
const thumbSizeCSS = computed(() => `${props.thumbSize}px`)
const markSizeCSS = computed(() => `${props.markSize}px`)

// ─── Slider DOM ───────────────────────────────────────────────────────────────
const sliderRoot = useTemplateRef('sliderRoot')
/**
 * px，resize 时更新
 */
const sliderWidth = ref(1)

// ─── Track geometry ───────────────────────────────────────────────────────────

// 两端留白（%），marks 在 [paddingPct, 100-paddingPct] 范围内均匀分布
const paddingPct = computed(() => props.padding * 100)

// 每个 mark 在轨道上的百分比位置
const markPositions = computed(() => {
  const n = props.marks.length
  const usable = 100 - paddingPct.value * 2
  return props.marks.map((_, i) => paddingPct.value + (i / (n - 1)) * usable)
})

// ─── Thumb position ───────────────────────────────────────────────────────────

// 滑块中心的百分比位置（用于定位浮动卡片）
const thumbCenterPct = ref(0)

// 滑块左边缘的百分比位置（用于定位滑块 DOM）= thumbCenterPct - thumbRadius%
const thumbLeftPct = ref(0)

// 渐变轨道从右侧裁剪的量，使渐变恰好在滑块右边缘结束
const gradientClipRight = computed(() => {
  const thumbWidthPct = (props.thumbSize / sliderWidth.value) * 100
  return `${100 - thumbLeftPct.value - thumbWidthPct}%`
})

// 浮动卡片的最大左边距（%），防止卡片超出右边界
const cardMaxLeftPct = computed(() => {
  if (!props.cardWidth)
    return 100
  return 100 - (props.cardWidth / 2 / sliderWidth.value) * 100
})

// ─── Selectable values ────────────────────────────────────────────────────────

// 将 marks + step 展开成完整的「可选值列表」和对应的「轨道位置列表」。
// 例如 marks=[{value:0},{value:10,step:5},{value:20}] 展开为：
//   values:    [5, 10, 20]
/**
 *   positions: [对应的轨道百分比, ...]
 */
function buildSelectables(): { values: number[], positions: number[] } {
  const values: number[] = []
  const positions: number[] = []
  let pos = paddingPct.value

  if (props.marks.length < 2)
    return { values, positions }

  for (let i = 1; i < props.marks.length; i++) {
    const from = props.marks[i - 1]!
    const to = props.marks[i]!
    /**
     * 默认整段一步
     */
    const step = from.step ?? (to.value - from.value)
    const stepCount = Math.round((to.value - from.value) / step)
    const prevMarkPos = markPositions.value[i - 1]!
    const currMarkPos = markPositions.value[i]!
    const posPerStep = (currMarkPos - prevMarkPos) / stepCount

    for (let j = 0; j < stepCount; j++) {
      pos += posPerStep
      positions.push(pos)
      values.push(from.value + (j + 1) * step)
    }
  }

  return { values, positions }
}

const { values: selectableValues, positions: selectablePositions } = buildSelectables()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function trackPositionOf(value: number): number | null {
  const idx = selectableValues.indexOf(value)
  return idx !== -1 ? (selectablePositions[idx] ?? null) : null
}

/**
 * 同时更新滑块中心和左边缘位置
 */
function setThumbPosition(centerPct: number) {
  const halfThumbPct = (props.thumbSize / 2 / sliderWidth.value) * 100
  thumbCenterPct.value = centerPct
  thumbLeftPct.value = Math.max(0, centerPct - halfThumbPct)
}

/**
 * 找到 position 落在哪两个相邻可选位置之间，返回 [prev, next] 或 null
 */
function findBracket(position: number): [number, number] | null {
  for (let i = 1; i < selectablePositions.length; i++) {
    const prev = selectablePositions[i - 1]!
    const next = selectablePositions[i]!
    if (position > prev && position <= next)
      return [prev, next]
  }
  return null
}

// ─── Init / resize ────────────────────────────────────────────────────────────

function init() {
  if (!sliderRoot.value)
    return
  sliderWidth.value = sliderRoot.value.getBoundingClientRect().width
  const pos = trackPositionOf(modelValue.value)
  // 值不在可选列表中（如 value=0 表示免费档）→ 滑块停在最左侧 mark 处
  setThumbPosition(pos ?? paddingPct.value)
}

// ─── Drag handling ────────────────────────────────────────────────────────────

function handleDrag(clientX: number) {
  if (!sliderRoot.value)
    return

  const { left, width } = sliderRoot.value.getBoundingClientRect()
  const pct = ((clientX - left) / width) * 100

  const minPos = trackPositionOf(props.min) ?? selectablePositions[0] ?? 0
  const maxPos = selectablePositions[selectablePositions.length - 1] ?? 100

  if (pct <= minPos) {
    modelValue.value = props.min
    return
  }
  if (pct >= maxPos) {
    modelValue.value = props.marks[props.marks.length - 1]!.value
    return
  }

  const bracket = findBracket(pct)
  if (bracket) {
    const [prev, next] = bracket
    const mid = prev + (next - prev) / 2
    modelValue.value = pct >= mid
      ? (selectableValues[selectablePositions.indexOf(next)] ?? modelValue.value)
      : (selectableValues[selectablePositions.indexOf(prev)] ?? modelValue.value)
  }
}

function handleThumbDragStart(event: MouseEvent) {
  event.preventDefault()
  const onMove = (e: MouseEvent) => handleDrag(e.clientX)
  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function handleThumbTouchStart(event: TouchEvent) {
  event.preventDefault()
  const onMove = (e: TouchEvent) => handleDrag(e.touches[0]!.clientX)
  const onEnd = () => {
    window.removeEventListener('touchmove', onMove)
    window.removeEventListener('touchend', onEnd)
  }
  window.addEventListener('touchmove', onMove)
  window.addEventListener('touchend', onEnd)
}

function handleMarkClick(mark: SliderMark) {
  if (mark.value >= props.min)
    modelValue.value = mark.value
}

// ─── Reactivity ───────────────────────────────────────────────────────────────

// sliderWidth > 1 means init() has run and the DOM has been measured
watch(modelValue, (val) => {
  if (sliderWidth.value <= 1)
    return
  const pos = trackPositionOf(val)
  setThumbPosition(pos ?? paddingPct.value)
})

const debouncedInit = useDebounceFn(init, 100)

onMounted(() => {
  init()
  useResizeObserver(sliderRoot, debouncedInit)
})
</script>

<template>
  <div ref="sliderRoot" class="rx-slider" v-bind="$attrs">
    <div class="rx-slider__track__gradient" />

    <div
      v-for="(mark, index) in marks"
      :key="mark.value"
      class="rx-slider__mark" :class="[mark.value <= modelValue ? 'active' : '']"
      :style="{ left: `calc(${markPositions[index]}% - ${markSize / 2}px)` }"
      @click.stop="handleMarkClick(mark)"
    >
      <div v-if="$slots['mark-badge']" class="rx-slider__mark-badge">
        <slot name="mark-badge" :value="mark.value" :is-active="mark.value === modelValue" />
      </div>
      <div class="rx-slider__mark-label" :class="{ active: mark.value === modelValue }">
        <slot name="mark" :value="mark.value" :is-active="mark.value === modelValue">
          {{ mark.value }}
        </slot>
      </div>
    </div>

    <div
      class="rx-slider__thumb"
      :style="{ left: `${thumbLeftPct}%` }"
      @mousedown="handleThumbDragStart"
      @touchstart="handleThumbTouchStart"
    >
      <div v-if="modelValue > 0 && !hideTooltip" class="rx-slider__thumb-popup">
        <slot name="popup" :value="modelValue">
          {{ modelValue }}
        </slot>
      </div>
    </div>

    <div
      class="top-13 absolute -translate-x-50%"
      :style="{ left: `${Math.min(cardMaxLeftPct, thumbCenterPct)}%` }"
      @mousedown="handleThumbDragStart"
    >
      <slot :value="modelValue" :center-pct="thumbCenterPct" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.rx-slider {
  position: relative;
  height: 20px;
  background-color: var(--pattern-pay-plan-bg-slider);
  border-radius: 12px;
  cursor: pointer;
  border: 1px solid var(--pattern-pay-plan-border-slider);
  width: 103%;
  transform: translateX(-1.5%);
  box-sizing: border-box;
  margin-bottom: 26px;
}

.rx-slider__track__gradient {
  position: absolute;
  height: 100%;
  width: 100%;
  border-radius: 12px;
  background: linear-gradient(90deg, #12a3fc 0%, #ec51f7 100%);
  clip-path: inset(0% v-bind(gradientClipRight) 0% 0% round 0px 12px 12px 0px);
}

.rx-slider__mark {
  position: absolute;
  width: v-bind(markSizeCSS);
  height: v-bind(markSizeCSS);
  top: 50%;
  transform: translateY(-50%);
  // background-color: rgba($color: #000000, $alpha: 0.2);
  background-color: var(--pattern-pay-plan-bg-slider-dot);
  border-radius: 50%;
}

.rx-slider__mark.active {
  // background-color: rgba(255, 255, 255, 0.6) !important;
  background-color: var(--colors-alpha-alpha-white-60);
}

.rx-slider__mark-badge {
  position: absolute;
  left: 50%;
  bottom: 100%;
  margin-bottom: 16px;
  transform: translateX(-50%);
  user-select: none;
  pointer-events: none;
  z-index: 2;
}

.rx-slider__mark-label {
  position: absolute;
  transform: translateX(-50%);
  top: 100%;
  margin-top: 14px;
  font-size: 16px;
  color: #909399;
  user-select: none;
  left: 50%;
}

.rx-slider__mark-label.active {
  color: #04754c;
}

.rx-slider__thumb {
  border: 5px solid #fff;
  border-radius: 50%;
  cursor: grab;
  height: v-bind(thumbSizeCSS);
  width: v-bind(thumbSizeCSS);
  outline: none;
  position: absolute;
  top: 50%;
  transform: translateY(-50%) translateZ(0);
  transition: transform 0.2s;
}

.rx-slider__thumb-popup {
  position: absolute;
  top: -38px;
  left: 50%;
  transform: translateX(-50%);
  color: #fff;
  background-color: rgba(0, 0, 0, 0.8);
  padding: 2px 10px;
  border-radius: 4px;
  white-space: nowrap;
}
</style>
