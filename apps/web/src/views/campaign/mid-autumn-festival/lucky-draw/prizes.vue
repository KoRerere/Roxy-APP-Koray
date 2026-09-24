<script setup lang="ts">
import { API } from '/@/api'
import { formatDrawTime, getPrizeTierName } from './prize'
import type { LotteryPrizeRecord } from './prize'

const emit = defineEmits<{
  /** 关闭我的奖品弹窗 */
  close: []
  /** 查看详情：由外壳关掉全部抽奖弹窗后再跳转 */
  viewDetails: [prize: LotteryPrizeRecord]
}>()

const columns = [
  {
    title: $t('奖项'),
    key: 'prizeTier',
    getText: (row: LotteryPrizeRecord) => getPrizeTierName(row.prizeTier),
  },
  {
    title: $t('奖品内容'),
    slot: 'prizeContent',
  },
  {
    title: $t('抽奖时间'),
    key: 'drawTime',
    getText: (row: LotteryPrizeRecord) => formatDrawTime(row.drawTime),
  },
  {
    title: $t('操作'),
    slot: 'actions',
  },
]

/** 详情跳转依赖外壳关闭抽奖盘，这里只把当前行抛出去 */
function onViewDetails(prize: LotteryPrizeRecord) {
  emit('viewDetails', prize)
}

/** RyTable 需要 { rows }；奖品列表接口把记录放在 prizes 里 */
async function getPrizeList() {
  const { code, data, msg } = await API.pay.userMidAutumnLotteryPrizesList()
  return { code, data: { rows: data?.prizes ?? [] }, msg }
}
</script>

<template>
  <div class="w-200 inline-flex flex-col pa-6 pt-4 gap-4">
    <div class="h-9 flex justify-between items-center">
      <span class="header">{{ $t('我的奖品') }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="$emit('close')" />
    </div>
    <div class="h-70 overflow-hidden">
      <RyTable :columns="columns" :table-request="getPrizeList" :show-table-header="false" :show-actions="false" :paginator="false" :multiple-operation="false">
        <template #table-empty>
          <CustomEmpty :title="$t('暂无奖品')" />
        </template>
        <template #prizeContent="{ data }">
          <div class="flex items-center">
            <span>{{ data.prizeContent }}</span>
            <SvgIcon v-if="data.desc" v-tooltip="data.desc" class="cursor-pointer" name="base/rx_ic_info" color="var(--colors-icon-icon-note)" />
          </div>
        </template>
        <template #actions="{ data }">
          <RxButton size="xxs" variant="text" :label="$t('查看详情')" @click="onViewDetails(data)" />
        </template>
      </RyTable>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.header {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}
</style>
