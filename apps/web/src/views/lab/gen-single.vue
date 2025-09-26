<script lang="tsx" setup>
import RemarkIcon from '/@/components/remark-icon'
import inputLabel from '/@/components/ry-form/input-label.vue'
import inputNumberGroup from '/@/components/ry-form/input-number-group.vue'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import { RxAlert } from '/@/components/rx-alert'

import { $t } from '/@/locales'
import { strConcat, findInputByName, getFormData, getDictMap, isEmptyValue, parseProxyUrl, setInputValue, setInputValueByFormData, IPType, deepClone } from '/@/utils'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'
import { useCheckProxy } from '/@/views/agent/hooks'


const { data = {} } = defineProps<{
  data?: Record<string, any>
}>()

const emit = defineEmits(['save'])

const { testProxy, checkResult, batchTestShowToast } = useCheckProxy()

const [showToast] = useResponseToast()
const { getUserConfig } = useUserStore()

// const userConfig = getUserConfig()
// const $dict_map = getDictMap()

// const proxyCategory = (data.proxyCategory || data.protocol)?.split('/')[0]

const rxAlertRef = useTemplateRef('rxalert')

const remark = ref()
const visible = ref(false)
const original = ref(deepClone(data))
const inputs = ref<any>([
  {
    type: 'textarea',
    label: $t('智能识别'),
    placeholder: $t('代理主机:端口:用户名:密码[刷新URL]'),
    name: 'proxyRules',
    rows: 2,
    errorMsg: $t('解析错误，请检查格式'),
    invalid: false,
    size: 'md',
    onBlur: () => {
      const input = inputs.value.find((item: any) => item.name === 'proxyRules')
      const value = input?.value?.trim()

      if (value) {
        input!.invalid = false

        const { protocol, host, port, proxyUserName, proxyPassword, refreshUrl } = parseProxyUrl(value)
        const formData = {
          proxyCategory: protocol?.toLocaleUpperCase(),
          host: host?.replace(/\[|\]/g, ''),
          port,
          proxyUserName,
          proxyPassword,
          refreshUrl,
        }

        const ipType = host?.startsWith('[') ? IPType.IPV6 : IPType.IPV4

        if (isEmptyValue(Object.values(formData).filter(Boolean))) {
          input!.invalid = true
        }
        else {
          setInputValueByFormData(inputs.value, { ipType, ...formData })
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
    // value: data.ipType || $dict_map.ipType[0]?.value,
    // options: $dict_map.ipType,
    size: 'md',
  },
  {
    label: $t('代理信息'),
    items: [
      {
        type: 'select',
        name: 'proxyCategory',
        // value: !proxyCategory || proxyCategory === 'noproxy' ? $dict_map.protocol[0]?.value : proxyCategory?.toLocaleUpperCase(),
        // options: $dict_map.protocol,
        optionValue: 'value',
        filter: false,
        size: 'md',
        formatValue: (input: any, _inputs: any, formData: any) => {
          Object.assign(formData, { protocol: input.value })
          return input.value
        },
        style: {
          width: '160px'
        }
      },
      {
        type: 'text',
        name: 'host',
        value: data.host ?? null,
        placeholder: $t('主机'),
        required: true,
        onBlur(event: any) {
          if (event.target.value.trim()) {
            setInputValue(inputs.value, 'host', event.target.value.trim())
          }
        },
      },
      { separator: true },
      {
        type: 'number',
        name: 'port',
        value: data.port?.split?.('/')?.[0] ?? null,
        placeholder: $t('端口'),
        required: true,
        onBlur: async () => {
          const input = findInputByName(inputs.value, 'port')
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
        setInputValue(inputs.value, 'proxyUserName', event.target.value.trim())
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
        setInputValue(inputs.value, 'proxyPassword', event.target.value.trim())
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
      const input = findInputByName(inputs.value, 'refreshUrl')
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
    tooltip: $t('若 IP 检测结果有误，请尝试切换下方检测渠道并重试'),
    // value: data.checkChannel || userConfig?.ipChecker || $dict_map.checkChannel[0]?.value,
    props: {
      // options: $dict_map.checkChannel,
      optionValue: 'value',
      filter: false,
      size: 'md',
    },
    slot: 'ipchecker',
  },
])

async function onCheckProxy() {
  try {
    const data = getFormData(inputs.value)
    visible.value = false
    const result = await testProxy(toRaw(data))
    batchTestShowToast([result])
    original.value = { ...original.value, ...result }

    if (!result.error) {
      visible.value = true
      nextTick(() => {
        // rxAlertRef.value?.$el.scrollIntoView({ behavior: 'smooth' })
      })
    }
  }
  catch (error) {
    console.log(error)
  }
}

function addRemark(platformRemarks: string) {
  remark.value = platformRemarks
}

function save() {
  const formData = getFormData(inputs.value, original.value)
  emit('save', [{
    ...formData,
    remark: remark.value,
    protocol: formData.proxyCategory, // 兼容新版接口字段名 protocol
  }])
}

//============================================
import TsForm from './components/form/index.vue';
import TsFormSelect from '/@/views/lab/components/form/m-input-select.vue'
import RxButton from "/@/components/rx-button";

const mambaRef = useTemplateRef('mamba')

const wcisinput = ref(
  [
    {
      type: 'textarea',
      label: $t('智能识别'),
      name: 'proxyRules',
      props: {
        placeholder: $t('代理主机:端口:用户名:密码[刷新URL]'),
        rows: 2,
        size: 'md',
        onBlur: (event: Event) => {
          const result = parseProxyUrl((event.target as HTMLTextAreaElement).value)
          if (isEmptyValue(Object.values(result).filter(Boolean))) return

          const { protocol, host, port, proxyUserName, proxyPassword, refreshUrl } = result

          // const ipType = host?.startsWith('[') ? IPType.IPV6 : IPType.IPV4

          // formRef.value?.setValues({
          //   // proxyCategory: protocol?.toLocaleUpperCase(),
          //   ipType,
          //   host: host?.replace(/\[|\]/g, ''),
          //   port,
          //   proxyUserName,
          //   proxyPassword,
          //   refreshUrl,
          // })
        },
      },
      resolver: (zod: any) => zod
        .string()
        .refine((value: string) => {
          if (isEmptyValue(value)) return true
          return !isEmptyValue(Object.values(parseProxyUrl(value)).filter(Boolean))
        }, { message: $t('解析错误,请检查格式：{text}', { text: $t('代理主机:端口:用户名:密码[刷新URL]') }) })
    },
    {
      separator: true,
    },
    {
      type: 'radio',
      label: $t('代理类型'),
      name: 'ipType',
      // value: data.ipType || $dict_map.ipType[0]?.value,
      props: {
        // options: $dict_map.ipType,
        size: 'md',
        options: [
          {
            label: 'IPV4',
            value: IPType.IPV4,
          },
          {
            label: 'IPV6',
            value: IPType.IPV6,
          },
        ],
      }
    },
    {
      type: 'group',
      label: '代理信息#x',
      items: [
        {
          type: 'select',
          name: 'proxyCategory',
          groupClass: '!w-1/2',
          props: {
            optionValue: 'value',
            size: 'md',
            placeholder: $t('代理类型'),
            options: [
              {
                label: 'HTTP',
                value: 'http',
              },
              {
                label: 'HTTPS',
                value: 'https',
              },
            ],
          }
        },
        {
          type: 'text',
          name: 'host',
          groupClass: '!w-1/4',
          props: {
            placeholder: $t('主机'),
            size: 'md',
          }
        },
        {
          type: 'text',
          name: 'port',
          groupClass: '!w-1/4',
          props: {
            placeholder: $t('端口'),
            size: 'md',
          },
          resolver: (zod: any) => zod
            .number()
            .refine((value: number) => {
              if (isEmptyValue(value)) return true
              return 1 <= value || value <= 65535
            }, { message: $t('端口范围 1~65535') })
        }
      ]
    },
    {
      type: 'text',
      name: 'proxyUserName',
      label: $t('用户名'),
      // value: data.proxyUserName ?? '',
      props: {
        placeholder: $t('请输入用户名'),
        size: 'md',
      }
    },
    {
      type: 'text',
      name: 'proxyPassword',
      label: $t('密码'),
      // value: data.proxyPassword ?? '',
      props: {
        placeholder: $t('请输入密码'),
        size: 'md',
      }
    },
    {
      type: 'text',
      name: 'refreshUrl',
      label: $t('刷新URL'),
      tooltip: $t('请在填写后点击下方刷新按钮测试'),
      props: {
        placeholder: $t('请输入刷新URL'),
        icon: 'base/rx_ic_refresh',
        size: 'md',
        onIconClick: async () => {
          const refreshUrl = mambaRef.value?.getFieldState('refreshUrl')?.value
          if (refreshUrl) {
            const isOK = await window.electronAPI.send('proxy:refreshUrl', refreshUrl)
            showToast(isOK ? 0 : -1, refreshUrl)
          }
        }
      }
    },
    {
      separator: true,
    },
    {
      label: $t('IP 检测'),
      name: 'checkChannel',
      tooltip: $t('若 IP 检测结果有误，请尝试切换下方检测渠道并重试'),
      // value: data.checkChannel || userConfig?.ipChecker || $dict_map.checkChannel[0]?.value,
      props: {
        // options: $dict_map.checkChannel,
        optionValue: 'value',
        options: [
          {
            label: 'a1',
            value: 'a1',
          },
          {
            label: 'a2',
            value: 'a2',
          },
        ]
      },
      render: (props: any) => {
        return <div class="w-full flex justify-between items-center gap-1.5 overflow-hidden" >
          <TsFormSelect size="md" {...props} />
          <RxButton class="flex-shrink-0" size="md" severity="secondary" variant="outlined" icon="base/rx_ic_speed_test" label={$t('测试代理')} onClick={() => {
            console.log("🚀 ~ ye:", mambaRef.value?.getValues())
          }} />
        </div>
      },
    },
  ]
)

async function onCheck1Proxy() {
  try {
    const data = getFormData(inputs.value)
    visible.value = false
    const result = await testProxy(toRaw(data))
    batchTestShowToast([result])
    original.value = { ...original.value, ...result }

    if (!result.error) {
      visible.value = true
      nextTick(() => {
        rxAlertRef.value?.$el.scrollIntoView({ behavior: 'smooth' })
      })
    }
  }
  catch (error) {
    console.log(error)
  }
}
</script>

<template>
  <!-- <div class="w-full mx-auto flex gap-15">
    <div class="flex-1 flex items-center flex-col">
      <div class="flex-1 overflow-hidden">
        <div class="h-full w-full proxies-form">
          <RyForm :inputs="inputs">
            <template #server="{ input }">
              <div class="flex flex-col">
                <inputLabel :label="input.label" />
                <div class="flex">
                  <RxInputSelect v-bind="input.items[0]" v-model="input.items[0].value" class="!border-r-0 !rounded-tr-none !rounded-br-none" />
                  <inputNumberGroup class="!rounded-tl-none !rounded-bl-none !shadow-none" :inputs="input.items" />
                </div>
              </div>
            </template>
<template #ipchecker="{ input }">
              <div class="flex flex-col">
                <inputLabel v-bind="input" />
                <div class="flex gap-1.5">
                  <div class="flex-1">
                    <RxInputSelect v-bind="input.props" v-model="input.value" :name="input.name" />
                  </div>
                  <RxButton :size="input.props.size" outlined severity="secondary" :label="$t('测试代理')" icon="base/rx_ic_speed_test" @click="onCheckProxy" />
                </div>
              </div>
            </template>
</RyForm>
<RxAlert ref="rxalert" v-model:visible="visible" class="!w-full checkermessage" type="success" :title="$t('测试成功')" content="内容">
  <template #content>
              <i18n-t :keypath="$t('{location}{ip}{timezone}', { location: '{location}', timezone: '{timezone}', ip: '{ip}' })" scope="global">
                <template #location>
                  <span>{{ $t('位置: {location}', {
                    location: `${checkResult.lastCountry}${strConcat('/',
                      checkResult.lastCity as string)}`
                  }) }}</span>
                </template>
  <template #ip>
                  <br><span>{{ $t('IP: {ip}', { ip: checkResult.lastIp }) }}</span>
                </template>
  <template #timezone>
                  <br><span>{{ $t('时区: {timezone}', { timezone: checkResult.timezone }) }}</span>
                </template>
  </i18n-t>
  </template>
</RxAlert>
</div>
</div>
<div class="flex justify-between w-full">
  <div class="flex items-center gap-3">
    <RemarkIcon class="ma-auto ml-0" :title="$t('请为代理添加备注')" :label="$t('备注')" mode="button" :value="remark" :on-confirm="addRemark" />
  </div>
  <div class="flex gap-3 py-4">
    <RxButton size="sm" :label="$t('保存')" @click="save" />
  </div>
</div>
</div>
<div class="flex-1">

</div>
</div> -->
  <TsForm ref="mamba" :inputs="wcisinput"></TsForm>
  <RxAlert ref="rxalert" v-model:visible="visible" class="!w-full" type="success" :title="$t('测试成功')">
    <template #content>
      <i18n-t class="whitespace-pre-wrap" tag="div" scope="global"
        :keypath="$t('位置: {location}\nIP: {ip}\n时区: {timezone}', { location: `${checkResult.lastCountry}${strConcat('/', checkResult.lastCity)}`, ip: checkResult.lastIp, timezone: checkResult.timezone })"></i18n-t>
    </template>
  </RxAlert>
</template>

<style lang="scss" scoped>
.proxies-form {
  overflow-y: auto;
  padding-bottom: 12px;

  &::-webkit-scrollbar {
    display: none;
  }

  :deep(.number-group-item) {
    &:first-of-type {
      flex: 2;
    }
  }
}
</style>
