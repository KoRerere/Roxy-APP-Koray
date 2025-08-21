<script setup lang="tsx">
import OutboundIp from '/@/views/agent/list/components/outbound-ip.vue'
import CustomFilter from '/@/views/browser/list/profiles/components/custom-filters.vue'
import HelpModal from '/@/views/agent/shop/components/help-modal.vue'
import { $t } from '/@/locales'
import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useSimpleDialog } from '/@/components/simplePopup'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDialog } from '/@/hooks/useDialog'
import { concurrentControl, setOperationLoading } from '/@/utils'
import { filterFieldByValue, getFormData } from '/@/utils/index'
import { useCheckProxy, useProxy } from '/@/views/agent/hooks'
import { useColumns } from './columns'
import { getCustomFilters, type ProxyItem, tableOperation, tableRequest, getSorts } from './operation'
import { useUserStore } from '/@/stores/user'
import { ProxyCheckStatus, ProxyExpireStatus, ProxyOrderStatus } from '/@/enums'
import { useRoleStore } from '/@/stores/role'

const route = useRoute()
const router = useRouter()
const { isOwner } = storeToRefs(useRoleStore())
const { userConfig } = storeToRefs(useUserStore())
const { columns, updateRemarkDisplayStatus } = useColumns()
const { testProxy: checkProxy, batchTestShowToast } = useCheckProxy()
const [_, onlyErrorToast] = useResponseToast()
const { showSimpleDialog } = useSimpleDialog()
const { buyProxy, downloadProxy, renewProxy } = useProxy()
const [showModal] = useDialog()

const tableRef = useTemplateRef('shoptable')
const filtersMenu = ref()
const dataList = ref()
const newOrderNo = ref()

const checkedMessage = ref<Record<string, ProxyCheckStatus>>({})

const hideTypeConfig = reactive({
  value: 'list_use',
  trueValue: 'window_use',
  falseValue: 'list_use',
})

const filters = reactive({
  value: Number(route.query.expireStatus) || undefined,
  options: [
    {
      name: $t('全部'),
      value: undefined,
    },
    {
      name: $t('使用中'),
      value: ProxyExpireStatus.using,
    },
    {
      name: $t('即将过期'),
      value: ProxyExpireStatus.soon,
    },
  ],
  onChange() {
    tableRef.value?.refresh({ proxyExpireStatus: filters.value, type: hideTypeConfig.value })
  },
  resetFilters() {
    filters.value = undefined
    hideTypeConfig.value = hideTypeConfig.falseValue
    filters.onChange()
  },
})

onBeforeMount(async () => {
  filtersMenu.value = await getCustomFilters()
  setNewOrderNo(route.query.orderNo as string)
})

async function getTableList(params: any) {
  const data = await tableRequest({ proxyExpireStatus: filters.value, type: hideTypeConfig.falseValue, ...params })
  dataList.value = (data.data?.rows || []).filter(item => item.proxyExpireStatus !== ProxyExpireStatus.expired && [ProxyOrderStatus.done, ProxyOrderStatus.refunding, ProxyOrderStatus.changing].includes(item.orderStatus!))
  return data
}

async function operationHandler(operate: any, data: ProxyItem) {
  const datas = ([] as ProxyItem[]).concat(data)

  switch (operate.name) {
    case 'test':
      onCheckProxyStatus(datas, operate.name)
      break
    case 'download':
      await download(datas)
      break
    case 'renew':
      onRenewProxy(datas)
      break
    case 'remark':
      onRemark(data)
      break
  }
}

function onBuyProxy() {
  buyProxy(orderInfo => {
    onRefreshTable()
    setNewOrderNo(orderInfo.orderNo)
  })
}

async function testAllProxy() {
  if (!dataList.value?.length) {
    onlyErrorToast(-1, $t('暂无代理'))
    return
  }
  await onCheckProxyStatus(dataList.value, 'test')
}

async function onCheckProxyStatus(datas: ProxyItem[], operateName: string) {
  const tasks = datas.map((item) => {
    setOperationLoading(item, operateName, true)
    return async () => {
      const checkResult = await checkProxy({ ...toRaw(item), apiCheck: true })
      setOperationLoading(item, operateName, false)
      Object.assign(item, checkResult)
      checkedMessage.value[item.id!] = checkResult.checkStatus;
      return { ...checkResult, id: item.id }
    }
  })

  const results = await concurrentControl(tasks, 5)
  batchTestShowToast(results)
}

function onRenewProxy(datas: ProxyItem[]) {
  renewProxy(datas, () => {
    onRefreshTable()
  })
}

function download(datas: ProxyItem[]) {
  const { promise, resolve, reject } = Promise.withResolvers<void>();

  const data = datas.map(({ host, port, proxyUserName, proxyPassword }) => ({ host, port, username: proxyUserName, password: proxyPassword }))

  downloadProxy({
    data,
    cancel: reject,
    confirm: resolve
  })

  return promise
}

async function openHelp(data: ProxyItem) {
  const { code, data: refundInfo, msg } = await API.proxy.userGetProxyRefundInfoList({ proxyBuyId: data.id! })
  onlyErrorToast(code, msg)
  if (code !== 0) return

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => <HelpModal data={data} info={refundInfo} onReplace={onRefreshTable} onClose={hideModal} />,
    },
  })
}

function onRemark(data: any) {
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
        }
      },
    ],
    onConfirm: async ({ remark }: Record<string, any>) => {
      addRemark(remark, data)
    },
  })
}

async function addRemark(proxyRemark: string, data: ProxyItem) {
  const { code, msg } = await API.proxy.userMdfUserBuyProxyRemarkCreate({ id: data.id!, proxyRemark })
  onlyErrorToast(code, msg)
  if (code !== 0) return
  onRefreshTable()
}

function toggleRemarkDisplayStatus(cache: Record<string, any>) {
  cache.extend = !cache.extend
  if (userConfig.value.remarkDisplayStatus !== cache.extend) {
    updateRemarkDisplayStatus(cache.extend)
  }
}

function tableBeforeRefresh() {
  checkedMessage.value = {}
}

function onRefreshTable() {
  const params = filterFieldByValue(getFormData(filtersMenu.value))
  tableRef.value?.refresh(params)
}

function rowClass(data: ProxyItem) {
  return {
    'row-success': data.orderNo === newOrderNo.value,
    // 'row-disabled': data.proxyExpireStatus === ProxyExpireStatus.expired || [ProxyOrderStatus.pending, ProxyOrderStatus.refunded].includes(data.orderStatus!),
  }
}

function setNewOrderNo(value: string) {
  if (!value) return
  newOrderNo.value = value
  setTimeout(() => {
    newOrderNo.value = ''
    const { orderNo, ...query } = route.query
    router.replace({ name: 'agent-list', query })
  }, 3000)
}
</script>

<template>
  <div class="flex flex-col w-full h-full">
    <div class="flex flex-1 overflow-hidden">
      <!-- eslint-disable-next-line vue/no-unused-refs -->
      <RyTable ref="shoptable" v-model:columns="columns" cacheKey="agent-shop" selection-mode="multiple" :table-request="getTableList" :table-operation="tableOperation" :table-sort="getSorts"
        :row-class="rowClass" :operation-handler="operationHandler" :beforeRefresh="tableBeforeRefresh" :show-gridlines="false" :show-actions="false">
        <template #filter-after>
          <div class="w-full">
            <div class="pb-3 flex gap-1.5 items-start">
              <div class="flex flex-1 gap-3">
                <RxSelectButton v-model="filters.value" :options="filters.options" size="xxs" option-label="name" option-value="value" data-key="value" @change="filters.onChange" />
                <div class="flex items-center gap-1.5">
                  <Checkbox v-model="hideTypeConfig.value" :pt="{ root: 'items-center', box: '!w-4 !h-4' }" input-id="wrap" binary :true-value="hideTypeConfig.trueValue"
                    :false-value="hideTypeConfig.falseValue" @change="filters.onChange" />
                  <label for="wrap" class="text-3 select-none cursor-pointer text-[var(--colors-text-text-secondary)]">{{
                    $t('隐藏不可用代理') }}</label>
                </div>
              </div>
              <div class="flex items-center gap-1.5">
                <div class="relative">
                  <RxButton v-if="isOwner" size="xxs" icon="base/rx_ic_cart" :label="$t('购买')" @click.stop="onBuyProxy"></RxButton>
                  <div class="new-dot"></div>
                </div>
                <RxButton size="xxs" outlined severity="secondary" icon="base/rx_ic_speed_test" :label="$t('测试全部')" @click.stop="testAllProxy" />
                <Divider layout="vertical" class="!ml-0 !mr-1.5 h-4" />
              </div>
            </div>
            <CustomFilter :enabled-filter-save="false" :filters-menu="filtersMenu" @filter-change="onRefreshTable" />
          </div>
        </template>
        <template #table-empty>
          <CustomEmpty icon="rx_illustration_star.svg" :title="$t('暂无代理')" :desc="$t('在此购买代理，并更方便地与窗口进行绑定。')">
            <template #extra>
              <div class="flex items-center gap-3">
                <RxButton v-if="isOwner" outlined severity="secondary" size="xs" icon="base/rx_ic_cart" :label="$t('购买')" @click.stop="onBuyProxy" />
              </div>
            </template>
          </CustomEmpty>
        </template>
        <template #outbound="{ data }">
          <div class="flex items-center gap-2.5">
            <OutboundIp :country="data.lastCountry" :city="data.lastCity" :last-ip="data.lastIp" :time="data.checkTime" :status="checkedMessage[data.id]"
              :is-loading="data.loadingOperationMap?.test" />
            <div v-if="data.checkStatus === ProxyCheckStatus.failure && data.orderStatus === ProxyOrderStatus.done" class="flex items-center gap-1.5">
              <SvgIcon name="base/rx_ic_info" color="var(--colors-icon-icon-error)"></SvgIcon>
              <RxButton v-if="isOwner" outlined severity="secondary" size="xxs" icon="base/rx_ic_fix" :label="$t('帮助')" @click.stop="openHelp(data)"></RxButton>
            </div>
          </div>
        </template>
        <template #remarkHeader="{ column: { title, _cache } }">
          <div class="flex items-center gap-2 note-header">
            <span>{{ title }}</span>
            <RxSvgIcon v-tooltip.top="{ value: _cache.extend ? $t('收起') : $t('展开'), showDelay: 0 }" class="cursor-pointer color-[#989CA0]"
              :name="_cache.extend ? 'base/rx_ic_hidden' : 'base/rx_ic_eye'" @click.stop="toggleRemarkDisplayStatus(_cache)" />
          </div>
        </template>
        <template #remark="{ data, column: { _cache } }">
          <div class="inline-flex items-center gap-1" @click.stop="operationHandler({ name: 'remark' }, data)">
            <RxButton v-tooltip.top="{ value: data.remark, showDelay: 0 }" class="shrink-0" :class="{ 'note-light': data.remark }" text severity="secondary" size="xxs"
              :icon="data.remark ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'" />
            <div v-if="_cache.extend" :title="data.remark" class="min-w-50 whitespace-pre-wrap note-content">{{
              data.remark }}</div>
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
:deep(.row-success) {
  border-color: var(--component-table-border-updated);
  background: var(--colors-background-bg-success);

  &>td {
    border-color: var(--component-table-border-updated);
  }

  .p-datatable-frozen-column {
    background: var(--colors-background-bg-success);
  }
}

.new-dot {
  position: absolute;
  right: 0;
  top: 0;
  transform: translate(40%, -40%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--colors-background-bg-error);
}

.note {
  &-header {
    color: var(--colors-text-text-primary);
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
      color: var(--colors-text-text-brand) !important;
    }
  }
}
</style>
