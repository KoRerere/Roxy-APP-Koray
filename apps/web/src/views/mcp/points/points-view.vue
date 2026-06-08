<script setup lang="ts">
import { computed, ref } from 'vue'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import Empty from '../settings/components/empty.vue'
import PurchaseAgentPoints from '/@/views/lab/PurchaseAgentPoints.vue'

// ── State ────────────────────────────────────────────────────────────
const pointsBalance = ref(0)
const records = ref<RechargeRecord[]>([])
const loading = ref(false)
const dateFilter = ref('all')
const showBuyDialog = ref(false)

// ── Types ────────────────────────────────────────────────────────────
interface RechargeRecord {
  id: string
  date: string
  points: number
  price: string
}

// ── Date filter options ──────────────────────────────────────────────
const dateFilterOptions = computed(() => [
  { label: $t('全部日期'), value: 'all' },
  { label: $t('最近 7 天'), value: '7days' },
  { label: $t('最近 30 天'), value: '30days' },
  { label: $t('最近 90 天'), value: '90days' },
])

// ── Filtered records ─────────────────────────────────────────────────
const filteredRecords = computed(() => {
  if (dateFilter.value === 'all')
    return records.value

  const now = Date.now()
  const daysMap: Record<string, number> = {
    '7days': 7,
    '30days': 30,
    '90days': 90,
  }
  const days = daysMap[dateFilter.value] || 0
  const cutoff = now - days * 24 * 60 * 60 * 1000

  return records.value.filter(r => new Date(r.date).getTime() >= cutoff)
})

// ── Data fetching ────────────────────────────────────────────────────
async function loadData() {
  loading.value = true
  try {
    // TODO: Replace with actual API calls when backend is ready
    // For now, use mock data matching the Figma design
    pointsBalance.value = 100

    records.value = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2026, 5, 5, 12, 46, 27)
      d.setDate(d.getDate() - i)
      return {
        id: String(i + 1),
        date: formatDateTime(d),
        points: 300,
        price: '$16.20',
      }
    })
  }
  catch (e) {
    console.error('Failed to load points data:', e)
  }
  finally {
    loading.value = false
  }
}

// ── Helpers ──────────────────────────────────────────────────────────
function formatDateTime(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}/${m}/${d} ${h}:${min}:${s}`
}

function handleBuyPoints() {
  showBuyDialog.value = true
}

function hideBuyDialog() {
  showBuyDialog.value = false
}

// ── Init ─────────────────────────────────────────────────────────────
onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- 顶部标题栏 -->
    <div class="w-full h-[60px] flex items-center px-6 border-b border-b-solid border-[var(--colors-border-border-inactive)] shrink-0">
      <div class="font-['Archivo'] font-semibold text-[var(--colors-text-text-primary)] text-lg leading-[30px]">
        {{ $t('Points') }}
      </div>
    </div>

    <!-- 内容区 -->
    <div class="flex-1 min-h-0 overflow-y-auto px-6 pt-[92px] pb-6">
      <div class="flex flex-col gap-6">
        <!-- My Points 卡片 -->
        <div
          class="relative h-[140px] shrink-0 rounded-3 border border-solid border-[var(--colors-border-border-inactive)] overflow-hidden p-5 flex flex-col justify-between"
        >
          <!-- 装饰背景 -->
          <div class="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              class="absolute w-[500px] h-[500px] rounded-full opacity-15"
              style="background: radial-gradient(circle, var(--colors-text-text-brand, #11a3fd) 0%, transparent 70%); left: -180px; top: -200px"
            />
            <div
              class="absolute w-[300px] h-[300px] rounded-full opacity-10"
              style="background: radial-gradient(circle, #f359dc 0%, transparent 70%); right: -80px; top: -120px"
            />
          </div>

          <!-- 卡片内容 -->
          <div class="relative z-1">
            <p class="font-['Archivo'] font-semibold text-base leading-6 text-[var(--colors-text-text-secondary)] my-0">
              {{ $t('我的积分') }}
            </p>
          </div>

          <div class="relative z-1 flex items-end justify-between">
            <div class="flex items-baseline gap-2 whitespace-nowrap">
              <span class="font-['DingTalk_Sans'] text-[40px] leading-[48px] text-[var(--colors-text-text-primary)]">
                {{ pointsBalance }}
              </span>
              <span class="font-['Inter'] font-medium text-[14px] leading-[20px] text-[var(--colors-text-text-tertiary)]">
                {{ $t('积分') }}
              </span>
            </div>

            <button
              class="flex items-center justify-center gap-1.5 min-w-[72px] px-2.5 py-1.5 rounded-1.5 border border-solid cursor-pointer shrink-0
                     bg-[var(--component-button-primary-bg,#11a3fd)] border-[var(--component-button-primary-border,#0282d4)]
                     text-white font-['Inter'] font-medium text-xs leading-5
                     shadow-[0px_4px_4px_-1px_rgba(0,0,0,0.02),0px_1px_1px_0px_rgba(0,0,0,0.06)]"
              @click="handleBuyPoints"
            >
              {{ $t('购买积分') }}
            </button>
          </div>
        </div>

        <!-- 下半部分：左侧导航 + 右侧表格 -->
        <div class="flex-1 min-h-0 flex gap-[60px]">
          <!-- 左侧导航 -->
          <div class="shrink-0 w-[180px] flex flex-col gap-0.5">
            <div
              class="flex flex-col h-9 justify-center px-3 rounded-1.5 cursor-pointer bg-[var(--component-table-bg-selected,#def3ff)]"
            >
              <span class="font-['Inter'] text-[14px] leading-5 text-[var(--colors-text-text-primary)] whitespace-nowrap">
                {{ $t('充值记录') }}
              </span>
            </div>
          </div>

          <!-- 右侧内容 -->
          <div class="flex-1 min-w-0 flex flex-col gap-5">
            <!-- 表头 -->
            <div class="flex items-center justify-between shrink-0">
              <p class="font-['Archivo'] font-semibold text-base leading-6 text-[var(--colors-text-text-primary)] my-0">
                {{ $t('充值记录') }}
              </p>

              <!-- 日期筛选 -->
              <RxInputSelect
                v-model="dateFilter"
                name="points-date-filter"
                class="!w-[233px]"
                :filter="false"
                size="md"
                :options="dateFilterOptions"
                option-label="label"
                option-value="value"
              />
            </div>

            <!-- 记录列表 -->
            <div v-if="loading" class="flex items-center justify-center py-12">
              <div class="text-sm text-[var(--colors-text-text-inactive)]">
                {{ $t('加载中...') }}
              </div>
            </div>

            <div v-else-if="filteredRecords.length === 0">
              <Empty icon="empty/wallet" :title="$t('暂无充值记录')" />
            </div>

            <div v-else class="flex flex-col">
              <div
                v-for="record in filteredRecords"
                :key="record.id"
                class="flex gap-3 h-[60px] items-center py-2 border-y-[0.5px] border-solid border-[var(--colors-border-border-inactive)]"
              >
                <div class="flex-1 min-w-0 font-['Inter'] text-[14px] leading-5 text-[var(--colors-text-text-primary)]">
                  {{ record.date }}
                </div>
                <div class="shrink-0 flex flex-col gap-1 items-end whitespace-nowrap">
                  <span class="font-['Inter'] font-medium text-[14px] leading-5 text-[var(--colors-text-text-success,#1dc94d)]">
                    +{{ record.points }}
                  </span>
                  <span class="font-['Inter'] text-xs leading-5 text-[var(--colors-text-text-tertiary)]">
                    {{ record.price }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 购买积分弹窗 -->
    <Dialog
      v-model:visible="showBuyDialog"
      :header="$t('购买 Agent 积分')"
      modal
      :draggable="false"
      :style="{ width: '680px' }"
      :pt="{
        header: { class: '!px-0 !pt-0 !pb-0' },
        content: { class: '!px-0 !pt-0 !pb-0' },
        footer: { class: '!hidden' },
      }"
      @hide="hideBuyDialog"
    >
      <PurchaseAgentPoints :hide-modal="hideBuyDialog" />
    </Dialog>
  </div>
</template>
