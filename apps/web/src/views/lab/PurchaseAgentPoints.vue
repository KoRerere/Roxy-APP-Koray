<script setup lang="ts">
import { computed, ref } from 'vue'
import RxSlider from '/@/components/rx-slider'
import RxStepInput from '/@/components/rx-step-input'
import RxButton from '/@/components/rx-button'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  hideModal: () => void
}>()

const MIN_POINTS = 500
const MAX_POINTS = 50000

// ── Slider marks ────────────────────────────────────────────────────
const POINTS_MARKS = [
  { value: 0 },
  { value: 500, step: 100 },
  { value: 1000, step: 1000 },
  { value: 5000, step: 1000 },
  { value: 10000, step: 1000 },
  { value: MAX_POINTS, step: 1000 },
]

// Price per 100 points (matching design: $1.47 for 100 points)
const UNIT_PRICE = 1.47

// ── State ────────────────────────────────────────────────────────────
const points = ref(MIN_POINTS)

// ── Computed ─────────────────────────────────────────────────────────
/**
 * + 方向步长：取当前值所在段的 step（from ≤ v < to）
 * 例如 1000 处于 1000→5000 段，step=1000，+ → 2000
 */
const plusStep = computed(() => {
  for (let i = 0; i < POINTS_MARKS.length - 1; i++) {
    const from = POINTS_MARKS[i]!
    const to = POINTS_MARKS[i + 1]!
    if (points.value >= from.value && points.value < to.value) {
      return from.step ?? (to.value - from.value)
    }
  }
  // at max
  const lastFrom = POINTS_MARKS[POINTS_MARKS.length - 2]!
  return lastFrom.step ?? 1000
})

/**
 * - 方向步长：取上一段的 step（from < v ≤ to）
 * 例如 1000 处于上一段 500→1000，step=100，- → 900
 */
const minusStep = computed(() => {
  for (let i = 0; i < POINTS_MARKS.length - 1; i++) {
    const from = POINTS_MARKS[i]!
    const to = POINTS_MARKS[i + 1]!
    if (points.value > from.value && points.value <= to.value) {
      return from.step ?? (to.value - from.value)
    }
  }
  return 100
})

/** 拦截 + 操作：用 plusStep 手动设值，return false 阻止组件内部计算 */
function beforePlus(value: number): boolean {
  points.value = Math.min(value + plusStep.value, MAX_POINTS)
  return false
}
/** 拦截 - 操作：用 minusStep 手动设值，return false 阻止组件内部计算 */
function beforeMinus(value: number): boolean {
  points.value = Math.max(value - minusStep.value, MIN_POINTS)
  return false
}

const actualPrice = computed(() =>
  ((points.value / 100) * UNIT_PRICE).toFixed(2),
)

const benefits = computed(() => ({
  videoPosting: Math.floor(points.value / 1),
  materials: Math.floor(points.value / 5),
  dataCapture: Math.floor(points.value / 7),
  accountNurturing: Math.floor(points.value / 4),
}))

// ── Format helpers ───────────────────────────────────────────────────
function formatMarkLabel(value: number): string {
  if (value === 0) return '0'
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return String(value)
}

function handlePay() {
  // TODO: integrate with payment flow
  console.log('Pay now:', points.value, 'points, $' + actualPrice.value)
  props.hideModal()
}
</script>

<template>
  <div class="bg-white flex flex-col gap-6 p-6 rounded-3">
    <!-- ── Header ────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between shrink-0 w-full">
      <p class="text-5 font-semibold text-[var(--colors-text-text-primary)] leading-normal my-0">
        {{ $t('购买 Agent 积分') }}
      </p>
      <button
        class="flex items-center justify-center p-2 rounded-1.5 shrink-0 cursor-pointer bg-transparent border-0"
        @click="props.hideModal"
      >
        <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" />
      </button>
    </div>

    <!-- ── Body ──────────────────────────────────────────────────── -->
    <div class="flex flex-col gap-4 items-center w-full">
      <!-- Subtitle -->
      <div class="flex flex-col gap-1.5 items-center w-full leading-normal">
        <p class="text-4.5 font-semibold text-[var(--colors-text-text-primary)] my-0">
          {{ $t('滑动选择积分') }}
        </p>
        <p class="text-3 font-normal text-[var(--colors-text-text-tertiary)] my-0">
          {{ $t('购买后积分永久有效') }}
        </p>
      </div>

      <!-- Slider + Input row -->
      <div class="flex items-start justify-between w-full gap-10">
        <div class="flex-1">
          <RxSlider
            v-model="points"
            :marks="POINTS_MARKS"
            :min="MIN_POINTS"
            :padding="0.05"
            :thumb-size="22"
            :mark-size="8"
            class="!mb-[30px]"
          >
            <template #mark="{ value, isActive }">
              <span
                class="text-[14px] whitespace-nowrap font-normal"
                :class="isActive ? 'text-[var(--colors-text-text-primary)] font-medium' : 'text-[var(--colors-text-text-tertiary)]'"
              >
                {{ formatMarkLabel(value) }}
              </span>
            </template>
            <template #popup="{ value }">
              {{ formatMarkLabel(value) }} {{ $t('积分') }}
            </template>
          </RxSlider>
        </div>

        <RxStepInput
          v-model="points"
          :step="100"
          :min="MIN_POINTS"
          :max="MAX_POINTS"
          :before-plus="beforePlus"
          :before-minus="beforeMinus"
          size="lg"
          class="shrink-0 !w-30"
        />
      </div>
    </div>

    <!-- ── Bottom cards ──────────────────────────────────────────── -->
    <div class="flex gap-5 w-full">
      <!-- Left: Benefits card -->
      <div
        class="flex-1 flex flex-col gap-3 p-4 rounded-2 border border-solid border-[var(--colors-border-border-inactive)]"
      >
        <p class="font-semibold my-0 w-full">
          <span class="text-6 text-[var(--colors-text-text-primary)] font-[DingTalk_Sans] leading-[30px] mr-1">{{ points }}</span>
          <span class="text-3 font-medium text-[var(--colors-text-text-secondary)] leading-normal">{{ $t('积分') }}</span>
        </p>

        <div class="flex flex-col gap-2 text-[var(--colors-text-text-tertiary)] w-full">
          <p class="text-[14px] leading-[20px] font-normal my-0">
            {{ $t('可生成以下任意场景：') }}
          </p>
          <ul class="text-[14px] leading-[22px] list-disc font-normal my-0" style="padding-left: calc(var(--list-marker-font-size, 14px) * 1.5)">
            <li class="mb-0">
              <I18nT :keypath="$t('单任务视频发布 {n} 次', { n: '{n}' })">
                <template #n>
                  <span class="font-medium text-[var(--colors-text-text-primary)]">{{ benefits.videoPosting }}</span>
                </template>
              </I18nT>
            </li>
            <li class="mb-0">
              <I18nT :keypath="$t('可生成 {n} 个素材', { n: '{n}' })">
                <template #n>
                  <span class="font-medium text-[var(--colors-text-text-primary)]">{{ benefits.materials }}</span>
                </template>
              </I18nT>
            </li>
            <li class="mb-0">
              <I18nT :keypath="$t('竞品数据采集 {n} 次', { n: '{n}' })">
                <template #n>
                  <span class="font-medium text-[var(--colors-text-text-primary)]">{{ benefits.dataCapture }}</span>
                </template>
              </I18nT>
            </li>
            <li>
              <I18nT :keypath="$t('单窗口账号养号 {n} 次', { n: '{n}' })">
                <template #n>
                  <span class="font-medium text-[var(--colors-text-text-primary)]">{{ benefits.accountNurturing }}</span>
                </template>
              </I18nT>
            </li>
          </ul>
        </div>
      </div>

      <!-- Right: Bill card -->
      <div
        class="flex-1 flex flex-col justify-between p-4 rounded-2 border border-solid border-[var(--colors-border-border-inactive)]"
      >
        <div class="flex flex-col gap-3 w-full">
          <div class="flex items-center justify-between w-full">
            <p class="text-[14px] font-semibold text-[var(--colors-text-text-primary)] leading-[20px] w-[200px] my-0">
              {{ $t('Agent 积分') }}
            </p>
          </div>
          <div class="flex items-center justify-between text-[14px] font-normal text-[var(--colors-text-text-secondary)] leading-[20px] w-full whitespace-nowrap">
            <span>{{ $t('数量') }}</span>
            <span class="text-right">{{ $t('{points} 积分', { points: points }) }}</span>
          </div>
          <div class="flex items-center justify-between text-[14px] font-normal text-[var(--colors-text-text-secondary)] leading-[20px] w-full whitespace-nowrap">
            <span>{{ $t('单价') }}</span>
            <span class="text-right">${{ UNIT_PRICE.toFixed(2) }}</span>
          </div>
        </div>

        <div class="flex flex-col gap-3 w-full">
          <div class="flex flex-col gap-3 w-full">
            <hr class="border-0 border-t border-dashed border-[var(--colors-border-border-base)] w-full mt-8 mb-0" />
            <div class="flex items-center justify-between w-full">
              <span class="text-[14px] font-semibold text-[var(--colors-text-text-primary)] leading-[20px] whitespace-nowrap">
                {{ $t('实际价格') }}
              </span>
              <div class="flex flex-col gap-[2px] items-end justify-center">
                <span class="text-6 font-semibold text-[var(--colors-text-text-brand)] leading-normal text-right whitespace-nowrap">
                  ${{ actualPrice }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-3 w-full">
            <RxButton
              class="w-full"
              @click="handlePay"
            >
              {{ $t('立即支付') }}
            </RxButton>
            <p class="text-3 my-0 font-normal text-[var(--colors-text-text-tertiary)] leading-[18px] w-full">
              <I18nT :keypath="$t('继续即表示您同意我们的 {service}。', { 'service': '{service}' })">
                <template #service>
                  <a class="text-[var(--colors-text-text-brand)] underline cursor-pointer">{{ $t('服务信用条款') }}</a>
                </template>
              </I18nT>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
