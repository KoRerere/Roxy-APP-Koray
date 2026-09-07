<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import RxSlider from '/@/components/rx-slider'
import RxStepInput from '/@/components/rx-step-input'
import RxButton from '/@/components/rx-button'
import { API } from '/@/api'
import type { PointsData } from './interface.ts'
import { useSimpleLocale } from '/@/stores/locale'
import { $t } from '/@/locales'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  hideModal: () => void
  onClose?: () => void
  onConfirm: (pointsData: PointsData) => void
}>()

const { getOfficialWebsite } = useSimpleLocale()

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

// ── 满量折扣徽标：达到对应档位享受的折扣 ──────────────────────────────
// 通过 getPointsTierDiscountRulesList 接口动态获取，key 为积分档位，value 为展示文案（如 -5%）
const pointsDiscounts = ref<Record<number, string>>({})

/**
 * 拉取积分梯度折扣规则，构建 { [threshold]: '-{discount}%' } 映射。
 */
async function fetchTierDiscountRules() {
  try {
    const res = await API.points.getPointsTierDiscountRulesList()
    if (res.code === 0) {
      pointsDiscounts.value = res.data.rules.reduce<Record<number, string>>((acc, rule) => {
        if (rule.discount > 0)
          acc[rule.threshold] = `-${rule.discount}%`
        return acc
      }, {})
    }
  }
  catch {
    // keep empty map on error
  }
}

fetchTierDiscountRules()

/** 最高折扣档位：用于渲染渐变变体徽标（其余为描边变体） */
const maxDiscountThreshold = computed(() => {
  const thresholds = Object.keys(pointsDiscounts.value).map(Number)
  return thresholds.length ? Math.max(...thresholds) : -1
})

// ── State ────────────────────────────────────────────────────────────
const points = ref(MIN_POINTS)
const pointsInputKey = ref(0)
const originalAmount = ref<number>(0)
const actualAmount = ref<number>(0)
const tierDiscount = ref<number>(0)
const identityDiscount = ref<number>(0)
const priceLoading = ref(false)

/**
 * ── Price fetch ──────────────────────────────────────────────────────
 */
async function fetchPrice(rechargeAmount: number) {
  priceLoading.value = true
  try {
    console.log('rechargeAmount', rechargeAmount)
    const res = await API.points.userCalculatePointsPriceList({
      rechargeAmount: String(rechargeAmount),
    })

    if (res.code === 0) {
      originalAmount.value = res.data.originalAmount
      actualAmount.value = res.data.actualAmount
      tierDiscount.value = res.data.tierDiscount
      identityDiscount.value = res.data.identityDiscount
    }
  }
  catch {
    // keep previous values on error
  }
  finally {
    priceLoading.value = false
  }
}

const debouncedFetchPrice = useDebounceFn((val: number) => fetchPrice(val), 200)

function ceilPointsByMarks(value: number): number {
  const numericValue = Number.isFinite(value) ? value : MIN_POINTS
  const boundedValue = Math.min(Math.max(numericValue, MIN_POINTS), MAX_POINTS)

  for (let i = 0; i < POINTS_MARKS.length - 1; i++) {
    const from = POINTS_MARKS[i]!
    const to = POINTS_MARKS[i + 1]!
    if (boundedValue > from.value && boundedValue <= to.value) {
      const step = from.step ?? (to.value - from.value)
      return Math.min(from.value + Math.ceil((boundedValue - from.value) / step) * step, to.value)
    }
  }

  return MAX_POINTS
}

watch(points, (val) => {
  const alignedValue = ceilPointsByMarks(val)
  if (alignedValue !== val) {
    points.value = alignedValue
    pointsInputKey.value += 1
    return
  }

  debouncedFetchPrice(alignedValue)
}, { immediate: true })

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

// ── 权益列表：keypath + 对应每积分可生成数量的除数 ──────────────────
const BENEFIT_ITEMS = [
  {
    keypath: $t('单任务视频发布约 {n} 次', { n: '{n}' }),
    tooltip: $t('通用模式下，Agent 自主在 TikTok 发布一个视频，消耗约 {n} 积分', { n: '{n}' }),
    divisor: 2,
  },
  // {
  //   keypath: $t('可生成约 {n} 个素材', { n: '{n}' }),
  //   tooltip: $t('通用模式下，Agent 生成 1 个图片素材消耗约 {n} 积分', { n: '{n}' }),
  //   divisor: 8,
  // },
  {
    keypath: $t('竞品数据采集约 {n} 次', { n: '{n}' }),
    tooltip: $t('通用模式下，Agent 完成 1 次竞品网站数据收集消耗约 {n} 积分', { n: '{n}' }),
    divisor: 5,
  },
  {
    keypath: $t('单窗口账号养号约 {n} 次', { n: '{n}' }),
    tooltip: $t('通用模式下，Agent 完成 1 次单窗口 TikTok 账号养号（浏览、点赞视频）消耗约 {n} 积分', { n: '{n}' }),
    divisor: 5,
  },
  {
    keypath: $t('执行自动化脚本约 {n} 次', { n: '{n}' }),
    tooltip: $t('通用模式下，Agent 完成 1 次执行自动化脚本消耗约 {n} 积分', { n: '{n}' }),
    divisor: 1.2,
  },
]

const benefits = computed(() =>
  BENEFIT_ITEMS.map(item => ({
    keypath: item.keypath,
    tooltip: item.tooltip,
    count: item.divisor ? Math.floor(points.value / item.divisor) : '0',
    divisor: item.divisor,
  })),
)

// ── 账单数据 ──────────────────────────────────────────────────────────

/**
 * 折扣行：将各类折扣合并展示，总折扣最高封顶 25%。
 */
const discountRows = computed(() => {
  const identityRate = 1 - identityDiscount.value / 100
  const tierRate = 1 - tierDiscount.value / 100
  const totalDiscount = (1 - identityRate * tierRate) * 100

  return totalDiscount > 25
    ? [{
        label: $t('折扣'),
        percent: Math.min(Number(totalDiscount.toFixed(2)), 25),
        // 身份折扣文案暂不对外展示，此处不再说明叠加口径
        // tooltip: $t('专属折扣与消费折扣按乘法叠加计算，最高可享 25% 折扣'),
        tooltip: '',
      }]
    : [
        // 身份折扣文案暂不对外展示，折扣仍参与计价
        // { label: $t('专属折扣'), percent: identityDiscount.value },
        { label: $t('消费折扣'), percent: tierDiscount.value },
      ].filter(row => row.percent > 0)
})

/** 立省金额 = 原价 - 实付 */
const savedAmount = computed(() => Math.max(originalAmount.value - actualAmount.value, 0))

/** 账单明细行（分割线以上）。label 为 i18n key，模板中翻译 */
const billRows = computed(() => [
  { label: $t('数量'), value: $t('{points} 积分', { points: points.value }) },
  { label: $t('单价'), value: `$${originalAmount.value}`, valueClass: savedAmount.value > 0 ? 'line-through' : '' },
])

/**
 * ── Format helpers ───────────────────────────────────────────────────
 */
function formatMarkLabel(value: number): string {
  if (value === 0)
    return '0'
  if (value >= 1000)
    return `${(value / 1000).toFixed(1)}K`
  return String(value)
}

function handlePay() {
  // TODO: integrate with payment flow
  console.log('Pay now:', points.value, `points, $${actualAmount.value}`)
  props.hideModal()
  props.onConfirm({
    points: points.value,
    originalAmount: originalAmount.value,
    actualAmount: actualAmount.value,
  })
}

function handleClose() {
  props.onClose?.()
  props.hideModal()
}
</script>

<template>
  <div class="!w-[680px] bg-[var(--colors-background-bg-page)] flex flex-col gap-6 p-6 rounded-3">
    <!-- ── Header ────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between shrink-0 w-full">
      <p class="text-5 font-semibold text-[var(--colors-text-text-primary)] leading-normal my-0">
        {{ $t('购买 Agent 积分') }}
      </p>
      <button
        class="flex items-center justify-center p-2 rounded-1.5 shrink-0 cursor-pointer bg-transparent border-0"
        @click="handleClose"
      >
        <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" />
      </button>
    </div>

    <!-- ── Body ──────────────────────────────────────────────────── -->
    <div class="flex flex-col gap-11 items-center w-full">
      <!-- Subtitle -->
      <div class="flex flex-col gap-1.5 items-center w-full leading-normal">
        <p class="text-4.5 font-semibold text-[var(--colors-text-text-primary)] my-0">
          {{ $t('滑动选择积分') }}
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
            hide-tooltip
          >
            <template #mark-badge="{ value }">
              <span
                v-if="pointsDiscounts[value]"
                class="points-discount-badge"
                :class="{ 'points-discount-badge--gradient': value === maxDiscountThreshold }"
              >
                <span class="points-discount-badge__text">{{ pointsDiscounts[value] }}</span>
              </span>
            </template>
            <template #mark="{ value, isActive }">
              <span
                class="text-[14px] whitespace-nowrap font-normal"
                :class="isActive ? 'text-[var(--colors-text-text-primary)] font-medium' : 'text-[var(--colors-text-text-tertiary)]'"
              >
                {{ formatMarkLabel(value) }}
              </span>
            </template>
            <!-- <template #popup="{ value }">
              {{ formatMarkLabel(value) }} {{ $t('积分') }}
            </template> -->
          </RxSlider>
        </div>

        <RxStepInput
          :key="pointsInputKey"
          v-model="points"
          :step="plusStep"
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
          <span class="text-6 text-[var(--colors-text-text-primary)] font-[DingTalk_JinBuTi] leading-[30px] mr-1">{{ points }}</span>
          <span class="text-3 font-medium text-[var(--colors-text-text-secondary)] leading-normal">{{ $t('积分') }}</span>
        </p>

        <div class="flex flex-col gap-2 text-[var(--colors-text-text-tertiary)] w-full">
          <p class="text-[14px] leading-[20px] font-normal my-0">
            {{ $t('可完成以下任务：') }}
          </p>
          <ul class="text-[14px] leading-[22px] list-disc font-normal my-0" style="padding-left: calc(var(--list-marker-font-size, 14px) * 1.5)">
            <li
              v-for="(item, index) in benefits"
              :key="item.keypath"
              :class="{ 'mb-0': index < benefits.length - 1 }"
            >
              <p class="leading-[1.1] gap-1 align-top my-1">
                <I18nT :keypath="item.keypath">
                  <template #n>
                    <span class="font-medium text-[var(--colors-text-text-primary)]">{{ item.count }}</span>
                  </template>
                </I18nT>
                <SvgIcon
                  v-if="item.tooltip"
                  v-tooltip.top="{ value: $t(item.tooltip, { n: item.divisor }), showDelay: 300, pt: { root: '!max-w-60' } }"
                  class="shrink-0 cursor-pointer ml-1 translate-y-1px"
                  name="base/rx_ic_info"
                  size="12"
                  color="var(--colors-icon-icon-note)"
                />
              </p>
            </li>
          </ul>
        </div>
      </div>

      <!-- Right: Bill card -->
      <div
        class="flex-1 flex flex-col justify-between p-4 rounded-2 border border-solid border-[var(--colors-border-border-inactive)] bg-[var(--pattern-pay-plan-bg-bill)]"
      >
        <div class="flex flex-col gap-3 w-full">
          <div class="flex items-center justify-between w-full">
            <p class="text-[14px] font-semibold text-[var(--colors-text-text-primary)] leading-[20px] w-[200px] my-0">
              {{ $t('Agent 积分') }}
            </p>
          </div>
          <div
            v-for="row in billRows"
            :key="row.label"
            class="flex items-center justify-between text-[14px] font-normal text-[var(--colors-text-text-secondary)] leading-[20px] w-full whitespace-nowrap"
          >
            <span>{{ row.label }}</span>
            <span class="text-right" :class="row.valueClass">{{ row.value }}</span>
          </div>
        </div>

        <div class="flex flex-col gap-3 w-full">
          <div class="flex flex-col gap-3 w-full">
            <hr class="border-0 border-t border-dashed border-[var(--colors-border-border-base)] w-full mt-8 mb-0">

            <!-- 合并折扣展示，最高封顶 25% -->
            <div
              v-for="row in discountRows"
              :key="row.label"
              class="flex items-center justify-between text-[14px] font-normal leading-[20px] w-full whitespace-nowrap text-[#fc9d12]"
            >
              <span class="inline-flex items-center gap-1">
                <span>{{ row.label }}</span>
                <SvgIcon
                  v-if="row.tooltip"
                  v-tooltip.top="{ value: row.tooltip, showDelay: 300, pt: { root: '!max-w-60' } }"
                  class="shrink-0 cursor-pointer"
                  name="base/rx_ic_info"
                  size="12"
                  color="var(--colors-icon-icon-note)"
                />
              </span>
              <span class="text-right">-{{ row.percent }}%</span>
            </div>

            <div class="flex items-center justify-between w-full">
              <span class="leading-[16px] whitespace-nowrap actual-price-label">
                {{ $t('实际价格') }}
              </span>
              <div class="flex flex-col gap-[2px] items-end justify-center">
                <span
                  class="text-6 font-semibold leading-[1.2] text-right whitespace-nowrap"
                  :class="priceLoading ? 'text-[var(--colors-text-text-tertiary)]' : 'text-[var(--colors-text-text-brand)]'"
                >
                  ${{ actualAmount }}
                </span>
                <span
                  v-if="savedAmount > 0"
                  class="text-3 font-medium leading-[16px] text-right whitespace-nowrap text-[#fc9d12]"
                >
                  {{ $t('立省 {amount}', { amount: `$${savedAmount.toFixed(2)}` }) }}
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
              <I18nT :keypath="$t('继续即表示您同意我们的 {service}。', { service: '{service}' })">
                <template #service>
                  <a class="text-[var(--colors-text-text-brand)] underline cursor-pointer" :href="getOfficialWebsite('/copyright/user')" target="_blank">{{ $t('用户协议') }}</a>
                </template>
              </I18nT>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.actual-price-label {
  background: linear-gradient(90deg, #11a3fd 0%, #f047ff 100%);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  font-family: 'DingTalk JinBuTi';
  font-size: 15px;
}

.points-discount-badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 8px;
  white-space: nowrap;
  border-radius: 10px;
  // ── 描边变体（-5% / -10% / -15%）：白底 + 1px 橙边 ──
  color: #fc9d12;
  background: #fff;
  border: 1px solid #fc9d12;
  box-sizing: content-box;

  // 向下指向刻度的小尾巴：旋转 45° 的小方块，中心贴在气泡底边上，
  // 上半嵌入气泡（白底融合），下半露出右、下两条描边形成尖角
  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    width: 6px;
    height: 6px;
    background: #fff;
    border-right: 1px solid #fc9d12;
    border-bottom: 1px solid #fc9d12;
    border-bottom-right-radius: 2px;
    transform: translate(-50%, -2px) rotate(45deg);
  }

  // ── 渐变变体（-20%）：渐变底 + 白字，无描边 ──
  &--gradient {
    color: #fff;
    // background: linear-gradient(100deg, #3faaf6 0%, #f359dc 50%, #f28fb0 100%);
    background: linear-gradient(104deg, #3faaf6 -9.72%, #f359dc 65.72%, #f28fb0 141.16%);
    // border-color: transparent;
    border: none;
    transform: translateY(-2px);

    // 无描边变体改用旋转小方块模拟尾巴，这样尖角可以单独做圆角
    &::after {
      width: 0;
      height: 0;
      background: transparent;
      border: 5px solid transparent;
      border-top: 5px solid rgb(224, 98, 223);
      border-bottom: 0;
      // 上移 1px 让三角平底嵌进气泡，藏住基部肩膀，只露尖角
      transform: translate(-50%, -1px);
      border-bottom-right-radius: 2px;
    }
  }
}

.points-discount-badge__text {
  position: relative;
  z-index: 1;
  font-family: 'DingTalk JinBuTi', Inter, sans-serif;
  font-size: 12px;
  font-weight: 400;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
