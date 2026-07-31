<script setup lang="ts">
import { API } from '/@/api'
import type { DeviceItem } from '../device-operation'

const { data } = defineProps<{
  data: DeviceItem
}>()

const columns = [
  {
    title: $t('账号'),
    key: 'accountName',
  },
  {
    title: $t('电商平台'),
    key: 'platform',
  },
  {
    title: $t('最后登录用户'),
    key: 'lastLoginUser',
    getText: (data: any) => data.lastLoginUser || '--',
  },
  {
    title: $t('最后登录时间'),
    key: 'lastLoginTime',
    getText: (data: any) => data.lastLoginTime || '--',
  },
]

function tableRequest(params: any) {
  return API.proxy.userGetProxyDeviceBoundAccountsList({ ...params, id: String(data.id) })
}
</script>

<template>
  <RyTable data-key="windowId" :columns="columns" :table-request="tableRequest" :show-table-header="false" :show-actions="false">
    <template #table-empty>
      <CustomEmpty :title="$t('暂无绑定账号')" />
    </template>
  </RyTable>
</template>

<style scoped></style>
