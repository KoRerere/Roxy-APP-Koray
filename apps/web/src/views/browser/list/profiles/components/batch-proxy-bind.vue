<script setup lang="ts">
import AdvancedSearch from '/@/views/browser/list/profiles/components/advanced-search.vue'
import OutboundIp from '/@/views/agent/shop/components/outbound-ip.vue'
import ExpireDate from '/@/views/agent/shop/components/expire-date.vue'
import BandwidthCell from '/@/views/agent/shop/components/bandwidth-cell.vue'
import RelatedProfilesCell from '/@/views/account/list/components/related-profiles-cell.vue'
import ProxyFilter from '/@/views/agent/shop/components/proxy-filter/index.vue'
import { useProxyFilter } from '/@/views/agent/shop/components/proxy-filter/useProxyFilter'
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import ProfileInfo from './profile-info/index.vue'
import { RxAlert } from '/@/components/rx-alert'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { concurrentControl, setOperationLoading } from '/@/utils'
import { useCheckProxy, useProxy } from '/@/views/agent/hooks'
import { BuyEntryType, BuyProxyListType, ProxyReqType, ProxyType } from '/@/enums'
import { getRelatedProfileLabels } from '/@/views/agent/shop/columns.tsx'
import { getAdvancedSearch, tableRequest } from '/@/views/agent/shop/operation.ts'
import { watchDebounced } from '@vueuse/core'
import { API } from '/@/api'
import type { ProxyCheckStatus } from '/@/enums'
import type { SvgNames } from '/@/components/rx-icon'

/** 一组绑定：同一条代理 IP 绑到若干窗口 */
export interface ProxyBindGroup {
  proxy: Record<string, any>
  profiles: Record<string, any>[]
}

const { profiles, workspaceName, onConfirm } = defineProps<{
  /** 本次在窗口列表多选的窗口 */
  profiles: Record<string, any>[]
  workspaceName?: string
  /** 按代理分组回传；返回 false 时保留弹窗 */
  onConfirm: (groups: ProxyBindGroup[]) => Promise<boolean | void>
}>()

const { buyProxy } = useProxy()
const { testProxy, batchTestShowToast } = useCheckProxy()
const [showToast, onlyErrorToast] = useResponseToast()

/* ---------------- 左侧：代理 IP 列表（单选） ---------------- */

const proxyTableRef = useTemplateRef('proxyTable')
const advancedSearchOptions = getAdvancedSearch()
const proxyList = ref<Record<string, any>[]>([])
const checkedMessage = ref<Record<string, ProxyCheckStatus>>({})
/** 右侧当前选中的代理 IP（表格单选，v-model:selection） */
const selectedProxy = ref<Record<string, any>>()

/** 「全部 / 已导入 / 已购买」分段，与代理 IP 页面同一参数 proxyType */
const proxyTypeOptions = [
  { name: $t('全部'), value: undefined },
  { name: $t('已导入'), value: ProxyType.resource.toString() },
  { name: $t('已购买'), value: ProxyType.buy.toString() },
]
const proxyTypeValue = ref<string>()

/** 与代理 IP 页面同一套「筛选」抽屉：状态 / 关联窗口 / 来源 / 自动续费 */
const proxyFilter = useProxyFilter({
  multiple: true,
  onApply: () => refreshProxyTable({}, true),
})

// 加了备注列后整体收窄各列最小宽度，保证右侧面板默认宽度下不出横向滚动
const proxyColumns = [
  { title: $t('出口 IP'), key: 'lastCountry', slot: 'outbound', style: { width: '0%', minWidth: '180px' } },
  { title: $t('到期时间'), key: 'expireDate', render: ({ data }: any) => h(ExpireDate, { data }), style: { minWidth: '130px' } },
  { title: $t('IP 带宽'), key: 'bandwidth', render: ({ data }: any) => h(BandwidthCell, { data }), style: { minWidth: '80px' } },
  { title: $t('已关联窗口'), key: 'bindList', slot: 'bindList', style: { minWidth: '120px' } },
  { title: $t('备注'), key: 'proxyRemark', slot: 'remark', style: { minWidth: '100px' } },
]

function refreshProxyTable(tabParams = {}, force = false) {
  proxyTableRef.value?.refresh(tabParams, force)
}

async function getProxyList(params: any) {
  const result = await tableRequest({ ...proxyFilter.getApiParams(), ...(proxyTypeValue.value ? { proxyType: proxyTypeValue.value } : {}), ...params, type: BuyProxyListType.Use })
  if (result.code === 0) {
    proxyList.value = result.data.rows
    // 翻页后用同源行替换选中对象，保证单选回显
    const matched = result.data.rows.find((item: any) => item.id === selectedProxy.value?.id)
    if (matched) {
      selectedProxy.value = matched
    }
  }
  return result
}

/** 点整行也能选中代理 IP（单选列之外的区域） */
function onProxyRowClick({ data }: { data: Record<string, any> }) {
  selectedProxy.value = data
}

function onProxySearch(search?: Record<string, any>) {
  const { key, value } = search || {}
  refreshProxyTable({ queryKey: value && (key || 'fuzzy'), queryValue: value }, true)
}

/** 购买成功后刷新列表，新 IP 即可在右侧选择 */
async function onBuyProxy() {
  try {
    await buyProxy({ entryType: BuyEntryType.Immediate })
    refreshProxyTable({}, true)
  }
  catch {
    // 关闭购买弹窗时 reject，忽略
  }
}

async function onTestAll() {
  if (!proxyList.value.length) {
    onlyErrorToast(-1, $t('暂无代理 IP'))
    return
  }
  const datas = proxyList.value
  const tasks = datas.map((item) => {
    setOperationLoading(item, 'test', true)
    return async () => {
      const checkResult = await testProxy({ ...toRaw(item), apiCheck: item.proxyType === ProxyType.buy })
      setOperationLoading(item, 'test', false)
      Object.assign(item, { ...checkResult, _checkRes: toRaw(checkResult) })
      checkedMessage.value[item.id] = checkResult.checkStatus
      return { ...checkResult, id: item.id, proxyType: item.proxyType }
    }
  })
  const results = await concurrentControl(tasks, 5)
  batchTestShowToast(results, { reCheck: onTestAll })
  if (results.some((item: any) => item.proxyType === ProxyType.resource)) {
    API.proxy.userMdfProxyModuleCreate({ proxyList: results, requestType: ProxyReqType.SpeedTest })
  }
}

/* ---------------- 绑定关系（本地暂存，保存时统一提交） ---------------- */

/** 窗口 id -> 本次绑定的代理 IP */
const bindings = ref<Record<number, Record<string, any>>>({})
const configuredCount = computed(() => Object.keys(bindings.value).length)
/** 左侧勾选的窗口，配合「替换为新代理 IP」批量绑定；进入时默认全选 */
const checkedProfiles = ref<Record<string, any>[]>([...profiles])

/** 去掉表格运行时字段，只保留代理数据 */
function pickSelectedProxy() {
  const { loadingOperationMap: _, _checkRes: __, ...proxy } = toRaw(selectedProxy.value!) as Record<string, any>
  return proxy
}

/** 「替换为新代理 IP」：把右侧选中的 IP 一次绑到左侧所有勾选的窗口 */
function bindCheckedProfiles() {
  if (!checkedProfiles.value?.length) {
    onlyErrorToast(-1, $t('请先在左侧勾选窗口'))
    return
  }
  if (!selectedProxy.value) {
    onlyErrorToast(-1, $t('请先在右侧选择代理 IP'))
    return
  }
  const proxy = pickSelectedProxy()
  const count = checkedProfiles.value.length
  for (const profile of checkedProfiles.value) {
    bindings.value[profile.id] = proxy
  }
  checkedProfiles.value = []
  // 只是本地暂存，提示里说明需点「确认」才生效
  showToast(0, $t('已为 {count} 个窗口更换代理 IP，点击「确认」后生效', { count }))
}

/**
 * 右侧「已关联窗口」：原有关联 + 本次绑到该 IP 的窗口，
 * 并去掉原本挂在该 IP、但本次改绑到其他 IP 的窗口（一个窗口只能用一个 IP）
 */
function getLinkedLabels(proxy: Record<string, any>) {
  const sortNums = new Set<number | string>(proxy.bindList ?? [])
  for (const profile of profiles) {
    const pending = bindings.value[profile.id]
    if (!pending) {
      continue
    }
    if (pending.id === proxy.id) {
      sortNums.add(profile.windowSortNum)
    }
    else if (profile.moduleId === proxy.id) {
      sortNums.delete(profile.windowSortNum)
    }
  }
  return getRelatedProfileLabels({ bindList: [...sortNums] })
}

/* ---------------- 左侧：本次多选的窗口 ---------------- */

const profileTableRef = useTemplateRef('profileTable')
const profileKeyword = ref('')

const profileColumns = [
  { title: $t('窗口信息'), key: 'windowName', slot: 'profile', style: { minWidth: '280px' } },
  { title: $t('代理 IP'), key: 'proxy', slot: 'proxy', style: { minWidth: '140px' } },
]

/** 本地分页 + 关键字过滤（编号 / 名称） */
async function getProfileList(params: any) {
  const keyword = profileKeyword.value.trim().toLowerCase()
  const rows = keyword
    ? profiles.filter(item => `${workspaceName}-${item.windowSortNum}`.toLowerCase().includes(keyword) || `${item.windowName ?? ''}`.toLowerCase().includes(keyword))
    : profiles
  const pageSize = Number(params.page_size) || 10
  const pageIndex = Number(params.page_index) || 1
  return {
    code: 0,
    data: { rows: rows.slice((pageIndex - 1) * pageSize, pageIndex * pageSize), total: rows.length },
  }
}

watchDebounced(profileKeyword, () => profileTableRef.value?.refresh({}, true), { debounce: 200 })

/**
 * 代理库里的 IP（按 id）：窗口自身没有检测出地区时，用它关联的代理库条目（moduleId）补国旗和地区
 */
const proxyLibrary = ref<Record<number, Record<string, any>>>({})

async function loadProxyLibrary() {
  const moduleIds = new Set(profiles.map(item => item.moduleId).filter(Boolean))
  if (!moduleIds.size) {
    return
  }
  const result = await tableRequest({ type: BuyProxyListType.Use, page_index: '1', page_size: '999' })
  if (result.code === 0) {
    proxyLibrary.value = Object.fromEntries(result.data.rows.filter((item: any) => moduleIds.has(item.id)).map((item: any) => [item.id, item]))
  }
}

onBeforeMount(loadProxyLibrary)

/** 窗口原先绑定的 IP：优先窗口自身检测结果，缺地区时回退到代理库条目 */
function getOriginalProxy(profile: Record<string, any>) {
  const module = proxyLibrary.value[profile.moduleId]
  if (!profile.lastCountry && module?.lastCountry) {
    return { ...profile, lastCountry: module.lastCountry, lastCity: module.lastCity, lastIp: module.lastIp }
  }
  return profile
}

/** 窗口原先是否绑定过代理 IP */
function hasOriginalProxy(profile: Record<string, any>) {
  return !!profile.proxyCategory && profile.proxyCategory !== 'noproxy'
}

/**
 * 窗口指示器（ProfileInfo）的数据：本次已绑定时用新代理覆盖代理相关字段，
 * 中间那格即显示新 IP 的国旗；未绑定保持原样
 */
function getIndicatorData(profile: Record<string, any>) {
  const proxy = bindings.value[profile.id]
  if (!proxy) {
    return profile
  }
  return {
    ...profile,
    proxyCategory: proxy.proxyCategory || proxy.protocol,
    lastCountry: proxy.lastCountry,
    lastCity: proxy.lastCity,
    lastIp: proxy.lastIp,
    checkTime: proxy.checkTime,
    // 原窗口的检测结果不适用于新 IP，去掉右上角的检测状态点
    _checkRes: undefined,
  }
}

/** 「代理 IP」列展示：已绑定显示本次的新 IP，否则显示原 IP */
function getDisplayProxy(profile: Record<string, any>) {
  return bindings.value[profile.id] ?? getOriginalProxy(profile)
}

/** 「国家/城市」展示文案；未检测出地区时依次回退到出口 IP、代理主机 */
function getRegionText(item: Record<string, any>) {
  const region = [item.lastCountry, item.lastCity].filter(Boolean).join('/')
  const lastIp = item.lastIp && item.lastIp !== '--' ? item.lastIp : ''
  return region || lastIp || item.host || '--'
}

function getFlagName(item: Record<string, any>) {
  return `country-code/${item.lastCountry}` as SvgNames
}

/* ---------------- 保存 ---------------- */

const saving = ref(false)

/** 按代理分组提交；未配置的窗口保留原代理 */
async function onSave() {
  const groupMap = new Map<number, ProxyBindGroup>()
  for (const profile of profiles) {
    const proxy = bindings.value[profile.id]
    if (!proxy) {
      continue
    }
    const group = groupMap.get(proxy.id) ?? { proxy, profiles: [] }
    group.profiles.push(profile)
    groupMap.set(proxy.id, group)
  }
  saving.value = true
  try {
    await onConfirm([...groupMap.values()])
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="h-full flex flex-col min-h-0">
    <div class="shrink-0 px-5 py-3 section-divider">
      <RxAlert class="min-w-full" type="info" :closable="false"
               :title="$t('一个窗口只能使用一个代理 IP，一个代理 IP 可绑定多个窗口。请先在左侧勾选窗口，再在右侧选择代理 IP 并点击「替换为新代理 IP」，最后点击「确认」保存全部修改。')"
      />
    </div>

    <div class="flex-1 min-h-0 flex">
      <!-- 1 选择要更换 IP 的窗口 -->
      <div class="shrink-0 w-[44%] min-w-0 flex flex-col px-5 panel-left">
        <div class="shrink-0 flex flex-col gap-3 py-4">
          <div class="h-7 flex items-center gap-2">
            <span class="step">1</span>
            <span class="tt-primary text-3.5 leading-5 font-600">{{ $t('选择要更换 IP 的窗口') }}</span>
          </div>
          <div class="step-divider" />
          <div class="flex items-center">
            <TsFormInputText v-model="profileKeyword" size="xs" :fluid="false" :field-props="{ class: '!w-35' }" pre-icon="base/rx_ic_magnify" :placeholder="$t('搜索窗口')" />
          </div>
        </div>
        <div class="flex-ovh-1">
          <RyTable ref="profileTable" v-model:selection="checkedProfiles" :columns="profileColumns" cache-key="batch-proxy-bind-profiles" :table-request="getProfileList"
                   selection-mode="multiple" :clear-selection-on-request="false" :show-table-header="false" :show-actions="false"
                   :show-display="false" :context-menu="false" :multiple-operation="false"
          >
            <template #profile="{ data: row }">
              <div class="flex items-center gap-4 min-w-0">
                <ProfileInfo class="shrink-0" :show-sort="false" :data="getIndicatorData(row)" readonly />
                <div class="flex flex-col gap-1 min-w-0 text-3 font-500 leading-4">
                  <span class="truncate tt-primary">{{ row.windowName || '--' }}</span>
                  <span class="font-['JetBrains_Mono']"><span class="tt-tertiary">{{ workspaceName }}-</span><span class="tt-primary">{{ row.windowSortNum }}</span></span>
                </div>
              </div>
            </template>
            <template #proxy="{ data: row }">
              <div v-if="bindings[row.id] || hasOriginalProxy(row)" class="flex items-center gap-2 min-w-0">
                <SvgIcon class="shrink-0" :name="getFlagName(getDisplayProxy(row))" fallback="base/rx_ic_earth" size="24" />
                <div class="flex flex-col gap-1 min-w-0 text-3 leading-4">
                  <span class="truncate tt-primary font-500">{{ getRegionText(getDisplayProxy(row)) }}</span>
                  <span v-if="getDisplayProxy(row).lastIp && getDisplayProxy(row).lastIp !== '--'" class="truncate tt-tertiary">{{ getDisplayProxy(row).lastIp }}</span>
                </div>
              </div>
              <span v-else class="tt-tertiary text-3">--</span>
            </template>
          </RyTable>
        </div>
      </div>

      <!-- 2 选择代理 IP -->
      <div class="flex-1 min-w-0 flex flex-col px-5">
        <div class="shrink-0 flex flex-col gap-3 py-4">
          <div class="h-7 flex items-center gap-2">
            <span class="step">2</span>
            <span class="flex-1 tt-primary text-3.5 leading-5 font-600">{{ $t('选择代理 IP') }}</span>
            <RxButton v-tooltip.top="checkedProfiles?.length ? '' : $t('请先在左侧勾选窗口')" size="xs" :label="$t('替换为新代理 IP')" @click.stop="bindCheckedProfiles" />
          </div>
          <div class="step-divider" />
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <RxButton size="xs" icon="base/rx_ic_cart" :label="$t('购买代理 IP')" @click.stop="onBuyProxy" />
              <AdvancedSearch :options="advancedSearchOptions" :search="onProxySearch" :clear="onProxySearch" />
              <Divider layout="vertical" class="!ml-0 !mr-0 h-4" />
              <RxSelectButton v-model="proxyTypeValue" :options="proxyTypeOptions" size="xxs" option-label="name" option-value="value" data-key="value"
                              @change="refreshProxyTable({}, true)"
              />
            </div>
            <div class="flex items-center gap-3">
              <ProxyFilter :filter="proxyFilter" />
              <RxButton outlined severity="secondary" size="xxs" icon="base/rx_ic_speed_test" :label="$t('测试全部')" @click.stop="onTestAll" />
            </div>
          </div>
        </div>
        <div class="flex-ovh-1">
          <RyTable ref="proxyTable" v-model:selection="selectedProxy" :columns="proxyColumns" cache-key="batch-proxy-bind-proxies" :table-request="getProxyList"
                   selection-mode="single" class="pick-table" :clear-selection-on-request="false" :show-table-header="false" :show-actions="false" :show-display="false"
                   :context-menu="false" :multiple-operation="false" :virtual-scroller-options="{ itemSize: 60 }" @row-click="onProxyRowClick"
          >
            <template #table-empty>
              <CustomEmpty icon="rx_illustration_star.svg" :title="$t('暂无代理 IP')" />
            </template>
            <template #outbound="{ data: row }">
              <OutboundIp class="select-none" :country="row.lastCountry" :city="row.lastCity" :last-ip="row.lastIp" :time="row.checkTime" :status="checkedMessage[row.id]"
                          :badge-desc="row.badgeTypeDesc" :is-loading="row.loadingOperationMap?.test"
              />
            </template>
            <template #bindList="{ data: row }">
              <RelatedProfilesCell :list="getLinkedLabels(row)" />
            </template>
            <template #remark="{ data: row }">
              <!-- 选择场景只读展示，最多两行，悬停看全文 -->
              <div v-if="row.remark" v-tooltip.top="{ value: row.remark, showDelay: 300 }" class="max-w-40 line-clamp-2 break-all whitespace-pre-wrap tt-primary text-3 leading-4">
                {{ row.remark }}
              </div>
              <span v-else class="tt-tertiary text-3">--</span>
            </template>
          </RyTable>
        </div>
      </div>
    </div>

    <div class="shrink-0 flex items-center justify-between gap-4 pt-4 px-4 pb-5 footer">
      <i18n-t tag="div" class="tt-primary text-3.5 leading-5" keypath="已配置 {count}/{total} 个窗口；未配置的窗口将保留原有代理 IP。">
        <template #count>
          <span class="tt-brand">{{ configuredCount }}</span>
        </template>
        <template #total>
          <span>{{ profiles.length }}</span>
        </template>
      </i18n-t>
      <RxButton size="lg" :label="$t('确认')" :disabled="!configuredCount" :loading="saving" @click="onSave" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.section-divider {
  border-bottom: 1px solid var(--colors-border-divider);
}

.panel-left {
  border-right: 1px solid var(--colors-border-border-inactive);
}

.footer {
  border-top: 1px solid var(--colors-border-divider);
}

.step-divider {
  border-bottom: 1px dashed var(--colors-border-divider-dashed);
}

.step {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 9999px;
  background: var(--colors-background-bg-brand, #11a3fd);
  color: var(--component-button-primary-text, #fff);
  font-size: 13px;
  font-weight: 600;
  line-height: 16px;
}

:deep(.p-datatable) {
  th:first-child,
  td:first-child {
    padding-left: 16px !important;
  }

  th:last-child,
  td:last-child {
    padding-right: 16px !important;
  }
}

.pick-table :deep(tbody > tr) {
  cursor: pointer;

  &.p-datatable-row-selected > td {
    background: var(--component-table-bg-selected);
  }

  &.p-datatable-row-selected:hover > td {
    background: var(--component-table-bg-selected-hover);
  }
}

:deep(.rx-header) {
  padding: 0;
}
</style>
