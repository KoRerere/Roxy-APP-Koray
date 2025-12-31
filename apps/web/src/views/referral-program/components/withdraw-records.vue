<script setup lang="tsx">
import { format } from 'date-fns'
import { API } from '/@/api'

import { PayWay } from '/@/enums/pay'
import type { UnwrapRowType, UserGetWithdrawRecordListListData } from '@roxy/backend-api'

type Data = UnwrapRowType<UserGetWithdrawRecordListListData>

const withdrawStatusMap = {
  'Pending': $t('处理中...'),
  'Success': $t('已到账'),
  'Fail': $t('提现失败'),
  'Reject': $t('未通过'),
}

const withdrawStatusColorMap = {
  'Pending': 'var(--colors-text-text-primary)',
  'Success': 'var(--colors-text-text-success)',
  'Fail': 'var(--colors-text-text-error)',
  'Reject': 'var(--colors-text-text-error)',
}

const columns = ref([
  {
    title: $t('申请提现时间'),
    key: 'userName',
    getText: (data: Data) => format(data.createTime * 1000, 'yyyy-MM-dd HH:mm:ss')
  },
  {
    title: $t('提现金额'),
    key: 'withdrawAmount',
    getText: (data: Data) => `$${data.withdrawAmount}`
  },
  {
    title: $t('提现类型'),
    key: 'withdrawType',
  },
  {
    title: $t('状态'),
    key: 'withdrawStatus',
    render: ({ data }: { data: Data }) => (
      <span style={{ color: withdrawStatusColorMap[data.withdrawStatus as keyof typeof withdrawStatusColorMap] }}>
        {withdrawStatusMap[data.withdrawStatus as keyof typeof withdrawStatusMap]}
      </span>
    ),
  },
])

function tableRequest(params: any) {
  return API.base.userGetWithdrawRecordListList(params)
}

async function tableFilters() {
  return [
    {
      type: 'date',
      name: 'date',
      placeholder: $t('请选择时间'),
      formatValue: (input: any, _: any, formData: any) => {
        if (Array.isArray(input.value) && input.value[0]) {
          const [start_time, end_time] = (input.value || []).map((date: Date) => date / 1000)
          Object.assign(formData, { start_time, end_time: end_time ? end_time : start_time + 86399 })
        }
      },
    },
    {
      type: 'select',
      name: 'withdraw_type',
      placeholder: $t('请选择提现类型'),
      showClear: true,
      options: [
        { label: $t('Roxy 钱包'), value: PayWay.Balance },
        { label: $t('加密货币'), value: PayWay.USDT },
        { label: 'PayPal', value: PayWay.PayPal }
      ],
    },
    {
      type: 'select',
      name: 'withdraw_status',
      showClear: true,
      placeholder: $t('请选择状态'),
      options: [
        { label: $t('处理中...'), value: 'Pending' },
        { label: $t('已到账'), value: 'Success' },
        { label: $t('提现失败'), value: 'Fail' },
      ],
    },
  ]
}
</script>

<template>
  <RyTable cacheKey="history-log-list" :table-filters="tableFilters" :columns="columns" :table-request="tableRequest" :show-actions="false" :show-display="false" :context-menu="false">
    <template #table-empty>
      <CustomEmpty icon="rx_illustration_filter.svg" :title="$t('暂无提现记录')" />
    </template>
  </RyTable>
</template>

<style lang="scss" module>
.user-email {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-family: Inter;
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
}

.user-name {
  color: var(--colors-text-text-tertiary, #575D60);
  font-family: Inter;
  font-size: 12px;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>

<style lang="scss" scoped>
.description {
  color: var(--colors-text-text-tertiary, #575D60);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 16px;
}

.locationip {
  color: var(--colors-text-text-primary, #fafafa);
  font-family: Inter;
  font-size: 12px;
  line-height: 16px;
}
</style>
