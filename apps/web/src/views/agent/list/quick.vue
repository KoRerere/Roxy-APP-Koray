<script lang="ts" setup>
import { format } from 'date-fns'
import { useToast } from 'primevue/usetoast'
import proxyColumns from './columns'
import { type ProxyItem, tableOperation, tableRequest } from './operation'
import { API } from '/@/api'
import actions from '/@/components/actions.vue'
import drawerContent from '/@/components/drawer-content.vue'
import ryButton from '/@/components/ry-button'
import ryTable from '/@/components/ry-table'
import { ProxyCheckStatus } from '/@/enums'
import { setRowsLoading } from '/@/utils'
import outboundIp from '/@/views/agent/list/components/outbound-ip.vue'
import relatedProfiles from '/@/views/agent/list/components/related-profiles.vue'

const _props = defineProps({
  data: {
    type: Object as PropType<any>,
    default: () => ({}),
  },
})

const emit = defineEmits(['confirm'])

const toast = useToast()

const columns = proxyColumns.data.filter(column => column.key !== 'ipChecker')

const filterButtons = reactive({
  value: 'All',
  options: [
    {
      key: 'All',
      name: 'All',
    },
    {
      key: 'SOCKS5',
      name: 'SOCKS 5',
    },
    {
      key: 'HTTP',
      name: 'HTTP',
    },
    {
      key: 'HTTPS',
      name: 'HTTPS',
    },
  ],
})

const dataList = ref()

async function getTableList(params: any) {
  const data = await tableRequest(params)
  dataList.value = data.data.rows
  return data
}

function operationHandler(operate: any, data: ProxyItem) {
  const datas = ([] as ProxyItem[]).concat(data)
  switch (operate.name) {
    case 'refresh':
      refreshUrl(datas)
      break
    case 'test':
      testProxy(datas, operate.name)
      break
  }
}

function refreshUrl(datas: ProxyItem[]) {
  datas.forEach(async (item) => {
    const isOK = await window.electronAPI.send('proxy:refreshUrl', item.refreshUrl!)
    toast.add({ severity: isOK ? 'success' : 'error', summary: isOK ? 'Success' : 'Failure', detail: item.refreshUrl, life: 5000 })
  })
}

async function testProxy(datas: ProxyItem[], operateName: string) {
  datas.forEach((item) => {
    setRowsLoading(item, operateName, () => window.electronAPI.send('proxy:detection', toRaw(item) as any))
      .then(async (checkRes) => {
        const params = {
          id: item.id,
          checkStatus: checkRes.error ? ProxyCheckStatus.failure : ProxyCheckStatus.success,
          lastCity: checkRes.city ?? '',
          lastCountry: checkRes.continent_code ?? '',
          lastIp: checkRes.ip ?? '',
          checkTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        }
        await API.proxy.userMdfProxyModuleCreate([params as any])
        Object.assign(item, params)
      })
  })
}

function testAllProxy() {
  testProxy(dataList.value, 'test')
}

// ====================
const selection = ref()

function saveSelected() {
  emit('confirm', selection.value)
}
</script>

<template>
  <drawer-content title="代理列表" v-bind="$attrs">
    <div class="h-full">
      <ry-table v-model:selection="selection" :table-request="getTableList" :show-gridlines="false" :columns="columns"
        :show-config="false" selection-mode="single" :context-menu="false">
        <template #header-extra>
          <div class="flex flex-auto items-center justify-between">
            <SelectButton v-model="filterButtons.value" :options="filterButtons.options" option-label="name"
              option-value="key" data-key="key" />
            <ryButton severity="secondary" icon="mdi mdi-wifi-refresh" label="Test All" @click="testAllProxy" />
          </div>
        </template>
        <template #proxy="{ data: row }">
          <div class="proxy-host">
            <span>{{ row.protocol }}://</span><span>{{ row.host }}</span><span>:{{ row.port }}</span>
          </div>
          <div class="ip-type">
            {{ row.ipType }}
          </div>
        </template>
        <template #outbound="{ data: row }">
          <outboundIp :image="row.region" :country="row.lastCountry" :time="row.checkTime" />
        </template>
        <template #related="{ data: row }">
          <relatedProfiles :list="row.bindList" />
        </template>
        <template #actions="{ data: row }">
          <actions :operation="tableOperation(row)" :loading-operation-map="row.loadingOperationMap" :show-menu="false"
            @quick-click="(operate) => operationHandler(operate, row)" />
        </template>
      </ry-table>
    </div>
    <template #footer>
      <ry-button label="Save selected" severity="info" @click="saveSelected" />
    </template>
  </drawer-content>
</template>

<style lang="scss" scoped>
.proxy-host {
  color: var(--Color-neutrals-950, #0e1214);
  font-family: 'JetBrains Mono';
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}

.ip-type {
  color: var(--Colors-Text-text-subtle, #c7cdd1);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
