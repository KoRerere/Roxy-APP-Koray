<script setup lang="ts">
import { API } from '/@/api'
import type { DeviceItem } from '../device-operation'

const { data } = defineProps<{
  data: DeviceItem
}>()

const columns = [
  {
    title: $t('操作成员'),
    key: 'operatorName',
  },
  {
    title: $t('操作时间'),
    key: 'operateTime',
  },
  {
    title: $t('操作内容'),
    key: 'operateContent',
  },
  {
    title: $t('关联账号'),
    key: 'windowName',
  },
  {
    title: $t('关联账号编号'),
    key: 'windowAccountId',
  },
]

function tableRequest(params: any) {
  return API.proxy.userGetProxyOperateRecordListCreate({ ...params, proxyModuleId: data.id })
}
</script>

<template>
  <RyTable class="proxies" :columns="columns" :table-request="tableRequest" :show-table-header="false" :show-actions="false">
    <template #table-empty>
      <CustomEmpty :title="$t('暂无操作日志')" />
    </template>
  </RyTable>
</template>

<style scoped></style>
