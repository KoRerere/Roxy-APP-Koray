import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { useUserStore } from '/@/stores/user'
import { findInputByName, getDictMap, isEmptyValue, parseProxyUrl, setInputValue, setInputValueByFormData } from '/@/utils'

const userStore = useUserStore()

export async function getInputs(data: any = {}) {
  const [showToast] = useResponseToast()

  const userConfig = await userStore.getUserConfig()
  const $dict_map = await getDictMap()

  const proxyCategory: string = data.proxyCategory || data.protocol

  const inputs = reactive([
    {
      type: 'textarea',
      label: $t('智能识别'),
      // placeholder: `${$t('请按以下格式输入代理信息')}:\n${$t('代理主机:端口:用户名:密码[刷新URL]')}\n192.168.0.1:8000:username:password[http://www.example.com]`,
      placeholder: $t('代理主机:端口:用户名:密码[刷新URL]'),
      name: 'proxyRules',
      rows: 2,
      errorMsg: $t('解析错误，请检查格式'),
      invalid: false,
      size: 'md',
      onBlur: () => {
        const input = inputs.find((item: any) => item.name === 'proxyRules')
        const value = input?.value?.trim()

        if (value) {
          input!.invalid = false
          const ipType = value.startsWith('*') ? 'IPV6' : 'IPV4'
          const { protocol, host, port, proxyUserName, proxyPassword, refreshUrl } = parseProxyUrl(value)
          const formData = {
            proxyCategory: protocol?.toLocaleUpperCase(),
            host,
            port,
            proxyUserName,
            proxyPassword,
            refreshUrl,
          }

          if (isEmptyValue(Object.values(formData).filter(Boolean))) {
            input!.invalid = true
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
      label: $t('代理类型'),
      name: 'ipType',
      value: data.ipType || $dict_map.ipType[0]?.value,
      options: $dict_map.ipType,
      size: 'md',
    },
    {
      label: $t('代理信息'),
      items: [
        {
          type: 'select',
          name: 'proxyCategory',
          value: !proxyCategory || proxyCategory === 'noproxy' ? $dict_map.protocol[0]?.value : proxyCategory,
          options: $dict_map.protocol,
          optionValue: 'value',
          filter: false,
          size: 'md',
          formatValue: (input: any, _inputs: any, formData: any) => {
            Object.assign(formData, { protocol: input.value })
            return input.value
          },
        },
        {
          type: 'text',
          name: 'host',
          value: data.host ?? null,
          placeholder: $t('主机'),
          required: true,
          onBlur(event: any) {
            if (event.target.value.trim()) {
              setInputValue(inputs, 'host', event.target.value.trim())
            }
          },
        },
        { separator: true },
        {
          type: 'number',
          name: 'port',
          value: data.port ?? null,
          placeholder: $t('端口'),
          required: true,
          onBlur: async () => {
            const input = findInputByName(inputs, 'port')
            if (input.value !== null) {
              if (input.value < 1 || input.value > 65535) {
                input.invalid = true
                input.errorMsg = $t('端口范围 1~65535')
              }
            }
          },
        },
      ],
      slot: 'server',
    },
    {
      type: 'text',
      label: $t('用户名'),
      name: 'proxyUserName',
      value: data.proxyUserName ?? '',
      placeholder: $t('请输入用户名'),
      size: 'md',
      onBlur(event: any) {
        if (event.target.value.trim()) {
          setInputValue(inputs, 'proxyUserName', event.target.value.trim())
        }
      },
    },
    {
      type: 'text',
      label: $t('密码'),
      name: 'proxyPassword',
      value: data.proxyPassword ?? '',
      placeholder: $t('请输入密码'),
      size: 'md',
      onBlur(event: any) {
        if (event.target.value.trim()) {
          setInputValue(inputs, 'proxyPassword', event.target.value.trim())
        }
      },
    },
    {
      type: 'text',
      label: $t('刷新URL'),
      name: 'refreshUrl',
      value: data.refreshUrl ?? '',
      placeholder: $t('请输入刷新URL'),
      tooltip: $t('请在填写后点击下方刷新按钮测试'),
      icon: 'base/rx_ic_refresh',
      size: 'md',
      iconClick: async () => {
        const input = findInputByName(inputs, 'refreshUrl')
        if (input.value) {
          const isOK = await window.electronAPI.send('proxy:refreshUrl', input.value)
          showToast(isOK ? 0 : -1, input.value)
        }
      },
    },
    {
      separator: true,
    },
    {
      label: $t('IP 检测'),
      type: 'select',
      name: 'checkChannel',
      value: data.checkChannel || userConfig?.ipChecker || $dict_map.checkChannel[0]?.value,
      props: {
        options: $dict_map.checkChannel,
        optionValue: 'value',
        filter: false,
        size: 'md',
      },
      slot: 'ipchecker',
    },
    {
      slot: 'checkermessage',
    },
  ])
  return inputs
}
