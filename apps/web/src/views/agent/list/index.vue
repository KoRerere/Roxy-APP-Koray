<script setup lang="ts">
import CustomFilter from '/@/views/browser/list/profiles/components/custom-filters.vue'
import OutboundIp from '/@/views/agent/list/components/outbound-ip.vue'
import EditProxy from '/@/views/agent/create/quick.vue'
import TutorialVideo from '/@/views/tutorial/components/tutorial-video.vue'
import AdvancedSearch from '/@/views/browser/list/profiles/components/advanced-search.vue'
import { useConfirm } from 'primevue/useconfirm'
import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useSimpleDialog } from '/@/components/simplePopup'
import { useResponseToast } from '/@/hooks/useResponseToast'

import { useRoleStore } from '/@/stores/role'
import { concurrentControl, setOperationLoading, setRowsLoading } from '/@/utils'
import { filterFieldByValue, getFormData } from '/@/utils/index'
import { useCheckProxy } from '/@/views/agent/hooks'
import { useColumns } from './columns'
import { getAdvancedSearch, getCustomFilters, tableOperation, tableRequest } from './operation'
import type { ProxyItem } from './operation'
import { useDrawer } from '/@/hooks/useDrawer'
import { useUserStore } from '/@/stores/user'
import type { ProxyCheckStatus } from '/@/enums'

const router = useRouter()
const role = useRoleStore()
const confirm = useConfirm()
const drawerInstance = useDrawer()
const [showToast, onlyErrorToast] = useResponseToast()
const { userConfig } = storeToRefs(useUserStore())
const { mixpanelTrack } = useUserStore()
const { columns, updateRemarkDisplayStatus } = useColumns()
const { testProxy: checkProxy, batchTestShowToast } = useCheckProxy()
const { showSimpleDialog } = useSimpleDialog()

const advancedSearchOptions = getAdvancedSearch()
const tableRef = useTemplateRef('listtable')
const filtersMenu = ref()
const dataList = ref()
const testStatus = ref<Record<string, ProxyCheckStatus>>({})

onBeforeMount(async () => {
  filtersMenu.value = await getCustomFilters()
})

async function getTableList(params: any) {
  const data = await tableRequest(params)
  dataList.value = data.data?.rows || []
  return data
}

async function operationHandler(operate: any, data: ProxyItem) {
  const datas = ([] as ProxyItem[]).concat(data)

  switch (operate.name) {
    case 'edit':
      editProxy(data)
      break
    case 'refresh':
      refreshUrl(data)
      break
    case 'test':
      testProxy(datas, operate.name)
      break
    case 'remark':
      onRemark(data)
      break
    case 'delete':
      await deleteProxy(datas)
      break
  }
}

function onAdvancedSearch(search?: Record<string, any>) {
  const { key, value } = search || {}
  onRefreshTable({ queryKey: value && (key || 'fuzzy'), queryValue: value }, true)
}

function editProxy(data: ProxyItem) {
  drawerInstance.showDrawer({
    title: $t('编辑代理'),
    slots: {
      container: () => h(EditProxy, {
        data,
        showRemark: true,
        onConfirm: async (formData: any) => {
          const { code, msg } = await onEdit([formData])
          onlyErrorToast(code, msg)
          tableRef.value?.refresh()
          drawerInstance.hideDrawer()
        },
      }),
    },
  })
}

async function refreshUrl(data: ProxyItem) {
  const _data = toRaw(data)
  if (!_data.bindList!.length) {
    const isOK = await setRowsLoading(_data, 'refresh', () => window.electronAPI.send('proxy:refreshUrl', _data.refreshUrl!))
    showToast(isOK ? 0 : -1, _data.refreshUrl as string)
    return
  }

  confirm.require({
    header: $t('刷新代理'),
    message: $t('此代理已关联 {count} 个窗口，您确认要刷新代理吗？', { count: _data.bindList!.length }),
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
      const isOK = await setRowsLoading(_data, 'refresh', () => window.electronAPI.send('proxy:refreshUrl', _data.refreshUrl!))
      showToast(isOK ? 0 : -1, _data.refreshUrl as string)
    },
  })
}

async function testProxy(datas: ProxyItem[], operateName: string) {
  const tasks = datas.map((item) => {
    setOperationLoading(item, operateName, true)
    return async () => {
      const checkResult = await checkProxy(toRaw(item))
      setOperationLoading(item, operateName, false)
      Object.assign(item, checkResult)
      testStatus.value[item.id] = checkResult.checkStatus
      return { ...checkResult, id: item.id }
    }
  })

  const results = await concurrentControl(tasks, 5)
  batchTestShowToast(results)
  await onEdit(results)
}

async function testAllProxy() {
  if (!dataList.value?.length) {
    onlyErrorToast(-1, $t('暂无代理 IP'))
    return
  }
  await testProxy(dataList.value, 'test')
}

function onRemark(data: any) {
  if (role.isViewer || role.isEditor)
    return

  showSimpleDialog({
    title: $t('为所选代理添加备注'),
    inputs: [
      {
        type: 'textarea',
        name: 'remark',
        value: data.remark,
        props: {
          placeholder: $t('请输入备注'),
          rows: 6,
        },
      },
    ],
    onConfirm: async (formData: any) => {
      addRemark(formData.remark, data)
    },
  })
}

async function addRemark(remark: string, data: any) {
  const { code, msg } = await onEdit([{ ...data, remark }])
  onlyErrorToast(code, msg)
  tableRef.value?.refresh()
}

function toggleRemarkDisplayStatus(cache: Record<string, any>) {
  cache.extend = !cache.extend
  if (userConfig.value.remarkDisplayStatus !== cache.extend) {
    updateRemarkDisplayStatus(cache.extend)
  }
}

async function onEdit(data: any) {
  return API.proxy.userMdfProxyModuleCreate(data)
}

function createProxy() {
  mixpanelTrack('proxy_create_click')
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
        onlyErrorToast(code, msg)
        if (code === 0) {
          onRefreshTable()
        }
        resolve(true)
      },
      reject: () => resolve(false),
      onHide: () => resolve(false),
    })
  })
}

function tableBeforeRefresh() {
  testStatus.value = {}
}

function onRefreshTable(tabParams = {}, force = false) {
  const params = {
    ...tabParams,
    ...filterFieldByValue(getFormData(filtersMenu.value)),
  }
  tableRef.value?.refresh(params, force)
}
</script>

<template>
  <div class="flex flex-col w-full h-full">
    <div class="flex flex-1 overflow-hidden">
      <!-- eslint-disable-next-line vue/no-unused-refs -->
      <RyTable ref="listtable" v-model:columns="columns" cache-key="agent-list" selection-mode="multiple" :table-request="getTableList" :table-operation="tableOperation"
               :operation-handler="operationHandler" :before-refresh="tableBeforeRefresh" :show-gridlines="false" :show-actions="false"
      >
        <template #filter-after>
          <div class="w-full flex gap-1.5 items-start">
            <AdvancedSearch :options="advancedSearchOptions" :search="onAdvancedSearch" :clear="onAdvancedSearch" />
            <CustomFilter :enabled-filter-save="false" :filters-menu="filtersMenu" @filter-change="onRefreshTable" />
            <div class="flex items-center gap-1.5">
              <RxButton v-if="!role.isViewer && !role.isEditor" size="xxs" icon="base/rx_ic_add_proxy" :label="$t('添加代理')" @click.stop="createProxy" />
              <RxButton size="xxs" outlined severity="secondary" icon="base/rx_ic_speed_test" :label="$t('测试全部')" @click.stop="testAllProxy" />
              <Divider layout="vertical" class="!ml-0 !mr-1.5 h-4" />
            </div>
          </div>
        </template>
        <template #table-empty>
          <CustomNewEmpty icon="base/rx_ic_internet" img="empty-proxies.png" :title="$t('暂无代理 IP')" :desc="$t('在此添加代理信息以管理，并更方便地与窗口进行绑定。')">
            <template #extra>
              <div class="flex gap-3">
                <RxButton v-if="!role.isViewer && !role.isEditor" outlined severity="secondary" size="xs" icon="base/rx_ic_add_proxy" :label="$t('添加代理')" @click.stop="createProxy" />
                <TutorialVideo size="xs" video-type="proxy_management" :autoplay="false" />
              </div>
            </template>
          </CustomNewEmpty>
        </template>
        <template #outbound="{ data }">
          <OutboundIp :country="data.lastCountry" :city="data.lastCity" :last-ip="data.lastIp" :time="data.checkTime" :status="testStatus[data.id]" :is-loading="data.loadingOperationMap?.test" />
        </template>
        <template #remarkHeader="{ column: { title, _cache } }">
          <div class="flex items-center gap-2 note-header">
            <span>{{ title }}</span>
            <RxSvgIcon v-tooltip.top="{ value: _cache.extend ? $t('收起') : $t('展开'), showDelay: 0 }" class="cursor-pointer color-[#989CA0]"
                       :name="_cache.extend ? 'base/rx_ic_hidden' : 'base/rx_ic_eye'" @click.stop="toggleRemarkDisplayStatus(_cache)"
            />
          </div>
        </template>
        <template #remark="{ data, column: { _cache } }">
          <div class="inline-flex items-center gap-1" @click.stop="operationHandler({ name: 'remark' }, data)">
            <RxButton v-tooltip.top="{ value: data.remark, showDelay: 0 }" class="shrink-0" :class="{ 'note-light': data.remark }" text severity="secondary" size="xxs"
                      :icon="data.remark ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'"
            />
            <div v-if="_cache.extend" :title="data.remark" class="min-w-50 whitespace-pre-wrap note-content">
              {{
                data.remark }}
            </div>
          </div>
        </template>
        <template #actions="{ data }">
          <div class="flex gap-2">
            <Actions :operation="tableOperation(data)" :loading-operation-map="data.loadingOperationMap" :show-menu="false" @quick-click="operationHandler($event, data)" />
          </div>
        </template>
      </RyTable>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.note {
  &-header {
    color: var(--colors-text-text-primary, #fafafa);
    font-size: 12px;
    line-height: 16px;
    font-weight: 600;
  }

  &-content {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: break-all;
    line-height: 1.4;
  }

  &-light {
    :deep(svg) {
      color: var(--colors-text-text-brand, #11a3fd) !important;
    }
  }
}
</style>
