<script setup lang="ts">
import { format } from 'date-fns'
import { useToast } from 'primevue/usetoast'
import { ProxyCheckStatus } from '/@/enums'
import { setRowsLoading } from '/@/utils'
import outboundIp from '/@/views/agent/list/components/outbound-ip.vue'

defineProps({
  dataList: {
    type: Array,
    default: () => [],
  },
})

const toast = useToast()

const columns = ref([
  {
    key: 'id',
    title: 'ID',
  },
  {
    key: 'host',
    title: 'Host',
  },
  {
    key: 'port',
    title: 'Port',
  },
  {
    key: 'proxyUserName',
    title: 'Username',
  },
  {
    key: 'proxyPassword',
    title: 'Password',
  },
  {
    key: 'refreshUrl',
    title: 'Refreshing URL',
    width: 100,
  },
  {
    key: 'remark',
    title: 'Notes',
    width: 100,
  },
  {
    title: 'Outbound IP',
    slot: 'outbound',
  },
])

function tableOperation(data: any) {
  return [
    {
      name: 'refresh',
      label: '刷新',
      icon: 'mdi mdi-refresh',
      quick: true,
      disabled: !data.refreshUrl,
      disabledTips: '缺少刷新地址',
    },
    {
      name: 'test',
      label: '测速',
      icon: 'mdi mdi-wifi',
      quick: true,
    },
  ]
}

function operationHandler(operate: any, data: any) {
  switch (operate.name) {
    case 'refresh':
      refreshUrl(data, operate.name)

      break
    case 'test':
      testProxy(data, operate.name)
      break
  }
}

async function refreshUrl(data: any, operateName: string) {
  const isOK = await setRowsLoading(data, operateName, () => window.electronAPI.send('proxy:refreshUrl', data.refreshUrl!))
  toast.add({ severity: isOK ? 'success' : 'error', summary: isOK ? 'Success' : 'Failure', detail: data.refreshUrl, life: 5000 })
}

/**
 * 并发限制 5
 */
async function testProxy(data: any, operateName: string) {
  setRowsLoading(data, operateName, () => window.electronAPI.send('proxy:detection', toRaw(data)))
    .then(async (checkRes) => {
      data.checkStatus = checkRes.error ? ProxyCheckStatus.failure : ProxyCheckStatus.success
      data.lastIp = checkRes.ip ?? ''
      data.lastCity = checkRes.city ?? ''
      data.lastCountry = checkRes.continent_code ?? ''
      data.checkTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss')
    })
}
</script>

<template>
  <ry-table :columns="columns" :data-list="dataList" :table-operation="tableOperation" :paginator="false"
    :show-table-header="false">
    <template #outbound="{ data }">
      <outboundIp v-if="data.checkTime" :image="data.region" :country="data.lastCountry" :time="data.checkTime" />
      <div v-else>
        未检测
      </div>
    </template>

    <template #actions="{ data, operation }">
      <actions :loading-operation-map="data.loadingOperationMap" :operation="operation" :show-menu="false"
        @quick-click="(operate) => operationHandler(operate, data)" />
    </template>
  </ry-table>
</template>

<style scoped></style>
