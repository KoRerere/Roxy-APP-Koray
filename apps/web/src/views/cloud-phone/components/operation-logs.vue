<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CustomEmpty from '/@/components/custom-empty.vue'
import CustomNewEmpty from '/@/components/custom-new-empty.vue'
import RxButton from '/@/components/rx-button'
import RxDivider from '/@/components/rx-divider.vue'
import { RxSvgIcon } from '/@/components/rx-icon'
import RxTag from '/@/components/rx-tag.vue'
import RyTable from '/@/components/ry-table'
import TableFilter from '/@/components/ry-table/table-filter.vue'
import { usePopupMenu } from '/@/hooks/usePopupMenu'
import { useCloudPhones } from '../useCloudPhones'
import type { CloudPhoneLog } from '../useCloudPhones'

const { t: $t } = useI18n()

const { logs } = useCloudPhones()

const { showMenu } = usePopupMenu()

// 日期范围筛选：[开始, 结束]，只选了一天时结束为 null
// 直接复用表格通用筛选（TableFilter）的日期控件，样式与团队操作日志等模块保持一致
const dateFilters = reactive<any[]>([
  { type: 'date', key: 'date', name: 'date', value: null as (Date | null)[] | null, placeholder: $t('选择日期范围'), maxDate: new Date() },
])
const dateRange = computed<(Date | null)[] | null>({
  get: () => dateFilters[0].value,
  set: (value) => {
    dateFilters[0].value = value
  },
})
// 通过「添加筛选」追加的状态筛选
const statusFilter = ref<CloudPhoneLog['status'] | null>(null)
const refreshing = ref(false)

const statusLabels = computed<Record<CloudPhoneLog['status'], string>>(() => ({
  success: $t('成功'),
  failed: $t('失败'),
}))

const hasFilter = computed(() => !!dateRange.value?.[0] || !!statusFilter.value)

const filteredLogs = computed(() => {
  const [start, end] = dateRange.value ?? []
  let startTime = Number.NEGATIVE_INFINITY
  let endTime = Number.POSITIVE_INFINITY
  if (start) {
    startTime = new Date(start).setHours(0, 0, 0, 0)
    endTime = new Date(end ?? start).setHours(23, 59, 59, 999)
  }

  return logs.value.filter((item) => {
    if (statusFilter.value && item.status !== statusFilter.value) {
      return false
    }
    const time = new Date(item.time.replace(' ', 'T')).getTime()
    return time >= startTime && time <= endTime
  })
})

function showFilterMenu(event: MouseEvent) {
  showMenu(event, {
    model: (Object.keys(statusLabels.value) as CloudPhoneLog['status'][]).map(status => ({
      label: `${$t('状态')}: ${statusLabels.value[status]}`,
      command: () => {
        statusFilter.value = status
      },
    })),
  })
}

async function onRefresh() {
  // 日志目前是本地数据，刷新仅给出加载反馈
  refreshing.value = true
  await new Promise(resolve => setTimeout(resolve, 400))
  refreshing.value = false
}

function onExport() {
  const escapeCell = (value: string) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const rows = [
    [$t('操作'), $t('云手机名称'), $t('操作人'), $t('时间'), $t('状态')],
    ...filteredLogs.value.map(item => [item.action, item.phoneName, item.operator, item.time, item.status]),
  ]
  const csv = rows.map(row => row.map(escapeCell).join(',')).join('\n')
  // 加 BOM，避免 Excel 打开中文乱码
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `cloud-phone-logs-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

const columns = ref<any[]>([
  {
    title: $t('操作'),
    key: 'action',
    disabledToggle: true,
    slot: 'action',
    style: { width: '220px', minWidth: '160px' },
  },
  {
    title: $t('云手机名称'),
    key: 'phoneName',
    slot: 'phoneName',
    style: { width: '200px', minWidth: '140px' },
  },
  {
    title: $t('操作人'),
    key: 'operator',
    slot: 'operator',
    style: { width: '220px', minWidth: '160px' },
  },
  {
    title: $t('时间'),
    key: 'time',
    slot: 'time',
    style: { width: '200px', minWidth: '160px' },
  },
  {
    title: $t('状态'),
    key: 'status',
    slot: 'status',
    style: { width: '120px', minWidth: '90px' },
  },
])
</script>

<template>
  <RyTable v-model:columns="columns" :data-list="filteredLogs" :immediate="false" :paginator="false" :show-display="false" :show-reload="false" :show-actions="false" class="cloud-phone-logs">
    <template #table-header>
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <TableFilter :filters="dateFilters" />
        <RxDivider vertical line-only line-color="var(--colors-border-border-subtle)" class="!h-4 !w-px shrink-0" />
        <div v-if="statusFilter" class="cloud-phone-logs__chip">
          <RxSvgIcon class="cursor-pointer" :size="14" name="base/rx_ic_delete" @click="statusFilter = null" />
          <span class="select-none">{{ $t('状态') }}: {{ statusLabels[statusFilter] }}</span>
        </div>
        <RxButton size="xxs" outlined severity="secondary" icon="base/rx_ic_filter" :label="$t('添加筛选')" @click="showFilterMenu" />
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <RxButton size="xxs" outlined severity="secondary" :label="$t('刷新')" :loading="refreshing" @click="onRefresh" />
        <RxButton size="xxs" icon="base/rx_ic_export" :label="$t('导出')" :disabled="!filteredLogs.length" @click="onExport" />
      </div>
    </template>

    <template #table-empty>
      <CustomEmpty v-if="hasFilter && logs.length" :title="$t('抱歉，没有找到匹配结果。')" class="py-12" />
      <CustomNewEmpty v-else icon="base/rx_ic_clock" img="empty-cloud-phone.png" :title="$t('暂无操作日志')" :desc="$t('记录云手机创建、启停及配置变更历史')" />
    </template>

    <template #action="{ data }">
      <span class="cloud-phone-logs__action">{{ data.action }}</span>
    </template>

    <template #phoneName="{ data }">
      <span class="cloud-phone-logs__phone">{{ data.phoneName }}</span>
    </template>

    <template #operator="{ data }">
      <span class="cloud-phone-logs__muted">{{ data.operator }}</span>
    </template>

    <template #time="{ data }">
      <span class="cloud-phone-logs__muted">{{ data.time }}</span>
    </template>

    <template #status="{ data }">
      <RxTag :label="data.status" />
    </template>
  </RyTable>
</template>

<style lang="scss" scoped>
.cloud-phone-logs {
  &__action {
    color: var(--colors-text-text-primary);
    font-weight: 500;
  }

  &__phone {
    color: var(--colors-text-text-brand);
  }

  &__muted {
    color: var(--colors-text-text-secondary);
  }

  &__chip {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 24px;
    padding: 0 6px;
    border: 0.5px solid var(--colors-border-border-action);
    border-radius: var(--radius-sm, 4px);
    background: var(--colors-background-bg-action);
    color: var(--colors-text-text-primary);
    font-size: 12px;
    line-height: 16px;
  }
}
</style>
