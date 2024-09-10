<script lang="ts" setup>
import { useDebounceFn } from '@vueuse/core'
import { format } from 'date-fns'
import { useToast } from 'primevue/usetoast'
import { parseProxyUrl } from './utils'
import ryForm from '/@/components/ry-form'
import { ProxyCheckStatus } from '/@/enums'
import { getFormData, isEmptyValue, setInputValueByFormData } from '/@/utils'

const emit = defineEmits(['cancel', 'save'])

const toast = useToast()

const formInputs: any = ref(getInputs())
const checkeResult = ref({
  checkStatus: ProxyCheckStatus.failure,
  lastIp: '',
  lastCity: '',
  lastCountry: '',
  checkTime: '',
})

function getInputs(data: any = {}) {
  const $dict_map = JSON.parse(localStorage.getItem('$dict_map') ?? '{}')
  const inputs = reactive([
    {
      type: 'textarea',
      label: '智能检测',
      name: 'proxyRules',
      value: '',
      placeholder: 'Paste proxy rules like:\nhost:port:user:password:refreshingURL',
      rows: 5,
      errorMsg: '解析内容有误',
      tooltip: 'man!',
      change: useDebounceFn((input: any) => {
        input.invalid = false
        const ipType = input.value?.startsWith('*') ? 'IPV6' : 'IPV4'
        const { protocol, host, port, proxyUserName, proxyPassword, refreshUrl } = parseProxyUrl(input.value)
        const formData = {
          proxyCategory: protocol?.toLocaleUpperCase(),
          host,
          port,
          proxyUserName,
          proxyPassword,
          refreshUrl,
        }

        if (isEmptyValue(Object.values(formData).filter(Boolean))) {
          input.invalid = true
        }
        else {
          setInputValueByFormData(inputs, { ipType, ...formData })
        }
        input.value = undefined
      }, 500),
    },
    {
      separator: true,
    },
    {
      type: 'radio',
      label: '网络协议',
      name: 'ipType',
      value: data.ipType || $dict_map.ipType[0].value,
      options: $dict_map.ipType,
      tooltip: 'what can i say',
    },
    {
      label: 'Server',
      items: [
        {
          type: 'select',
          name: 'proxyCategory',
          placeholder: '请选择网络协议',
          value: !data.proxyCategory || data.proxyCategory === 'noproxy' ? $dict_map.protocol[0].value : data.proxyCategory,
          options: $dict_map.protocol,
        },
        {
          type: 'text',
          name: 'host',
          value: data.host || '',
          placeholder: '代理主机',
        },
        {
          type: 'text',
          name: 'port',
          value: data.port || '',
          placeholder: '代理端口',
        },
      ],
      tooltip: 'what can i say',
      slot: 'server',
    },
    {
      type: 'text',
      label: '代理账号',
      name: 'proxyUserName',
      value: data.proxyUserName || '',
      placeholder: 'Username for your server',
    },
    {
      type: 'password',
      label: '代理密码',
      name: 'proxyPassword',
      value: data.proxyPassword || '',
      placeholder: 'Password for your server',
    },
    {
      type: 'text',
      label: '刷新URL',
      name: 'refreshUrl',
      value: data.refreshUrl || '',
      placeholder: 'Please enter a valid URL',
      tooltip: 'mamba out!',
      icon: 'mdi mdi-refresh',
      iconClick: async () => {
        const { refreshUrl } = getFormData(formInputs.value)
        const isOK = await window.electronAPI.send('proxy:refreshUrl', refreshUrl!)
        toast.add({ severity: isOK ? 'success' : 'error', summary: isOK ? 'Success' : 'Failure', detail: refreshUrl, life: 5000 })
      },
    },
  ])
  return inputs
}
const loading = ref(false)

async function testProxy() {
  const data = getFormData(formInputs.value)

  loading.value = true
  window.electronAPI.send('proxy:detection', toRaw(data)).then(async (checkRes) => {
    loading.value = false

    if (!checkRes.ip) {
      toast.add({ severity: 'error', summary: 'Errors occur', detail: 'Please checkout your IP configuration and local network then try again.', life: 5000 })
    }
    else {
      toast.add({ severity: 'success', summary: 'Proxy test success', detail: `Location: ${checkRes.continent_code}/${checkRes.country}\nIP: ${checkRes.ip}`, life: 5000 })
    }

    checkeResult.value = {
      checkStatus: !checkRes.ip ? ProxyCheckStatus.failure : ProxyCheckStatus.success,
      lastIp: checkRes.ip ?? '',
      lastCity: checkRes.city ?? '',
      lastCountry: checkRes.continent_code ?? '',
      checkTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    }
  })
}

function save() {
  const formData = getFormData(formInputs.value)
  emit('save', [{
    ...checkeResult.value,
    ...formData,
    protocol: formData.proxyCategory, // 兼容新版接口字段名 protocol
  }])
}
</script>

<template>
  <div class="flex items-center flex-col w-50% mx-auto">
    <ry-form :inputs="formInputs">
      <template #server="{ input }">
        <InputGroup>
          <template v-for="(item, index) in input.items" :key="index">
            <Select v-if="item.type === 'select'" v-bind="item" v-model="item.value" option-label="label"
              option-value="value" show-clear />
            <InputText v-else v-bind="item" v-model="item.value" type="text" />
          </template>
        </InputGroup>
      </template>
    </ry-form>
    <div class="flex flex-1 items-end justify-end w-full gap-3">
      <Button class="mx-auto ml-0" severity="secondary" :loading="loading" label="Test proxies" icon="mdi mdi-wifi"
        @click="testProxy" />
      <ryButton text severity="secondary" label="Cancel" @click="$emit('cancel')" />
      <ryButton severity="info" label="Save proxies" @click="save" />
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
