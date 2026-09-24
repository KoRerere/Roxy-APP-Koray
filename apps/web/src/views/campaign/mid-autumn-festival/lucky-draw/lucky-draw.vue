<script setup lang="ts">
import { computed, ref } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { tryOnScopeDispose, useDocumentVisibility, usePreferredReducedMotion, useTimeoutFn } from '@vueuse/core'
import { getImage } from '/@/utils/basic'

/** 抽奖盘运行阶段 */
type DrawPhase = 'idle' | 'spinning' | 'stopping' | 'stopped'

/** 单个奖品格在 3×3 盘面上的位置 */
interface PrizeCell {
  /** 顺时针路径下标，0 为左上角 */
  pathIndex: number
  /** CSS grid-area，用于把路径格放到九宫格视觉位置 */
  gridArea: string
}

defineProps<{
  /** 外部正在请求结果时禁用中心按钮，避免重复开奖 */
  disabled?: boolean
}>()

const emit = defineEmits<{
  /** 指针停稳，外壳再弹出结果弹窗 */
  stopped: []
  /** 用户点击中心按钮，由外壳去请求抽奖结果 */
  draw: []
}>()

/** 必须与盘面 88px 格子 / 8px 间距对齐，指示器才能落到格子中心 */
const CELL_SIZE = 88
const CELL_GAP = 8
const PATH_LENGTH = 8
const CRUISE_DELAY = 74
const EXTRA_STOP_LOOPS = 2

/** 顺时针格子的行列坐标，用于把路径下标换成位移 */
const PATH_COORDS: Array<[number, number]> = [
  [0, 0],
  [1, 0],
  [2, 0],
  [2, 1],
  [2, 2],
  [1, 2],
  [0, 2],
  [0, 1],
]

/** 与 demo 共用同一套抽奖盘素材 */
const prizeImage = getImage('campaing/mid-autumn-festival/lottery/prize.png')
const selectedStar = getImage('campaing/mid-autumn-festival/lottery/selected-star.svg')
const drawButton = getImage('campaing/mid-autumn-festival/lottery/draw-button.svg')
const drawButtonHover = getImage('campaing/mid-autumn-festival/lottery/draw-button-hover.svg')

const prizeCells: PrizeCell[] = [
  { pathIndex: 0, gridArea: '1 / 1' },
  { pathIndex: 1, gridArea: '1 / 2' },
  { pathIndex: 2, gridArea: '1 / 3' },
  { pathIndex: 7, gridArea: '2 / 1' },
  { pathIndex: 3, gridArea: '2 / 3' },
  { pathIndex: 6, gridArea: '3 / 1' },
  { pathIndex: 5, gridArea: '3 / 2' },
  { pathIndex: 4, gridArea: '3 / 3' },
]

const visibility = useDocumentVisibility()
const preferredReducedMotion = usePreferredReducedMotion()
const reducedMotion = computed(() => preferredReducedMotion.value === 'reduce')

const phase = ref<DrawPhase>('idle')
const activeIndex = ref(0)
const hasCompletedDraw = ref(false)
const indicatorDurationMs = ref(0)
const stepDelayMs = ref(110)
const statusMessage = ref($t('可以开始抽奖'))

/** 用于丢弃过期的步进计时，避免 start 重入或卸载后仍跳格 */
let runToken = 0
let activeToken = 0
let stopStep = 0
let totalStopSteps = 0

const isBusy = computed(() => phase.value === 'spinning' || phase.value === 'stopping')
const indicatorVisible = computed(() => phase.value !== 'idle')

const indicatorOffset = computed(() => pathOffset(activeIndex.value))

const indicatorTransition = computed(() => {
  if (reducedMotion.value) {
    return { duration: 0 }
  }

  return {
    type: 'tween' as const,
    duration: indicatorDurationMs.value / 1000,
    ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
  }
})

const { start: startStepTimer, stop: stopStepTimer } = useTimeoutFn(onStepTick, stepDelayMs, { immediate: false })
const { start: startFinishTimer, stop: stopFinishTimer } = useTimeoutFn(finishDraw, () => indicatorDurationMs.value + 40, { immediate: false })

/**
 * 把顺时针路径下标换算成指示器相对左上角格子的位移。
 */
function pathOffset(index: number): { x: number, y: number } {
  const [col, row] = PATH_COORDS[index] ?? PATH_COORDS[0]
  const step = CELL_SIZE + CELL_GAP
  return { x: col * step, y: row * step }
}

/**
 * 格子外观相同，停在随机格即可，只保留减速停稳的手感。
 */
function pickStopIndex(): number {
  return Math.floor(Math.random() * PATH_LENGTH)
}

/**
 * 停轮阶段前半保持巡航，后半二次减速，让指针有“咬住奖品”的感觉。
 */
function stoppingDelay(step: number, total: number): number {
  const progress = step / total
  if (progress < 0.55) {
    return CRUISE_DELAY
  }

  const slowdown = (progress - 0.55) / 0.45
  return CRUISE_DELAY + Math.round(280 * slowdown * slowdown)
}

/**
 * 前进一步并更新指示器过渡时长；时长略短于步进间隔，格子之间会留一拍停顿。
 */
function moveToNext(delay: number) {
  indicatorDurationMs.value = reducedMotion.value ? 0 : Math.min(Math.round(delay * 0.76), 180)
  activeIndex.value = (activeIndex.value + 1) % PATH_LENGTH
}

/**
 * 单次步进。页面隐藏时不跳格，避免后台把动画一次性跑完。
 */
function onStepTick() {
  if (activeToken !== runToken) {
    return
  }

  if (visibility.value === 'hidden') {
    stepDelayMs.value = 120
    startStepTimer()
    return
  }

  if (phase.value === 'spinning') {
    moveToNext(CRUISE_DELAY)
    stepDelayMs.value = CRUISE_DELAY
    startStepTimer()
    return
  }

  if (phase.value !== 'stopping') {
    return
  }

  stopStep += 1
  const delay = stoppingDelay(stopStep, totalStopSteps)
  moveToNext(delay)

  if (stopStep >= totalStopSteps) {
    startFinishTimer()
    return
  }

  stepDelayMs.value = delay
  startStepTimer()
}

/**
 * 指针停稳后广播结果，给中奖格做结算动效用。
 */
function finishDraw() {
  if (activeToken !== runToken) {
    return
  }

  phase.value = 'stopped'
  hasCompletedDraw.value = true
  statusMessage.value = $t('抽奖完成')
  emit('stopped')
}

/**
 * 清空步进与结算计时，防止新旧一轮交叉。
 */
function clearTimers() {
  stopStepTimer()
  stopFinishTimer()
}

/**
 * 接口失败时立刻停转，不进入中奖结算。
 */
function abort() {
  runToken += 1
  clearTimers()
  phase.value = 'idle'
  hasCompletedDraw.value = false
  indicatorDurationMs.value = 0
  statusMessage.value = $t('可以开始抽奖')
}

/**
 * 开始沿九宫格巡航；真实奖品要等 stop 才能停针。
 */
function start() {
  if (isBusy.value) {
    return
  }

  runToken += 1
  activeToken = runToken
  clearTimers()
  phase.value = 'spinning'
  hasCompletedDraw.value = false
  indicatorDurationMs.value = 0
  statusMessage.value = $t('抽奖进行中')

  if (reducedMotion.value) {
    return
  }

  stepDelayMs.value = 110
  startStepTimer()
}

/**
 * 接口返回后减速停到随机格，再通知外壳弹出结果。
 */
function stop() {
  if (phase.value === 'idle' || phase.value === 'stopped') {
    start()
  }

  const targetIndex = pickStopIndex()

  if (reducedMotion.value) {
    clearTimers()
    indicatorDurationMs.value = 0
    activeIndex.value = targetIndex
    finishDraw()
    return
  }

  const distance = (targetIndex - activeIndex.value + PATH_LENGTH) % PATH_LENGTH
  stopStep = 0
  totalStopSteps = EXTRA_STOP_LOOPS * PATH_LENGTH + (distance === 0 ? PATH_LENGTH : distance)
  phase.value = 'stopping'
}

/**
 * 中心按钮只通知外壳去拉接口，自身不直接开奖，避免绕过结果请求。
 */
function onDrawClick() {
  if (isBusy.value) {
    return
  }
  emit('draw')
}

tryOnScopeDispose(() => {
  runToken += 1
  clearTimers()
})

defineExpose({
  /**
   * 开始沿九宫格巡航
   */
  start,
  /**
   * 接口成功后减速停针
   */
  stop,
  /**
   * 接口失败时中止转动
   */
  abort,
})
</script>

<template>
  <section class="inline-flex justify-center" :aria-label="$t('抽奖奖品盘')">
    <div class="prize-board" :aria-label="$t('抽奖奖品盘')">
      <motion.div v-for="cell in prizeCells" :key="cell.pathIndex" class="prize-tile" :style="{ gridArea: cell.gridArea }"
                  :animate="hasCompletedDraw && activeIndex === cell.pathIndex ? { scale: 1.04 } : { scale: 1 }" :transition="{ type: 'spring', bounce: 0.2, visualDuration: 0.35 }" aria-hidden="true"
      >
        <img class="prize-shadow" :src="prizeImage" alt="">
        <img class="prize-image" :src="prizeImage" alt="">
      </motion.div>

      <AnimatePresence>
        <motion.div v-if="indicatorVisible" class="selection-indicator" :initial="false" :animate="{ x: indicatorOffset.x, y: indicatorOffset.y }" :transition="indicatorTransition" aria-hidden="true">
          <motion.div class="indicator-frame" :animate="hasCompletedDraw ? { scale: [0.96, 1.035, 1] } : { scale: 1 }" :transition="hasCompletedDraw
            ? { duration: 0.28, ease: [0.32, 0.72, 0, 1] }
            : { duration: 0 }"
          >
            <motion.div v-if="hasCompletedDraw" class="indicator-flash" :initial="{ opacity: 0 }" :animate="{ opacity: [0, 0.48, 0, 0.4, 0, 0.34, 0] }"
                        :transition="{ duration: 0.62, ease: 'easeOut', times: [0, 0.16, 0.32, 0.49, 0.66, 0.83, 1] }"
            />
          </motion.div>

          <motion.img v-if="hasCompletedDraw" class="selected-star" :src="selectedStar" alt="" :initial="{ opacity: 0, scale: 0.72, rotate: -20 }" :animate="{ opacity: 1, scale: 1, rotate: 0 }"
                      :transition="{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }"
          />
        </motion.div>
      </AnimatePresence>

      <motion.button class="draw-button" type="button" :disabled="isBusy || disabled" :aria-label="isBusy ? $t('抽奖进行中') : $t('开始抽奖')" @click="onDrawClick">
        <img class="draw-button-image draw-button-default" :src="drawButton" alt="">
        <img class="draw-button-image draw-button-hover" :src="drawButtonHover" alt="">
        <span>{{ $t('开始抽奖') }}</span>
      </motion.button>
    </div>

    <p class="sr-only" role="status" aria-live="polite">
      {{ statusMessage }}
    </p>
  </section>
</template>

<style scoped lang="scss">
.prize-board {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 88px);
  grid-template-rows: repeat(3, 88px);
  gap: 8px;
  width: 304px;
  height: 304px;
  padding: 12px;
  overflow: hidden;
  background: linear-gradient(180deg, #ffe0cc 0%, #ffc9a3 100%);
  border: 0;
  border-radius: 12px;
  box-shadow:
    inset 0 0 0 2px rgba(255, 215, 187, 0.2),
    inset 0 4px 4px rgba(0, 0, 0, 0.06);
}

.prize-tile {
  position: relative;
  display: grid;
  place-items: center;
  width: 88px;
  height: 88px;
  overflow: hidden;
  background: #fff8ee;
  border: 1px solid #ffffff;
  border-radius: 10px;
}

.selection-indicator {
  position: absolute;
  z-index: 4;
  top: 12px;
  left: 12px;
  width: 88px;
  height: 88px;
  pointer-events: none;
  will-change: transform;
}

.indicator-frame {
  position: absolute;
  inset: 3px;
  overflow: hidden;
  border: 2px solid #fd6645;
  border-radius: 6px;
  box-shadow: 0 0 4px rgba(253, 102, 69, 0.45);
}

.indicator-flash {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: #ffffff;
  border-radius: 4px;
}

.prize-image,
.prize-shadow {
  position: absolute;
  width: 66px;
  height: 66px;
  object-fit: cover;
}

.prize-shadow {
  opacity: 0.3;
  filter: blur(1.5px);
  transform: translateY(2px);
}

.selected-star {
  position: absolute;
  z-index: 4;
  top: 8px;
  right: 7px;
  width: 10px;
  height: 10px;
}

.draw-button {
  position: relative;
  z-index: 5;
  display: grid;
  grid-area: 2 / 2;
  place-items: center;
  width: 88px;
  height: 88px;
  padding: 0;
  color: #ffffff;
  background: transparent;
  border: 0;
  border-radius: 12px;
  cursor: pointer;
  touch-action: manipulation;
  transform: translateY(4px);
}

.draw-button:active:not(:disabled) {
  transform: translateY(4px) scale(0.96);
}

.draw-button:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.draw-button:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}

.draw-button-image {
  position: absolute;
  inset: 2px;
  width: 84px;
  height: 84px;
  transition: opacity 280ms ease;
}

.draw-button-hover {
  opacity: 0;
}

.draw-button span {
  position: relative;
  z-index: 2;
  width: 2.2em;
  color: #ffffff;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
  text-align: center;
  transform: translateY(-4px);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  white-space: nowrap;
  border: 0;
  clip: rect(0, 0, 0, 0);
}

@media (hover: hover) and (pointer: fine) {
  .draw-button:not(:disabled):hover .draw-button-default {
    opacity: 0;
  }

  .draw-button:not(:disabled):hover .draw-button-hover {
    opacity: 1;
  }
}
</style>
