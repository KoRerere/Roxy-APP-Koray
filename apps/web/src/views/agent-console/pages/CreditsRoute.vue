<script setup lang="ts">
import { format, subDays } from 'date-fns'
import { API } from '/@/api'
import { OrderTypeStr } from '/@/enums/pay'
import { usePermission } from '/@/hooks/usePermission'
import { useUserStore } from '/@/stores/user'
import AgentConsolePageLayout from '../components/AgentConsolePageLayout.vue'
import { useBuyPoints } from '../components/buy-points/useBuyPoints'
import { getImage } from '/@/utils'

type RecordTab = 'recharge' | 'charge'
type TimeFilter = 'all' | '30d' | '90d'

interface CreditsRecord {
  id: string
  date: string
  points: number | string
  amount?: string
  description: string
}

defineProps<{
  activeConversationId?: string
  routeTitle?: string | symbol
  thinking?: boolean
}>()

defineModel<string>('prompt')

defineEmits<{
  send: []
}>()

const PAGE_SIZE = 20
const { buyPoints } = useBuyPoints()
const { check } = usePermission()
const userStore = useUserStore()
const { userPayInfo } = storeToRefs(userStore)

const activeTab = ref<RecordTab>('recharge')
const activeFilter = ref<TimeFilter>('30d')
const filterMenuOpen = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const pageIndex = ref(1)
const total = ref(0)
const hasMore = ref(true)
const records = ref<CreditsRecord[]>([])
const listRef = ref<HTMLElement | null>(null)
const filterSelectRef = ref<HTMLElement | null>(null)
let latestLoadId = 0

const tabs = [
  { id: 'recharge', label: $t('充值记录') },
  { id: 'charge', label: $t('使用记录') },
] as const

const filterOptions = [
  // { id: 'all', label: $t('全部时间') },
  { id: '30d', label: $t('近 30 天') },
  { id: '90d', label: $t('近 90 天') },
] as const

const activeFilterLabel = computed(
  () => filterOptions.find((item) => item.id === activeFilter.value)?.label || $t('全部时间'),
)
const creditBalance = computed(() => userPayInfo.value?.points ?? 0)
const canTopUp = computed(() => check('Cost_Center_all'))
const activeTabMeta = computed(() => {
  return activeTab.value === 'recharge'
    ? {
        empty: $t('暂无充值记录'),
        prefix: '+',
        valueClass: 'is-positive',
      }
    : {
        empty: $t('暂无使用记录'),
        prefix: '-',
        valueClass: 'is-neutral',
      }
})

async function handleTopUp() {
  if (!canTopUp.value)
    return

  const success = await buyPoints()
  if (success) {
    await Promise.all([userStore.getUserPayInfo(), loadData(true)])
  }
}

function switchTab(tab: RecordTab) {
  if (activeTab.value === tab) return

  activeTab.value = tab
  loadData(true)
}

function setFilter(filter: TimeFilter) {
  if (activeFilter.value === filter) {
    filterMenuOpen.value = false
    return
  }

  activeFilter.value = filter
  filterMenuOpen.value = false
  loadData(true)
}

function getDateQuery(filter: TimeFilter) {
  if (filter === 'all') return {}

  const days = filter === '30d' ? 30 : 90
  return {
    startDate: format(subDays(new Date(), days), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  }
}

async function loadData(reset = false) {
  if (!reset && (loading.value || loadingMore.value || !hasMore.value))
    return

  const loadId = reset ? ++latestLoadId : latestLoadId
  const requestedTab = activeTab.value
  const requestedFilter = activeFilter.value
  const requestedPage = reset ? 1 : pageIndex.value

  if (reset) {
    loading.value = true
    loadingMore.value = false
    pageIndex.value = 1
    total.value = 0
    hasMore.value = true
    records.value = []
  } else {
    loadingMore.value = true
  }

  try {
    const query = {
      page_index: requestedPage,
      page_size: PAGE_SIZE,
      ...getDateQuery(requestedFilter),
    }
    const request =
      requestedTab === 'recharge'
        ? API.points.userGetPointsRechargeRecordsList(query)
        : API.points.userGetPointsChargesRecordsList({
            ...query,
            page_index: String(query.page_index),
            page_size: String(query.page_size),
          })

    const { code, data } = (await request) as any

    if (loadId !== latestLoadId || code !== 0)
      return

    const timeField = requestedTab === 'charge' ? 'chargedAt' : 'payTime'
    const nextRecords = (data?.rows ?? []).map((row: any, index: number) => ({
      id: row.orderNo || row.id || `${requestedTab}-${requestedPage}-${index}`,
      date: formatRecordTime(row[timeField]),
      points: row.points || 0,
      amount: requestedTab === 'recharge' && row.amount ? `$${row.amount}` : undefined,
      description:
        requestedTab === 'recharge'
          ? OrderTypeStr[row.orderType] || row.orderType || $t('充值')
          : row.description || row.name || row.scene || $t('使用'),
    }))

    total.value = Number(data?.total) || 0
    const updatedRecords = reset ? nextRecords : [...records.value, ...nextRecords]
    records.value = updatedRecords
    hasMore.value = total.value > 0 ? updatedRecords.length < total.value : nextRecords.length === PAGE_SIZE

    if (hasMore.value) pageIndex.value = requestedPage + 1

    if (reset) {
      nextTick(() => {
        listRef.value?.scrollTo({ top: 0 })
      })
    }
  } catch (error) {
    console.error('Failed to load credits data:', error)
  } finally {
    if (loadId === latestLoadId) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

function normalizeTimestamp(timestamp?: number | string | null): number | undefined {
  if (timestamp == null) return undefined

  const value = Number(timestamp)
  if (!Number.isFinite(value) || value <= 0) return undefined

  return value < 1_000_000_000_000 ? value * 1000 : value
}

function formatRecordTime(timestamp?: number | string | null): string {
  const value = normalizeTimestamp(timestamp)
  return value ? format(value, 'yyyy/MM/dd HH:mm:ss') : ''
}

function onListScroll(event: Event) {
  const target = event.target as HTMLElement
  const threshold = 24
  const isNearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - threshold

  if (isNearBottom) loadData()
}

function closeFilterMenuOnOutsideClick(event: MouseEvent) {
  const target = event.target as Node | null

  if (!target || filterSelectRef.value?.contains(target)) return

  filterMenuOpen.value = false
}

onMounted(() => {
  userStore.getUserPayInfo()
  loadData(true)
  document.addEventListener('click', closeFilterMenuOnOutsideClick, true)
})

onUnmounted(() => {
  document.removeEventListener('click', closeFilterMenuOnOutsideClick, true)
})
</script>

<template>
  <AgentConsolePageLayout content-display="flex" overflow="hidden" padding="66px 23px 24px" mobile-padding="66px 16px 20px">
    <div class="credits-content">
      <h1>{{ $t('积分') }}</h1>

      <section class="balance-card" :aria-label="$t('积分余额')">
        <div class="balance-copy">
          <p>{{ $t('积分余额') }}</p>
          <div class="balance-row">
            <strong>{{ creditBalance }}</strong>
            <button v-if="canTopUp" class="top-up-button" type="button" @click="handleTopUp">
              {{ $t('充值') }}
            </button>
          </div>
        </div>

        <div class="balance-art" aria-hidden="true">
          <img :src="getImage('agent/credits-effect.png')" class="w-full"/>
        </div>
      </section>

      <div class="credits-tabs" role="tablist" :aria-label="$t('积分记录视图')">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="credits-tab"
          :class="{ active: activeTab === tab.id }"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.id"
          @click="switchTab(tab.id)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="filter-row">
        <div ref="filterSelectRef" class="filter-select">
          <button class="filter-select__trigger" type="button" @click="filterMenuOpen = !filterMenuOpen">
            <span>{{ activeFilterLabel }}</span>
            <SvgIcon name="base/rx_ic_calendar" size="12" />
          </button>

          <div v-if="filterMenuOpen" class="filter-select__menu">
            <button
              v-for="option in filterOptions"
              :key="option.id"
              class="filter-select__option"
              :class="{ active: activeFilter === option.id }"
              type="button"
              @click="setFilter(option.id)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </div>

      <div ref="listRef" class="credits-list" @scroll="onListScroll">
        <div v-if="loading" class="credits-state">{{ $t('加载中...') }}</div>

        <div v-else-if="records.length === 0" class="credits-state">
          {{ activeTabMeta.empty }}
        </div>

        <template v-else>
          <article v-for="record in records" :key="record.id" class="credits-record">
            <div class="record-main">
              <time>{{ record.date }}</time>
              <span>{{ record.description }}</span>
            </div>
            <div class="record-value">
              <strong :class="activeTabMeta.valueClass">{{ activeTabMeta.prefix }}{{ record.points }}</strong>
              <span v-if="record.amount">{{ record.amount }}</span>
            </div>
          </article>
        </template>

        <div v-if="loadingMore" class="credits-state credits-state--more">{{ $t('加载中...') }}</div>
      </div>
    </div>
  </AgentConsolePageLayout>
</template>

<style lang="scss" scoped>
.credits-content {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

h1 {
  margin: 0 0 23px;
  color: var(--color-text-primary);
  font-size: 24px;
  font-weight: 500;
  line-height: 32px;
}

.balance-card {
  position: relative;
  display: flex;
  height: 120px;
  flex: 0 0 auto;
  align-items: center;
  padding: 24px;
  border-radius: 12px;
  background: #3e1c96;
  color: var(--color-bg-primary);
  overflow: hidden;
}

.balance-copy {
  position: relative;
  z-index: 1;

  p {
    margin: 0 0 10px;
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
    color: #FCFCFC;
  }
}

.balance-row {
  display: flex;
  align-items: center;
  gap: 12px;

  strong {
    font-size: 32px;
    font-weight: 700;
    line-height: 38px;
    color: #FCFCFC;
  }
}

.top-up-button {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border: 0;
  border-radius: 10px;
  color: #FCFCFC;
  background: var(--agent-gradient);
  box-shadow: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.balance-art {
  position: absolute;
  right: -40px;
  width: 399px;
  pointer-events: none;
}

.balance-art__ring {
  position: absolute;
  inset: 56px;
  border: 1px solid rgb(252 252 252 / 28%);
  border-radius: 132px;
  background: rgb(63 170 246 / 12%);
}

.balance-art__bar {
  position: absolute;
  width: 29px;
  height: 94px;
  border: 1px solid rgb(252 252 252 / 12%);
  border-radius: 999px;
  background: #3e1c96;
}

.balance-art__bar--left {
  top: 295px;
  left: 226px;
}

.balance-art__bar--right {
  top: 253px;
  right: 72px;
}

.credits-tabs {
  display: flex;
  height: 32px;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  margin-top: 24px;
  border-bottom: 1px solid var(--color-border-secondary);
}

.credits-tab {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  color: var(--color-text-tertiary);
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  opacity: 0.6;

  &.active {
    border-bottom-color: var(--color-text-primary);
    color: var(--color-text-primary);
    opacity: 1;
  }
}

.filter-row {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  margin-top: 20px;
}

.filter-select {
  position: relative;
  width: 220px;
}

.filter-select__trigger {
  display: flex;
  width: 100%;
  height: 32px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 10px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  box-shadow: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
}

.filter-select__menu {
  position: absolute;
  z-index: 10;
  top: calc(100% + 6px);
  right: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  padding: 4px;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  background: var(--color-bg-primary);
  box-shadow: 0 12px 30px rgb(15 15 15 / 12%);
}

.filter-select__option {
  height: 30px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  color: var(--color-text-primary);
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  line-height: 18px;
  text-align: left;

  &:hover,
  &.active {
    background: var(--color-bg-quaternary);
  }
}

.credits-list {
  display: flex;
  box-sizing: border-box;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  margin-top: 12px;
  padding-bottom: 12px;
  overflow: auto;
}

.credits-record {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border-secondary);
}

.record-main {
  display: flex;
  min-width: 0;
  height: 44px;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;

  time {
    color: var(--color-text-primary);
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
  }

  span {
    color: var(--color-text-secondary);
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
  }
}

.record-value {
  display: flex;
  height: 44px;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  white-space: nowrap;

  strong {
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
  }

  span {
    color: var(--color-text-tertiary);
    font-size: 12px;
    font-weight: 400;
    line-height: 16px;
  }
}

.is-positive {
  color: #17b26a;
}

.is-neutral {
  color: var(--color-text-primary);
}

.credits-state {
  display: grid;
  min-height: 140px;
  place-items: center;
  color: var(--color-text-quaternary);
  font-size: 14px;
  line-height: 20px;
}

.credits-state--more {
  min-height: 44px;
}

@media (max-width: 720px) {
  .balance-card {
    padding: 20px;
  }

  .balance-art {
    right: -220px;
  }
}
</style>
