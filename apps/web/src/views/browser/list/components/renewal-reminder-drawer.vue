<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon'
import RxButton from '/@/components/rx-button'
import { useBillingEntityLabels } from '/@/composables/useBillingEntityLabels'
import { SubLevelEnum } from '/@/enums/pay'
import { usePermission } from '/@/hooks/usePermission'
import { useUserStore } from '/@/stores/user'
import { emitter } from '/@/utils/eventBus'
import { useThemeStore } from '/@/stores/theme'
import { discountCalculate } from '/@/views/pay/subscribe/util.ts'
import { useDocumentVisibility, useTimeoutFn } from '@vueuse/core'

const router = useRouter()
const userStore = useUserStore()
const themeStore = useThemeStore()
const { userInfo, userPayInfo, payInfoReceivedAt } = storeToRefs(userStore)
const { check } = usePermission()
const billingLabels = useBillingEntityLabels()

const visible = ref(false)
const remainDays = ref(0)
const activeThreshold = ref<number | null>(null)

const features = computed(() => [
  billingLabels.value.createEntityTemplate,
  $t('团队协作'),
  $t('额外工作空间'),
  billingLabels.value.entitySync,
  $t('专属技术支持'),
  billingLabels.value.entityTransfer,
  $t('无限 API 请求'),
  $t('日志保留时长'),
])

/** 限时续费活动档位折扣；与首购/专属折扣按乘法折上折，不能相加 */
const RENEWAL_CAMPAIGN_DISCOUNT = 40

/** 首购折扣（userPayInfo.firstPurchaseDiscount），无则不展示对应标签 */
const firstPurchaseDiscount = computed(() => Number(userPayInfo.value?.firstPurchaseDiscount) || 0)

/** 用户身份专属折扣（userPayInfo.discount），无则不展示对应标签 */
const exclusiveDiscount = computed(() => Number(userPayInfo.value?.discount) || 0)

/**
 * 实付系数 = ∏(1 - 各折扣)。
 * 大字 67% OFF / 角标、文案「实付约原价 33%」都由该系数换算，避免折扣变化后文案仍写死。
 */
const stackedPayRatio = computed(() => {
  const discounts = [firstPurchaseDiscount.value, exclusiveDiscount.value, RENEWAL_CAMPAIGN_DISCOUNT].filter(percent => percent > 0)
  return discounts.length ? discountCalculate(discounts) : 1
})

/** 叠折后相对原价少付的百分比，四舍五入到整数便于展示 */
const totalOffPercent = computed(() => Math.round((1 - stackedPayRatio.value) * 100))

/** 叠折后实付约占原价的百分比，与 totalOffPercent 互补，避免两边各自 round 对不齐 */
const payPercent = computed(() => 100 - totalOffPercent.value)

/** 全站共用一条记录，避免按档位无限写入 localStorage */
const SEEN_STORAGE_KEY = 'renew_drawer_seen'

/** 超过 1 天才视为续费换期；剩余天数自然减少或接口时间戳抖动不能清档 */
const RENEWAL_CYCLE_MIN_MS = 24 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
/** 浏览器单次 setTimeout 上限约 24.8 天，更长间隔拆成多次等待 */
const MAX_TIMER_MS = 24 * 60 * 60 * 1000

/** 距下一个「剩余整天数」下降的延迟，供 useTimeoutFn 读取 */
const nextCheckDelay = ref(60_000)

/** 单用户本轮订阅已展示过的提醒档位 */
interface RenewalDrawerSeenRecord {
  /** 用于过期清理和判断是否续费；不能用全等，否则 7 天关了 6 天还会再弹 */
  subEndDate: number
  /** 已关闭过的档位：7（剩余 4–7 天）/ 3（剩余 2–3 天）/ 1（剩余 0–1 天） */
  thresholds: number[]
}

type RenewalDrawerSeenMap = Record<string, RenewalDrawerSeenRecord>

/**
 * 按剩余天数落入互斥档位，保证每个窗口只对应一次弹窗：
 * 4–7 天 → 7；2–3 天 → 3；0–1 天 → 1。边界归入更紧急档，避免 3/1 天重叠弹出。
 */
function resolveThreshold(diffDays: number): number | null {
  if (diffDays <= 7 && diffDays > 3) {
    return 7
  }
  if (diffDays <= 3 && diffDays > 1) {
    return 3
  }
  if (diffDays <= 1 && diffDays >= 0) {
    return 1
  }
  return null
}

/** 用接口服务器时间加上本地流逝，得到当前估算的服务器时刻 */
function getEstimatedServerNow(subCurrentDate: number) {
  if (!payInfoReceivedAt.value) {
    return subCurrentDate
  }
  return subCurrentDate + Math.max(0, Date.now() - payInfoReceivedAt.value)
}

/** 距离「剩余整天数」再减 1 的毫秒数，用来在跨档瞬间弹出 */
function computeDelayToNextDayFloor(subEndDate: number, serverNow: number) {
  const remainingMs = subEndDate - serverNow
  if (remainingMs <= 0) {
    return null
  }
  const diffDays = Math.floor(remainingMs / DAY_MS)
  const msInCurrentDay = remainingMs - diffDays * DAY_MS
  const delay = msInCurrentDay === 0 ? DAY_MS : msInCurrentDay
  return Math.min(delay + 50, MAX_TIMER_MS)
}

/** 解析聚合存储；脏数据直接丢弃，避免坏 JSON 卡住提醒 */
function parseSeenMap(raw: string | null): RenewalDrawerSeenMap {
  if (!raw) {
    return {}
  }
  try {
    const data = JSON.parse(raw) as RenewalDrawerSeenMap
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return {}
    }
    return data
  }
  catch {
    return {}
  }
}

/**
 * 清掉已到期记录；仅在到期日明显后移（续费）时重置当前用户档位。
 * 用服务器当前时间判断过期，避免本机时钟偏差导致误删或堆积。
 */
function pruneSeenMap(currentDate: number, userId?: string | number, currentEndDate?: number): RenewalDrawerSeenMap {
  const map = parseSeenMap(localStorage.getItem(SEEN_STORAGE_KEY))
  const next: RenewalDrawerSeenMap = {}

  for (const [uid, record] of Object.entries(map)) {
    if (!record?.subEndDate || !Array.isArray(record.thresholds)) {
      continue
    }
    // 订阅已过期的记录不再有用
    if (record.subEndDate <= currentDate) {
      continue
    }
    next[uid] = {
      subEndDate: record.subEndDate,
      thresholds: record.thresholds.filter(item => item === 7 || item === 3 || item === 1),
    }
  }

  if (userId != null && currentEndDate) {
    const uid = String(userId)
    const record = next[uid]
    if (record) {
      if (currentEndDate - record.subEndDate > RENEWAL_CYCLE_MIN_MS) {
        // 续费把到期日往后推了一天以上，上一轮关闭记录作废
        delete next[uid]
      }
      else {
        // 同一轮：同步最新到期日，保留已关档位（7 天关掉后到 6/5/4 天不再弹）
        record.subEndDate = Math.max(record.subEndDate, currentEndDate)
      }
    }
  }

  persistSeenMap(next)
  return next
}

function persistSeenMap(map: RenewalDrawerSeenMap) {
  if (Object.keys(map).length === 0) {
    localStorage.removeItem(SEEN_STORAGE_KEY)
    return
  }
  localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(map))
}

/** 仅在用户点关闭时记档；刷新未关闭则同一档位会再弹出 */
function markThresholdSeen(userId: string | number, subEndDate: number, threshold: number, currentDate: number) {
  const map = pruneSeenMap(currentDate, userId, subEndDate)
  const uid = String(userId)
  const record = map[uid] ?? { subEndDate, thresholds: [] as number[] }
  if (!record.thresholds.includes(threshold)) {
    record.thresholds.push(threshold)
  }
  record.subEndDate = Math.max(record.subEndDate, subEndDate)
  map[uid] = record
  persistSeenMap(map)
}

function checkExpiredDrawer() {
  const subCurrentDate = userPayInfo.value?.subCurrentDate
  const subEndDate = userPayInfo.value?.subEndDate
  const userId = userInfo.value?.id
  if (!subEndDate || !subCurrentDate) {
    visible.value = false
    return
  }

  const serverNow = getEstimatedServerNow(subCurrentDate)

  if (subEndDate <= serverNow) {
    pruneSeenMap(serverNow, userId, subEndDate)
    visible.value = false
    return
  }

  const diffDays = Math.floor((subEndDate - serverNow) / DAY_MS)
  const threshold = resolveThreshold(diffDays)

  if (!threshold) {
    pruneSeenMap(serverNow, userId, subEndDate)
    visible.value = false
    return
  }

  if (!userId) {
    return
  }

  const seenMap = pruneSeenMap(serverNow, userId, subEndDate)
  const seenThresholds = seenMap[String(userId)]?.thresholds ?? []

  if (!seenThresholds.includes(threshold)) {
    remainDays.value = Math.max(diffDays, 1)
    activeThreshold.value = threshold
    visible.value = true
  }
  else {
    visible.value = false
  }
}

function handleClose() {
  const subCurrentDate = userPayInfo.value?.subCurrentDate
  const subEndDate = userPayInfo.value?.subEndDate
  const userId = userInfo.value?.id
  if (userId && subEndDate && subCurrentDate && activeThreshold.value) {
    markThresholdSeen(userId, subEndDate, activeThreshold.value, getEstimatedServerNow(subCurrentDate))
  }
  visible.value = false
}

function onLocalClockTick() {
  checkExpiredDrawer()
  armThresholdTimer()
}

const { start: startThresholdTimer, stop: stopThresholdTimer } = useTimeoutFn(
  onLocalClockTick,
  nextCheckDelay,
  { immediate: false },
)

function armThresholdTimer() {
  stopThresholdTimer()
  const subCurrentDate = userPayInfo.value?.subCurrentDate
  const subEndDate = userPayInfo.value?.subEndDate
  if (!subEndDate || !subCurrentDate) {
    return
  }
  const delay = computeDelayToNextDayFloor(subEndDate, getEstimatedServerNow(subCurrentDate))
  if (delay == null) {
    return
  }
  nextCheckDelay.value = delay
  startThresholdTimer()
}

watch(
  () => [userPayInfo.value?.subEndDate, userPayInfo.value?.subCurrentDate, userInfo.value?.id],
  () => {
    checkExpiredDrawer()
    armThresholdTimer()
  },
  { immediate: true },
)

const visibility = useDocumentVisibility()
watch(visibility, (state) => {
  // 后台标签页定时器会被节流，回到前台立刻按推算时间再判一次档位
  if (state === 'visible') {
    checkExpiredDrawer()
    armThresholdTimer()
  }
})

function handleRenew() {
  if (check('Cost_Center_all')) {
    if (userPayInfo.value?.subLevel === SubLevelEnum.Trial) {
      router.push({ name: 'subscribe-plan' })
    }
    else {
      emitter.emit('showRenewalDialog', {
        paySuccess: () => {
          router.replace({ name: 'wallet', query: { name: 'manage' } })
          emitter.emit('updateBillList')
        },
      })
    }
  }
  else {
    emitter.emit('showToast', {
      severity: 'warn',
      summary: $t('暂无充值/账单权限，联系管理员续费'),
      life: 3000,
    })
  }
}
</script>

<template>
  <Transition name="drawer-slide-up">
    <div
      v-if="visible"
      class="renewal-drawer absolute bottom-0 p-3 left-0 right-0 z-50 rounded-2 bg-[var(--colors-background-bg-page)] box-border pointer-events-auto"
    >
      <div class="renewal-drawer-content flex size-full rounded-2 overflow-hidden">
        <!-- 左侧权益面板 -->
        <div class="renewal-benefits-panel flex-1 min-w-0 min-h-220px bg-[var(--colors-background-bg-block,#f1f5f8)] p-6 rounded-l-2 flex flex-col box-border">
          <div class="flex items-center gap-1.5 leading-none">
            <span class="text-16px font-normal text-[var(--colors-text-text-secondary,#34393d)]">{{ $t('订阅到期提醒 · 仅剩') }}</span>
            <span class="text-24px font-semibold text-[var(--colors-text-text-warning,#fd9f12)] leading-none">{{ remainDays }}</span>
            <span class="text-16px font-normal text-[var(--colors-text-text-secondary,#34393d)]">{{ $t('天') }}</span>
          </div>

          <div class="w-full border-0 border-t border-dashed border-[var(--colors-border-divider,#e5e7eb)] my-3" />

          <div class="flex flex-col gap-4">
            <div class="text-18px font-semibold text-[var(--colors-text-text-secondary,#34393d)] leading-normal">
              {{ $t('到期后，以下权益将暂停使用') }}
            </div>

            <div class="renewal-features grid gap-x-20px gap-y-2.5">
              <div v-for="(item, idx) in features" :key="idx" class="flex items-start gap-3 min-w-0">
                <RxSvgIcon name="base/rx_ic_check" color="var(--colors-icon-icon-success, #12b76a)" class="shrink-0 text-16px mt-0.5" />
                <span class="renewal-feature-label text-14px font-medium text-[var(--colors-text-text-primary,#111213)] leading-5">{{ item }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧折扣与续费操作面板 -->
        <div class="w-460px shrink-0 min-h-220px relative p-6 rounded-r-2 bg-[var(--colors-background-bg-page,#ffffff)] flex flex-col justify-between box-border overflow-hidden">
          <!-- 背景渐变 (rx-gradient-Sirio) -->
          <img
            :src="`/images/payments/rx-gradient-Sirio_${themeStore.isDarkTheme ? 'dark' : 'light'}.svg`"
            class="absolute inset-0 max-w-none opacity-60 pointer-events-none select-none size-full"
            draggable="false"
          >

          <!-- 关闭按钮 -->
          <button
            type="button"
            class="absolute top-3 right-3 z-10 w-9 h-9 flex items-center justify-center rounded-1.5 text-[var(--colors-icon-icon-secondary,#34393d)] hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/15 transition-colors cursor-pointer border-none bg-transparent outline-none"
            @click="handleClose"
          >
            <RxSvgIcon name="base/rx_ic_video_close" class="text-20px" />
          </button>

          <!-- 折扣头部区域 -->
          <div class="flex flex-col gap-3 relative z-1">
            <div class="flex items-center gap-3">
              <span class="text-40px font-900 leading-12 text-[var(--colors-text-text-primary,#111213)] font-['DM_Sans',Inter,sans-serif]" style="font-variation-settings: 'opsz' 14;">{{ totalOffPercent }}% OFF</span>
              <div class="bg-gradient-to-r from-[#8780fe] to-[#c491f1] text-white text-14px font-['DingTalk_JinBuTi'] px-3 py-1.5 rounded-full whitespace-nowrap leading-none flex items-center justify-center">
                {{ $t('限时优惠') }}
              </div>
            </div>

            <div class="flex items-center gap-2 whitespace-nowrap flex-wrap">
              <div
                v-if="firstPurchaseDiscount > 0"
                class="bg-[var(--colors-background-bg-page,#ffffff)] dark:bg-[#1f2429] px-2 py-1 rounded-1 shadow-[0px_1px_1px_rgba(16,24,40,0.05)] dark:shadow-none flex items-center gap-1"
              >
                <span class="text-13px font-normal text-[var(--colors-text-text-primary,#111213)] leading-[18px]">{{ $t('首购折扣') }}</span>
                <span class="text-14px font-bold text-[var(--colors-text-text-warning,#fd9f12)] leading-[20px]">{{ firstPurchaseDiscount }}%</span>off
              </div>
              <!-- 身份折扣文案暂不对外展示，折扣仍计入总折扣 -->
              <div
                v-if="exclusiveDiscount > 0"
                class="bg-[var(--colors-background-bg-page,#ffffff)] dark:bg-[#1f2429] px-2 py-1 rounded-1 shadow-[0px_1px_1px_rgba(16,24,40,0.05)] dark:shadow-none flex items-center gap-1"
              >
                <span class="text-13px font-normal text-[var(--colors-text-text-primary,#111213)] leading-[18px]">{{ $t('专属折扣') }}</span>
                <span class="text-14px font-bold text-[var(--colors-text-text-warning,#fd9f12)] leading-[20px]">{{ exclusiveDiscount }}%</span>off
              </div>
              <div class="bg-[var(--colors-background-bg-page,#ffffff)] dark:bg-[#1f2429] px-2 py-1 rounded-1 shadow-[0px_1px_1px_rgba(16,24,40,0.05)] dark:shadow-none flex items-center gap-1">
                <span class="text-13px font-normal text-[var(--colors-text-text-primary,#111213)] leading-[18px]">{{ $t('续费折扣') }}</span>
                <span class="text-14px font-bold text-[var(--colors-text-text-warning,#fd9f12)] leading-[20px]">{{ RENEWAL_CAMPAIGN_DISCOUNT }}%</span>off
              </div>
            </div>

            <div class="text-14px font-normal text-[var(--colors-text-text-primary,#111213)] leading-5">
              {{ $t('优惠折上折，实付约原价 {percent}%', { percent: payPercent }) }}
            </div>
          </div>

          <!-- 续费按钮区域 -->
          <div class="relative w-full z-1">
            <div class="absolute top-2 right-3 z-2 bg-[#FC9D12] text-white text-14px font-['DingTalk_JinBuTi',sans-serif] px-3 py-0.5 rounded-full shadow-[0px_2px_4px_rgba(252,157,18,0.25)] whitespace-nowrap leading-tight pointer-events-none flex items-center justify-center">
              {{ totalOffPercent }}% Off
            </div>
            <RxButton class="w-full !h-10 !text-14px mt-20px font-medium !rounded-2" severity="primary" size="lg" @click="handleRenew">
              {{ $t('立即续费') }}
            </RxButton>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.renewal-drawer {
  container-type: inline-size;
}

.renewal-drawer-content {
  min-width: 0;
}

@container (max-width: 960px) {
  .renewal-drawer-content {
    flex-direction: column;
    gap: 12px;
  }

  .renewal-benefits-panel,
  .renewal-drawer-content > div:last-child {
    width: 100%;
    border-radius: 8px;
  }
}

.renewal-benefits-panel {
  container-type: inline-size;
}

.renewal-features {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.renewal-feature-label {
  min-width: 0;
  overflow-wrap: anywhere;
}

@container (max-width: 680px) {
  .renewal-features {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@container (max-width: 440px) {
  .renewal-features {
    grid-template-columns: minmax(0, 1fr);
  }
}

.drawer-slide-up-enter-active,
.drawer-slide-up-leave-active {
  transition:
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.drawer-slide-up-enter-from,
.drawer-slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
