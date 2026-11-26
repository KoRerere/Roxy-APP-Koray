<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useDocumentVisibility, useElementSize, useElementVisibility, useEventListener, usePreferredReducedMotion, useWindowSize } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import RxButton from '/@/components/rx-button'
import { RxSvgIcon } from '/@/components/rx-icon'
import AndroidHomeScreen from './android-home-screen.vue'
import mainWindowVideo from '/@/assets/videos/cloud-phone-main/main-window.mp4'

/**
 * 云手机空状态（Android 桌面矩阵版）
 * 左侧主控大屏 + 右侧多行多列小屏矩阵。
 * 初始全部为未打开状态（蓝灰色底），随后从最左侧主屏开始，按从左到右、逐行推进的顺序依次走完 4 步开机流程并点亮 Android 桌面；
 * 点击右侧任意已打开的小屏，可将其切换为左侧主控大屏，点击左侧大屏可放大预览。
 */
const emit = defineEmits<{ (e: 'create'): void }>()
const { t: $t } = useI18n()

/* ---------------- 开机序列与矩阵配置 ---------------- */

/** 小屏固定尺寸：窗口缩放时手机大小不变，只增减行数 / 列数 */
const SMALL_CARD_H = 220
/** 右侧最多显示的行数，避免超大屏时一次渲染过多台桌面 */
const MAX_GRID_ROWS = 4
const GRID_GAP = 14
/** 手机屏幕宽高比 9:18 */
const PHONE_ASPECT = 9 / 18

/** 开机推进节奏（毫秒） */
const BOOT_CONFIG = {
  initialHold: 550, // 进场先停留展示全员“未打开”状态
  itemStagger: 115, // 每台云手机依次开始启动的间隔
  stepDuration: 200, // 每个启动步骤的时长（共 4 步）：单台 4 步 + 停留 = 900ms，一秒内跑完
  revealDelay: 100, // 4 步全绿后短暂停留再淡出遮罩显现桌面
}
const SINGLE_BOOT_TOTAL = BOOT_CONFIG.stepDuration * 4 + BOOT_CONFIG.revealDelay

const BOOT_STEPS = [
  { pending: 'Starting device', active: 'Starting device', done: 'Device started' },
  { pending: 'Connecting proxy', active: 'Connecting proxy', done: 'Proxy connected' },
  { pending: 'Booting Android', active: 'Booting Android', done: 'Android booted' },
  { pending: 'Connecting screen', active: 'Connecting screen', done: 'Screen connected' },
] as const

/** 四段式圆环参数 */
const RING_RADIUS = 18
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const RING_GAP = 6.5
const RING_SEG_LEN = RING_CIRCUMFERENCE / 4 - RING_GAP
const RING_ANGLES = [-82, 8, 98, 188]

const PHONE_NAMES = [
  'TikTok-US-01',
  'TikTok-UK-02',
  'IG-Shop-03',
  'YT-Shorts-04',
  'FB-Ads-05',
  'X-Growth-06',
  'TT-Live-07',
]

/* ---------------- 容器尺寸与统一宽度 ---------------- */

const sectionRef = useTemplateRef<HTMLElement>('section')
const gridWrapRef = useTemplateRef<HTMLElement>('gridWrap')
const stageRef = useTemplateRef<HTMLElement>('stage')
const { width: stageWidth, height: stageHeight } = useElementSize(stageRef)
const { height: gridHeight } = useElementSize(gridWrapRef)
const STAGE_GAP = 20
/** 主屏高度 = 右侧 2 行小屏 + 1 个间距（比整列高度更小） */
const MAIN_ROWS = 2
/** 主屏窗口顶部标题栏（红黄绿三点那一栏）高度，与模板里 h-9 一致 */
const MAIN_TITLEBAR_H = 36

/** 小屏尺寸固定，不再随容器缩放（缩放时所有桌面都要按新尺寸重排，是拖动窗口卡顿的原因） */
const smallCardH = computed(() => SMALL_CARD_H)
const smallCardW = computed(() => Math.round(SMALL_CARD_H * PHONE_ASPECT))
/** 行数按右侧可用高度计算：窗口变高就多一行，至少 1 行 */
const gridRows = computed(() => {
  const h = gridHeight.value || SMALL_CARD_H * 2 + GRID_GAP
  return Math.min(MAX_GRID_ROWS, Math.max(1, Math.floor((h + GRID_GAP) / (SMALL_CARD_H + GRID_GAP))))
})
/** 主屏整个窗口（标题栏 + 屏幕）的高度 = 右侧 2 行小屏 + 1 个间距，上下边与右侧两行严格对齐 */
const mainDeviceH = computed(() => Math.round(smallCardH.value * MAIN_ROWS + GRID_GAP * (MAIN_ROWS - 1)))
const mainScreenH = computed(() => mainDeviceH.value - MAIN_TITLEBAR_H)
/** 左侧主控大屏按手机标准宽高比计算宽度，避免裁切 */
const mainColWidth = computed(() => Math.round(mainScreenH.value * PHONE_ASPECT))
/** 主屏右侧边缘操作栏宽度：按屏幕宽度等比（参照云手机窗口约 12.5%） */
const TOOLBAR_W = computed(() => Math.min(Math.max(Math.round(mainColWidth.value * 0.09), 34), 46))
const mainFrameWidth = computed(() => mainColWidth.value + TOOLBAR_W.value)
/** 列数按舞台剩余宽度计算，右侧宽度收紧到内容宽度，便于整体居中 */
/** 左侧云手机窗口数量：只保留 1 台主控窗口 */
const MAX_WINDOWS = 1
const windowCount = computed(() => {
  const minGrid = smallCardW.value
  const free = (stageWidth.value || 1200) - STAGE_GAP - minGrid
  return Math.min(MAX_WINDOWS, Math.max(1, Math.floor((free + STAGE_GAP) / (mainFrameWidth.value + STAGE_GAP))))
})
const leftWidth = computed(() => windowCount.value * mainFrameWidth.value + (windowCount.value - 1) * STAGE_GAP)

const gridCols = computed(() => {
  const w = (stageWidth.value || 1200) - leftWidth.value - STAGE_GAP
  // 比能放下的列数少放一列，右侧不要太满
  // 右侧放满能放下的列数
  return Math.max(1, Math.floor((w + GRID_GAP) / (smallCardW.value + GRID_GAP)))
})
const gridContentWidth = computed(() => gridCols.value * smallCardW.value + (gridCols.value - 1) * GRID_GAP)

/* ---------------- 空状态提示卡片位置 ---------------- */

/** 设计稿：卡片最宽 987px，左右各比手机区域内缩约 72px。
 * 只有 1～2 行时，卡片按前两行（与主屏同高）的底边定位；
 * 大屏多出第 3、4 行时，改按最后一行的底边定位，放到整个矩阵下方，不压在中间那几行上 */
const NOTICE_MAX_W = 987
const NOTICE_INSET_X = 72
/** 卡片底边相对参照行底边的偏移：正数往下。卡片略微压出手机底边，与设计稿一致 */
const NOTICE_OFFSET_Y = 64
/** 手机区域顶部的标题行（h-9 = 36px）+ 间距（gap-2 = 8px） */
const STAGE_HEADER_H = 36 + 8
const noticeStyle = computed(() => {
  const areaW = leftWidth.value + STAGE_GAP + gridContentWidth.value
  const width = Math.max(320, Math.min(NOTICE_MAX_W, areaW - NOTICE_INSET_X * 2))
  const gridH = gridRows.value * smallCardH.value + (gridRows.value - 1) * GRID_GAP
  const contentBottom = STAGE_HEADER_H + (gridRows.value > 2 ? gridH : mainDeviceH.value)
  return {
    width: `${width}px`,
    left: `${Math.round((areaW - width) / 2)}px`,
    // 卡片底边不超出舞台底部，避免窗口刚好只放得下两行时被裁掉
    top: `${stageHeight.value > 0 ? Math.min(contentBottom + NOTICE_OFFSET_Y, stageHeight.value - 1) : contentBottom + NOTICE_OFFSET_Y}px`,
    transform: 'translateY(-100%)',
  }
})

interface PhoneItem {
  /** 全局启动顺序索引：0 为左侧主屏，1..N 为右侧网格从左到右逐行排列 */
  order: number
  name: string
  id: string
}

const smallPhones = computed<PhoneItem[]>(() => {
  const total = gridRows.value * gridCols.value
  return Array.from({ length: total }, (_, idx) => {
    const order = idx + windowCount.value
    const hex = (0x9E3779B1 + order * 0x1041).toString(16).slice(0, 8)
    return {
      order,
      name: PHONE_NAMES[idx % PHONE_NAMES.length],
      id: hex,
    }
  })
})

const totalStreamCount = computed(() => windowCount.value + smallPhones.value.length)

/** 当前在左侧大屏展示的设备（null 表示默认第 0 台主屏，否则为右侧选中的小屏） */
const selectedOrder = ref<number | null>(null)

const mainPhone = computed<PhoneItem>(() => {
  if (selectedOrder.value !== null) {
    const found = smallPhones.value.find(p => p.order === selectedOrder.value)
    if (found) {
      return found
    }
  }
  return {
    order: 0,
    name: 'Cloud Phone-US-01',
    id: '9e3779b1',
  }
})

/* ---------------- 开机波浪推进状态 ---------------- */

const isVisible = useElementVisibility(sectionRef)
const documentVisibility = useDocumentVisibility()
const reducedMotion = usePreferredReducedMotion()
const isReduced = computed(() => reducedMotion.value === 'reduce')
const isPaused = computed(() => !isVisible.value || documentVisibility.value !== 'visible')

const bootElapsed = ref(0)
const bootFinished = ref(false)
const lightbox = ref<{ from: DOMRect } | null>(null)
let bootElapsedAccum = 0
let last = performance.now()
let lastBootSync = 0
let raf = 0

const totalBootDuration = computed(() =>
  BOOT_CONFIG.initialHold + (totalStreamCount.value - 1) * BOOT_CONFIG.itemStagger + SINGLE_BOOT_TOTAL,
)

interface CardBootState {
  stage: 'stopped' | 'booting' | 'running'
  completedSteps: number
  activeStep: number
  timerText: string
}

const RUNNING_STATE: CardBootState = {
  stage: 'running',
  completedSteps: 4,
  activeStep: -1,
  timerText: '1:27',
}

function formatSimulatedTimer(progress: number) {
  const totalSec = Math.max(1, Math.min(87, Math.round(progress * 87)))
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${String(sec).padStart(2, '0')}`
}

function getBootStateByOrder(order: number): CardBootState {
  if (isReduced.value || bootFinished.value) {
    return RUNNING_STATE
  }
  const startAt = BOOT_CONFIG.initialHold + order * BOOT_CONFIG.itemStagger
  const elapsed = bootElapsed.value - startAt
  if (elapsed < 0) {
    return { stage: 'stopped', completedSteps: 0, activeStep: -1, timerText: '0:00' }
  }
  if (elapsed >= SINGLE_BOOT_TOTAL) {
    return RUNNING_STATE
  }
  const stepIndex = Math.min(4, Math.floor(elapsed / BOOT_CONFIG.stepDuration))
  const progress = Math.min(1, elapsed / (BOOT_CONFIG.stepDuration * 4))
  return {
    stage: 'booting',
    completedSteps: stepIndex,
    activeStep: stepIndex < 4 ? stepIndex : -1,
    timerText: formatSimulatedTimer(progress),
  }
}

function getStepStatus(state: CardBootState, stepIndex: number): 'done' | 'active' | 'pending' {
  if (stepIndex < state.completedSteps) {
    return 'done'
  }
  if (stepIndex === state.activeStep) {
    return 'active'
  }
  return 'pending'
}

function getStepLabel(state: CardBootState, stepIndex: number) {
  return BOOT_STEPS[stepIndex][getStepStatus(state, stepIndex)]
}

/** 左侧窗口：第 1 台可被右侧小屏切换，其余为固定的云手机 */
const mainWindows = computed(() => Array.from({ length: windowCount.value }, (_, i) => {
  const phone: PhoneItem = i === 0
    ? mainPhone.value
    : { order: i, name: `Cloud Phone-US-${String(i + 1).padStart(2, '0')}`, id: (0x9E3779B1 + i * 0x2D1).toString(16).slice(0, 8) }
  return { phone, state: getBootStateByOrder(phone.order) }
}))
const smallStates = computed(() => smallPhones.value.map(p => getBootStateByOrder(p.order)))

const runningCount = computed(() => {
  let count = 0
  for (let i = 0; i < windowCount.value; i++) {
    if (getBootStateByOrder(i).stage === 'running') {
      count++
    }
  }
  for (const state of smallStates.value) {
    if (state.stage === 'running') {
      count++
    }
  }
  return count
})

function tick(now: number) {
  const dt = Math.min((now - last) / 1000, 0.05)
  last = now

  if (!lightbox.value && !bootFinished.value && !isPaused.value && !isReduced.value) {
    bootElapsedAccum += dt * 1000
    if (bootElapsedAccum >= totalBootDuration.value) {
      bootElapsed.value = totalBootDuration.value
      bootFinished.value = true
    }
    else if (now - lastBootSync >= 33) {
      bootElapsed.value = bootElapsedAccum
      lastBootSync = now
    }
  }

  if (!bootFinished.value) {
    raf = requestAnimationFrame(tick)
  }
}

watch(isReduced, (reduced) => {
  if (reduced) {
    bootFinished.value = true
  }
})

/* ---------------- 交互：点击右侧切换主屏 / 点击主屏打开灯箱 ---------------- */

function selectAsMain(phone: PhoneItem, state: CardBootState) {
  if (state.stage !== 'running') {
    return
  }
  selectedOrder.value = phone.order
}

const lightboxOn = ref(false)
/** 放大动画结束后才让灯箱里的桌面开始演示，避免动画过程中同时开 APP、解码视频导致掉帧 */
const lbPlaying = ref(false)
/** 动画进行中：提前提升为合成层，动画结束后释放 */
const lbAnimating = ref(false)
const lbMoveRef = useTemplateRef<HTMLElement>('lbMove')
let lbCard: HTMLElement | null = null
let lbToken = 0

/** 灯箱尺寸跟随窗口大小 */
const { width: winW, height: winH } = useWindowSize()
const lbFrame = computed(() => {
  const pad = Math.min(Math.max(winW.value * 0.05, 16), 64) * 2
  const maxH = winH.value - pad
  const h = Math.min(maxH, 720)
  return { width: Math.round(h * PHONE_ASPECT), height: Math.round(h) }
})

/** 等 transform 过渡结束（带兜底超时，防止 transitionend 没触发） */
function waitTransform(el: HTMLElement, fallback = 520) {
  return new Promise<void>((resolve) => {
    let done = false
    const finish = () => {
      if (done) {
        return
      }
      done = true
      el.removeEventListener('transitionend', onEnd)
      clearTimeout(timer)
      resolve()
    }
    const onEnd = (e: TransitionEvent) => {
      if (e.target === el && e.propertyName === 'transform') {
        finish()
      }
    }
    el.addEventListener('transitionend', onEnd)
    const timer = setTimeout(finish, fallback)
  })
}

function flipTo(rect: DOMRect) {
  const move = lbMoveRef.value
  if (!move) {
    return
  }
  const f = move.getBoundingClientRect()
  move.style.transform = `translate(${rect.left - f.left}px,${rect.top - f.top}px) scale(${rect.width / f.width},${rect.height / f.height})`
}

/** 左侧各窗口的屏幕元素，用于放大预览的起止动画 */
const cardEls: (HTMLElement | null)[] = []
function setCardEl(index: number, el: unknown) {
  cardEls[index] = (el as HTMLElement | null) || null
}
const lightboxOrder = ref(0)

async function openLightbox(index: number) {
  const win = mainWindows.value[index]
  if (!win || win.state.stage !== 'running') {
    return
  }
  const card = cardEls[index]
  if (!card) {
    return
  }
  const token = ++lbToken
  lightboxOrder.value = win.phone.order
  lbCard = card
  lbPlaying.value = false
  lbAnimating.value = true
  lightbox.value = { from: card.getBoundingClientRect() }
  await nextTick()
  const move = lbMoveRef.value
  if (!move) {
    return
  }
  move.style.transition = 'none'
  flipTo(lightbox.value.from)
  move.getBoundingClientRect()
  // 多等一帧：让新挂载的桌面先完成首帧绘制，再开始放大，避免动画第一帧卡住
  requestAnimationFrame(() => requestAnimationFrame(async () => {
    if (token !== lbToken) {
      return
    }
    lightboxOn.value = true
    move.style.transition = ''
    move.style.transform = 'none'
    await waitTransform(move)
    if (token !== lbToken) {
      return
    }
    lbAnimating.value = false
    lbPlaying.value = true
  }))
}

async function closeLightbox() {
  if (!lightbox.value || !lightboxOn.value) {
    return
  }
  const token = ++lbToken
  const move = lbMoveRef.value
  lbAnimating.value = true
  if (lbCard) {
    flipTo(lbCard.getBoundingClientRect())
  }
  lightboxOn.value = false
  if (move) {
    await waitTransform(move)
  }
  if (token !== lbToken) {
    return
  }
  lightbox.value = null
  lbAnimating.value = false
  lbPlaying.value = false
  last = performance.now()
}
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    closeLightbox()
  }
})

onMounted(() => {
  if (isReduced.value) {
    bootFinished.value = true
  }
  last = performance.now()
  if (!bootFinished.value) {
    raf = requestAnimationFrame(tick)
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
})
</script>

<template>
  <section
    ref="section"
    class="phone-wall flex flex-col overflow-hidden bg-[var(--colors-background-bg-page)] p-4 px-16 pt-16"
    aria-label="Cloud phone matrix preview"
  >
    <!-- 左一大 + 右多小群控矩阵：左对齐，缩放时左侧主屏位置固定，只在右侧增减列 -->
    <div
      ref="stage"
      class="phone-wall__stage relative min-h-0 w-full flex flex-1 justify-start gap-5 overflow-hidden select-none"
    >
      <!-- 左侧：多台云手机窗口（第 1 台为可切换的主控屏） -->
      <div class="h-full flex shrink-0 gap-5">
      <div
        v-for="(win, wi) in mainWindows"
        :key="wi"
        class="h-full flex shrink-0 flex-col gap-2 overflow-hidden"
        :style="{ width: `${mainFrameWidth}px` }"
      >
        <!-- 设备标题（独立放在窗口上方，与右侧状态栏等高 h-9） -->
        <div class="h-9 flex shrink-0 items-center px-0.5">
          <span class="min-w-0 truncate text-4 font-600 tt-primary" :title="win.phone.id">
            {{ win.phone.name }}
          </span>
        </div>

        <!-- 云手机窗口：顶部标题栏 + 屏幕 + 右侧边缘操作栏 -->
        <div class="phone-wall__device flex shrink-0 flex-col overflow-hidden rounded-[18px]" :style="{ height: `${mainDeviceH}px` }">
        <!-- 窗口标题栏（高 36px） -->
        <div class="phone-wall__titlebar h-9 flex shrink-0 items-center gap-2 px-3">
          <span class="flex shrink-0 items-center gap-1.5" aria-hidden="true">
            <span class="phone-wall__light bg-[#FF5F57]" />
            <span class="phone-wall__light bg-[#FEBC2E]" />
            <span class="phone-wall__light bg-[#28C840]" />
          </span>
          <span class="flex-1" />
          <button type="button" class="phone-wall__title-btn" title="Phone page" aria-label="Phone page" @click="emit('create')">
            <!-- lucide: arrow-up-right -->
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M7 7h10v10" />
              <path d="M7 17 17 7" />
            </svg>
          </button>
          <button
            type="button"
            class="phone-wall__title-btn"
            :disabled="win.state.stage !== 'running'"
            aria-label="Expand preview"
            title="Expand preview"
            @click="openLightbox(wi)"
          >
            <!-- lucide: panel-right -->
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M15 3v18" />
            </svg>
          </button>
        </div>
        <div class="min-h-0 flex flex-1">
        <div
          :ref="(el) => setCardEl(wi, el)"
          class="phone-wall__card phone-wall__card--main relative h-full shrink-0 overflow-hidden rounded-bl-[18px]"
          :style="{ width: `${mainColWidth}px` }"
          :class="{ 'is-running cursor-pointer': win.state.stage === 'running' }"
          @click="openLightbox(wi)"
        >
          <div class="phone-wall__media absolute inset-0" :class="{ 'is-visible': win.state.stage === 'running' }">
            <AndroidHomeScreen :autoplay="bootFinished" :offset="win.phone.order" :video="win.phone.order === 0 ? mainWindowVideo : undefined" loop />
          </div>

          <!-- 主屏开机状态覆盖层 -->
          <div
            class="phone-wall__boot-overlay absolute inset-0 flex flex-col items-center justify-center px-[10cqw] text-center"
            :class="{ 'is-hidden': win.state.stage === 'running' }"
          >
            <div v-if="win.state.stage === 'stopped'" class="flex flex-col items-center">
              <svg class="phone-wall__stopped-icon mb-[6cqw] tt-secondary opacity-65" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="6.5" y="2.5" width="11" height="19" rx="2.2" stroke="currentColor" stroke-width="1.6" />
                <path d="M10.5 18.2h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
              </svg>
              <div class="phone-wall__stopped-title font-600 tt-primary">
                Phone stopped
              </div>
              <div class="phone-wall__stopped-desc mt-[2.5cqw] tt-secondary">
                Phones stop on their own after 30 minutes idle
              </div>
              <div class="phone-wall__stopped-btn mt-[8cqw] rounded-full font-600">
                Start now
              </div>
            </div>

            <div v-else class="w-full flex flex-col items-center">
              <div class="phone-wall__ring relative flex items-center justify-center">
                <svg class="h-full w-full" viewBox="0 0 44 44" fill="none" aria-hidden="true">
                  <circle
                    v-for="(angle, segIdx) in RING_ANGLES"
                    :key="segIdx"
                    cx="22" cy="22" :r="RING_RADIUS"
                    stroke-width="2.6"
                    stroke-linecap="round"
                    :stroke-dasharray="`${RING_SEG_LEN} ${RING_CIRCUMFERENCE}`"
                    :transform="`rotate(${angle} 22 22)`"
                    class="phone-wall__ring-seg"
                    :class="{
                      'is-done': segIdx < win.state.completedSteps,
                      'is-active': segIdx === win.state.activeStep,
                    }"
                  />
                </svg>
              </div>

              <div class="phone-wall__boot-hint mt-[5cqw] tt-secondary">
                Usually 1 to 3 minutes
              </div>

              <ul class="phone-wall__steps m-0 mt-[7cqw] w-full list-none p-0 text-left">
                <li
                  v-for="(_, stepIdx) in BOOT_STEPS"
                  :key="stepIdx"
                  class="phone-wall__step flex items-center"
                  :class="`is-${getStepStatus(win.state, stepIdx)}`"
                >
                  <svg
                    v-if="getStepStatus(win.state, stepIdx) === 'done'"
                    class="phone-wall__step-icon shrink-0 text-[#10B981]"
                    viewBox="0 0 12 12" fill="none" aria-hidden="true"
                  >
                    <path d="M2.5 6.3L4.9 8.6L9.5 3.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <span
                    v-else-if="getStepStatus(win.state, stepIdx) === 'active'"
                    class="phone-wall__step-dot phone-wall__step-dot--active shrink-0 rounded-full"
                  />
                  <span
                    v-else
                    class="phone-wall__step-dot phone-wall__step-dot--pending shrink-0 rounded-full"
                  />
                  <span class="truncate">{{ getStepLabel(win.state, stepIdx) }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- 边缘操作栏（图标来自 Lucide：https://lucide.dev/icons/） -->
        <aside
          class="phone-wall__toolbar h-full flex shrink-0 flex-col items-center"
          :style="{ width: `${TOOLBAR_W}px`, '--tb': `${TOOLBAR_W}px` }"
          @click.stop
        >
          <!-- lucide: signal 去掉最左的点，保留 4 条信号柱 -->
          <div class="phone-wall__tool" title="Signal">
            <span class="phone-wall__tool-btn" style="color: #22C55E">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4.5 20v-3" />
                <path d="M9.5 20v-7" />
                <path d="M14.5 20v-11" />
                <path d="M19.5 20V5" />
              </svg>
            </span>
          </div>
          <!-- lucide: timer -->
          <div class="phone-wall__tool" title="Timer">
            <span class="phone-wall__tool-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="10" x2="14" y1="2" y2="2" />
                <line x1="12" x2="15" y1="14" y2="11" />
                <circle cx="12" cy="14" r="8" />
              </svg>
            </span>
          </div>
          <!-- lucide: rotate-cw-square -->
          <div class="phone-wall__tool" title="Rotate">
            <span class="phone-wall__tool-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 5H6a2 2 0 0 0-2 2v3" />
                <path d="m9 8 3-3-3-3" />
                <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
              </svg>
            </span>
          </div>
          <!-- lucide: scissors -->
          <div class="phone-wall__tool" title="Screenshot">
            <span class="phone-wall__tool-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="6" cy="6" r="3" />
                <path d="M8.12 8.12 12 12" />
                <path d="M20 4 8.12 15.88" />
                <circle cx="6" cy="18" r="3" />
                <path d="M14.8 14.8 20 20" />
              </svg>
            </span>
          </div>
          <!-- lucide: upload -->
          <div class="phone-wall__tool" title="Upload">
            <span class="phone-wall__tool-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 3v12" />
                <path d="m17 8-5-5-5 5" />
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              </svg>
            </span>
          </div>
          <!-- lucide: download -->
          <div class="phone-wall__tool" title="Export">
            <span class="phone-wall__tool-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 15V3" />
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="m7 10 5 5 5-5" />
              </svg>
            </span>
          </div>
          <!-- lucide: webcam -->
          <div class="phone-wall__tool" title="Camera">
            <span class="phone-wall__tool-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="10" r="8" />
                <circle cx="12" cy="10" r="3" />
                <path d="M7 22h10" />
                <path d="M12 22v-4" />
              </svg>
            </span>
          </div>
          <!-- lucide: crop -->
          <div class="phone-wall__tool" title="Crop">
            <span class="phone-wall__tool-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M6 2v14a2 2 0 0 0 2 2h14" />
                <path d="M18 22V8a2 2 0 0 0-2-2H2" />
              </svg>
            </span>
          </div>
          <div class="min-h-0 flex-1" />
          <!-- lucide: shopping-bag -->
          <div class="phone-wall__tool" title="Apps">
            <span class="phone-wall__tool-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M16 10a4 4 0 0 1-8 0" />
                <path d="M3.103 6.034h17.794" />
                <path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z" />
              </svg>
            </span>
          </div>
        </aside>
        </div>
        </div>
      </div>
      </div>

      <!-- 右侧：顶部状态栏 + 多行多列小屏矩阵 -->
      <div class="min-w-0 flex shrink-0 flex-col gap-2" :style="{ width: `${gridContentWidth}px` }">
        <!-- 状态栏（与左侧顶部栏等高 h-9，保证左右屏幕顶边严格对齐） -->
        <div class="h-9 flex shrink-0 items-center gap-2.5 pl-0.5">
          <span class="text-4 font-600 tt-primary">
            Active streams
          </span>
          <!-- 运行台数（按设计稿）：钉钉进步体 12px，成功色文字 + 成功色浅底，圆角 6px -->
          <span v-if="runningCount > 0" class="phone-wall__running ml-auto inline-flex items-center justify-center tabular-nums">
            {{ runningCount }} Running
          </span>
        </div>

        <!-- 多行多列小屏网格：小屏尺寸固定，行数 / 列数随可用空间增减 -->
        <div
          ref="gridWrap"
          class="min-h-0 flex-1 grid content-start justify-start"
          :style="{
            gridTemplateColumns: `repeat(${gridCols}, ${smallCardW}px)`,
            gridTemplateRows: `repeat(${gridRows}, ${smallCardH}px)`,
            gap: `${GRID_GAP}px`,
          }"
        >
          <div
            v-for="(phone, idx) in smallPhones"
            :key="phone.order"
            class="phone-wall__card phone-wall__card--small relative overflow-hidden rounded-[11px]"
            :class="{
              'is-running cursor-pointer': smallStates[idx].stage === 'running',
              'is-selected': selectedOrder === phone.order,
            }"
            role="button"
            :aria-label="phone.name"
            @click="selectAsMain(phone, smallStates[idx])"
          >
            <!-- 底层：Android 桌面（纯圆角矩形裁切，无 border） -->
            <div class="phone-wall__media absolute inset-0" :class="{ 'is-visible': smallStates[idx].stage === 'running' }">
              <AndroidHomeScreen :autoplay="bootFinished" :offset="phone.order" :play-video="false" loop :loop-pause="6000 + (phone.order % 4) * 1500" />
            </div>

            <!-- 顶层：未打开 -> 四步开机 -> 淡出遮罩 -->
            <div
              class="phone-wall__boot-overlay absolute inset-0 flex flex-col items-center justify-center px-[8cqw] text-center"
              :class="{ 'is-hidden': smallStates[idx].stage === 'running' }"
            >
              <div v-if="smallStates[idx].stage === 'stopped'" class="flex flex-col items-center">
                <svg class="phone-wall__stopped-icon mb-[6cqw] tt-secondary opacity-65" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="6.5" y="2.5" width="11" height="19" rx="2.2" stroke="currentColor" stroke-width="1.6" />
                  <path d="M10.5 18.2h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                </svg>
                <div class="phone-wall__stopped-title font-600 tt-primary">
                  Phone stopped
                </div>
                <div class="phone-wall__stopped-desc mt-[3cqw] tt-secondary">
                  Phones stop on their own after 30 minutes idle
                </div>
                <div class="phone-wall__stopped-btn mt-[8cqw] rounded-full font-600">
                  Start now
                </div>
              </div>

              <div v-else class="w-full flex flex-col items-center">
                <div class="phone-wall__ring relative flex items-center justify-center">
                  <svg class="h-full w-full" viewBox="0 0 44 44" fill="none" aria-hidden="true">
                    <circle
                      v-for="(angle, segIdx) in RING_ANGLES"
                      :key="segIdx"
                      cx="22" cy="22" :r="RING_RADIUS"
                      stroke-width="2.8"
                      stroke-linecap="round"
                      :stroke-dasharray="`${RING_SEG_LEN} ${RING_CIRCUMFERENCE}`"
                      :transform="`rotate(${angle} 22 22)`"
                      class="phone-wall__ring-seg"
                      :class="{
                        'is-done': segIdx < smallStates[idx].completedSteps,
                        'is-active': segIdx === smallStates[idx].activeStep,
                      }"
                    />
                  </svg>
                </div>

                <div class="phone-wall__boot-hint mt-[5cqw] tt-secondary">
                  Usually 1 to 3 minutes
                </div>

                <ul class="phone-wall__steps m-0 mt-[7cqw] w-full list-none p-0 text-left">
                  <li
                    v-for="(_, stepIdx) in BOOT_STEPS"
                    :key="stepIdx"
                    class="phone-wall__step flex items-center"
                    :class="`is-${getStepStatus(smallStates[idx], stepIdx)}`"
                  >
                    <svg
                      v-if="getStepStatus(smallStates[idx], stepIdx) === 'done'"
                      class="phone-wall__step-icon shrink-0 text-[#10B981]"
                      viewBox="0 0 12 12" fill="none" aria-hidden="true"
                    >
                      <path d="M2.5 6.3L4.9 8.6L9.5 3.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    <span
                      v-else-if="getStepStatus(smallStates[idx], stepIdx) === 'active'"
                      class="phone-wall__step-dot phone-wall__step-dot--active shrink-0 rounded-full"
                    />
                    <span
                      v-else
                      class="phone-wall__step-dot phone-wall__step-dot--pending shrink-0 rounded-full"
                    />
                    <span class="truncate">{{ getStepLabel(smallStates[idx], stepIdx) }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态提示卡片（按设计稿）：毛玻璃底，压在手机矩阵底部、水平居中 -->
      <div class="phone-wall__notice absolute z-10 flex items-center gap-6 p-8" :style="noticeStyle">
        <div class="min-w-0 flex flex-1 items-start gap-6">
          <RxSvgIcon name="base/rx_ic_cloud_phone" size="40" color="var(--colors-icon-icon-brand)" class="shrink-0" aria-hidden="true" />
          <div class="min-w-0 flex flex-1 flex-col items-start gap-3">
            <h2 class="m-0 text-4.5 font-600 leading-normal tt-primary">
              {{ $t('暂无云手机') }}
            </h2>
            <p class="m-0 text-3.25 font-400 leading-4 tt-secondary">
              {{ $t('创建您的第一台云手机以开始使用。您的免费试用包含 30 分钟使用时间。') }}
            </p>
          </div>
        </div>
        <RxButton size="md" icon="base/rx_ic_browser_add" :label="$t('创建云手机')" class="shrink-0" @click="emit('create')" />
      </div>
    </div>

    <!-- 灯箱：高清放大预览左侧主控桌面 -->
    <Teleport to="body">
      <div
        v-if="lightbox" class="phone-wall__lb fixed inset-0 z-2000 flex items-center justify-center"
        :class="{ 'is-on': lightboxOn }" @click.self="closeLightbox"
      >
        <div ref="lbMove" class="phone-wall__lb-move" :class="{ 'is-animating': lbAnimating }">
          <div class="relative overflow-hidden rounded-[21px]" :style="{ width: `${lbFrame.width}px`, height: `${lbFrame.height}px` }">
            <AndroidHomeScreen :autoplay="bootFinished && lbPlaying" :offset="lightboxOrder" :video="lightboxOrder === 0 ? mainWindowVideo : undefined" loop />
          </div>
        </div>
        <button class="phone-wall__lb-close absolute right-5 top-5 size-10 flex cursor-pointer items-center justify-center rounded-full" :aria-label="$t('关闭')" @click="closeLightbox">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
        </button>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.phone-wall__card {
  background: color-mix(in srgb, #64748b 10%, var(--colors-background-bg-page));
  container-type: inline-size;
  isolation: isolate;
  transform: translateZ(0);
  transition: box-shadow 0.2s ease;
}

.phone-wall__card--main {
  clip-path: inset(0 round 0 0 0 18px);
}

.phone-wall__card--small {
  --bezel: 3px;
  clip-path: inset(0 round 11px);
  background: #000;
}

/* 屏幕内容缩进边框宽度，边框像手机外框一样围在屏幕外面，不再盖住内容 */
.phone-wall__card--small > .phone-wall__media,
.phone-wall__card--small > .phone-wall__boot-overlay {
  inset: var(--bezel);
  overflow: hidden;
  border-radius: calc(11px - var(--bezel));
}

/* 小屏浅色描边：用内嵌覆盖层绘制（外层 clip-path 会裁掉普通 border/外阴影），
   避免浅色 APP 界面与白色页面背景融在一起 */
.phone-wall__card--small::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 5;
  border: var(--bezel) solid #000;
  border-radius: 11px;
  pointer-events: none;
}

.phone-wall__card--small.is-selected {
  --bezel: 4px;
}

.phone-wall__card--small.is-selected::after {
  border-color: #10b981;
}

.phone-wall__card.is-selected {
  box-shadow: 0 0 0 2px #10b981;
}

.phone-wall__media {
  opacity: 0;
  transition:
    opacity 0.55s ease-out,
    transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.phone-wall__media.is-visible {
  opacity: 1;
}


/* 开机状态覆盖层（默认加载时的蓝灰色底，兼容浅色/深色主题） */
.phone-wall__boot-overlay {
  background: color-mix(in srgb, #64748b 10%, var(--colors-background-bg-page));
  opacity: 1;
  transition:
    opacity 0.55s ease-out,
    transform 0.55s cubic-bezier(0.16, 1, 0.3, 1);
}

.phone-wall__boot-overlay.is-hidden {
  opacity: 0;
  transform: scale(1.03);
  pointer-events: none;
}

/* 卡片内元素按容器宽度 cqw 自适应，同时兼容左侧大屏与右侧紧凑小屏 */
.phone-wall__stopped-icon {
  width: clamp(13px, 15cqw, 28px);
  height: clamp(13px, 15cqw, 28px);
}

.phone-wall__stopped-title {
  font-size: clamp(8.5px, 8.2cqw, 15px);
  line-height: 1.25;
}

.phone-wall__stopped-desc {
  max-width: 90%;
  font-size: clamp(6.5px, 6cqw, 11.5px);
  line-height: 1.3;
}

.phone-wall__stopped-btn {
  padding: clamp(2px, 2.8cqw, 6px) clamp(8px, 10cqw, 20px);
  background: var(--colors-background-bg-page);
  color: var(--colors-text-text-primary);
  font-size: clamp(7.5px, 6.8cqw, 12.5px);
  line-height: 1.2;
}

/* 四段式进度环 */
.phone-wall__ring {
  width: clamp(28px, 34cqw, 68px);
  height: clamp(28px, 34cqw, 68px);
}

.phone-wall__ring-seg {
  stroke: color-mix(in srgb, #64748b 24%, transparent);
  transition: stroke 0.25s ease;
}

.phone-wall__ring-seg.is-done {
  stroke: #10b981;
}

.phone-wall__ring-seg.is-active {
  stroke: #3b82f6;
  animation: phone-wall-pulse 1.1s ease-in-out infinite;
}


.phone-wall__boot-hint {
  font-size: clamp(6.5px, 5.8cqw, 11px);
  line-height: 1.2;
}

/* 启动步骤列表 */
.phone-wall__steps {
  display: flex;
  flex-direction: column;
  gap: clamp(2.5px, 3.2cqw, 8px);
  padding-inline: clamp(1px, 3cqw, 10px);
}

.phone-wall__step {
  gap: clamp(3.5px, 4cqw, 8px);
  font-size: clamp(7px, 6.4cqw, 12.5px);
  line-height: 1.25;
  transition: color 0.25s ease;
}

.phone-wall__step.is-done {
  color: color-mix(in srgb, var(--colors-text-text-primary) 78%, transparent);
}

.phone-wall__step.is-active {
  color: var(--colors-text-text-primary);
  font-weight: 500;
}

.phone-wall__step.is-pending {
  color: color-mix(in srgb, var(--colors-text-text-primary) 38%, transparent);
}

.phone-wall__step-icon {
  width: clamp(7.5px, 7cqw, 13px);
  height: clamp(7.5px, 7cqw, 13px);
}

.phone-wall__step-dot {
  width: clamp(4px, 3.8cqw, 7px);
  height: clamp(4px, 3.8cqw, 7px);
  margin-inline: clamp(1.5px, 1.5cqw, 3px);
}

.phone-wall__step-dot--active {
  background: #3b82f6;
  box-shadow: 0 0 6px rgba(59, 130, 246, 0.55);
  animation: phone-wall-pulse 1.1s ease-in-out infinite;
}

.phone-wall__step-dot--pending {
  border: 1px solid color-mix(in srgb, var(--colors-text-text-primary) 30%, transparent);
}

@keyframes phone-wall-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.45;
  }
}

/* 灯箱 */
.phone-wall__lb {
  /* 不用 backdrop-filter：全屏模糊会在背后十几台桌面每次重绘时整屏重算，是放大/缩小卡顿的主要来源 */
  background: rgba(8, 8, 10, 0.92);
  opacity: 0;
  transition: opacity 0.32s;
}

.phone-wall__lb.is-on {
  opacity: 1;
}

.phone-wall__lb-move {
  transform-origin: 0 0;
  transition: transform 0.42s cubic-bezier(0.16, 1, 0.3, 1);
}

.phone-wall__lb-move.is-animating {
  will-change: transform;
}

.phone-wall__lb-close {
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.phone-wall__lb-close:hover {
  background: rgba(255, 255, 255, 0.16);
}

.phone-wall__titlebar {
  background: #f6f7f9;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.phone-wall__light {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.12);
}

.phone-wall__title-btn {
  display: flex;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #374151;
  cursor: pointer;
}

.phone-wall__title-btn:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.06);
}

.phone-wall__title-btn:disabled {
  cursor: default;
  opacity: 0.4;
}

.phone-wall__device {
  position: relative;
  /* 自成层叠上下文：描边覆盖层的 z-index 只在窗口内部生效，不会盖到外面的空状态卡片上 */
  isolation: isolate;
  background: #f1f4f9;
}

/* 窗口描边：画在窗口内部的覆盖层上。
   原来用外扩 1px 的 box-shadow，但外层列容器有 overflow: hidden 且窗口贴着列的左边缘，
   左侧（以及右侧）那 1px 被裁掉，浅色 APP 界面时左边就像没有边框 */
.phone-wall__device::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 20;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: inherit;
  pointer-events: none;
}

/* 右侧操作栏：浅蓝灰底、白色圆按钮、图标下方深灰文字 */
.phone-wall__toolbar {
  gap: calc(var(--tb) * 0.2);
  padding: calc(var(--tb) * 0.28) 0 calc(var(--tb) * 0.22);
  background: #f1f4f9;
  color: #6b7280;
  overflow: hidden;
}

.phone-wall__tool {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
  gap: calc(var(--tb) * 0.08);
}

.phone-wall__tool-btn {
  display: flex;
  width: calc(var(--tb) * 0.9);
  height: calc(var(--tb) * 0.9);
  align-items: center;
  justify-content: center;
  background: transparent;
}

.phone-wall__tool-btn svg {
  width: 50%;
  height: 50%;
}

.phone-wall__tool-label {
  max-width: 92%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: calc(var(--tb) * 0.22);
  line-height: 1.2;
  color: #374151;
}

/* 运行台数：与站内其他数字展示一致，使用钉钉进步体 */
.phone-wall__running {
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--colors-background-bg-success);
  color: var(--colors-text-text-success);
  font-family: 'DingTalk JinBuTi', Inter, sans-serif;
  font-size: 12px;
  font-weight: 400;
  line-height: normal;
}

/* 空状态提示卡片：毛玻璃底（在设计稿 #E5E5E5 80% 基础上略微提亮）+ 白色 20% 描边 + 12px 背景模糊 */
.phone-wall__notice {
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(238, 238, 238, 0.84);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
</style>
