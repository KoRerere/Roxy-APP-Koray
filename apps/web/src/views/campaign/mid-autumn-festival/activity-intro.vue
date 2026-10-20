<script setup lang="ts">
import { usePreferredReducedMotion, useResizeObserver, useTimeoutFn } from '@vueuse/core'
import { motion } from 'motion-v'
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import ActivityCountdown from './activity-countdown.vue'
import type { ActivityCountdownUnit } from './activity-countdown.vue'
import ActivityHeadline from './activity-headline.vue'
import { easeIn } from './motion'

const { titleSrc, headlinePrefix, headlineMessages, countdown, brandTarget, headlineTarget, countdownTarget } = defineProps<{
  titleSrc: string
  headlinePrefix: string
  headlineMessages: [string, string]
  countdown: ActivityCountdownUnit[]
  brandTarget: HTMLElement | null
  headlineTarget: HTMLElement | null
  countdownTarget: HTMLElement | null
}>()

const emit = defineEmits<{
  finish: []
}>()

/** 每次挂载重新停留 1.5 秒，再把两组内容送回弹窗标题栏。 */
const HOLD_MS = 1500
const BASE_FLIGHT_SECONDS = 3.2
const START_RAMP_SECONDS = 0.6
const FLIGHT_SECONDS = BASE_FLIGHT_SECONDS + START_RAMP_SECONDS / 2
const FLIGHT_DURATION_SECONDS = 1.08
const REVEAL_MS = 280
/** 左侧标题先起飞，右侧倒计时稍后跟上，形成轻微错落。 */
const COUNTDOWN_DELAY_SECONDS = 0.11

/** 起步从静止加速，再平滑衔接匀速；补足起步少走的距离，避免后段被迫加速。 */
function flightEase(progress: number) {
  const elapsed = progress * FLIGHT_SECONDS
  const distance = elapsed < START_RAMP_SECONDS
    ? elapsed ** 2 / (2 * START_RAMP_SECONDS)
    : elapsed - START_RAMP_SECONDS / 2
  return distance / BASE_FLIGHT_SECONDS
}

const phase = ref<'holding' | 'flying' | 'revealing'>('holding')
const root = useTemplateRef<HTMLElement>('root')
const brand = useTemplateRef<HTMLElement>('brand')
const heading = useTemplateRef<InstanceType<typeof ActivityHeadline>>('heading')
const timer = useTemplateRef<HTMLElement>('timer')
const preferredReducedMotion = usePreferredReducedMotion()

const brandMotion = ref({ x: 0, y: 0, scale: 1 })
const headlineMotion = ref({ x: 0, y: 0, scale: 1 })
const countdownMotion = ref({ x: 0, y: 0, scale: 1 })
const foregroundOpacity = computed(() => phase.value === 'revealing' ? 0 : 1)
const flightTransition = computed(() => ({
  type: 'tween' as const,
  duration: FLIGHT_DURATION_SECONDS,
  ease: flightEase,
  opacity: { duration: REVEAL_MS / 1000, ease: easeIn },
}))
// 延迟只作用于位移；淡出走 opacity 自己的配置，跳过时不会被拖慢。
const countdownTransition = computed(() => ({
  ...flightTransition.value,
  delay: COUNTDOWN_DELAY_SECONDS,
}))

const { start: startRevealTimer } = useTimeoutFn(() => emit('finish'), REVEAL_MS, { immediate: false })
const { start: startFlightTimer, stop: stopFlightTimer } = useTimeoutFn(startFlight, HOLD_MS, { immediate: false })

/** 归位坐标在起飞前现算，兼容 Dialog 入场过渡、缩放及不同语言宽度。 */
function getFlight(source: HTMLElement | null, target: HTMLElement | null, matchFontSize = false) {
  if (!source || !target) {
    return null
  }
  const from = source.getBoundingClientRect()
  const to = target.getBoundingClientRect()
  if (!from.width || !from.height || !to.width || !to.height) {
    return null
  }
  // 文案不同、宽度不同，标题按真实字号缩放，不能按整块宽高比缩放。
  const scale = matchFontSize
    ? Number.parseFloat(getComputedStyle(target).fontSize) / Number.parseFloat(getComputedStyle(source).fontSize)
    : to.height / from.height
  return {
    x: to.left - from.left,
    y: to.top - from.top,
    scale,
  }
}

function startFlight() {
  if (phase.value !== 'holding') {
    return
  }
  const nextBrand = getFlight(brand.value, brandTarget)
  const nextHeadline = getFlight(heading.value?.$el ?? null, headlineTarget, true)
  const nextCountdown = getFlight(timer.value, countdownTarget)
  if (preferredReducedMotion.value === 'reduce' || !nextBrand || !nextHeadline || !nextCountdown) {
    reveal()
    return
  }
  brandMotion.value = nextBrand
  headlineMotion.value = nextHeadline
  countdownMotion.value = nextCountdown
  phase.value = 'flying'
}

function reveal() {
  if (phase.value === 'revealing') {
    return
  }
  stopFlightTimer()
  phase.value = 'revealing'
  startRevealTimer()
}

function onFlightComplete() {
  if (phase.value === 'flying') {
    reveal()
  }
}

/** 点击遮罩跳过入场：停留或飞行中都直接淡出，露出真实标题栏。 */
function skip() {
  reveal()
}

// 飞行途中窗口尺寸变化时直接显露真实标题栏，避免落到旧坐标。
useResizeObserver(root, () => {
  if (phase.value === 'flying') {
    reveal()
  }
})

// useTimeoutFn 随组件卸载取消；关闭后立即重开不会残留上一次的回调。
onMounted(startFlightTimer)
</script>

<template>
  <div ref="root" class="absolute inset-0 z-20 flex items-center justify-center overflow-hidden" :class="phase === 'revealing' ? 'pointer-events-none' : 'cursor-pointer'" data-campaign-intro :data-phase="phase" aria-hidden="true" @click="skip" @wheel.prevent @touchmove.prevent>
    <motion.div class="absolute inset-0 bg-black/50 backdrop-blur-[8px]" :initial="false" :animate="{ opacity: foregroundOpacity }" :transition="{ duration: REVEAL_MS / 1000, ease: easeIn }" />
    <div class="relative flex flex-col items-center gap-7 px-6 max-w-full">
      <div class="w-max max-w-full flex flex-col items-center gap-3">
        <motion.div class="origin-top-left" :initial="false" :animate="{ ...brandMotion, opacity: foregroundOpacity }" :transition="flightTransition">
          <img ref="brand" class="block h-8 shrink-0" :src="titleSrc" alt="" draggable="false" data-intro-brand>
        </motion.div>
        <motion.div class="origin-top-left max-w-full" :initial="false" :animate="{ ...headlineMotion, opacity: foregroundOpacity }" :transition="flightTransition">
          <ActivityHeadline ref="heading" class="w-max max-w-full" :prefix="headlinePrefix" :messages="headlineMessages" :active="false" prominent data-intro-headline />
        </motion.div>
      </div>
      <motion.div class="origin-top-left" :initial="false" :animate="{ ...countdownMotion, opacity: foregroundOpacity }" :transition="countdownTransition" :on-animation-complete="onFlightComplete">
        <!-- 遮罩阶段放大 1.35 倍；用 zoom 而非 transform，布局仍居中且文字清晰，归位缩放按真实高度自动算回 1 倍。 -->
        <div ref="timer" class="w-max [zoom:1.35]" data-intro-countdown>
          <ActivityCountdown :items="countdown" />
        </div>
      </motion.div>
    </div>
  </div>
</template>
