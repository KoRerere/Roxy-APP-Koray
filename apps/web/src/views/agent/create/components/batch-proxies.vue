<script setup lang="tsx">
import { useConfirm } from 'primevue/useconfirm'
import { RxSvgIcon } from '/@/components/rx-icon/'
import RxTag from '/@/components/rx-tag.vue'
import { RxAlert } from '/@/components/rx-alert/'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import { ProxyCheckStatus } from '/@/enums'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { useUserStore } from '/@/stores/user'
import { concurrentControl, getDictMap, parseProxyUrl, setOperationLoading, setRowsLoading, sleep, IPType, ParseMode } from '/@/utils'
import { useCheckProxy } from '/@/views/agent/hooks'
import OutboundIp from '/@/views/agent/list/components/outbound-ip.vue'
import ParseTextarea from './parse-textarea.vue'
import { getColumns } from './columns'
import ShadowDotGrid from '/@/components/shadow-dot-grid.vue'
const emit = defineEmits(['cancel', 'save'])
const confirm = useConfirm()
const { testProxy: checkProxy, batchTestShowToast } = useCheckProxy()
const [showToast, onlyErrorToast] = useResponseToast()
const userStore = useUserStore()

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

const proxiesText = ref('')
const dataList = ref<ProxyItem[]>([])
const isDuplicate = ref(true)
const showMessage = ref(false)
const filterCount = ref(0)

const testStatus = ref<Record<string, ProxyCheckStatus>>({})
const protocolOptions = ref<any[]>([])
const protocolValue = ref()
const parserTypeOptions = computed(() => {
  return [
    { label: $t('Host:Post:User:password'), value: ParseMode.one },
    { label: $t('User:password@Host:Post'), value: ParseMode.two },
  ]
})
const parserType = ref(parserTypeOptions.value[0])
const ipTypeOptions = ref<any[]>([])
const ipType = ref()
const columns = ref(getColumns())

const ipCheckerConfig = reactive<IpCheckerConfig>({
  value: undefined,
  props: {
    name: 'checkChannel',
    options: undefined,
    filter: false,
    size: 'xxs' as any,
    icon: 'base/rx_ic_network' as any,
  },
  onChange() {
    dataList.value.forEach((item: any) => {
      item.checkChannel = ipCheckerConfig.value?.value
      item.checkChannelValue = ipCheckerConfig.value?.label
    })
  },
})

const deleteFailDisabled = computed(() => !(dataList.value.length && dataList.value.some(item => item.checkStatus === ProxyCheckStatus.failure)))

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

  return $t('第 [{miss}] 条代理缺少信息，将不会被保存。', { miss: miss.map(item => item._missIndex).join(', ') })
})

onBeforeMount(async () => {
  const $dict_map = await getDictMap()
  const userConfig = await userStore.getUserConfig()
  ipCheckerConfig.value = $dict_map.checkChannel.find((item: any) => item.value === userConfig!.ipChecker)
  ipCheckerConfig.props.options = $dict_map.checkChannel
  protocolOptions.value = $dict_map.protocol
  protocolValue.value = $dict_map.protocol[0]
  ipTypeOptions.value = $dict_map.ipType
  ipType.value = $dict_map.ipType[0]
})

function parseValue() {
  const list = proxiesText.value.split('\n').map(n => n.replace(/\s/g, '').replace(/：/g, ':')).filter(Boolean)

  if (!list.length) {
    onlyErrorToast(-1, $t('请先输入代理信息'))
    return
  }

  dataList.value = (isDuplicate.value ? [...new Set(list)] : list)
    .map((url, index) => {
      const { protocol: __protocol, host, port, proxyUserName, proxyPassword, refreshUrl, remark } = parseProxyUrl(url, ipType.value.value, parserType.value.value)

      const protocol = __protocol || protocolValue.value.value;

      const _missField = [['protocol', protocol], ['host', host], ['port', port]].filter(item => !item[1])

      return {
        checkChannel: ipCheckerConfig.value?.value,
        checkChannelValue: ipCheckerConfig.value?.label,
        ipType,
        protocol: protocol?.toLocaleUpperCase(),
        host,
        port,
        proxyUserName,
        proxyPassword,
        refreshUrl,
        remark,
        _missField,
        _missIndex: _missField.length ? index + 1 : 0,
        _id: index
      }
    })

  filterCount.value = list.length - dataList.value.length
  showMessage.value = true
  // 重置掉状态
  testStatus.value = {}
}

function messageClose() {
  sleep(300).then(() => {
    showMessage.value = false
  })
}

function tableOperation(data: any) {
  return [
    {
      name: 'refresh',
      label: $t('刷新代理'),
      icon: 'base/rx_ic_refresh',
      quick: true,
      disabled: !data.refreshUrl,
      disabledTooltip: $t('未配置刷新URL'),
    },
    {
      name: 'test',
      label: $t('测试代理'),
      icon: 'base/rx_ic_speed_test',
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
      testProxy(data, operate.name)
      break
    case 'delete':
      deleteProxy(data)
      break
  }
}

async function refreshUrl(data: any, operateName: string) {
  const isOK = await setRowsLoading(data, operateName, () => window.electronAPI.send('proxy:refreshUrl', data.refreshUrl!))
  showToast(isOK ? 0 : -1, data.refreshUrl as string)
}

async function testProxy(data: ProxyItem | ProxyItem[], operateName: string) {
  const tasks = (([] as ProxyItem[]).concat(data)).map((item) => {
    setOperationLoading(item, operateName, true)
    return async () => {
      const checkResult = await checkProxy({ ...toRaw(item), protocol: item.protocol || 'HTTP' })
      Object.assign(item, checkResult)
      testStatus.value[item._id] = checkResult.checkStatus;
      setOperationLoading(item, operateName, false)
      return checkResult
    }
  })

  const results = await concurrentControl(tasks, 5)
  batchTestShowToast(results)
}

async function testAllProxy() {
  if (!dataList.value?.length) {
    onlyErrorToast(-1, $t('暂无代理'))
    return
  }
  await testProxy(dataList.value, 'test')
}

function deleteProxy(data: any) {
  console.log('🚀 ~ deleteProxy ~ data:', data)
}

function deleteFailProxy() {
  const list = dataList.value.filter((item: any) => item.checkStatus !== ProxyCheckStatus.failure)
  confirm.require({
    header: $t('删除失败代理'),
    message: $t('您确认删除所有测速失败的代理吗?共 {count} 个', { count: dataList.value.length - list.length }),
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
    },
  })
}

function onSave() {
  const list = dataList.value.map(item => ({
    ...item,
    checkStatus: item.checkStatus ?? ProxyCheckStatus.failure,
  }))

  if (!list.some(item => item._missIndex)) {
    emit('save', list)
    return
  }

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
    message: $t('第 [{miss}] 条代理缺少信息，将不会被保存，请确认是否继续', { miss: miss.map(item => item._missIndex).join(', ') }),
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('确认'),
      severity: 'info',
    },
    accept: () => {
      emit('save', success)
    },
  })
}
</script>

<template>
  <div class="flex-1 overflow-auto flex-col proxies-content">
    <div class="parse-input">
      <div class="flex flex-1 flex-col gap-6px">
        <div class="panel-title flex justify-between items-center">
          <span>{{ $t('代理信息') }}</span>
          <div class="flex gap-6px">
            <RxInputSelect size="xs" v-model="ipType" :options="ipTypeOptions" name="ipType" :filter="false" />
            <RxInputSelect size="xs" v-model="protocolValue" :options="protocolOptions" name="protocol"
              :filter="false" />
            <RxInputSelect size="xs" v-model="parserType" :options="parserTypeOptions" name="parserType"
              :filter="false" />
          </div>
        </div>
        <div class="information">
          <ParseTextarea v-model="proxiesText" :placeholder="$t('请在此处输入代理信息')" />
          <div class="flex justify-between information-actions">
            <div class="flex items-center gap-2.5">
              <div>
                <RxInputSelect v-model="ipCheckerConfig.value" v-bind="ipCheckerConfig.props"
                  @change="ipCheckerConfig.onChange" />
              </div>
              <div class="flex items-center">
                <Checkbox v-model="isDuplicate" :pt="{ root: 'items-center', box: '!w-4 !h-4' }" input-id="wrap"
                  binary />
                <label for="wrap"
                  class="text-3 select-none mr-1.5 cursor-pointer text-[var(--colors-text-text-secondary)]">{{
                    $t('自动去重') }}</label>
                <RxSvgIcon v-tooltip="{ value: $t('当输入重复代理信息时不做添加'), showDelay: 500, hideDelay: 300 }"
                  name="base/rx_ic_info" color="var(--colors-icon-icon-note)" :size="12" />
              </div>
            </div>
            <RxButton outlined severity="secondary" size="xxs" :label="$t('解析')" icon="base/rx_ic_play"
              @click.stop="parseValue" />
          </div>
        </div>
      </div>
      <div class="flex flex-1 flex-col gap-6px">
        <div class="panel-title h-30px flex items-center">
          {{ $t('导入规则') }}
        </div>
        <div class="rules flex-1">
          <div class="relative z-10">
            <i18n-t
              :keypath="$t('支持 IPv4, IPv6 {br}示例: {br}{example}1. 不填写代理类型时，将默认为HTTP类型{br}2. 仅支持 HTTP, HTTPS, SOCKS5 三种类型代理{br}3. 每一行一个代理，一次最多添加500个代理{br}4. 添加IPV6代理时，请在首部添加 * ，主机部分请用小括号包裹', { br: '{br}', example: '{example}' })"
              scope="global">
              <template #br>
                <br>
              </template>
              <template #example>
                <span class="text-[var(--colors-text-text-primary)]">
                  <i18n-t
                    :keypath="$t('http://192.168.0.1:8000{remark}{br}https://192.168.0.1:8000:用户名:密码{refreshurl}{br}socks5://192.168.0.1:8000{refreshurl}{remark}{br}IPv6:{br}*http://{ipv6}:8000{refreshurl}{remark}{br}{br}', { br: '{br}', refreshurl: '{refreshurl}', remark: '{remark}', ipv6: '{ipv6}' })">
                    <template #br>
                      <br>
                    </template>
                    <template #refreshurl>
                      <span class="text-green">[{{ $t('刷新 URL') }}]</span>
                    </template>
                    <template #remark>
                      <span class="text-blue">{{ `\{${$t('备注')}\}` }}</span>
                    </template>
                    <template #ipv6>
                      <span class="text-orange">(2001:db8:2de:0:0:0:0:e13)</span>
                    </template>
                  </i18n-t>
                </span>
              </template>
            </i18n-t>
          </div>
          <ShadowDotGrid class="z-9" />
        </div>
      </div>
    </div>
    <div class="flex flex-col flex-1">
      <div class="flex items-center justify-between pt-6 pb-3 table-toolbar">
        <div class="panel-title">
          {{ $t('已解析代理') }}
        </div>
        <div class="flex gap-2">
          <RxButton text severity="secondary" size="xxs" :label="$t('删除失败')" icon="base/rx_ic_bin_1"
            :disabled="deleteFailDisabled" @click.stop="deleteFailProxy" />
          <RxButton outlined severity="secondary" size="xxs" :label="$t('测试全部')" icon="base/rx_ic_speed_test"
            :disabled="!dataList?.length" @click.stop="testAllProxy" />
        </div>
      </div>
      <div class="parse-result-message">
        <RxAlert v-model:visible="showMessage" type="success" class="w-full"
          :content="$t('已成功解析 {count} 代理。{filterCount} 重复代理已过滤。', { count: dataList.length, filterCount }) + missMessage"
          closable @close="messageClose">
        </RxAlert>
        <div v-if="showMessage" class="h-[10px] w-full bg-[var(--colors-background-bg-page)]"></div>
      </div>
      <RyTable :style="{ '--message-h': showMessage ? '52px' : '0px' }" :columns="columns" :data-list="dataList"
        :table-operation="tableOperation" :paginator="false" :show-table-header="false" :show-actions="false">
        <template #table-empty>
          <CustomEmpty icon="rx_illustration_star.svg" :title="$t('暂未添加代理')" />
        </template>
        <template #outbound="{ data }">
          <OutboundIp :country="data.lastCountry" :city="data.lastCity" :last-ip="data.lastIp" :time="data.checkTime"
            :status="testStatus[data._id]" :is-loading="data.loadingOperationMap?.test" />
        </template>
        <template #actions="{ data }">
          <Actions :loading-operation-map="data.loadingOperationMap" :operation="tableOperation(data)"
            :show-menu="false" @quick-click="operationHandler($event, data)" />
        </template>
      </RyTable>
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
      position: sticky;
      top: calc(-30px + 58px + var(--message-h));
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
      border-top: 0.5px solid var(--colors-border-border-overlay, #34393D);
      background: var(--colors-background-bg-overlay, #2C2E30);
    }
  }

  .rules {
    padding: var(--spacing-lg, 8px) var(--spacing-lg, 8px) var(--spacing-lg, 8px) 10px;
    gap: var(--spacing-md, 6px);
    height: 100%;
    border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
    // border: 1px solid var(--colors-border-border-action);
    background: var(--colors-background-bg-overlay, #2C2E30);
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
