<script setup lang="ts">
import type { UnwrapRowType, UserGetOperateLogListData } from '@roxy/backend-api'
import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon/'

type Data = UnwrapRowType<UserGetOperateLogListData>

const filters = ref([
  {
    type: 'multiple',
    name: 'match',
    value: ['1'],
    options: [
      { label: 'Match one', value: '1' },
      { label: 'Match two', value: '2' },
      { label: 'Match three', value: '3' },
      { label: 'Match four', value: '4' },
    ],
  },
  {
    type: 'multiple',
    name: 'match1',
    value: ['1'],
    options: [
      { label: 'Match one', value: '1' },
      { label: 'Match two', value: '2' },
      { label: 'Match three', value: '3' },
      { label: 'Match four', value: '4' },
    ],
  },
  {
    name: 'match2',
    options: [
      { label: 'Match Every', value: 'every' },
      { label: 'Match Any', value: 'any' },
    ],
  },
])

const columns = ref([
  {
    title: 'User',
    key: 'userName',
  },
  {
    title: 'Actions',
    key: 'operateType',
  },
  {
    title: 'Detail',
    key: 'operateDetail',
    width: 240,
  },
  {
    title: 'Date',
    key: 'operateTime',
  },
  {
    title: 'Result',
    key: 'status',
    getText: (data: Data) => data.status ? 'Success' : 'Failed',
  },
  {
    title: 'Location IP',
    key: 'location',
    slot: 'location',
  },
])

function tableRequest(params: any) {
  return API.logging.userGetOperateLogList(params)
}
</script>

<template>
  <div class="flex flex-col w-full h-full logs">
    <div class="logs-header">
      <RxSvgIcon name="base/rx_ic_doc_data" />
      <span>Logss</span>
    </div>
    <div class="flex flex-1 overflow-hidden">
      <ry-table :filters="filters" :columns="columns" :table-request="tableRequest" :show-actions="false"
        :show-config="false" :context-menu="false">
        <template #location="{ data }">
          {{ data.location }}
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
