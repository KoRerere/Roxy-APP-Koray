<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useDocumentVisibility, useElementSize, useElementVisibility, useEventListener, usePreferredReducedMotion } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
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

const GRID_ROWS = 2
/** 小屏尺寸按 2.3 行计算：比按 3 行大约 30% */
const SIZE_ROWS = 2.3
const GRID_GAP = 14
/** 手机屏幕宽高比 9:18 */
const PHONE_ASPECT = 9 / 18

/** 开机推进节奏（毫秒） */
const BOOT_CONFIG = {
  initialHold: 550, // 进场先停留展示全员“未打开”状态
  itemStagger: 115, // 每台云手机依次开始启动的间隔
  stepDuration: 420, // 每个启动步骤的时长（共 4 步）
  revealDelay: 160, // 4 步全绿后短暂停留再淡出遮罩显现桌面
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
const { width: stageWidth } = useElementSize(stageRef)
const { height: gridHeight } = useElementSize(gridWrapRef)
const STAGE_GAP = 20
/** 主屏高度 = 右侧 2 行小屏 + 1 个间距（比整列高度更小） */
const MAIN_ROWS = 1.75

/** 右侧小屏按 3 行高度与标准宽高比算出统一宽度，保持所有小屏宽度一致且不裁切 */
const smallCardH = computed(() => {
  const h = gridHeight.value || 540
  return Math.max((h - GRID_GAP * (SIZE_ROWS - 1)) / SIZE_ROWS, 120)
})
const smallCardW = computed(() => Math.round(smallCardH.value * PHONE_ASPECT))
const mainScreenH = computed(() => Math.round(smallCardH.value * MAIN_ROWS + GRID_GAP * (MAIN_ROWS - 1)))
/** 左侧主控大屏按手机标准宽高比计算宽度，避免裁切 */
const mainColWidth = computed(() => Math.round(mainScreenH.value * PHONE_ASPECT))
/** 主屏右侧边缘操作栏宽度：按屏幕宽度等比（参照云手机窗口约 12.5%） */
const TOOLBAR_W = computed(() => Math.min(Math.max(Math.round(mainColWidth.value * 0.09), 34), 46))
const mainFrameWidth = computed(() => mainColWidth.value + TOOLBAR_W.value)

const C = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`
const TOOLBAR_ITEMS = [
  { key: 'timer', label: 'Timer', d: `${C(12, 12, 8.5)}M12 7.5V12l3 2` },
  { key: 'rotate', label: 'Rotate', d: 'M9 3.5h5a1 1 0 0 1 1 1V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1ZM15 9.5h4a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V18M18 3.5a3 3 0 0 1 2.5 2.5M19.5 5.5l1 .5.5-1' },
  { key: 'shot', label: 'Screenshot', d: `M4 3.5h16v17H4ZM8.5 6.5l7 8M15.5 6.5l-7 8${C(8.5, 16.5, 2)}${C(15.5, 16.5, 2)}` },
  { key: 'upload', label: 'Upload', d: 'M4 13.5h4.5l1 2h5l1-2H20M4 13.5V20h16v-6.5M4 13.5 6 5h3M20 13.5 18 5h-3M12 12V3.5M9 6.5l3-3 3 3' },
  { key: 'export', label: 'Export', d: 'M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15' },
  { key: 'camera', label: 'Camera', d: `${C(12, 10, 7)}${C(12, 10, 2.8)}M8 21h8M12 17v4` },
  { key: 'crop', label: 'Get text', d: 'M6.5 2.5v13a2 2 0 0 0 2 2h13M17.5 21.5v-13a2 2 0 0 0-2-2h-13' },
]
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

interface PhoneItem {
  /** 全局启动顺序索引：0 为左侧主屏，1..N 为右侧网格从左到右逐行排列 */
  order: number
  name: string
  id: string
}

const smallPhones = computed<PhoneItem[]>(() => {
  const total = GRID_ROWS * gridCols.value
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
const lbMoveRef = useTemplateRef<HTMLElement>('lbMove')
let lbCard: HTMLElement | null = null

const lbFrame = computed(() => {
  const pad = Math.min(Math.max(window.innerWidth * 0.05, 16), 64) * 2
  const maxH = window.innerHeight - pad
  const h = Math.min(maxH, 720)
  return { width: Math.round(h * PHONE_ASPECT), height: Math.round(h) }
})

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
  lightboxOrder.value = win.phone.order
  lbCard = card
  lightbox.value = { from: card.getBoundingClientRect() }
  await nextTick()
  const move = lbMoveRef.value
  if (!move) {
    return
  }
  move.style.transition = 'none'
  flipTo(lightbox.value.from)
  move.getBoundingClientRect()
  requestAnimationFrame(() => {
    lightboxOn.value = true
    move.style.transition = ''
    move.style.transform = 'none'
  })
}

function closeLightbox() {
  if (!lightbox.value) {
    return
  }
  if (lbCard) {
    flipTo(lbCard.getBoundingClientRect())
  }
  lightboxOn.value = false
  setTimeout(() => {
    lightbox.value = null
    last = performance.now()
  }, 400)
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
    <!-- 左一大 + 右多小群控矩阵 -->
    <div
      ref="stage"
      class="phone-wall__stage min-h-0 w-full flex flex-1 justify-center gap-5 overflow-hidden select-none"
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
          <span class="min-w-0 truncate text-3.25 font-600 tt-primary" :title="win.phone.id">
            {{ win.phone.name }}
          </span>
        </div>

        <!-- 云手机窗口：顶部标题栏 + 屏幕 + 右侧边缘操作栏 -->
        <div class="phone-wall__device flex shrink-0 flex-col overflow-hidden rounded-[18px]" :style="{ height: `${mainScreenH + 36}px` }">
        <!-- 窗口标题栏（高 36px） -->
        <div class="phone-wall__titlebar h-9 flex shrink-0 items-center gap-2 px-3">
          <span class="flex shrink-0 items-center gap-1.5" aria-hidden="true">
            <span class="phone-wall__light bg-[#FF5F57]" />
            <span class="phone-wall__light bg-[#FEBC2E]" />
            <span class="phone-wall__light bg-[#28C840]" />
          </span>
          <span class="flex-1" />
          <button type="button" class="phone-wall__title-btn" title="Phone page" aria-label="Phone page" @click="emit('create')">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4.5 11.5L11.5 4.5M11.5 4.5H6M11.5 4.5V10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" stroke="currentColor" stroke-width="1.8" />
              <path d="M14.5 4.5v15" stroke="currentColor" stroke-width="1.8" />
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
            <AndroidHomeScreen :autoplay="bootFinished" :offset="win.phone.order" :video="win.phone.order === 0 ? mainWindowVideo : undefined" />
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
                <span class="phone-wall__ring-time absolute font-600 tt-primary tabular-nums">
                  {{ win.state.timerText }}
                </span>
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

        <!-- 边缘操作栏（参照云手机窗口右侧操作栏） -->
        <aside
          class="phone-wall__toolbar h-full flex shrink-0 flex-col items-center"
          :style="{ width: `${TOOLBAR_W}px`, '--tb': `${TOOLBAR_W}px` }"
          @click.stop
        >
          <div class="phone-wall__tool">
            <span class="phone-wall__tool-btn">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 19v-2.5M10 19v-5M14 19v-8M18 19V8.5" stroke="#22C55E" stroke-width="2.6" stroke-linecap="round" />
              </svg>
            </span>
          </div>
          <div v-for="item in TOOLBAR_ITEMS" :key="item.key" class="phone-wall__tool" :title="item.label">
            <span class="phone-wall__tool-btn">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path :d="item.d" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
          </div>
          <div class="min-h-0 flex-1" />
          <div class="phone-wall__tool" title="Apps">
            <span class="phone-wall__tool-btn">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5.5 7.5h13l-1 13h-11l-1-13ZM9 10.5V7a3 3 0 0 1 6 0v3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
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
        <div class="h-9 flex shrink-0 items-center gap-2.5 px-0.5">
          <span class="text-3 font-600 tt-primary">
            Active streams <span class="font-400 tt-secondary">({{ totalStreamCount }})</span>
          </span>
          <span class="text-2.75 tt-secondary">
            Click a phone to make it the main stream.
          </span>
          <span
            v-if="runningCount > 0"
            class="inline-flex items-center gap-1.5 rounded-full bg-[#16A34A]/12 px-2 py-0.5 text-2.5 font-500 text-[#16A34A] tabular-nums"
          >
            <span class="size-1.5 rounded-full bg-[#16A34A]" />
            {{ runningCount }} running
          </span>
        </div>

        <!-- 2 行多列小屏网格（每台小屏保持统一标准宽度，不裁切） -->
        <div
          ref="gridWrap"
          class="min-h-0 flex-1 grid content-start justify-start"
          :style="{
            gridTemplateColumns: `repeat(${gridCols}, ${smallCardW}px)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, ${smallCardH}px)`,
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
              <AndroidHomeScreen :autoplay="bootFinished" :offset="phone.order" :play-video="false" />
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
                  <span class="phone-wall__ring-time absolute font-600 tt-primary tabular-nums">
                    {{ smallStates[idx].timerText }}
                  </span>
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
    </div>

    <!-- 灯箱：高清放大预览左侧主控桌面 -->
    <Teleport to="body">
      <div
        v-if="lightbox" class="phone-wall__lb fixed inset-0 z-2000 flex items-center justify-center"
        :class="{ 'is-on': lightboxOn }" @click.self="closeLightbox"
      >
        <div ref="lbMove" class="phone-wall__lb-move">
          <div class="relative overflow-hidden rounded-[21px]" :style="{ width: `${lbFrame.width}px`, height: `${lbFrame.height}px` }">
            <AndroidHomeScreen :autoplay="bootFinished" :offset="lightboxOrder" :video="lightboxOrder === 0 ? mainWindowVideo : undefined" />
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
  clip-path: inset(0 round 11px);
}

/* 小屏浅色描边：用内嵌覆盖层绘制（外层 clip-path 会裁掉普通 border/外阴影），
   避免浅色 APP 界面与白色页面背景融在一起 */
.phone-wall__card--small::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 5;
  border: 2px solid rgba(15, 23, 42, 0.1);
  border-radius: inherit;
  pointer-events: none;
}

.phone-wall__card--small.is-selected::after {
  border: 3px solid #10b981;
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

.phone-wall__card.is-running:hover .phone-wall__media {
  transform: scale(1.03);
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

.phone-wall__ring-time {
  font-size: clamp(7.5px, 7.6cqw, 14px);
  line-height: 1;
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
  background: rgba(8, 8, 10, 0.9);
  backdrop-filter: blur(14px);
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
  width: 22px;
  height: 22px;
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
  background: #f1f4f9;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.08);
}

/* 右侧操作栏：浅蓝灰底、白色圆按钮、图标下方深灰文字 */
.phone-wall__toolbar {
  gap: calc(var(--tb) * 0.2);
  padding: calc(var(--tb) * 0.28) 0 calc(var(--tb) * 0.22);
  background: #f1f4f9;
  color: #111827;
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
  width: 48%;
  height: 48%;
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
</style>
