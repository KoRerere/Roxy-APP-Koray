<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { useTemplateRef } from 'vue'
import { API } from '/@/api'
import actions from '/@/components/actions.vue'
import remarkIcon from '/@/components/remark-icon'
import useColumns from '/@/hooks/useColumns'
import { useRoleStore } from '/@/stores/role'
import { setRowsLoading, strConcat } from '/@/utils'
import { filterFieldByValue, getFormData } from '/@/utils/index'
import editProxy from '/@/views/agent/create/quick.vue'
import { useCheckProxy } from '/@/views/agent/hooks'
import CustomFilter from '/@/views/browser/list/profiles/components/custom-filters.vue'
import columnsConfig from './columns'
import { getCustomFilters, type ProxyItem, tableOperation, tableRequest } from './operation'

const router = useRouter()
const tableRef = useTemplateRef('proxyTable')

const toast = useToast()
const [columns] = useColumns(columnsConfig)
const role = useRoleStore()
const [checkProxy] = useCheckProxy()

const ctmFilters = ref(getCustomFilters())
const dataList = ref()

const drawer: any = reactive({
  data: null,
  visible: false,
})

async function getTableList(params: any) {
  const data = await tableRequest(params)
  dataList.value = data.data.rows
  return data
}

function operationHandler(operate: any, data: ProxyItem) {
  const datas = ([] as ProxyItem[]).concat(data)

  switch (operate.name) {
    case 'edit':
      drawer.visible = true
      drawer.data = data
      break
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
  for (const item of datas) {
    setRowsLoading(item, operateName, () => checkProxy(toRaw(item)))
      .then(async (checkResult) => {
        await onEdit({ ...toRaw(checkResult), id: item.id })
        Object.assign(item, toRaw(checkResult))
      })
  }
}

function testAllProxy() {
  testProxy(dataList.value, 'test')
}

async function addRemark(remark: string, data: any) {
  await onEdit({ ...data, remark })
  toast.add({ severity: 'success', summary: 'Success', detail: '添加成功', life: 5000 })
  tableRef.value?.refresh()
}

async function onEditConfirm(data: any) {
  await onEdit(data)
  toast.add({ severity: 'success', summary: 'Success', detail: '修改成功', life: 5000 })
  tableRef.value?.refresh()
  drawer.visible = false
}

async function onEdit(data: any) {
  return API.proxy.userMdfProxyModuleCreate([data])
}

function createProxy() {
  router.push({ name: 'agent-create' })
}

function onRefreshTable() {
  const params = filterFieldByValue(getFormData(ctmFilters.value))
  tableRef.value!.refresh(params)
}
</script>

<template>
  <div class="flex flex-col h-full proxies">
    <div class="flex justify-end proxies-header">
      <div class="flex-1">
        Proxies
      </div>
      <RyButton v-if="!role.isViewer" size="small" severity="info" icon="base/rx_ic_plus" label="Create proxy"
        @click="createProxy" />
      <RyButton size="small" icon="base/rx_ic_speed_test" label="Test all" @click="testAllProxy" />
    </div>
    <div class="proxies-content">
      <!-- eslint-disable-next-line vue/no-unused-refs -->
      <RyTable ref="proxyTable" selection-mode="multiple" :table-request="getTableList"
        :table-operation="tableOperation" :columns="columns" :operation-handler="operationHandler"
        :show-gridlines="false">
        <template #header-extra>
          <CustomFilter :ctm-filters="ctmFilters" @filter-change="onRefreshTable" />
        </template>
        <template #proxy="{ data }">
          <div class="proxy-host">
            <span>{{ strConcat(data.protocol, '://') }}</span>
            <span>{{ data.host }}</span>
            <span>{{ strConcat(':', data.port) }}</span>
          </div>
          <div class="ip-type">
            {{ data.ipType }}
            {{ data.proxyUserName }}
          </div>
        </template>
        <template #actions="{ data }">
          <div class="flex gap-2">
            <actions :operation="tableOperation(data)" :loading-operation-map="data.loadingOperationMap"
              :show-menu="false" @quick-click="(operate: any) => operationHandler(operate, data)" />
            <remarkIcon :value="data.remark" :on-confirm="(params: any) => addRemark(params, data)" />
          </div>
        </template>
      </RyTable>
    </div>
  </div>
  <Drawer v-model:visible="drawer.visible" position="right" class="!w-[auto]">
    <template #container="{ closeCallback }">
      <editProxy :data="drawer.data" title="编辑代理" @close="closeCallback" @confirm="onEditConfirm" />
    </template>
  </Drawer>
</template>

<style lang="scss" scoped>
.proxies {
  &-header {
    padding: var(--spacing-xl, 12px) var(--spacing-4xl, 24px);
    gap: 10px;
    height: 48px;
    color: #000;
    font-family: Inter;
    font-size: 16px;
    font-style: normal;
    font-weight: 600;
    line-height: var(--Line-Height-text-xl, 24px);
    border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
  }

  &-content {
    height: calc(100% - 48px);
  }
}

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
