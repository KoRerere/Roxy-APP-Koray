import { useToast } from 'primevue/usetoast'
import { findInputByName, isEmptyValue, parseProxyUrl, setInputValueByFormData } from '/@/utils'

export function getInputs(data: any = {}) {
  const toast = useToast()

  const $dict_map = new Proxy(JSON.parse(localStorage.getItem('$dict_map') ?? '{}'), {
    get(target, key) {
      return target[key] || [] // 简易兜底处理，后续优化获取字典逻辑
    },
  })

  const proxyCategory = data.proxyCategory || data.protocol

  const inputs = reactive([
    {
      type: 'textarea',
      label: '智能检测',
      name: 'proxyRules',
      value: '',
      placeholder: 'Paste proxy rules like:\nHost:Port:Username:Password[RefreshURL]',
      rows: 5,
      errorMsg: '解析内容有误',
      tooltip: 'man!',
      invalid: false,
      onBlur: () => {
        const input = inputs.find((item: any) => item.name === 'proxyRules')

        if (input && input.value.trim()) {
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
        }
      },
    },
    {
      separator: true,
    },
    {
      type: 'radio',
      label: '网络协议',
      name: 'ipType',
      value: data.ipType || $dict_map.ipType[0]?.value,
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
          value: !proxyCategory || proxyCategory === 'noproxy' ? $dict_map.protocol[0]?.value : proxyCategory,
          options: $dict_map.protocol,
          formatValue: (input: any, _inputs: any, formData: any) => {
            Object.assign(formData, { protocol: input.value })
            return input.value
          },
        },
        {
          type: 'text',
          name: 'host',
          value: data.host ?? '',
          placeholder: 'host',
          required: true,
        },
        { separator: true },
        {
          type: 'number',
          name: 'port',
          value: data.port ?? '',
          placeholder: 'port',
          required: true,
          onblur: () => {
            // const formData = getFormData(inputs.value)
            // const result = z.number().min(0).max(65535).safeParse(formData.port)
            // if (result.error) {
            //   setInputFieldByInputKey(inputs.value, 'port', 'errorMsg', 'between 0~65535')
            // }
            // else {
            //   port.value = formData.port
            //   updateApiKeys()
            // }
          },
        },
      ],
      tooltip: 'what can i say',
      slot: 'server',
    },
    {
      type: 'text',
      label: '代理账号',
      name: 'proxyUserName',
      value: data.proxyUserName ?? '',
      placeholder: 'Username for your server',
    },
    {
      type: 'password',
      label: '代理密码',
      name: 'proxyPassword',
      value: data.proxyPassword ?? '',
      placeholder: 'Password for your server',
    },
    {
      type: 'text',
      label: '刷新URL',
      name: 'refreshUrl',
      value: data.refreshUrl ?? '',
      placeholder: 'Please enter a valid URL',
      tooltip: 'mamba out!',
      icon: 'base/rx_ic_refresh',
      iconClick: async () => {
        const input = findInputByName(inputs, 'refreshUrl')
        if (input.value) {
          const isOK = await window.electronAPI.send('proxy:refreshUrl', input.value)
          toast.add({ severity: isOK ? 'success' : 'error', summary: isOK ? 'Success' : 'Failure', detail: input.value, life: 5000 })
        }
      },
    },
  ])
  return inputs
}
