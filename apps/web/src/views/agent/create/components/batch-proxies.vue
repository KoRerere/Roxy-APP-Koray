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
import { concurrentControl, getDictMap, parseProxyUrl, setOperationLoading, setRowsLoading, sleep } from '/@/utils'
import { useCheckProxy } from '/@/views/agent/hooks'
import OutboundIp from '/@/views/agent/list/components/outbound-ip.vue'
import ParseTextarea from './parse-textarea.vue'

const emit = defineEmits(['cancel', 'save'])
const confirm = useConfirm()
const [checkProxy] = useCheckProxy()
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

const columns = ref([
  {
    key: 'protocol',
    title: $t('代理类型'),
    getText: (data: any) => data.protocol || '--',
  },
  {
    key: 'host',
    title: $t('主机'),
    getText: (data: any) => data.host || '--',
  },
  {
    key: 'port',
    title: $t('端口'),
    getText: (data: any) => data.port || '--',
  },
  {
    key: 'proxyUserName',
    title: $t('用户名'),
    getText: (data: any) => data.proxyUserName || '--',
  },
  {
    key: 'proxyPassword',
    title: $t('密码'),
    getText: (data: any) => data.proxyPassword || '--',
  },
  {
    key: 'refreshUrl',
    title: $t('刷新 URL'),
    width: 100,
    getText: (data: any) => data.refreshUrl || '--',
  },
  {
    key: 'remark',
    title: $t('备注'),
    width: 100,
    getText: (data: any) => data.remark || '--',
  },
  {
    title: $t('IP 查询渠道'),
    key: 'ipChecker',
    render: ({ data }: any) => {
      return (
        <RxTag icon="base/rx_ic_network" label={data.checkChannelValue} disabled={true}></RxTag>
      )
    },
  },
  {
    title: $t('出口 IP'),
    render: ({ data }: any) => {
      return (
        data.checkTime
          ? <OutboundIp country={data.lastCountry} city={data.lastCity} lastIp={data.lastIp} time={data.checkTime} />
          : <div class="text-3">{$t('未检测')}</div>
      )
    },
  },
  {
    title: $t('操作'),
    slot: 'actions',
  },
])

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
})

function parseValue() {
  const list = proxiesText.value.split('\n').map(n => n.replace(/\s/g, '').replace(/：/g, ':')).filter(Boolean)

  if (!list.length) {
    onlyErrorToast(-1, $t('请先输入代理信息'))
    return
  }

  dataList.value = (isDuplicate.value ? [...new Set(list)] : list)
    .map((url, index) => {
      const ipType = url.startsWith('*') ? 'IPV6' : 'IPV4'
      const { protocol = 'http', host, port, proxyUserName, proxyPassword, refreshUrl, remark } = parseProxyUrl(url)

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
      }
    })

  filterCount.value = list.length - dataList.value.length
  showMessage.value = true
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
      setOperationLoading(item, operateName, false)
    }
  })

  await concurrentControl(tasks, 5)
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
      <div class="flex flex-1 flex-col gap-1">
        <div class="panel-title">
          {{ $t('代理信息') }}
        </div>
        <div class="information">
          <ParseTextarea v-model="proxiesText" />
          <div class="flex justify-between information-actions">
            <div class="flex items-center gap-2.5">
              <div>
                <RxInputSelect v-model="ipCheckerConfig.value" v-bind="ipCheckerConfig.props"
                  @change="ipCheckerConfig.onChange" />
              </div>
              <div class="flex items-center">
                <Checkbox v-model="isDuplicate" :pt="{ root: 'items-center', box: '!w-4 !h-4' }" input-id="wrap"
                  binary />
                <label for="wrap" class="text-3 select-none mr-1.5 cursor-pointer">{{ $t('自动去重') }}</label>
                <RxSvgIcon v-tooltip="{ value: $t('当输入重复代理信息时不做添加'), showDelay: 500, hideDelay: 300 }"
                  name="base/rx_ic_info" :size="12" />
              </div>
            </div>
            <RxButton outlined severity="secondary" size="xxs" :label="$t('解析')" icon="base/rx_ic_play"
              @click.stop="parseValue" />
          </div>
        </div>
      </div>
      <div class="flex flex-1 flex-col gap-1">
        <div class="panel-title">
          {{ $t('导入规则') }}
        </div>
        <div class="rules">
          <i18n-t
            :keypath="$t('支持 IPv4, IPv6 {br}示例: {br}http://192.168.0.1:8000{remark}{br}https://192.168.0.1:8000:用户名:密码{refreshurl}{br}socks5://192.168.0.1:8000{refreshurl}{remark}{br}IPv6:{br}*http://{ipv6}:8000{refreshurl}{remark}{br}{br}1. 不填写代理类型时，将默认为HTTP类型{br}2. 仅支持 HTTP, HTTPS, SOCKS5 三种类型代理{br}3. 每一行一个代理，一次最多添加500个代理{br}4. 添加IPV6代理时，请在首部添加 * ，主机部分请用小括号包裹', { br: '{br}', refreshurl: '{refreshurl}', remark: '{remark}', ipv6: '{ipv6}' })"
            scope="global">
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
        <div v-if="showMessage" class="h-[10px] w-full bg-white"></div>
      </div>
      <RyTable :style="{ '--message-h': showMessage ? '52px' : '0px' }" :columns="columns" :data-list="dataList"
        :table-operation="tableOperation" :paginator="false" :show-table-header="false" :show-actions="false">
        <template #table-empty>
          <CustomEmpty icon="rx_illustration_star.svg" :title="$t('暂未添加代理')" />
        </template>
        <template #actions="{ data }">
          <Actions :loading-operation-map="data.loadingOperationMap" :operation="tableOperation(data)"
            :show-menu="false" @quick-click="operationHandler($event, data)" />
        </template>
      </RyTable>
    </div>
    <div class="flex justify-end footer">
      <RxButton severity="info" :label="$t('保存')" :disabled="!dataList?.length" @click.stop="onSave" />
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
    background-color: white;
  }

  .parse-result-message {
    position: sticky;
    top: calc(-30px + 58px);
    z-index: 100;
    background-color: white;
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
    border: 1px solid var(--Colors-Border-border-inactive, #e4e8eb);
    box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
    overflow: hidden;

    &-actions {
      display: flex;
      padding: var(--spacing-lg, 8px) var(--spacing-xl, 12px);
      justify-content: space-between;
      align-items: center;
      align-self: stretch;
      border-top: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
    }
  }

  .rules {
    padding: var(--spacing-lg, 8px) var(--spacing-lg, 8px) var(--spacing-lg, 8px) 10px;
    gap: var(--spacing-md, 6px);
    height: 100%;
    border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
    border: 1px solid var(--Colors-Border-border-inactive, #e4e8eb);
    background: var(--Color-neutrals-50, #fafbfc);
    box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);

    color: var(--Component-Colors-TextInput-text-text-placeholder, #7c8387);
    font-family: Inter;
    font-size: 13px;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.panel {
  &-title {
    color: var(--Component-Colors-TextInput-label-label, #171c1f);
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
  background-color: white;
  width: 100%;
  padding: 12px 0;
  z-index: 10;
}
</style>
