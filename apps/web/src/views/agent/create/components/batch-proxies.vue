<script setup lang="tsx">
import TsFormSelect from '/@/views/lab/components/form/m-input-select.vue'
import Example from '/@/views/agent/create/components/example.vue'
import ShadowDotGrid from '/@/components/shadow-dot-grid.vue'
import ParseTextarea from '/@/views/agent/create/components/parse-textarea.vue'
import OutboundIp from '/@/views/agent/shop/components/outbound-ip.vue'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { RxAlert } from '/@/components/rx-alert/'
import { useConfirm } from 'primevue/useconfirm'
import { API } from '/@/api'
import { ProxyCheckStatus } from '/@/enums'
import { IPType } from '/@/enums/proxy'
import { useResponseToast } from '/@/hooks/useResponseToast'

import { useUserStore } from '/@/stores/user'
import { concurrentControl, getDictMap, parseProxyUrl, setOperationLoading, setRowsLoading, sleep } from '/@/utils'
import { useCheckProxy } from '/@/views/agent/hooks'
import { useProxyCreateLabels } from '../proxy-create-mode'
import { getColumns } from './columns'

interface ProxyItem {
  checkChannel?: string
  checkChannelValue?: string
  checkStatus?: ProxyCheckStatus
  ipType?: string
  protocol?: string
  host?: string
  port?: string
  proxyUserName?: string
  proxyPassword?: string
  refreshUrl?: string
  remark?: string
  _missField: any[]
  _missIndex: number
  hasImportRecord?: boolean
  historyChecking?: boolean
  [key: string]: any
}

interface IpCheckerConfig {
  value: {
    value: string
    label: string
    [key: string]: any
  } | undefined
  props: any
  onChange: () => void
}

const { onConfirm } = defineProps<{
  onConfirm: (data: ProxyItem[]) => Promise<void> | void
}>()

const labels = useProxyCreateLabels()
const isDeviceMode = computed(() => labels.value.mode === 'device')
const confirm = useConfirm()
const { getUserConfig } = useUserStore()
const { userConfig, userPayInfo } = storeToRefs(useUserStore())
const { testProxy: checkProxy, batchTestShowToast } = useCheckProxy()
const [showToast, onlyErrorToast] = useResponseToast()

const proxiesText = ref('')
const dataList = ref<ProxyItem[]>([])
const isDuplicate = ref(true)
const showMessage = ref(false)
const showHistoryWarning = ref(false)
const filterCount = ref(0)

const testStatus = ref<Record<string, ProxyCheckStatus>>({})
const isTestingAll = ref(false)
/** 历史库批量检测结果缓存，连通性完成后按 _id 匹配 */
const historyResultMap = new Map<string, boolean>()
let historyCheckPending = false
const protocolOptions = ref()
const protocolValue = ref()
const ipTypeOptions = ref()
const ipType = ref()
const columns = computed(() => getColumns(labels.value))

const ipCheckerConfig = reactive<IpCheckerConfig>({
  value: undefined,
  props: {
    name: 'checkChannel',
    options: undefined,
    filter: false,
    size: 'xxs' as any,
    icon: 'base/rx_ic_network' as any,
    iconColor: 'var(--colors-icon-icon-secondary)',
  },
  onChange() {
    dataList.value.forEach((item: any) => {
      item.checkChannel = ipCheckerConfig.value?.value
      item.checkChannelValue = ipCheckerConfig.value?.label
    })
  },
})

const deleteFailDisabled = computed(() => !(dataList.value.length && dataList.value.some(item => item.checkStatus === ProxyCheckStatus.failure)))

const historyMatchCount = computed(() => dataList.value.filter(item => item.hasImportRecord).length)

const historyWarningMessage = computed(() => $t('有 {count} 条设备命中平台半年内历史库，继续导入可能造成账号关联风险。', { count: historyMatchCount.value }))

const messageAlertHeight = computed(() => {
  let height = 0
  if (showMessage.value)
    height += 52
  if (showHistoryWarning.value)
    height += 52
  if (showMessage.value && showHistoryWarning.value)
    height += 10
  return `${height}px`
})

const missMessage = computed(() => {
  const list = dataList.value.map(item => ({
    ...item,
    checkStatus: item.checkStatus ?? ProxyCheckStatus.failure,
  }))

  if (!list.some(item => item._missIndex)) {
    return ''
  }

  const { miss } = list.reduce((data, item) => {
    if (item._missIndex) {
      data.miss.push(item)
    }
    else {
      data.success.push(item)
    }
    return data
  }, { success: [] as ProxyItem[], miss: [] as ProxyItem[] })

  return labels.value.formatMissSaveMessage(miss.map(item => item._missIndex).join(', '))
})

watch(ipType, async (newVal) => {
  const $dict_map = await getDictMap()
  const dictKey = newVal === IPType.IPV6 ? 'ipv6-query-channels' : 'checkChannel'
  ipCheckerConfig.props.options = $dict_map[dictKey]
  ipCheckerConfig.value = $dict_map[dictKey]!.find((item: any) => item.value === userConfig.value.ipChecker) || $dict_map[dictKey]![0]
})

onBeforeMount(async () => {
  const [$dict_map, userConfig] = await Promise.all([getDictMap(), getUserConfig()])
  ipCheckerConfig.value = $dict_map.checkChannel!.find((item: any) => item.value === userConfig!.ipChecker)
  ipCheckerConfig.props.options = $dict_map.checkChannel
  protocolOptions.value = $dict_map.protocol
  protocolValue.value = $dict_map.protocol![0]!.value
  ipTypeOptions.value = $dict_map.ipType
  ipType.value = $dict_map.ipType![0]!.value
})

async function parseValue() {
  const list = proxiesText.value.split('\n').map(n => n.replace(/\s/g, '').replace(/：/g, ':')).filter(Boolean)

  if (!list.length) {
    onlyErrorToast(-1, labels.value.inputRequired)
    return
  }

  dataList.value = (isDuplicate.value ? [...new Set(list)] : list)
    .map((url, index) => {
      const { protocol: __protocol, host, port, proxyUserName, proxyPassword, refreshUrl, remark } = parseProxyUrl(url)

      const protocol = __protocol || protocolValue.value

      const _missField = [['protocol', protocol], ['host', host], ['port', port]].filter(item => !item[1])

      const __ipType = host?.startsWith('[') ? IPType.IPV6 : ipType.value

      return {
        checkChannel: ipCheckerConfig.value?.value,
        checkChannelValue: ipCheckerConfig.value?.label,
        ipType: __ipType,
        protocol: protocol?.toLocaleUpperCase(),
        host: host?.replace(/\[|\]/g, ''),
        port,
        proxyUserName,
        proxyPassword,
        // 电商模式无刷新 URL 能力，解析结果也不保留该字段
        ...(isDeviceMode.value ? {} : { refreshUrl }),
        remark,
        _missField,
        _missIndex: _missField.length ? index + 1 : 0,
        _id: index,
      }
    })

  filterCount.value = list.length - dataList.value.length
  showMessage.value = true
  showHistoryWarning.value = false
  // 重置掉状态
  testStatus.value = {}
  historyResultMap.clear()
  historyCheckPending = false
  dataList.value.forEach((item) => {
    item.hasImportRecord = undefined
    item.historyChecking = false
  })

  if (isTestingAll.value)
    return

  isTestingAll.value = true
  try {
    await Promise.all([
      runTestAllProxy(),
      isDeviceMode.value ? startHistoryCheck(dataList.value) : Promise.resolve(),
    ])
  }
  finally {
    isTestingAll.value = false
  }
}

function messageClose() {
  sleep(300).then(() => {
    showMessage.value = false
  })
}

function historyWarningClose() {
  sleep(300).then(() => {
    showHistoryWarning.value = false
  })
}

function tableOperation(data: any) {
  return [
    // 电商模式无刷新 URL 能力，隐藏刷新操作
    ...(isDeviceMode.value
      ? []
      : [{
          name: 'refresh',
          label: labels.value.refreshAction,
          icon: 'base/rx_ic_refresh',
          quick: true,
          disabled: !data.refreshUrl,
          disabledTooltip: $t('未配置刷新URL'),
        }]),
    {
      name: 'test',
      label: labels.value.testAction,
      icon: 'base/rx_ic_speed_test',
      quick: true,
    },
    {
      name: 'delete',
      label: $t('删除'),
      icon: 'base/rx_ic_bin_1',
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
      if (!globalThis.isElectron) {
        return globalThis.electronAPI.send('proxy:detect', {} as any)
      }
      testProxy(data, operate.name)
      break
    case 'delete':
      deleteProxyItem(data)
      break
  }
}

async function refreshUrl(data: any, operateName: string) {
  const isOK = await setRowsLoading(data, operateName, () => globalThis.electronAPI.send('proxy:refreshUrl', data.refreshUrl!))
  showToast(isOK ? 0 : -1, data.refreshUrl as string)
}

async function testProxy(data: ProxyItem | ProxyItem[], operateName: string) {
  const secondCheckMap = new Map<number, () => Promise<any>>()

  const tasks = ([] as ProxyItem[])
    .concat(data)
    .map((item, index) => {
      setOperationLoading(item, operateName, true)

      const _task = async () => {
        const checkResult = await checkProxy({ ...toRaw(item), protocol: item.protocol || 'HTTP', isDirect: userPayInfo.value.isDirectWhitelist })
        if (checkResult.checkStatus === ProxyCheckStatus.failure && !item._secondCheck) {
          Reflect.set(item, '_secondCheck', true)
          secondCheckMap.set(index, _task)
        }
        else {
          Reflect.deleteProperty(item, '_secondCheck')
          Object.assign(item, checkResult)
          testStatus.value[item._id] = checkResult.checkStatus
          setOperationLoading(item, operateName, false)
          applyHistoryResultToItem(item)
        }
        return checkResult
      }

      return _task
    })

  const results = await concurrentControl(tasks, 5)

  // 将失败的代理进行二次测试，验证是否真的失败
  if (secondCheckMap.size > 0) {
    const res = await concurrentControl([...secondCheckMap.values()], 5)
    secondCheckMap.keys().forEach((key, index) => results[key] = res[index])
    secondCheckMap.clear()
  }

  batchTestShowToast(results)
}

function clearProxy() {
  confirm.require({
    header: labels.value.clearHeader,
    message: labels.value.clearMessage,
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('确认'),
      severity: 'danger',
    },
    accept: () => {
      dataList.value = []
      showMessage.value = false
      showHistoryWarning.value = false
    },
  })
}

function syncHistoryWarning() {
  showHistoryWarning.value = isDeviceMode.value && historyMatchCount.value > 0
}

/** 连通性已有结果时，从历史批量结果中回填风险评级 */
function applyHistoryResultToItem(item: ProxyItem) {
  if (!isDeviceMode.value || item._missIndex || !item.host || !item.port)
    return
  if (item.checkStatus === undefined)
    return

  if (historyCheckPending) {
    item.historyChecking = true
    return
  }

  item.hasImportRecord = historyResultMap.get(String(item._id)) ?? true
  item.historyChecking = false
  syncHistoryWarning()
}

/** 电商模式：并行发起历史库批量检测，结果缓存后随连通性结果逐条匹配 */
async function startHistoryCheck(items: ProxyItem[]) {
  const validItems = items.filter(item => !item._missIndex && item.host && item.port)
  if (!validItems.length)
    return

  historyResultMap.clear()
  historyCheckPending = true

  try {
    const { code, data } = await API.proxy.userBatchCheckProxyImportCreate({
      items: validItems.map(item => ({
        tempId: String(item._id),
        host: item.host,
        port: item.port,
        proxyUserName: item.proxyUserName,
        proxyPassword: item.proxyPassword,
      })),
    })

    // API 异常时保守视为命中，与单条检测弹窗一致
    if (code !== 0 || !data.items) {
      validItems.forEach(item => historyResultMap.set(String(item._id), true))
    }
    else {
      data.items.forEach((item) => {
        historyResultMap.set(item.tempId!, !!item.hasImportRecord)
      })
    }
  }
  finally {
    historyCheckPending = false
    validItems.forEach(item => applyHistoryResultToItem(item))
  }
}

async function runTestAllProxy() {
  if (!dataList.value?.length) {
    onlyErrorToast(-1, labels.value.emptyList)
    return
  }
  if (!globalThis.isElectron) {
    return globalThis.electronAPI.send('proxy:detect', {} as any)
  }
  await testProxy(dataList.value, 'test')
}

function deleteProxyItem(data: ProxyItem) {
  dataList.value = dataList.value.filter(item => item._id !== data._id)
  delete testStatus.value[data._id]
  if (!dataList.value.length) {
    showMessage.value = false
    showHistoryWarning.value = false
  }
  else if (historyMatchCount.value === 0) {
    showHistoryWarning.value = false
  }
}

async function testAllProxy() {
  if (isTestingAll.value)
    return

  isTestingAll.value = true
  try {
    await runTestAllProxy()
  }
  finally {
    isTestingAll.value = false
  }
}

function deleteFailProxy() {
  const list = dataList.value.filter((item: any) => item.checkStatus !== ProxyCheckStatus.failure)
  confirm.require({
    header: labels.value.deleteFailHeader,
    message: labels.value.formatDeleteFailMessage(dataList.value.length - list.length),
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('确认'),
      severity: 'danger',
    },
    accept: () => {
      dataList.value = list
      if (historyMatchCount.value === 0)
        showHistoryWarning.value = false
    },
  })
}

async function onSave() {
  const list = dataList.value.map(item => ({
    ...item,
    checkStatus: item.checkStatus ?? ProxyCheckStatus.failure,
  }))

  if (!list.some(item => item._missIndex)) {
    await onConfirm(list)
    return
  }

  const { promise, resolve } = Promise.withResolvers<void>()

  const { success, miss } = list.reduce((data, item) => {
    if (item._missIndex) {
      data.miss.push(item)
    }
    else {
      data.success.push(item)
    }
    return data
  }, { success: [] as ProxyItem[], miss: [] as ProxyItem[] })

  confirm.require({
    header: $t('警告'),
    message: labels.value.formatMissConfirmMessage(miss.map(item => item._missIndex).join(', ')),
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('确认'),
      severity: 'info',
    },
    accept: async () => {
      await onConfirm(success)
      resolve()
    },
    reject: resolve,
    onHide: resolve,
  })
  return promise
}
</script>

<template>
  <div class="flex-1 overflow-auto flex-col proxies-content">
    <div class="parse-input w-full">
      <div class="flex flex-col gap-1.5 xl:w-60%">
        <div class="panel-title flex justify-between items-start xl:items-center flex-col xl:flex-row gap-1">
          <div>{{ labels.entityInfo }}</div>
          <div class="flex gap-1.5">
            <TsFormSelect v-model="ipType" class="flex-1" :options="ipTypeOptions" option-value="value" size="xs" />
            <TsFormSelect v-model="protocolValue" class="!w-30" :options="protocolOptions" option-value="value" size="xs" />
            <!-- <TsFormSelect v-model="parserType" class="!w-50" :options="parserTypeOptions" option-value="value" size="xs" /> -->
          </div>
        </div>
        <div class="information min-w-423px">
          <ParseTextarea v-model="proxiesText" :placeholder="labels.inputPlaceholder" />
          <div class="flex justify-between information-actions">
            <div class="flex items-center gap-2.5">
              <div>
                <TsFormSelect v-model="ipCheckerConfig.value" class="!w-32" v-bind="ipCheckerConfig.props" @change="ipCheckerConfig.onChange" />
              </div>
              <div class="flex items-center gap-1.5">
                <RxCheckbox v-model="isDuplicate" :pt="{ root: 'items-center', box: '!w-4 !h-4' }" input-id="wrap" binary />
                <label for="wrap" class="text-3 select-none cursor-pointer text-[var(--colors-text-text-secondary)]">{{
                  $t('自动去重') }}</label>
                <RxSvgIcon v-tooltip="{ value: labels.duplicateTip, showDelay: 500, hideDelay: 300 }" name="base/rx_ic_info" color="var(--colors-icon-icon-note)" :size="12" />
              </div>
            </div>
            <RxButton outlined severity="secondary" size="xxs" :label="$t('解析并测试')" icon="base/rx_ic_play" :disabled="isTestingAll" @click.stop="parseValue" />
          </div>
        </div>
      </div>
      <div class="flex flex-col gap-1.5 w-40%">
        <div class="panel-title h-30px flex items-center">
          {{ labels.importRules }}
        </div>
        <div class="rules flex-1 min-w-335px">
          <!-- :parser-type="parserType" -->
          <Example :ip-type="ipType" class="relative z-10" />
          <ShadowDotGrid class="z-9" />
        </div>
      </div>
    </div>
    <div class="flex flex-col flex-1">
      <div class="flex items-center justify-between pt-6 pb-3 table-toolbar">
        <div class="panel-title">
          {{ labels.parsedTitle }}
        </div>
        <div class="flex gap-2">
          <RxButton text severity="secondary" size="xxs" :label="labels.clearAction" icon="base/rx_ic_bin_1" :disabled="!dataList?.length" @click.stop="clearProxy" />
          <RxButton text severity="secondary" size="xxs" :label="$t('删除失败')" icon="base/rx_ic_internet_error" :disabled="deleteFailDisabled" @click.stop="deleteFailProxy" />
          <RxButton outlined severity="secondary" size="xxs" :label="$t('测试全部')" icon="base/rx_ic_speed_test" :disabled="!dataList?.length || isTestingAll" @click.stop="testAllProxy" />
        </div>
      </div>
      <div class="parse-result-message">
        <RxAlert v-model:visible="showMessage" type="success" class="w-full" :content="labels.formatParseSuccess(dataList.length, filterCount) + missMessage" closable @close="messageClose" />
        <div v-if="showMessage" class="h-[10px] w-full bg-[var(--colors-background-bg-page)]" />
        <RxAlert v-if="isDeviceMode" v-model:visible="showHistoryWarning" type="warn" class="w-full" :content="historyWarningMessage" closable @close="historyWarningClose" />
        <div v-if="showHistoryWarning" class="h-[10px] w-full bg-[var(--colors-background-bg-page)]" />
      </div>
      <div class="flex-1 overflow-x-auto">
        <RyTable :style="{ '--message-h': messageAlertHeight }" :columns="columns" :data-list="dataList" :table-operation="tableOperation" :paginator="false" :show-table-header="false"
                 :show-actions="false"
        >
          <template #table-empty>
            <CustomEmpty icon="rx_illustration_star.svg" :title="labels.emptyTable" class="min-h-258px" />
          </template>
          <template #outbound="{ data }">
            <OutboundIp :country="data.lastCountry" :city="data.lastCity" :last-ip="data.lastIp" :time="data.checkTime" :status="testStatus[data._id]" :is-loading="data.loadingOperationMap?.test" />
          </template>
          <template #riskRating="{ data }">
            <div v-if="data.historyChecking" class="text-3 font-500 leading-4 tt-secondary">
              {{ $t('检测中') }}
            </div>
            <template v-else-if="data.hasImportRecord === undefined">
              --
            </template>
            <div v-else-if="data.hasImportRecord" class="text-3 font-500 leading-4 tt-warning">
              {{ $t('关联风险') }}
            </div>
            <div v-else class="text-3 font-500 leading-4 tt-success">
              {{ $t('安全') }}
            </div>
          </template>
          <template #actions="{ data }">
            <Actions :loading-operation-map="data.loadingOperationMap" :operation="tableOperation(data)" :show-menu="false" @quick-click="operationHandler($event, data)" />
          </template>
        </RyTable>
      </div>
    </div>
    <div class="flex justify-end footer">
      <RxButton :label="$t('保存')" :disabled="!dataList?.length" @click.stop="onSave" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.proxies-content {
  padding: 20px 24px 0;

  .table-toolbar {
    position: sticky;
    top: -30px;
    z-index: 100;
    background-color: var(--colors-background-bg-page);
  }

  .parse-result-message {
    position: sticky;
    top: calc(-30px + 58px);
    z-index: 100;
    background-color: var(--colors-background-bg-page);
  }

  :deep(.table-wrapper) {
    overflow: initial;

    .p-datatable-table-container {
      overflow: initial !important;
    }

    .p-datatable-thead {
      // position: sticky;
      // 58 需要减去2个px
      // top: calc(-30px + 56px + var(--message-h));
      z-index: 100;
      background-color: white;
    }
  }
}

.parse-input {
  display: flex;
  gap: 8px;

  .information {
    border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
    border: 1px solid var(--colors-border-border-action);
    box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
    overflow: hidden;

    &-actions {
      display: flex;
      padding: var(--spacing-lg, 8px) var(--spacing-xl, 12px);
      justify-content: space-between;
      align-items: center;
      align-self: stretch;
      border-top: 0.5px solid var(--colors-border-border-overlay, #34393d);
      background: var(--colors-background-bg-overlay, #2c2e30);
    }
  }

  .rules {
    padding: var(--spacing-lg, 8px) var(--spacing-lg, 8px) var(--spacing-lg, 8px) 10px;
    gap: var(--spacing-md, 6px);
    height: 100%;
    border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
    // border: 1px solid var(--colors-border-border-action);
    background: var(--colors-background-bg-overlay, #2c2e30);
    // box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
    position: relative;
    overflow: hidden;

    color: var(--colors-text-text-tertiary, #7c8387);
    font-family: Inter;
    font-size: 13px;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.panel {
  &-title {
    color: var(--colors-text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.footer {
  position: sticky;
  bottom: 0;
  right: 0;
  background-color: var(--colors-background-bg-page);
  width: 100%;
  padding: 12px 0;
  z-index: 10;
}
</style>
