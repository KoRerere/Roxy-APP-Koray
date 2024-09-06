<script setup lang="ts">
import ryTag from '/@/components/ry-tag'
import ryTable from '/@/components/ry-table'
import ryButton from '/@/components/ry-button'
import actions from '/@/components/actions.vue'
import remarkIcon from '/@/components/remark-icon'
import proxyIcon from '/@/assets/image/proxy.svg'
import useColumns from '/@/hooks/useColumns'
import columnsConfig from './columns'
import { format } from 'date-fns'
import { API } from '/@/api'
import { useToast } from 'primevue/usetoast'
import { setRowsLoading } from '/@/utils'
import { ProxyCheckStatus } from '/@/enums'
import type { UnwrapRowType, UserGetProxyModuleListData } from '@roxy/backend-api'
import { useTemplateRef } from 'vue'

interface ProxyItem extends UnwrapRowType<UserGetProxyModuleListData> {
  loadingOperationMap: {
    [key: string]: boolean
  }
}

const tableRef = useTemplateRef('proxyTable')

const toast = useToast()
const [columns] = useColumns(columnsConfig)

const dataList = ref()

function tableOperation(data: ProxyItem | ProxyItem[]) {
  const datas = ([] as ProxyItem[]).concat(data)
  return [
    {
      name: 'refresh',
      label: '刷新',
      icon: 'mdi mdi-refresh',
      quick: true,
      multiple: true,
      disabled: datas.some(item => !item.refreshUrl),
      disabledTips: '缺少刷新地址',
    },
    {
      name: 'test',
      label: '测速',
      icon: 'mdi mdi-wifi',
      quick: true,
      multiple: true,
    },
  ]
}

const drawer = reactive({
  data: null,
  visible: false,
})

async function tableRequest(params: any) {
  const data = await API.proxy.userGetProxyModuleList(params)
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

/**
 * 并发限制 5
 */
async function testProxy(datas: ProxyItem[], operateName: string) {
  datas.forEach((item) => {
    setRowsLoading(item, operateName, () => window.electronAPI.send('proxy:detection', toRaw(item)))
      .then(async (checkRes) => {
        const params = {
          id: item.id,
          checkStatus: checkRes.error ? ProxyCheckStatus.failure : ProxyCheckStatus.success,
          lastCity: checkRes.city ?? '',
          lastCountry: checkRes.continent_code ?? '',
          lastIp: checkRes.ip ?? '',
          checkTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        }
        editProxy(params)
      })
  })
}

function testAllProxy() {
  testProxy(dataList.value, 'test')
}

async function addRemark([remark, close]: [string, () => void], data: any) {
  const { msg } = await editProxy({ ...data, remark })
  toast.add({ severity: 'success', summary: 'Success', detail: msg, life: 5000 })
  tableRef.value?.refresh()
  close()
}

async function editProxy(data: any) {
  return await API.proxy.userMdfProxyModuleCreate([data])
}
</script>

<template>
  <div class="flex flex-col h-full proxies">
    <div class="flex justify-end proxies-header">
      <div class="flex-1">
        Proxies
      </div>
      <ryButton size="small" severity="info" icon="mdi mdi-web" label="Create proxy" />
      <ryButton size="small" icon="mdi mdi-wifi" label="Test all" @click="testAllProxy" />
    </div>
    <div class="proxies-content">
      <ry-table ref="proxyTable" selection-mode="multiple" :table-request="tableRequest"
        :table-operation="tableOperation" :columns="columns" :operation-handler="operationHandler"
        :show-gridlines="false">
        <template #proxy="{ data }">
          <div><span>{{ data.protocol }}://</span><span>{{ data.host }}</span><span>:{{ data.port }}</span></div>
          <div>{{ data.ipType }}</div>
        </template>
        <template #outbound="{ data }">
          <div class="outbound">
            <img class="outbound-img" :src="data.region || proxyIcon">
            <div class="flex justify-between outbound-region">
              <span>{{ data.lastCountry }}</span>
            </div>
            <div class="flex items-center outbound-email">
              <span>{{ data.checkTime }}</span>
            </div>
          </div>
        </template>
        <template #checker="{ data }">
          <ryTag>
            <span class="mdi mdi-web" />
            <span>{{ data.checkChannel }}</span>
          </ryTag>
        </template>
        <template #related="{ data }">
          <template v-if="data.bindCount > 0">
            <ryTag>{{ data[0] }}</ryTag>
            <ryTag v-if="data.bindCount > 1">
              {{ data.bindCount - 1 }}
            </ryTag>
          </template>
          <div v-else>
            - -
          </div>
        </template>
        <template #actions="{ data, operation }">
          <div class="flex justify-end gap-2">
            <actions :operation="operation" :loading-operation-map="data.loadingOperationMap" :show-menu="false"
              @quick-click="(operate) => operationHandler(operate, data)" />
            <remarkIcon :value="data.remark" @on-confirm="(params) => addRemark(params, data)" />
          </div>
        </template>
      </ry-table>
    </div>
  </div>
  <Drawer v-model:visible="drawer.visible" position="right">
    <template #container="{ closeCallback }">
      <div @click="closeCallback">
        123
      </div>
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

.outbound {
  display: grid;
  grid-template-columns: 16px 1fr;
  grid-column-gap: var(--spacing-md, 8px);
  grid-row-gap: var(--spacing-sm, 4px);

  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  line-height: var(--Line-Height-text-xs, 16px);
  font-weight: 400;

  &-img {
    width: 16px;
    height: 16px;
    grid-row-start: span 2;
  }

  &-region {
    color: var(--Colors-Text-text-primary, #171c1f);
    font-weight: 500;
  }

  &-email {
    gap: var(--spacing-sm, 4px);
    color: var(--Colors-Text-text-inactive, #a3a9ad);
  }
}
</style>
