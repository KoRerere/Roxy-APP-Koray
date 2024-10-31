<script setup lang="tsx">
import { useConfirm } from 'primevue/useconfirm'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { ProxyCheckStatus } from '/@/enums'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { parseProxyUrl, setRowsLoading, sleep } from '/@/utils'
import { useCheckProxy } from '/@/views/agent/hooks'
import OutboundIp from '/@/views/agent/list/components/outbound-ip.vue'
import ParseTextarea from './parse-textarea.vue'

const emit = defineEmits(['cancel', 'save'])
const confirm = useConfirm()
const [checkProxy] = useCheckProxy()
const [showToast, onlyErrorToast] = useResponseToast()

const proxiesText = ref('')
const dataList: any = ref([])
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
    title: $t('出口 IP'),
    render: ({ data }: any) => {
      return (
        data.checkTime
          ? <OutboundIp image={data.region} country={data.lastCountry} city={data.lastCity} lastIp={data.lastIp} time={data.checkTime} />
          : <div>未检测</div>
      )
    },
  },
  {
    title: $t('操作'),
    slot: 'actions',
  },
])

function parseValue() {
  const list = proxiesText.value.split('\n').map(n => n.trim()).filter(Boolean)

  if (!list.length) {
    onlyErrorToast(-1, $t('请先输入代理信息'))
    return
  }

  dataList.value = (isDuplicate.value ? [...new Set(list)] : list)
    .map((url) => {
      const ipType = url.startsWith('*') ? 'IPV6' : 'IPV4'
      const { protocol, host, port, proxyUserName, proxyPassword, refreshUrl, remark } = parseProxyUrl(url)

      return {
        checkStatus: ProxyCheckStatus.failure,
        ipType,
        protocol: protocol?.toLocaleUpperCase(),
        host,
        port,
        proxyUserName,
        proxyPassword,
        refreshUrl,
        remark,
        _validator: [['protocol', protocol], ['host', host], ['port', port]].filter(item => !item[1]),
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
      disabledTips: $t('未配置刷新URL'),
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

function testProxy(data: any, operateName: string) {
  const datas = [].concat(data)
  for (const item of datas) {
    setRowsLoading(item, operateName, () => checkProxy(toRaw(item)))
      .then((checkResult) => {
        Object.assign(item, toRaw(checkResult))
      })
  }
}

function deleteProxy(data: any) {
  console.log('🚀 ~ deleteProxy ~ data:', data)
}

function testAllProxy() {
  if (!dataList.value?.length) {
    onlyErrorToast(-1, $t('暂无代理'))
    return
  }
  testProxy(dataList.value, 'test')
}

function deleteFailProxy() {
  confirm.require({
    header: $t('删除失败代理'),
    message: $t('您确认删除所有测速失败的代理吗?共 {count} 个', { count: -1 }),
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
      dataList.value = dataList.value.filter((item: any) => item.checkStatus !== ProxyCheckStatus.failure)
    },
  })
}

function onSave() {
  const index = dataList.value.findIndex((item: any) => item._validator.length)

  if (index > -1) {
    const { _validator } = dataList.value[index]
    const key = columns.value.find(item => item.key === _validator[0][0])?.title

    onlyErrorToast(-1, $t('代理[{index}] {key} 缺失', { index: index + 1, key }))
    return
  }

  emit('save', dataList.value)
}
</script>

<template>
  <div class="flex-ovh-1 flex-col proxies-content">
    <div class="parse-input">
      <div class="flex flex-1 flex-col gap-1">
        <div class="panel-title">
          {{ $t('代理信息') }}
        </div>
        <div class="information">
          <ParseTextarea v-model="proxiesText" />
          <div class="flex justify-between information-actions">
            <div class="flex items-center">
              <Checkbox v-model="isDuplicate" :pt="{ box: '!w-4 !h-4' }" input-id="wrap" binary />
              <label for="wrap" class="text-3 select-none mx-1.5 cursor-pointer">{{ $t('自动去重') }}</label>
              <RxSvgIcon v-tooltip="$t('当输入重复代理信息时不做添加')" name="base/rx_ic_info" :size="12" />
            </div>
            <RxButton outlined severity="secondary" size="xxs" :label="$t('解析')" icon="base/rx_ic_play" @click="parseValue" />
          </div>
        </div>
      </div>
      <div class="flex flex-1 flex-col gap-1">
        <div class="panel-title">
          {{ $t('导入规则') }}
        </div>
        <div class="rules">
          <i18n-t
            :keypath="$t('支持 IPv4, IPv6 {br}示例: {br}http://192.168.0.1:8000{remark}{br}https://192.168.0.1:8000:用户名:密码{refreshurl}{br}socks5://192.168.0.1:8000{refreshurl}{remark}{br}*http://2001:db8:2de:0:0:0:0:e13:8000{refreshurl}{remark}{br}{br}1. 不填写代理类型时，将默认为HTTP类型{br}2. 仅支持 HTTP, HTTPS, SOCKS5 三种类型代理{br}3. 每一行一个代理，一次最多添加500个代理{br}4. 添加IPV6代理时，请在首部添加 *', { br: '{br}', refreshurl: '{refreshurl}', remark: '{remark}' })"
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
          </i18n-t>
        </div>
      </div>
    </div>
    <div class="flex flex-col flex-1 overflow-hidden mt-6">
      <div class="flex items-center justify-between mb-3">
        <div class="panel-title">
          {{ $t('已解析代理') }}
        </div>
        <div class="flex gap-2">
          <RxButton text severity="secondary" size="xxs" :label="$t('删除失败')" icon="base/rx_ic_bin_1" :disabled="!dataList?.length" @click="deleteFailProxy" />
          <RxButton outlined severity="secondary" size="xxs" :label="$t('测试全部')" icon="base/rx_ic_speed_test" @click="testAllProxy" />
        </div>
      </div>
      <Message v-if="showMessage" class="mb-3" severity="success" icon="pi pi-check-circle" closable @close="messageClose">
        {{ $t('已成功解析 {count} 代理。{filterCount} 重复代理已过滤', { count: dataList.length, filterCount }) }}
      </Message>
      <div class="flex-ovh-1 items-center justify-center">
        <RyTable :columns="columns" :data-list="dataList" :table-operation="tableOperation" :paginator="false" :show-table-header="false" :show-actions="false">
          <template #actions="{ data }">
            <Actions :loading-operation-map="data.loadingOperationMap" :operation="tableOperation(data)" :show-menu="false" @quick-click="operationHandler($event, data)" />
          </template>
        </RyTable>
      </div>
    </div>
    <div class="flex justify-end">
      <RxButton severity="info" :label="$t('保存')" :disabled="!dataList?.length" @click="onSave" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.proxies-content {
  padding: 20px 24px 16px;
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
    font-size: 12px;
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
</style>
