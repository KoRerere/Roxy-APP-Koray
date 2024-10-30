<script setup lang="ts">
import { useConfirm } from 'primevue/useconfirm'
import { useTemplateRef } from 'vue'
import { API } from '/@/api'
import RemarkIcon from '/@/components/remark-icon'
import useColumns from '/@/hooks/useColumns'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import { setRowsLoading, strConcat } from '/@/utils'
import { filterFieldByValue, getFormData } from '/@/utils/index'
import EditProxy from '/@/views/agent/create/quick.vue'
import { useCheckProxy } from '/@/views/agent/hooks'
import CustomFilter from '/@/views/browser/list/profiles/components/custom-filters.vue'
import columnsConfig from './columns'
import { getCustomFilters, type ProxyItem, tableOperation, tableRequest } from './operation'

const router = useRouter()
const tableRef = useTemplateRef('proxyTable')

const [columns] = useColumns(columnsConfig)
const role = useRoleStore()
const [checkProxy] = useCheckProxy()
const [showToast, onlyErrorToast] = useResponseToast()
const confirm = useConfirm()

const filtersMenu = ref(getCustomFilters())
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

async function operationHandler(operate: any, data: ProxyItem) {
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
    case 'delete':
      await deleteProxy(datas)
      break
  }
}

function refreshUrl(datas: ProxyItem[]) {
  datas.forEach(async (item) => {
    const isOK = await window.electronAPI.send('proxy:refreshUrl', item.refreshUrl!)
    showToast(isOK ? 0 : -1, item.refreshUrl as string)
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
  if (!dataList.value?.length) {
    onlyErrorToast(-1, $t('暂无代理'))
    return
  }
  testProxy(dataList.value, 'test')
}

async function addRemark(remark: string, data: any) {
  const { code, msg } = await onEdit({ ...data, remark })
  showToast(code, msg)
  tableRef.value?.refresh()
}

async function onEditConfirm(data: any) {
  const { code, msg } = await onEdit(data)
  showToast(code, msg)
  tableRef.value?.refresh()
  drawer.visible = false
}

async function onEdit(data: any) {
  return API.proxy.userMdfProxyModuleCreate([data])
}

function createProxy() {
  router.push({ name: 'agent-create' })
}

async function deleteProxy(datas: ProxyItem[]) {
  return new Promise((resolve) => {
    confirm.require({
      header: $t('删除代理'),
      message: $t('您确认要删除所选代理吗？'),
      rejectProps: {
        label: $t('取消'),
        severity: 'secondary',
        outlined: true,
      },
      acceptProps: {
        label: $t('确认'),
        severity: 'danger',
      },
      accept: async () => {
        const { code, msg } = await API.proxy.userDelProxyModuleV2Create({ ids: datas.map(item => item.id) })
        showToast(code, msg)
        if (code === 0) {
          onRefreshTable()
        }
        resolve(true)
      },
      reject: () => resolve(false),
    })
  })
}

function onRefreshTable() {
  const params = filterFieldByValue(getFormData(filtersMenu.value))
  tableRef.value!.refresh(params)
}
</script>

<template>
  <div class="flex flex-col w-full h-full">
    <ViewsHeader class="proxies-header" :title="($route.meta.title as string)">
      <RxButton v-if="!role.isViewer" size="xxs" severity="info" icon="base/rx_ic_internet" :label="$t('添加代理')" @click="createProxy" />
      <RxButton size="xxs" outlined severity="secondary" icon="base/rx_ic_speed_test" :label="$t('测试全部')" @click="testAllProxy" />
    </ViewsHeader>
    <div class="flex flex-1 overflow-hidden">
      <!-- eslint-disable-next-line vue/no-unused-refs -->
      <RyTable ref="proxyTable" v-model:columns="columns" selection-mode="multiple" :table-request="getTableList" :table-operation="tableOperation" :operation-handler="operationHandler"
        :show-gridlines="false" :show-actions="false">
        <template #header-extra>
          <CustomFilter :enabled-filter-save="false" :filters-menu="filtersMenu" @filter-change="onRefreshTable" />
        </template>
        <template #table-empty>
          <CustomEmpty icon="empty/rx_illustration_star.svg" :title="$t('暂无代理')" :desc="$t('在此添加代理信息以管理，并更方便地与窗口进行绑定。')">
            <template #extra>
              <div class="flex items-center gap-3">
                <RxButton outlined severity="secondary" size="xs" icon="base/rx_ic_internet" :label="$t('添加代理')" @click="createProxy" />
                <RxButton text severity="secondary" size="xs" :label="$t('代理文档')" />
              </div>
            </template>
          </CustomEmpty>
        </template>

        <template #proxy="{ data }">
          <div class="proxy-host">
            <span>{{ strConcat(data.protocol?.toLocaleLowerCase(), '://') }}</span>
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
            <RemarkIcon :value="data.remark" :on-confirm="(params: any) => addRemark(params, data)" />
            <Actions :operation="tableOperation(data)" :loading-operation-map="data.loadingOperationMap" :show-menu="false" @quick-click="operationHandler($event, data)" />
          </div>
        </template>
      </RyTable>
    </div>
  </div>
  <RxDrawer v-model:visible="drawer.visible" :title="$t('编辑代理')">
    <template #default="{ closeCallback }">
      <EditProxy :data="drawer.data" @close="closeCallback" @confirm="onEditConfirm" />
    </template>
  </RxDrawer>
</template>

<style lang="scss" scoped>
.proxies-header {
  border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
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
