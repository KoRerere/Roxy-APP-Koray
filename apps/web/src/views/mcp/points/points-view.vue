<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import MInputDatePicker from '/@/views/lab/components/form/m-input-date-picker.vue'
import { API } from '/@/api'
import { useBuyPoints } from '../components/buyPointes'
import Empty from '../settings/components/empty.vue'
import { format } from 'date-fns'
import { useUserStore } from '/@/stores/user'
import { getImage } from '/@/utils'
import AutoThemeImage from '/@/views/account/list/components/platform-icon.vue'
import { OrderTypeStr } from '/@/enums/pay'

// ── Buy points ───────────────────────────────────────────────────────
const { buyPoints } = useBuyPoints()
const { userPayInfo } = storeToRefs(useUserStore())

type RecordTab = 'recharge' | 'charge'

// ── State ────────────────────────────────────────────────────────────
const loading = ref(false)
const loadingMore = ref(false)
const listRef = ref<HTMLElement | null>(null)
const pageIndex = ref(1)
const total = ref(0)
const hasMore = ref(true)
const PAGE_SIZE = 20
const activeTab = ref<RecordTab>('recharge')

// 日期范围：[startDate, endDate] | null
const dateRange = ref<Date[] | null>(null)

interface PointsRecord {
  id: string
  date: string
  timestamp?: number
  points: number | string
  amount?: string
  orderType: string
}

const records = ref<PointsRecord[]>([])

const tabOptions = computed(() => [
  {
    key: 'recharge' as const,
    label: $t('充值记录'),
    emptyText: $t('暂无充值记录'),
    pointsPrefix: '+',
    pointsClass: 'text-[var(--colors-text-text-success)]',
  },
  {
    key: 'charge' as const,
    label: $t('消费记录'),
    emptyText: $t('暂无消费记录'),
    pointsPrefix: '-',
    pointsClass: 'text-[var(--colors-text-text-primary)]',
  },
])

const activeTabMeta = computed(() =>
  tabOptions.value.find(item => item.key === activeTab.value) ?? tabOptions.value[0],
)

async function handleBuyPoints() {
  const isSuccess = await buyPoints()
  if (isSuccess) {
    await loadData(true)
  }
}

// ── Filtered records（按 dateRange 二次过滤） ────────────────────────
const filteredRecords = computed<PointsRecord[]>(() => {
  if (!dateRange.value || dateRange.value.length < 2)
    return records.value

  const [start, end] = dateRange.value
  if (!start)
    return records.value

  const startTs = start.getTime()
  const endTs = end ? end.getTime() + 86400_000 - 1 : Infinity

  return records.value.filter((r) => {
    const ts = r.timestamp
    if (!ts)
      return false

    return ts >= startTs && ts <= endTs
  })
})

/**
 * ── Data fetching ────────────────────────────────────────────────────
 */
async function loadData(reset = false) {
  if ((reset ? loading.value : loadingMore.value) || (!reset && !hasMore.value))
    return

  if (reset) {
    loading.value = true
    pageIndex.value = 1
    total.value = 0
    hasMore.value = true
    records.value = []
  }
  else {
    loadingMore.value = true
  }

  try {
    const range = dateRange.value
    const startDate = range?.[0] ? formatDate(range[0]) : undefined
    const endDate = range?.[1] ? formatDate(range[1]) : undefined

    const request = activeTab.value === 'recharge'
      ? API.points.userGetPointsRechargeRecordsList
      : API.points.userGetPointsChargesRecordsList

    const { code, data } = await request({
      page_index: pageIndex.value,
      page_size: PAGE_SIZE,
      startDate,
      endDate,
    }) as any

    if (code === 0) {
      const timeField = activeTab.value === 'charge' ? 'chargedAt' : 'payTime'
      const nextRecords = (data?.rows ?? []).map((row: any) => ({
        id: row.orderNo ?? '',
        date: formatPayTime(row[timeField]),
        timestamp: normalizeTimestamp(row[timeField]),
        points: row.points || '-',
        amount: activeTab.value === 'recharge' && row.amount ? `$${row.amount}` : undefined,
        orderType: OrderTypeStr[row.orderType] || row.orderType || '-',
      }))

      total.value = Number(data?.total) || 0
      records.value = reset ? nextRecords : [...records.value, ...nextRecords]

      if (total.value > 0) {
        hasMore.value = records.value.length < total.value
      }
      else {
        hasMore.value = nextRecords.length === PAGE_SIZE
      }

      if (hasMore.value) {
        pageIndex.value += 1
      }

      if (reset) {
        nextTick(() => {
          listRef.value?.scrollTo({ top: 0 })
        })
      }
    }
  }
  catch (e) {
    console.error('Failed to load points data:', e)
  }
  finally {
    if (reset) {
      loading.value = false
    }
    else {
      loadingMore.value = false
    }
  }
}

function switchTab(tab: RecordTab) {
  if (activeTab.value === tab)
    return

  activeTab.value = tab
  loadData(true)
}

/**
 * ── Helpers ──────────────────────────────────────────────────────────
 */
function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function normalizeTimestamp(timestamp?: number | string | null): number | undefined {
  if (timestamp == null)
    return undefined

  const value = Number(timestamp)
  if (!Number.isFinite(value) || value <= 0)
    return undefined

  return value < 1_000_000_000_000 ? value * 1000 : value
}

function formatPayTime(timestamp?: number | string | null): string {
  const value = normalizeTimestamp(timestamp)
  return value ? format(value, 'yyyy-MM-dd HH:mm:ss') : ''
}

function formatDateValue(input: any, _: any, formData: any) {
  if (Array.isArray(input.value)) {
    const [startDate, endDate] = input.value
    Object.assign(formData, {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate || startDate, 'yyyy-MM-dd'),
    })
  }
}

function onListScroll(event: Event) {
  const target = event.target as HTMLElement
  const threshold = 24
  const isNearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - threshold

  if (isNearBottom) {
    loadData()
  }
}

const planItems = computed(() => [
  {
    label: $t('我的积分'),
    value: userPayInfo.value.points,
    unit: '',
  },
  {
    label: $t('购买折扣'),
    value: userPayInfo.value.pointsDiscount,
    unit: '%',
    hide: userPayInfo.value.pointsDiscount <= 0,
  },
])

// ── Init ─────────────────────────────────────────────────────────────
onMounted(() => {
  loadData(true)
})
</script>

<template>
  <!-- 整体布局 -->
  <div class="h-full min-h-0 flex flex-col">
    <!-- 内容卡片容器 -->
    <div
      class="flex-1 min-h-0 flex flex-col bg-[var(--colors-background-bg-page)] overflow-hidden items-center w-full"
    >
      <!-- 顶部标题栏 -->
      <div class="w-full h-15 shrink-0 flex items-center px-6 border-1 border-b-solid border-[var(--colors-border-border-inactive)]">
        <span class="font-['Archivo'] font-semibold text-[18px] leading-[30px] text-[var(--colors-text-text-primary)]">
          {{ $t('积分') }}
        </span>
      </div>

      <!-- 内容区：可滚动 -->
      <div class="flex-1 min-h-0 overflow-hidden max-w-800px w-full">
        <div class="h-full min-h-0 flex flex-col gap-6 p-6">
          <!-- My Points 卡片 -->
          <div
            class="relative h-[140px] shrink-0 rounded-3 overflow-hidden p-5 flex flex-col justify-between"
          >
            <!-- 渐变装饰背景 -->
            <div class="absolute inset-0 pointer-events-none overflow-hidden">
              <AutoThemeImage class="w-full" :platform-icon="getImage('mcp/points/light.svg')" :platform-icon-dark="getImage('mcp/points/dark.svg')" />
            </div>

            <div class="flex gap-22.5 items-center text-[var(--component-button-primary-text)] relative z-1 pt-5">
              <template v-for="item in planItems">
                <div v-if="!item.hide" :key="item.label" class="flex flex-col gap-2">
                  <p class="my-0 font-[Archivo] text-4 leading-[24px] font-500">
                    {{ item.label }}
                  </p>
                  <p class="my-0 font-['DingTalk_JinBuTi'] text-10 leading-[48px]">
                    {{ item.value }}{{ item.unit }}
                  </p>
                </div>
              </template>
            </div>

            <div class="absolute top-5 right-5 z-2">
              <RxButton @click="handleBuyPoints">
                {{ $t('购买积分') }}
              </RxButton>
            </div>
          </div>

          <!-- 下半部分：左侧导航 + 分割线 + 右侧内容 -->
          <div class="flex flex-1 min-h-0 gap-10">
            <!-- 左侧导航 -->
            <div class="shrink-0 flex gap-5 w-[200px]">
              <div class="flex flex-col gap-[2px] flex-1">
                <div
                  v-for="tab in tabOptions"
                  :key="tab.key"
                  class="flex flex-col h-9 justify-center px-3 rounded-[6px] cursor-pointer"
                  :class="activeTab === tab.key ? 'bg-[var(--component-table-bg-selected)]' : ''"
                  @click="switchTab(tab.key)"
                >
                  <span class="font-normal text-[14px] leading-[20px] text-[var(--colors-text-text-primary)] whitespace-nowrap">
                    {{ tab.label }}
                  </span>
                </div>
              </div>

              <!-- 垂直分割线 -->
              <div class="w-[1px] bg-[var(--colors-border-border-inactive)] self-stretch shrink-0" />
            </div>

            <!-- 右侧：标题 + 筛选 + 记录列表 -->
            <div class="flex-1 min-w-0 min-h-0 flex flex-col gap-5 overflow-hidden">
              <!-- 表头行 -->
              <div class="flex items-center justify-between shrink-0">
                <span
                  class="font-['Archivo'] font-semibold text-4 leading-[24px] text-[var(--colors-text-text-primary)]"
                >
                  {{ activeTabMeta.label }}
                </span>
                <!-- 日期范围选择器 -->
                <MInputDatePicker
                  v-model="dateRange"
                  size="xs"
                  class="!w-[220px]"
                  selection-mode="range"
                  :placeholder="$t('全部时间')"
                  :format-value="formatDateValue"
                  @update:model-value="() => loadData(true)"
                />
              </div>

              <!-- 记录列表（超高度时滚动） -->
              <div
                ref="listRef"
                class="flex-1 min-h-0 overflow-y-auto"
                @scroll="onListScroll"
              >
                <div v-if="loading" class="flex items-center justify-center py-12">
                  <span class="text-sm text-[var(--colors-text-text-inactive)]">{{ $t('加载中...') }}</span>
                </div>

                <div v-else-if="filteredRecords.length === 0">
                  <Empty icon="empty/wallet" :title="activeTabMeta.emptyText" />
                </div>

                <div v-else class="flex flex-col">
                  <div
                    v-for="record in filteredRecords"
                    :key="record.id"
                    class="flex gap-3 h-15 py-2 border-1 border-t-solid border-[var(--colors-border-border-inactive)] last:border-b-solid"
                  >
                    <!-- 日期 -->
                    <div class="flex-1 min-w-0 flex flex-col justify-center gap-1 text-[14px] leading-[20px] text-[var(--colors-text-text-primary)]">
                      <span class="font-medium">
                        {{ record.date }}
                      </span>
                      <span
                        v-if="activeTab === 'recharge'"
                        class="font-normal text-3 leading-[20px] text-[var(--colors-text-text-tertiary)]"
                      >
                        {{ record.orderType }}
                      </span>
                    </div>
                    <!-- 积分 + 金额 -->
                    <div class="shrink-0 flex flex-col justify-center gap-1 items-end whitespace-nowrap">
                      <span
                        class="font-medium text-[14px] leading-[20px]"
                        :class="activeTabMeta.pointsClass"
                      >
                        {{ activeTabMeta.pointsPrefix }}{{ record.points }} {{ $t('积分') }}
                      </span>
                      <span
                        v-if="record.amount"
                        class="font-normal text-3 leading-[20px] text-[var(--colors-text-text-tertiary)]"
                      >
                        {{ record.amount }}
                      </span>
                    </div>
                  </div>

                  <div v-if="loadingMore" class="flex items-center justify-center py-4">
                    <span class="text-sm text-[var(--colors-text-text-inactive)]">{{ $t('加载中...') }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
