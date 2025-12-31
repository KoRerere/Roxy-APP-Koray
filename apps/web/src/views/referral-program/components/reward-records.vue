<script setup lang="ts">
import currency from 'currency.js'
import { format } from 'date-fns'

import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon/'
import type { SvgNames } from '/@/components/rx-icon/'
import type { UnwrapRowType, UserGetPromotionInfoListData, UserGetRewardRecordListListData } from '@roxy/backend-api'

type Data = UnwrapRowType<UserGetRewardRecordListListData>

const { promotionInfo } = defineProps<{
  promotionInfo: UserGetPromotionInfoListData['data']
}>()

const rewardStatusMap = {
  approved: $t('审核成功'),
  auditing: $t('审核中 (消费后 7 日内完成)'),
  rejected: $t('审核失败'),
}

const columns = [
  {
    title: $t('用户'),
    key: 'userName',
    getText: (data: Data) => data.email || data.phone,
  },
  {
    title: $t('来源链接'),
    key: 'source',
  },
  {
    title: $t('消费金额'),
    key: 'payAmount',
    getText: (data: Data) => data.dataType === 1 ? data.payAmount : currency(data.payAmount!).format(),
  },
  {
    title: $t('返利比例'),
    key: 'rewardRatio',
    width: 240,
    getText: (data: Data) => data.dataType === 1 ? data.rewardRatio : `${data.rewardRatio}%`,
  },
  {
    title: $t('奖励'),
    key: 'reward',
    getText: (data: Data) => currency(data.reward!).format(),
  },
  {
    title: $t('状态'),
    key: 'rewardStatus',
    getText: (data: Data) => rewardStatusMap[data.rewardStatus! as keyof typeof rewardStatusMap],
  },
  {
    title: $t('创建时间'),
    key: 'payTime',
    getText: (data: Data) => format(data.payTime! * 1000, 'yyyy-MM-dd HH:mm:ss'),
  },
]

function tableRequest(params: any) {
  return API.base.userGetRewardRecordListList(params)
}

async function tableFilters() {
  return [
    {
      type: 'date',
      name: 'date',
      placeholder: $t('请选择时间'),
      formatValue: (input: any, _: any, formData: any) => {
        if (Array.isArray(input.value) && input.value[0]) {
          const [start_time, end_time] = (input.value || []).map((date: Date) => date.getTime() / 1000)
          Object.assign(formData, { start_time, end_time: end_time || start_time + 86399 })
        }
        console.log('input.value ', input.value)
      },
    },
    {
      type: 'select',
      name: 'source',
      placeholder: $t('请选择来源链接'),
      showClear: true,
      options: promotionInfo.promotionLinkList?.map(item => ({ label: item.linkType, value: item.linkType })),
    },
    {
      type: 'select',
      name: 'reward_status',
      showClear: true,
      placeholder: $t('请选择状态'),
      options: [
        { label: $t('审核成功'), value: 'approved' },
        { label: $t('审核中 (消费后 7 日内完成)'), value: 'auditing' },
        { label: $t('审核失败'), value: 'rejected' },
      ],
    },
  ]
}
</script>

<template>
  <RyTable cache-key="history-log-list" :table-filters="tableFilters" :columns="columns" :table-request="tableRequest" :show-actions="false" :show-display="false" :context-menu="false">
    <template #table-empty>
      <CustomEmpty icon="rx_illustration_filter.svg" :title="$t('暂无奖励明细')" />
    </template>

    <template #location="{ data }">
      <div class="flex items-center gap-1 locationip ">
        <RxSvgIcon :name="(`country-code/${data.code}` as SvgNames)" fallback="base/rx_ic_earth" />
        <div>{{ data.countryCode }}</div>
        <RxSvgIcon v-tooltip.top="{ value: data.location.replace(';', '\n') }" :tooltip-options="{ placement: 'bottom', showDelay: 500 }" name="base/rx_ic_info" color="#C7CDD1" :size="14" />
      </div>
    </template>
  </RyTable>
</template>

<style lang="scss" scoped>
.description {
  color: var(--colors-text-text-tertiary);
  font-size: 12px;
  line-height: 16px;
}

.locationip {
  color: var(--colors-text-text-primary);
  font-size: 12px;
  line-height: 16px;
}
</style>
