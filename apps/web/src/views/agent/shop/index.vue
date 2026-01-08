<script setup lang="tsx">
import OutboundIp from '/@/views/agent/list/components/outbound-ip.vue'
import CustomFilter from '/@/views/browser/list/profiles/components/custom-filters.vue'
import AutoRenewModal from '/@/views/agent/shop/components/auto-renew-modal.vue'
import HelpModal from '/@/views/agent/shop/components/help-modal.vue'
import TutorialVideo from '/@/views/tutorial/components/tutorial-video.vue'
import AdvancedSearch from '/@/views/browser/list/profiles/components/advanced-search.vue'
import ProviderSimpleList from '/@/views/agent/shop/components/provider-simple-list.vue'
import currency from 'currency.js'
import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useSimpleDialog } from '/@/components/simplePopup'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDialog } from '/@/hooks/useDialog'
import { concurrentControl, setOperationLoading } from '/@/utils'
import { filterFieldByValue, getFormData } from '/@/utils/index'
import { useCheckProxy, useProxy } from '/@/views/agent/hooks'
import { useColumns } from './columns'
import { getAdvancedSearch, getCustomFilters, getSorts, tableOperation, tableRequest } from './operation'
import { useUserStore } from '/@/stores/user'
import { ProxyAutoRenewalStatus, ProxyCheckStatus, ProxyExpireStatus, ProxyOrderStatus } from '/@/enums'
import { useRoleStore } from '/@/stores/role'
import type { ProxyItem } from './operation'

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

const advancedSearchOptions = getAdvancedSearch()
const tableRef = useTemplateRef('shoptable')
const filtersMenu = ref()
const dataList = ref()
const newOrderNo = ref()

const checkedMessage = ref<Record<string, ProxyCheckStatus>>({})

const hideTypeConfig = reactive({
  value: localStorage.getItem('ProxyShopHideType') || 'available_list',
  trueValue: 'available_list',
  falseValue: 'list_use',
})

const filters = reactive({
  list: [
    {
      name: 'proxyExpireStatus',
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
    },
  ],
  getValues() {
    return Object.fromEntries(filters.list.filter(item => item.value).map(item => [item.name, item.value]))
  },
  onChange() {
    localStorage.setItem('ProxyShopHideType', hideTypeConfig.value)
    tableRef.value?.refresh({ ...filters.getValues() })
  },
})

watch(
  () => route.query._t,
  (value) => {
    if (value && route.query.action === 'buy') {
      onBuyProxy()
    }
  },
  {
    immediate: true,
  },
)

onBeforeMount(async () => {
  filtersMenu.value = await getCustomFilters()
  setNewOrderNo(route.query.orderNo as string)
})

async function getTableList(params: any) {
  const data = await tableRequest({ ...filters.getValues(), type: hideTypeConfig.value, ...params })
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

function onAdvancedSearch(search?: Record<string, any>) {
  const { key, value } = search || {}
  onRefreshTable({ queryKey: value && (key || 'fuzzy'), queryValue: value }, true)
}

function onBuyProxy(props?: Record<string, any>) {
  buyProxy((orderInfo) => {
    onRefreshTable()
    setNewOrderNo(orderInfo?.orderNo)
  }, toRaw(props))
}

function setNewOrderNo(value: string) {
  if (!value)
    return
  newOrderNo.value = value
  setTimeout(() => {
    newOrderNo.value = ''
    const { orderNo: _, ...query } = route.query
    router.replace({ name: 'agent-list', query })
  }, 3000)
}

async function testAllProxy() {
  if (!dataList.value?.length) {
    onlyErrorToast(-1, $t('暂无代理 IP'))
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
      checkedMessage.value[item.id!] = checkResult.checkStatus
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
  const { promise, resolve, reject } = Promise.withResolvers<void>()

  const data = datas.map(({ host, port, proxyUserName, proxyPassword }) => ({ host, port, username: proxyUserName, password: proxyPassword }))

  downloadProxy({
    data,
    cancel: reject,
    confirm: resolve,
  })

  return promise
}

async function openHelp(data: ProxyItem) {
  const { code, data: refundInfo, msg } = await API.proxy.userGetProxyRefundInfoList({ proxyBuyId: data.id! })
  onlyErrorToast(code, msg)
  if (code !== 0)
    return

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
        },
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
  if (code !== 0)
    return
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

function onRefreshTable(tabParams = {}, force = false) {
  const params = {
    ...tabParams,
    ...filterFieldByValue(getFormData(filtersMenu.value)),
  }
  tableRef.value?.refresh(params, force)
}

function rowClass(data: ProxyItem) {
  return {
    'row-success': data.orderNo === newOrderNo.value,
    // 'row-disabled': data.proxyExpireStatus === ProxyExpireStatus.expired || [ProxyOrderStatus.pending, ProxyOrderStatus.refunded].includes(data.orderStatus!),
  }
}

async function autoRenewChange(data: ProxyItem) {
  const expireDate = new Date(data.expireDate!).getTime()
  const isLimit = expireDate > Date.now() && (expireDate - Date.now()) < 1000 * 60 * 60

  if (isLimit && data.autoRenew === ProxyAutoRenewalStatus.Enabled) {
    onlyErrorToast(-1, $t('到期前 {hour} 小时无法修改自动续费开关。', { hour: 1 }), {
      severity: 'warn',
      summary: $t('操作失败'),
      life: 5000,
    })
    return false
  }

  const notShowAgain = localStorage.getItem('autoRenewModalNotShowAgain')

  if (!!notShowAgain || data.autoRenew === ProxyAutoRenewalStatus.Enabled) {
    return toggleAutoRenew(data)
  }

  const { promise, resolve } = Promise.withResolvers<boolean>()
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => (
        <AutoRenewModal
          onClose={
            () => {
              hideModal()
              resolve(false)
            }
          }
          onConfirm={
            async () => {
              const isOK = await toggleAutoRenew(data)
              resolve(isOK)
              hideModal()
            }
          }
        />
      ),
    },
  })
  return promise
}

async function toggleAutoRenew(data: ProxyItem) {
  const status = data.autoRenew === ProxyAutoRenewalStatus.Enabled ? ProxyAutoRenewalStatus.Disabled : ProxyAutoRenewalStatus.Enabled
  const { code, msg } = await API.proxy.userSetProxyAutoRenewalCreate({ proxyId: data.id, status })
  onlyErrorToast(code, msg)
  if (code !== 0)
    return false
  return true
}
</script>

<template>
  <div class="flex flex-col w-full h-full">
    <ProviderSimpleList :on-buy-proxy="onBuyProxy" />
    <div class="flex flex-1 overflow-hidden">
      <RyTable ref="shoptable" v-model:columns="columns" cache-key="agent-shop" selection-mode="multiple" :table-request="getTableList" :table-operation="tableOperation" removable-sort
               :table-sort="getSorts" :row-class="rowClass" :operation-handler="operationHandler" :before-refresh="tableBeforeRefresh" :show-gridlines="false" :show-actions="false"
      >
        <template #filter-after>
          <div class="w-full flex gap-1.5 items-start">
            <AdvancedSearch :options="advancedSearchOptions" :search="onAdvancedSearch" :clear="onAdvancedSearch" />
            <CustomFilter :enabled-filter-save="false" :filters-menu="filtersMenu" @filter-change="onRefreshTable" />
            <div class="flex items-center gap-1.5">
              <div class="flex items-center gap-1.5">
                <RxCheckbox v-model="hideTypeConfig.value" :pt="{ root: 'items-center', box: '!w-4 !h-4' }" input-id="wrap" binary :true-value="hideTypeConfig.trueValue"
                            :false-value="hideTypeConfig.falseValue" @change="filters.onChange"
                />
                <label for="wrap" class="text-3 select-none cursor-pointer text-[var(--colors-text-text-secondary)]">{{
                  $t('隐藏不可用代理 IP') }}</label>
              </div>
              <div v-if="isOwner" class="relative">
                <RxButton size="xxs" icon="base/rx_ic_cart" :label="$t('购买')" @click.stop="onBuyProxy()" />
                <div class="new-dot" />
              </div>
              <RxButton size="xxs" outlined severity="secondary" icon="base/rx_ic_speed_test" :label="$t('测试全部')" @click.stop="testAllProxy" />
              <Divider layout="vertical" class="!ml-0 !mr-0 h-4" />
            </div>
          </div>
        </template>
        <template #table-empty>
          <CustomNewEmpty icon="base/rx_ic_internet" img="empty-proxies.png" :title="$t('暂无代理 IP')" :desc="$t('在此购买代理 IP，并更方便地与窗口进行绑定。')">
            <template #extra>
              <div class="flex gap-3">
                <RxButton v-if="isOwner" outlined severity="secondary" size="xs" icon="base/rx_ic_cart" :label="$t('购买')" @click.stop="onBuyProxy()" />
                <TutorialVideo size="xs" video-type="proxy_management" :autoplay="false" />
              </div>
            </template>
          </CustomNewEmpty>
        </template>
        <template #outbound="{ data }">
          <div class="flex items-center gap-2.5">
            <OutboundIp :country="data.lastCountry" :city="data.lastCity" :last-ip="data.lastIp" :time="data.checkTime" :status="checkedMessage[data.id]"
                        :is-loading="data.loadingOperationMap?.test"
            />
            <div v-if="data.checkStatus === ProxyCheckStatus.failure && data.orderStatus === ProxyOrderStatus.done && data.proxyExpireStatus !== ProxyExpireStatus.expired"
                 class="flex items-center gap-1.5"
            >
              <SvgIcon name="base/rx_ic_info" color="var(--colors-icon-icon-error)" />
              <RxButton v-if="isOwner" outlined severity="secondary" size="xxs" icon="base/rx_ic_fix" :label="$t('帮助')" @click.stop="openHelp(data)" />
            </div>
          </div>
        </template>
        <template #price="{ data }">
          <div>
            <span>{{ currency(data.proxyProviderDiscountPrice).format() }}</span>
            <span class="days"> / {{ $t('{day} 天', { day: 30 }) }}</span>
          </div>
        </template>
        <template #renew="{ data }">
          <div class="scale-80" @click.stop>
            <RxToggleSwitch v-model="data.autoRenew" :disabled="data.orderStatus !== ProxyOrderStatus.done || data.proxyExpireStatus === ProxyExpireStatus.expired" :true-value="1" :false-value="0"
                            :before-change="() => autoRenewChange(data)"
            />
          </div>
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
        <template #providerType="{ data }">
          <div class="flex items-center gap-2">
            <div class="tag">
              {{ data.providerType }}
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
:deep(.row-success) {
  border-color: var(--component-table-border-updated);
  background: var(--colors-background-bg-success);

  & > td {
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

.days {
  color: var(--colors-text-text-inactive);
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

.tag {
  padding: 5px 6px;
  border-radius: 2px;
  border: 1px solid var(--component-tag-border);
  background: var(--component-tag-bg);
  color: var(--colors-text-text-secondary);
  font-family: 'JetBrains Mono';
  font-size: 10px;
  font-weight: 800;
  line-height: 8px;
}
</style>
