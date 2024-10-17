<script setup lang="tsx">
import type { UnwrapRowType, UserGetOperateLogListData } from '@roxy/backend-api'
import { format } from 'date-fns'
import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales'

type Data = UnwrapRowType<UserGetOperateLogListData>

const columns = ref([
  {
    title: $t('User'),
    key: 'userName',
    render: ({ data }: { data: Data }) => (
      <div>
        <div>{data.email}</div>
        <div class="text-[#7C8387]">{data.userName}</div>
      </div>
    ),
  },
  {
    title: $t('Actions'),
    key: 'operateType',
  },
  {
    title: $t('Detail'),
    key: 'operateDetail',
    width: 240,
  },
  {
    title: $t('Date'),
    key: 'operateTime',
  },
  {
    title: $t('Result'),
    key: 'status',
    getText: (data: Data) => data.status ? $t('Success') : $t('Failed'),
  },
  {
    title: $t('Location IP'),
    key: 'location',
    slot: 'location',
  },
])

function tableRequest(params: any) {
  return API.logging.userGetOperateLogList(params)
}

async function tableFilters() {
  const { data } = await API.team.userGetMemberInfoByWorkspaceList({})
  return [
    {
      type: 'multiple',
      name: 'operateModule',
      value: [],
      placeholder: $t('All actions'),
      options: [
        { label: $t('Profiles'), value: 'Profiles' },
        { label: $t('Proxies'), value: 'Proxies' },
        { label: $t('Accounts'), value: 'Accounts' },
        { label: $t('Projects'), value: 'Projects' },
        { label: $t('Extensions'), value: 'Extensions' },
        { label: $t('Members'), value: 'Members' },
        { label: $t('Team settings'), value: 'Teams' },
      ],
    },
    {
      type: 'multiple',
      name: 'userNameIds',
      value: [],
      placeholder: $t('All users'),
      options: data.rows.map(user => ({ label: user.email, value: user.user_id })),
    },
    {
      type: 'date',
      name: 'date',
      placeholder: $t('All time'),
      formatValue: (input: any, _: any, formData: any) => {
        const [startDate, endDate] = (input.value || []).map((date: Date) => format(date || input.value[0], 'yyyy-MM-dd'))
        Object.assign(formData, { startDate, endDate })
      },
    },
  ]
}
</script>

<template>
  <div class="flex flex-col w-full h-full logs">
    <div class="logs-header">
      <RxSvgIcon name="base/rx_ic_doc_data" />
      <span>{{ $t('History Logs') }}</span>
    </div>
    <div class="flex flex-1 overflow-hidden">
      <ry-table :table-filters="tableFilters" :columns="columns" :table-request="tableRequest" :show-actions="false"
                :show-display="false" :context-menu="false"
      >
        <template #location="{ data }">
          <div class="flex items-center gap-1">
            <RxSvgIcon name="base/rx_ic_earth" />
            <div>{{ data.countryCode }}</div>
            <RxSvgIcon v-tooltip.top="{ value: data.location.replace(';', '\n') }"
                       :tooltip-options="{ placement: 'bottom', showDelay: 500 }" name="base/rx_ic_info" :size="12"
            />
          </div>
        </template>
      </ry-table>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.logs {
  &-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: var(--spacing-xl, 12px) var(--spacing-4xl, 24px);
    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 16px;
    font-weight: 600;
    line-height: var(--Line-Height-text-xl, 24px);
    border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
  }
}
</style>
