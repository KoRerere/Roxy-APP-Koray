<script setup lang="ts">
import TsFormSelect from '/@/views/lab/components/form/m-input-select.vue'
import RxButton from '/@/components/rx-button'
import { useCheckProxy } from '/@/views/agent/hooks'
import { useProxyModuleCreate } from '/@/views/agent/hooks/useProxyModuleCreate'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { deepClone } from '/@/utils'
import { API } from '/@/api'
import { BuyProxyListType, ProxyReqType, ProxyType } from '/@/enums'
import type { SvgNames } from '/@/components/rx-icon/'
import type { ProxyInfoItem } from './types'

const emit = defineEmits<{
  /** 底部「创建代理」：交给外壳切到自定义代理 tab */
  create: []
}>()

/** 当前选中的已有代理 */
const currentProxy = defineModel<ProxyInfoItem | null>({ default: null })

const { testProxy, batchTestShowToast } = useCheckProxy()
const { updateProxyModules } = useProxyModuleCreate()
const [showToast] = useResponseToast()

const testing = ref(false)
const loading = ref(false)
const listLoading = ref(false)
const loadedProxies = ref<ProxyInfoItem[]>([])
/** 避免打开下拉时的并发刷新把较新结果覆盖掉 */
let loadSeq = 0

/** 地区文案：国家 / 城市，缺省为 -- */
function formatLocation(option: ProxyInfoItem) {
  const parts = [option.lastCountry, option.lastCity].filter(Boolean)
  return parts.join(' / ') || '--'
}

/** 代理地址，不带账号密码；无 host 且无 port 时不展示 */
function formatProxyAddress(option: ProxyInfoItem) {
  const protocol = String(option.proxyCategory || option.protocol || '').trim()
  const host = String(option.host || '').trim()
  const port = String(option.port ?? '').trim()
  if ((!host && !port) || option.isEncryptProxy) {
    return ''
  }
  const hostPort = [host, port].filter(Boolean).join(':')
  return protocol ? `${protocol.toLocaleLowerCase()}://${hostPort}` : hostPort
}

/** 绑定窗口列表长度；bindList 可能是 id 数组或 JSON 字符串 */
function resolveBindListLength(bindList: unknown) {
  if (Array.isArray(bindList)) {
    return bindList.length
  }
  if (bindList == null || bindList === '') {
    return 0
  }
  try {
    const parsed = JSON.parse(String(bindList))
    return Array.isArray(parsed) ? parsed.length : 0
  }
  catch {
    return 0
  }
}

/**
 * 绑定窗口数。
 * 列表与商店页都以 bindList 为准；bindCount 常缺省或恒为 0，不能用 ?? 挡掉列表长度。
 */
function formatBindCount(option: ProxyInfoItem) {
  const fromList = resolveBindListLength(option.bindList)
  const fromCount = Number(option.bindCount)
  const count = Math.max(fromList, Number.isFinite(fromCount) ? fromCount : 0)
  return $t('已绑 {count} 个', { count })
}

/** 有备注才返回文案，空备注不占行 */
function formatRemark(option: ProxyInfoItem) {
  const remark = String(option.remark ?? '').trim()
  return remark ? $t('备注: {remark}', { remark }) : ''
}

/** 把代理条目补齐下拉展示与搜索字段 */
function toSelectOption(item: ProxyInfoItem): ProxyInfoItem {
  const location = formatLocation(item)
  const lastIp = String(item.lastIp || '').trim()
  const label = [location === '--' ? '' : location, lastIp].filter(Boolean).join(' • ') || '--'
  return {
    ...item,
    icon: (item.lastCountry ? `country-code/${item.lastCountry}` : 'base/rx_ic_earth') as SvgNames,
    label,
    searchText: [item.lastCountry, item.lastCity, location, lastIp, item.protocol, item.host, item.port, item.remark].filter(Boolean).join(' '),
  }
}

/**
 * 测速会改出口 IP；模板/表单 hydrate 只有扁平字段（无 bindList/remark）。
 * 下拉必须以列表接口行为准，不能用草稿整行替换。
 */
const SPEED_TEST_OVERLAY_KEYS = ['lastIp', 'lastCountry', 'lastCity', 'lastState', 'checkStatus', 'checkTime'] as const

/** 列表行打底，仅叠草稿里测速后会变的出口字段 */
function mergeListItemWithDraft(listItem: ProxyInfoItem, current: ProxyInfoItem) {
  const overlay: Record<string, any> = {}
  for (const key of SPEED_TEST_OVERLAY_KEYS) {
    const value = current[key]
    if (value !== undefined && value !== null && value !== '') {
      overlay[key] = value
    }
  }
  return toSelectOption({ ...listItem, ...overlay })
}

/** 下拉选项：选中项不在当前页时才插入草稿；在列表里则合并测速字段 */
const proxyOptions = computed(() => {
  const list = loadedProxies.value
  const current = currentProxy.value
  if (!current?.id) {
    return list
  }
  const index = list.findIndex(item => String(item.id) === String(current.id))
  if (index < 0) {
    return [toSelectOption(current), ...list]
  }
  const next = list.slice()
  next[index] = mergeListItemWithDraft(list[index]!, current)
  return next
})

const selectedProxyId = computed({
  get: () => {
    const id = currentProxy.value?.id
    if (id == null || id === '') {
      return null
    }
    // 用选项里的 id 回写，避免 number/string 不一致导致触发器无法匹配
    return proxyOptions.value.find(item => String(item.id) === String(id))?.id ?? id
  },
  set: (id: string | number | null) => {
    if (id == null || id === '') {
      currentProxy.value = null
      return
    }
    // 优先拿列表接口原行，避免选中已被扁平草稿污染的 option
    const found = loadedProxies.value.find(item => String(item.id) === String(id))
      ?? proxyOptions.value.find(item => String(item.id) === String(id))
    currentProxy.value = found ? { ...found, proxyMethod: 'choose' } : null
  },
})

onMounted(() => {
  void loadProxyOptions()
})

/** 拉取可用代理列表；打开下拉时刷新，保证新建项能出现 */
async function loadProxyOptions() {
  const seq = ++loadSeq
  listLoading.value = true
  try {
    const { code, data } = await API.proxy.userGetProxyListMergedList({
      type: BuyProxyListType.Use,
      page_index: '1',
      page_size: '200',
    })
    if (seq !== loadSeq || code !== 0) {
      return
    }
    loadedProxies.value = (data?.rows ?? []).map(item => toSelectOption(item))
  }
  finally {
    if (seq === loadSeq) {
      listLoading.value = false
    }
  }
}

async function randomChoose() {
  loading.value = true
  try {
    const { code, data, msg } = await API.proxy.userGetRandomAvailableProxyMergedList()
    if (code !== 0 || !data) {
      showToast(code !== 0 ? code : -1, msg || $t('暂无可用代理'))
      return
    }
    currentProxy.value = { ...toSelectOption(data), proxyMethod: 'choose' }
  }
  finally {
    loading.value = false
  }
}

/** 关闭下拉并切到自定义代理 tab */
function onCreateProxy(close: () => void) {
  close()
  emit('create')
}

/** 测速结果写回选中项，避免创建窗口仍带旧 IP */
function applyCheckResult(result: Record<string, any>) {
  if (!currentProxy.value?.id) {
    return
  }
  currentProxy.value = { ...toRaw(currentProxy.value), ...result }
}

async function onTestProxy() {
  if (!currentProxy.value?.id) {
    showToast(-1, $t('请先选择代理'))
    return
  }
  if (!globalThis.isElectron) {
    return globalThis.electronAPI.send('proxy:detect', {} as any)
  }

  const payload = deepClone(currentProxy.value)
  const proxyType = payload.proxyType ?? payload.buyProxyType
  testing.value = true
  // 即将用于创建窗口，统一走本地检测；第三方失败时用当前项 lastCountry 给 toast 购买默认国家
  const result = await testProxy({
    ...payload,
    apiCheck: false,
    proxyType,
  })
  testing.value = false
  batchTestShowToast({ ...result, proxyType }, {
    reCheck: () => onTestProxy(),
  })
  applyCheckResult(result)

  // 动态/自备代理需回写代理库，避免创建窗口仍关联旧 IP
  if (proxyType === ProxyType.resource) {
    await updateProxyModules({
      proxyList: [{ ...result, id: payload.id, proxyType }],
      requestType: ProxyReqType.SpeedTest,
    })
  }
}
</script>

<template>
  <div class="flex items-center gap-1.5">
    <div class=" tt-tertiary text-3 ">
      {{ $t('已有代理 IP：') }}
    </div>
    <div class="flex-1 min-w-0 flex items-center gap-1.5">
      <TsFormSelect v-model="selectedProxyId" class="flex-1 min-w-0" :options="proxyOptions" option-value="id" option-label="label" filter show-clear overlay-auto-width
                    :filter-fields="['searchText', 'label', 'lastCountry', 'lastCity', 'lastIp', 'remark', 'host', 'protocol']" :filter-placeholder="$t('搜索地区 / IP / 备注')" :placeholder="$t('请选择已有代理 IP')"
                    :empty-message="listLoading ? $t('加载中...') : $t('暂无代理 IP')" overlay-class="proxy-picker-panel" scroll-height="20rem" @before-show="loadProxyOptions"
      >
        <template #option="{ option }">
          <div class="w-90 min-w-0 flex flex-col gap-0.5">
            <div class="min-w-0 flex items-center gap-2">
              <SvgIcon class="shrink-0" :name="option.icon" fallback="base/rx_ic_earth" color="var(--colors-icon-icon-inactive)" size="14" />
              <div class="flex-1 min-w-0 ellipsis-1 tt-tertiary text-3 leading-4">
                {{ formatLocation(option) }}
              </div>
              <div class="shrink-0 ellipsis-1 tt-tertiary text-3 leading-4">
                {{ formatBindCount(option) }}
              </div>
            </div>
            <div v-if="formatProxyAddress(option)" class="pl-5.5 ellipsis-1 tt-secondary text-3.5 leading-4.5 font-600">
              {{ formatProxyAddress(option) }}
            </div>
            <div v-if="String(option.lastIp || '').trim()" class="pl-5.5 ellipsis-1 tt-tertiary text-3.25 leading-4.5 font-[JetBrains_Mono]">
              {{ option.lastIp }}
            </div>
            <div v-if="formatRemark(option)" class="pl-5.5 ellipsis-1 tt-tertiary text-3 leading-4">
              {{ formatRemark(option) }}
            </div>
          </div>
        </template>
        <template #footer="{ close }">
          <div class="pa-1">
            <RxButton class="w-full" text icon="base/rx_ic_plus" :label="$t('添加代理 IP')" @click="onCreateProxy(close)" />
          </div>
        </template>
      </TsFormSelect>
      <RxButton severity="secondary" variant="text" icon="base/rx_ic_shuffle" :loading="loading" @click="randomChoose" />
      <RxButton severity="secondary" variant="outlined" icon="base/rx_ic_speed_test" :label="$t('测试代理 IP')" :loading="testing" @click="onTestProxy" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.rx-label) {
  text-align: right;
  max-width: 100px;
  min-width: 100px !important;
}
</style>

<style lang="scss">
.proxy-picker-panel {
  .m-input-select-option {
    align-items: flex-start;
  }
}
</style>
