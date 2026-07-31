<script lang="tsx" setup>
import { h } from 'vue'
import StepIndicator from './step-indicator.vue'
import DeviceDetectResultModal from '/@/views/ecommerce/devices/components/device-detect-result-modal.vue'
import TsForm from '/@/views/lab/components/form/index.vue'
import TsFormSelect from '/@/views/lab/components/form/m-input-select.vue'
import RxButton from '/@/components/rx-button'
import RemarkIcon from '/@/components/remark-icon'
import { RxAlert } from '/@/components/rx-alert'
import { getDictMap, getImage, isEmptyValue, parseProxyUrl, strConcat } from '/@/utils'
import { IPType, ProxyCheckStatus, ProxyType } from '/@/enums/proxy'
import { useUserStore } from '/@/stores/user'
import { useCheckProxy } from '/@/views/agent/hooks'
import { useProxyModuleCreate } from '/@/views/agent/hooks/useProxyModuleCreate'
import { createProxyCreateLabels } from '/@/views/agent/create/proxy-create-mode'
import { useDialog } from '/@/hooks/useDialog'
import type { CheckResult } from '/@/views/agent/hooks'
import { useThemeStore } from '/@/stores/theme'
import { WorkspaceType } from '/@/enums'

const { onNext } = defineProps<{
  onNext: (type: 'proxy' | 'platform') => void
}>()

const deviceCreateLabels = createProxyCreateLabels('device')
const { saveProxyModules } = useProxyModuleCreate()
const [showModal] = useDialog()
const { isDarkTheme } = storeToRefs(useThemeStore())
const { getUserConfig } = useUserStore()
const { userConfig, userPayInfo } = storeToRefs(useUserStore())
const { testProxy, batchTestShowToast } = useCheckProxy()

const formRef = useTemplateRef('form')
const alertRef = useTemplateRef('alert')
const cssModule = useCssModule()
const lastTestResult = ref<CheckResult | null>(null)
const loading = ref(false)
const submitting = ref(false)
const alertVisible = ref(false)
const original = ref<Record<string, any>>({})

const bgImageUrl = computed(() => (
  isDarkTheme.value
    ? getImage('ecommerce/modal_bg_dark.svg')
    : getImage('ecommerce/modal_bg_light.svg')
))

const inputs = ref([
  {
    type: 'textarea',
    label: deviceCreateLabels.smartRecognize,
    name: 'proxyRules',
    props: {
      placeholder: $t('示例（备注为选填）:\n192.168.0.1:8000:用户名:密码{notes}\n用户名:密码{at}192.168.0.1:8000{notes}', { at: '@', notes: `{${$t('备注')}}` }),
      rows: 3,
      size: 'lg',
      onBlur: (event: Event) => {
        const result = parseProxyUrl((event.target as HTMLTextAreaElement).value)
        if (isEmptyValue(Object.values(result).filter(Boolean)))
          return

        const { host, port, proxyUserName, proxyPassword, remark } = result

        const ipType = host?.startsWith('[') ? IPType.IPV6 : IPType.IPV4

        formRef.value?.setValues({
          ipType,
          host: host?.replace(/\[|\]/g, ''),
          port,
          proxyUserName,
          proxyPassword,
          proxyRules: '',
        })

        original.value.remark = remark
      },
    },
    resolver: (zod: any) => zod
      .string()
      .refine((value: string) => {
        if (isEmptyValue(value))
          return true
        return !isEmptyValue(Object.values(parseProxyUrl(value)).filter(Boolean))
      }, { message: $t('解析错误,请检查格式') }),
  },
  {
    separator: true,
    separatorProps: {
      lineStyle: 'dashed',
      lineColor: 'var(--colors-border-border-subtle)',
    },
  },
  {
    type: 'radio',
    label: deviceCreateLabels.entityType,
    name: 'ipType',
    props: {
      name: 'ipType',
      size: 'lg',
      onValueChange: async (value: string) => {
        // Web 端不展示 IP 检测渠道，无需同步切换
        if (!globalThis.isElectron)
          return

        const $dict_map = await getDictMap()
        const dictKey = value === IPType.IPV6 ? 'ipv6-query-channels' : 'checkChannel'
        const currentCheckChannel = formRef.value?.getFieldState('checkChannel')?.value
        const isExist = $dict_map[dictKey]?.find(item => item.value === currentCheckChannel)
        const defaultCheckChannel = isExist ? currentCheckChannel : $dict_map[dictKey]?.[0]?.value

        if (value === IPType.IPV6) {
          formRef.value?.setInputsProps({
            checkChannel: {
              value: defaultCheckChannel,
              options: $dict_map['ipv6-query-channels'],
            },
          })
        }
        else {
          formRef.value?.setInputsProps({
            checkChannel: {
              value: isExist ? defaultCheckChannel : (userConfig.value.ipChecker || defaultCheckChannel),
              options: $dict_map.checkChannel,
            },
          })
        }
      },
    },
  },
  {
    type: 'group',
    label: $t('设备信息'),
    items: [
      {
        type: 'select',
        name: 'proxyCategory',
        itemClass: 'flex-1.75/5',
        props: {
          optionValue: 'value',
          size: 'lg',
        },
      },
      {
        type: 'text',
        name: 'host',
        itemClass: `flex-1.75/5 ${cssModule.host}`,
        required: true,
        props: {
          placeholder: $t('主机'),
          size: 'lg',
        },
      },
      {
        itemClass: `justify-center ${cssModule.separator}`,
        render: () => <span>:</span>,
      },
      {
        type: 'text',
        name: 'port',
        itemClass: 'flex-1.5/5',
        props: {
          placeholder: $t('端口'),
          size: 'lg',
          useGrouping: false,
        },
        resolver: (zod: any) =>
          zod.string().refine(
            (value: string) => {
              if (isEmptyValue(value))
                return false
              return Number(value) >= 1 || Number(value) <= 65535
            },
            { message: $t('端口范围 1~65535') },
          ),
      },
    ],
  },
  {
    type: 'text',
    name: 'proxyUserName',
    label: $t('用户名'),
    props: {
      placeholder: $t('请输入用户名'),
      size: 'lg',
    },
  },
  {
    type: 'text',
    name: 'proxyPassword',
    label: $t('密码'),
    props: {
      placeholder: $t('请输入密码'),
      size: 'lg',
    },
  },
  // IP 检测依赖本地 Electron 能力，Web 端不展示该表单项
  ...(globalThis.isElectron
    ? [{
        label: $t('设备检测'),
        name: 'checkChannel',
        tooltip: $t('若设备检测结果有误，请尝试切换下方查询渠道并重试。'),
        props: {
          optionValue: 'value',
        },
        render: (props: any) => {
          return (
            <div class="w-full flex justify-between items-center gap-1.5 overflow-hidden">
              <TsFormSelect size="md" {...props} />
              <RxButton
                class="flex-shrink-0"
                size="md"
                severity="secondary"
                variant="outlined"
                icon="base/rx_ic_speed_test"
                disabled={loading.value}
                label={$t('测试设备')}
                onClick={onCheckProxyStatus}
              />
            </div>
          )
        },
      }]
    : []),
])

onMounted(() => {
  getInputs()
})

async function getInputs() {
  const [userConfigData, $dict_map] = await Promise.all([
    getUserConfig(),
    getDictMap(),
  ])

  const defaultIpType = $dict_map.ipType?.[0]?.value
  const props: Record<string, any> = {
    ipType: {
      value: defaultIpType,
      options: $dict_map.ipType,
    },
    proxyCategory: {
      value: $dict_map.protocol[0]?.value,
      options: $dict_map.protocol,
    },
  }

  if (globalThis.isElectron) {
    const isIPV6 = defaultIpType === IPType.IPV6
    const dictKey = isIPV6 ? 'ipv6-query-channels' : 'checkChannel'
    const defaultCheckChannel = isIPV6
      ? $dict_map[dictKey]?.[0]?.value
      : (userConfigData?.ipChecker || $dict_map[dictKey]?.[0]?.value)

    props.checkChannel = {
      value: defaultCheckChannel,
      options: $dict_map[dictKey],
    }
  }

  formRef.value?.setInputsProps(props)
}

function getFormData() {
  const { host, port, proxyUserName, proxyPassword, ...formData } = formRef.value?.getValues() ?? {}
  return {
    host: host?.trim(),
    port: port?.trim(),
    proxyUserName: proxyUserName?.trim(),
    proxyPassword: proxyPassword?.trim(),
    ...formData,
  } as Record<string, any>
}

async function onCheckProxyStatus() {
  if (!globalThis.isElectron) {
    return globalThis.electronAPI.send('proxy:detect', {} as any)
  }

  await formRef.value?.instance!.validate()
  if (!formRef.value?.instance!.valid)
    return

  const formData = getFormData()
  alertVisible.value = false
  loading.value = true
  // 直连白名单用户标记
  const result = await testProxy({
    ...formData,
    isDirect: userPayInfo.value.isDirectWhitelist,
  })
  loading.value = false
  lastTestResult.value = result
  original.value = { ...original.value, ...result }
  batchTestShowToast([result])

  if (!result.error) {
    alertVisible.value = true
    nextTick(() => {
      alertRef.value?.$el.scrollIntoView({ behavior: 'smooth' })
    })
  }
}

function addRemark(platformRemarks: string) {
  Reflect.set(original.value, 'remark', platformRemarks)
}

function buildSubmitPayload(formData: Record<string, any>, checkResult?: CheckResult) {
  return [{
    ...original.value,
    ...formData,
    ...(checkResult ?? {}),
    protocol: formData.proxyCategory, // 兼容新版接口字段名 protocol
  }]
}

async function onSubmit() {
  await formRef.value?.instance!.validate()
  if (!formRef.value?.instance!.valid)
    return

  const formData = getFormData()
  // Web 端无本地代理检测能力，跳过连通性检测直接保存
  if (!globalThis.isElectron) {
    await saveDevice({
      ...formData,
      checkStatus: ProxyCheckStatus.none,
      proxyType: ProxyType.resource,
      lastIp: '',
      lastCity: '',
      lastCountry: '',
      checkTime: '',
      timezone: '',
    })
    return
  }

  showDeviceDetectModal(formData)
}

/** 弹窗内完成连通性与历史库检测后再导入 */
function showDeviceDetectModal(formData: Record<string, any>) {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => h(DeviceDetectResultModal, {
        formData,
        isDirect: userPayInfo.value.isDirectWhitelist,
        onClose: hideModal,
        onConfirm: async (checkResult: CheckResult) => {
          await saveDevice(formData, checkResult)
          hideModal()
        },
      }),
    },
  })
}

async function saveDevice(formData: Record<string, any>, checkResult?: CheckResult) {
  submitting.value = true
  try {
    await saveProxyModules(buildSubmitPayload(formData, checkResult), {
      labels: deviceCreateLabels,
      extraParams: {
        workspaceType: WorkspaceType.ECommerce,
        isPermanent: true,
      },
      onSuccess: () => onNext('platform'),
    })
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="w-full h-full flex flex-col pt-30 pb-10 justify-center items-center gap-8">
    <StepIndicator :current="0" />
    <div class="flex-1 relative w-165 flex flex-col gap-3 rounded-3 self-ip">
      <img class="self-ip__bg" :src="bgImageUrl" alt="" aria-hidden="true">
      <div class="relative z-1 flex items-start gap-2 py-7 px-10">
        <!-- <RxButton class="!w-9" variant="text" size="md" severity="secondary" icon="base/rx_ic_arrow_left" @click="onNext('proxy')" /> -->
        <div class="flex flex-col gap-2">
          <div class="tt-primary text-4.5 font-700 leading-normal">
            {{ $t('自备设备接入') }}
          </div>
          <div class="tt-primary text-3.25 leading-4">
            {{ $t('填写你的 Socks5 / HTTP 设备，绑定后即可用独立环境运营') }}
          </div>
        </div>
      </div>
      <div class="flex-1 overflow-hidden relative z-1 flex flex-col gap-8 pb-10">
        <div class="flex-1 px-10 overflow-y-auto">
          <TsForm v-if="inputs" ref="form" :inputs="inputs" />
          <RxAlert ref="alert" v-model:visible="alertVisible" class="shrink-0 !w-full" type="success" :title="$t('测试成功')">
            <template #content>
              <i18n-t class="whitespace-pre-wrap" tag="div" scope="global" :keypath="$t('位置: {location}\nIP: {ip}\n时区: {timezone}', {
                location: `${lastTestResult?.lastCountry ?? ''}${strConcat('/', lastTestResult?.lastCity)}`,
                ip: lastTestResult?.lastIp,
                timezone: lastTestResult?.timezone,
              })"
              />
            </template>
          </RxAlert>
        </div>
        <div class="inline-flex flex-row-reverse justify-between w-full px-10">
          <RxButton class="!w-50" size="lg" :loading="submitting" :label="$t('保存')" @click="onSubmit" />
          <RemarkIcon :title="$t('请为设备 IP 添加备注')" :label="$t('备注')" mode="button" :value="original.remark" :on-confirm="addRemark" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" module>
.host {
  &:global(.p-formfield .p-inputtext) {
    border-right-width: 0px;
  }
}

.separator {
  padding: 8px 0;
  border-left-width: 0px;
  border-right-width: 0px;
  border-top-width: 1px;
  border-bottom-width: 1px;
  border-style: solid;
  background: var(--inputtext-background);
  border-color: var(--inputtext-border-color);
  color: var(--colors-text-text-tertiary);
  font-size: 16px;
  line-height: 24px;
}
</style>

<style lang="scss" scoped>
.self-ip {
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background-color: var(--colors-background-bg-overlay);

  &__bg {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 0;
    width: 100%;
    height: auto;
    pointer-events: none;
    user-select: none;
  }
}
</style>
