<script setup lang="ts">
import { format } from 'date-fns'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { parseProxyUrl } from './hooks'
import parseTextarea from './parse-textarea.vue'

import { ProxyCheckStatus } from '/@/enums'
import { setRowsLoading, sleep } from '/@/utils'

import outboundIp from '/@/views/agent/list/components/outbound-ip.vue'

const emit = defineEmits(['cancel', 'save'])
const toast = useToast()
const confirm = useConfirm()

// ===============================================

const proxiesText = ref('')
const dataList: any = ref([])
const errorList: any = ref([])
const isDuplicate = ref(true)
const showMessage = ref(false)
const columns = ref([
  {
    key: 'id',
    title: 'ID',
  },
  {
    key: 'host',
    title: 'Host',
  },
  {
    key: 'port',
    title: 'Port',
  },
  {
    key: 'proxyUserName',
    title: 'Username',
  },
  {
    key: 'proxyPassword',
    title: 'Password',
  },
  {
    key: 'refreshUrl',
    title: 'Refreshing URL',
    width: 100,
  },
  {
    key: 'remark',
    title: 'Notes',
    width: 100,
  },
  {
    title: 'Outbound IP',
    slot: 'outbound',
  },
])

function parseValue() {
  const list = proxiesText.value.split('\n').map(n => n.trim()).filter(Boolean)

  if (!list.length) {
    toast.add({ severity: 'warn', summary: '警告', detail: '解析内容不能为空', life: 5000, group: 'tc' })
    return
  }

  const errorLine: number[] = []
  dataList.value = (isDuplicate.value ? [...new Set(list)] : list)
    .map((url, index) => {
      const ipType = url.startsWith('*') ? 'IPV6' : 'IPV4'
      const { protocol, host, port, proxyUserName, proxyPassword, refreshUrl, remark } = parseProxyUrl(url)

      if (!host || !port) {
        errorLine.push(index + 1)
      }

      return {
        ipType,
        protocol,
        host,
        port,
        proxyUserName,
        proxyPassword,
        refreshUrl,
        remark,
      }
    })
  errorList.value = errorLine
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
      label: '刷新',
      icon: 'mdi mdi-refresh',
      quick: true,
      disabled: !data.refreshUrl,
      disabledTips: '缺少刷新地址',
    },
    {
      name: 'test',
      label: '测速',
      icon: 'mdi mdi-wifi',
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
  }
}

async function refreshUrl(data: any, operateName: string) {
  const isOK = await setRowsLoading(data, operateName, () => window.electronAPI.send('proxy:refreshUrl', data.refreshUrl!))
  toast.add({ severity: isOK ? 'success' : 'error', summary: isOK ? 'Success' : 'Failure', detail: data.refreshUrl, life: 5000 })
}

async function testProxy(data: any, operateName: string) {
  const datas = [].concat(data)
  datas.forEach((item: any) => {
    setRowsLoading(item, operateName, () => window.electronAPI.send('proxy:detection', toRaw(item)))
      .then(async (checkRes) => {
        item.checkStatus = checkRes.error ? ProxyCheckStatus.failure : ProxyCheckStatus.success
        item.lastIp = checkRes.ip ?? ''
        item.lastCity = checkRes.city ?? ''
        item.lastCountry = checkRes.continent_code ?? ''
        item.checkTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss')
      })
  })
}

function testAll() {
  testProxy(dataList.value, 'test')
}

function deleteFailProxy() {
  confirm.require({
    header: '警告',
    message: '确定删除所有测速失败的代理?',
    rejectProps: {
      label: '取消',
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: '确定',
      severity: 'danger',
    },
    accept: () => {
      dataList.value = dataList.value.filter((item: any) => item.checkStatus === ProxyCheckStatus.failure)
    },
  })
}

function save() {
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
          <parseTextarea v-model="proxiesText" />
          <div class="flex justify-between information-actions">
            <div class="flex items-center">
              <Checkbox v-model="isDuplicate" input-id="wrap" binary />
              <label for="wrap" class="select-none ml-2 cursor-pointer">Filter duplicates</label>
              <span class="mdi mdi-information-outline" />
            </div>
            <ryButton outlined severity="secondary" size="small" label="Parse proxies" icon="base/rx_ic_play"
              @click="parseValue" />
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
          socks5://192.168.0.1:8000<span class="text-green">[Refresh IP URL]</span><span
            class="text-blue">{Remark}</span><br>
          http://[2001:db8:2de:0:0:0:0:e13]:8000<span class="text-green">[Refresh IP URL]</span><span
            class="text-blue">{Remark}</span><br><br>
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
          <ryButton severity="secondary" text size="small" label="Delete fail" icon="base/rx_ic_bin_1"
            :disabled="!dataList?.length" @click="deleteFailProxy" />
          <ryButton severity="secondary" size="small" label="Test all proxies" icon="base/rx_ic_speed_test"
            @click="testAll" />
        </div>
      </div>
      <Message v-if="showMessage" severity="success" icon="pi pi-check-circle" closable @close="messageClose">
        {{ dataList.length }} proxies are successfully parsed. {{ errorList.length }} proxies has been filtered.
      </Message>
      <div class="flex-ovh-1 items-center justify-center">
        <ry-table :columns="columns" :data-list="dataList" :table-operation="tableOperation" :paginator="false"
          :show-table-header="false">
          <template #outbound="{ data }">
            <outboundIp v-if="data.checkTime" :image="data.region" :country="data.lastCountry" :time="data.checkTime" />
            <div v-else>
              未检测
            </div>
          </template>
          <template #actions="{ data, operation }">
            <actions :loading-operation-map="data.loadingOperationMap" :operation="operation" :show-menu="false"
              @quick-click="(operate) => operationHandler(operate, data)" />
          </template>
        </ry-table>
      </div>
    </div>
    <div class="flex justify-between">
      <ryButton severity="secondary" text size="small" label="Cancel" @click="$emit('cancel')" />
      <ryButton severity="info" size="small" label="Save proxies" @click="save" />
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
