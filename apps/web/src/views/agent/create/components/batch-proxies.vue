<script setup lang="tsx">
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { ProxyCheckStatus } from '/@/enums'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { parseProxyUrl, setRowsLoading, sleep } from '/@/utils'
import { useCheckProxy } from '/@/views/agent/hooks'
import OutboundIp from '/@/views/agent/list/components/outbound-ip.vue'
import ParseTextarea from './parse-textarea.vue'

const emit = defineEmits(['cancel', 'save'])
const toast = useToast()
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
    title: $t('Protocol'),
    getText: (data: any) => data.protocol || '--',
  },
  {
    key: 'host',
    title: $t('Host'),
    getText: (data: any) => data.host || '--',
  },
  {
    key: 'port',
    title: $t('Port'),
    getText: (data: any) => data.port || '--',
  },
  {
    key: 'proxyUserName',
    title: $t('Username'),
    getText: (data: any) => data.proxyUserName || '--',
  },
  {
    key: 'proxyPassword',
    title: $t('Password'),
    getText: (data: any) => data.proxyPassword || '--',
  },
  {
    key: 'refreshUrl',
    title: $t('Refreshing URL'),
    width: 100,
    getText: (data: any) => data.refreshUrl || '--',
  },
  {
    key: 'remark',
    title: $t('Notes'),
    width: 100,
    getText: (data: any) => data.remark || '--',
  },
  {
    title: $t('Outbound IP'),
    render: ({ data }: any) => {
      return (
        data.checkTime
          ? <OutboundIp image={data.region} country={data.lastCountry} city={data.lastCity} time={data.checkTime} />
          : <div>未检测</div>
      )
    },
  },
])

function parseValue() {
  const list = proxiesText.value.split('\n').map(n => n.trim()).filter(Boolean)

  if (!list.length) {
    toast.add({ severity: 'warn', summary: $t('warn'), detail: $t('The parsing content cannot be empty'), life: 5000, group: 'tc' })
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
      label: $t('Refresh'),
      icon: 'base/rx_ic_refresh',
      quick: true,
      disabled: !data.refreshUrl,
      disabledTips: $t('Missing refresh url'),
    },
    {
      name: 'test',
      label: $t('Test'),
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

function testAll() {
  testProxy(dataList.value, 'test')
}

function deleteFailProxy() {
  confirm.require({
    header: $t('warn'),
    message: '确定删除所有测速失败的代理?',
    rejectProps: {
      label: $t('Cancel'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('Confirm'),
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
    onlyErrorToast(-1, $t('proxies[{index}] {key} missing', { index: index + 1, key: _validator[0][0] }))
    return
  }

  emit('save', dataList.value)
}
</script>

<template>
  <div class="flex-ovh-1 flex-col proxies-content">
    <div class="parse-input">
      <div class="panel">
        <div class="panel-title">
          Proxies information
        </div>
        <div class="information">
          <ParseTextarea v-model="proxiesText" />
          <div class="flex justify-between information-actions">
            <div class="flex items-center">
              <Checkbox v-model="isDuplicate" input-id="wrap" binary />
              <label for="wrap" class="select-none mx-2 cursor-pointer">Filter duplicates</label>
              <RxSvgIcon name="base/rx_ic_info_line" :size="14" />
            </div>
            <RxButton outlined severity="secondary" size="sm" label="Parse proxies" icon="base/rx_ic_play" @click="parseValue" />
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-title">
          Import rules
        </div>
        <div class="rules">
          Allowed formats (IPv4, IPv6 supported):<br><br>
          192.168.0.1:8000<span class="text-blue">{Remark}</span><br>
          192.168.0.1:8000:username:password<span class="text-blue">{Remark}</span><br>
          socks5://192.168.0.1:8000<span class="text-green">[Refresh IP URL]</span><span class="text-blue">{Remark}</span><br>
          http://[2001:db8:2de:0:0:0:0:e13]:8000<span class="text-green">[Refresh IP URL]</span><span class="text-blue">{Remark}</span><br><br>
          1. If you do not fill in the proxy type, it will default to HTTP<br>
          2. Only support HTTP, HTTPS, SOCKS5<br>
          3. One proxy per line, add up to 500 proxies at a time<br>
          4. Host support IPv4 and IPv6, if IPv6 host should be filled in []
        </div>
      </div>
    </div>
    <div class="flex flex-col flex-1 overflow-hidden">
      <div class="flex items-center justify-between">
        <div>Parsed proxies</div>
        <div class="flex gap-2">
          <RxButton severity="secondary" text size="sm" label="Delete fail" icon="base/rx_ic_bin_1" :disabled="!dataList?.length" @click="deleteFailProxy" />
          <RxButton severity="secondary" size="sm" label="Test all proxies" icon="base/rx_ic_speed_test" @click="testAll" />
        </div>
      </div>
      <Message v-if="showMessage" severity="success" icon="pi pi-check-circle" closable @close="messageClose">
        {{ dataList.length }} proxies are successfully parsed. {{ filterCount }} proxies has been filtered.
      </Message>
      <div class="flex-ovh-1 items-center justify-center">
        <RyTable :columns="columns" :data-list="dataList" :table-operation="tableOperation" :paginator="false" :show-table-header="false">
          <template #actions="{ data }">
            <Actions :loading-operation-map="data.loadingOperationMap" :operation="tableOperation(data)" :show-menu="false" @quick-click="operationHandler($event, data)" />
          </template>
        </RyTable>
      </div>
    </div>
    <div class="flex justify-between">
      <RxButton severity="secondary" text size="sm" label="Cancel" @click="$emit('cancel')" />
      <RxButton severity="info" size="sm" label="Save proxies" :disabled="!dataList?.length" @click="onSave" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.proxies-content {
  padding: 24px 24px 16px;
}

.parse-input {
  display: flex;
  gap: 8px;

  .panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 4px);

    &-title {
      color: var(--Component-Colors-TextInput-label-label, #171c1f);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 500;
      line-height: var(--Line-Height-text-lg, 20px);
    }
  }

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
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.empty {
  gap: var(--spacing-lg, 8px);
  width: var(--width-sm, 480px);
  height: 160px;
  flex-shrink: 0;
  border-radius: var(--radius-2xl, 12px);
  border: 0.5px solid var(--Colors-Border-border-subtle, #e4e8eb);

  color: #000;
  text-align: center;
  font-family: Inter;
  font-size: 13px;
  font-style: normal;
  font-weight: 600;
  line-height: 16px;

  span {
    color: var(--Colors-Text-text-secondary, #575d61);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;
  }
}
</style>
