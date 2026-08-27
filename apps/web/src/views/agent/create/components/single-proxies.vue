<script lang="tsx" setup>
import { h } from 'vue'
import DeviceDetectResultModal from '/@/views/ecommerce/devices/components/device-detect-result-modal.vue'
import TsForm from '/@/views/lab/components/form/index.vue'
import TsFormSelect from '/@/views/lab/components/form/m-input-select.vue'
import RxButton from '/@/components/rx-button'
import RemarkIcon from '/@/components/remark-icon'
import TutorialVideo from '/@/views/tutorial/components/tutorial-video.vue'
import { RxAlert } from '/@/components/rx-alert'

import { deepClone, getDictMap, isEmptyValue, parseProxyUrl, strConcat } from '/@/utils'
import ProxyAdvertiseBanner from './proxy-advertise-banner.vue'
import { IPType, ProxyType } from '/@/enums/proxy'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'
import { useCheckProxy } from '/@/views/agent/hooks'
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks'
import { useProxyCreateLabels } from '../proxy-create-mode'
import type { ProxyCreateMode } from '../proxy-create-mode'
import { useDialog } from '/@/hooks/useDialog'
import type { CheckResult } from '/@/views/agent/hooks'

const {
  data = {},
  showRemark = false,
  showAdvertise = false,
  mode,
  onConfirm,
} = defineProps<{
  data?: Record<string, any>
  showRemark?: boolean
  /** 是否展示购买广告；抽屉与全页单条导入均可开启 */
  showAdvertise?: boolean
  /** 显式模式；抽屉场景必传。全页有上层 provide 时可省略 */
  mode?: ProxyCreateMode
  onConfirm?: (formData: Record<string, any>) => void | Promise<void>
}>()

const emit = defineEmits<{
  /** 点击广告「立即购买」；双抽屉聚焦购买区，全页弹出购买菜单 */
  buy: []
}>()

// 显式 mode 时自提供文案；否则读全页 create/index 的 inject
const labels = mode !== undefined
  ? useProxyCreateLabels(() => mode)
  : useProxyCreateLabels()

const [showToast] = useResponseToast()
const { getUserConfig } = useUserStore()
const { userConfig, userPayInfo } = storeToRefs(useUserStore())

const [showModal] = useDialog()
const { testProxy, batchTestShowToast } = useCheckProxy()
const lastTestResult = ref<CheckResult | null>(null)
const isDeviceMode = computed(() => labels.value.mode === 'device')
const { onboardingTaskStatus, closeGuideTipsAndUpdateTaskStatus } = useOnboardingTaskStatus()

const formRef = useTemplateRef('form')
const alertRef = useTemplateRef('alert')
const advertiseFailRef = useTemplateRef('advertiseFail')
const cssModule = useCssModule()
const loading = ref(false)
const alertVisible = ref(false)
const original = ref(deepClone(data))
const inputs = computed(() => [
  {
    type: 'textarea',
    label: labels.value.smartRecognize,
    name: 'proxyRules',
    props: {
      placeholder: isDeviceMode.value
        ? $t('示例（备注为选填）:\n192.168.0.1:8000:用户名:密码{notes}\n用户名:密码{at}192.168.0.1:8000{notes}', { at: '@', notes: `{${$t('备注')}}` })
        : $t('示例（刷新 URL 与备注为选填）:\n192.168.0.1:8000:用户名:密码[刷新 URL]{notes}\n用户名:密码{at}192.168.0.1:8000[刷新 URL]{notes}', { at: '@', notes: `{${$t('备注')}}` }),
      rows: 3,
      size: 'md',
      onBlur: (event: Event) => {
        const result = parseProxyUrl((event.target as HTMLTextAreaElement).value)
        if (isEmptyValue(Object.values(result).filter(Boolean)))
          return

        const { protocol, host, port, proxyUserName, proxyPassword, refreshUrl, remark } = result

        const ipType = host?.startsWith('[') ? IPType.IPV6 : IPType.IPV4

        formRef.value?.setValues({
          ipType,
          host: host?.replace(/\[|\]/g, ''),
          port,
          proxyUserName,
          proxyPassword,
          // 解析出的协议对应代理类型下拉（字典值为 SOCKS5/HTTP 等大写）；无协议时保留当前选择
          ...(protocol ? { proxyCategory: protocol.toLocaleUpperCase() } : {}),
          // 电商模式无刷新 URL 能力，解析结果也不回填该字段
          ...(isDeviceMode.value ? {} : { refreshUrl }),
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
  },
  {
    type: 'radio',
    label: labels.value.entityType,
    name: 'ipType',
    props: {
      name: 'ipType',
      size: 'md',
      onValueChange: async (value: string) => {
        const $dict_map = await getDictMap()
        const dictKey = value === IPType.IPV6 ? 'ipv6-query-channels' : 'checkChannel'
        const isExist = $dict_map[dictKey]?.find(item => item.value === data.checkChannel)
        const defaultCheckChannel = isExist ? data.checkChannel : $dict_map[dictKey]?.[0]?.value

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
    label: labels.value.entityInfo,
    items: [
      {
        type: 'select',
        name: 'proxyCategory',
        itemClass: 'flex-1.75/5',
        props: {
          optionValue: 'value',
          size: 'md',
        },
      },
      {
        type: 'text',
        name: 'host',
        itemClass: `flex-1.75/5 ${cssModule.host}`,
        value: data.host ?? null,
        required: true,
        props: {
          placeholder: $t('主机'),
          size: 'md',
        },
      },
      {
        itemClass: `justify-center ${cssModule.dot_eparator}`,
        render: () => <span>:</span>,
      },
      {
        type: 'text',
        name: 'port',
        itemClass: 'flex-1.5/5',
        value: data.port?.split?.('/')?.[0] ?? null,
        props: {
          placeholder: $t('端口'),
          size: 'md',
          useGrouping: false,
        },
        resolver: (zod: any) => zod
          .string()
          .refine((value: string) => {
            if (isEmptyValue(value))
              return false
            return Number(value) >= 1 || Number(value) <= 65535
          }, { message: $t('端口范围 1~65535') }),
      },
    ],
  },
  {
    type: 'text',
    name: 'proxyUserName',
    label: $t('用户名'),
    value: data.proxyUserName ?? '',
    props: {
      placeholder: $t('请输入用户名'),
      size: 'md',
    },
  },
  {
    type: 'text',
    name: 'proxyPassword',
    label: $t('密码'),
    value: data.proxyPassword ?? '',
    props: {
      placeholder: $t('请输入密码'),
      size: 'md',
    },
  },
  // 电商模式无刷新 URL 能力，隐藏该表单项
  ...(isDeviceMode.value
    ? []
    : [{
        type: 'text',
        name: 'refreshUrl',
        label: $t('刷新URL'),
        tooltip: $t('请在填写后点击下方刷新按钮测试。'),
        value: data.refreshUrl ?? '',
        props: {
          placeholder: $t('请输入刷新URL'),
          icon: 'base/rx_ic_refresh',
          size: 'md',
          onIconClick: async () => {
            const refreshUrl = formRef.value?.getFieldState('refreshUrl')?.value
            if (refreshUrl) {
              const isOK = await globalThis.electronAPI.send('proxy:refreshUrl', refreshUrl)
              showToast(isOK ? 0 : -1, refreshUrl)
            }
          },
        },
      }]),
  {
    separator: true,
  },
  {
    label: $t('IP 检测'),
    name: 'checkChannel',
    tooltip: $t('若 IP 检测结果有误，请尝试切换下方查询渠道并重试。'),
    props: {
      optionValue: 'value',
    },
    render: (props: any) => {
      return (
        <div class="w-full flex justify-between items-center gap-1.5 overflow-hidden">
          <TsFormSelect size="md" {...props} />
          <RxButton class="flex-shrink-0" size="md" severity="secondary" variant="outlined" icon="base/rx_ic_speed_test" disabled={loading.value} label={labels.value.testAction} onClick={onCheckProxyStatus} />
        </div>
      )
    },
  },
])

onBeforeMount(() => {
  getInputs()
})

async function getInputs() {
  const [userConfig, $dict_map] = await Promise.all([
    getUserConfig(),
    getDictMap(),
  ])

  const isIPV6 = data.ipType === IPType.IPV6
  const dictKey = isIPV6 ? 'ipv6-query-channels' : 'checkChannel'
  const isExist = $dict_map[dictKey]?.find(item => item.value === data.checkChannel)
  let defaultCheckChannel: string = isExist ? data.checkChannel : $dict_map[dictKey]?.[0]?.value
  defaultCheckChannel = isIPV6 ? defaultCheckChannel : (data.checkChannel || userConfig?.ipChecker || defaultCheckChannel)

  const proxyCategory = (data.proxyCategory || data.protocol)?.split('/')[0]

  formRef.value?.setInputsProps({
    ipType: {
      value: data.ipType || $dict_map.ipType![0]?.value,
      options: $dict_map.ipType,
    },
    proxyCategory: {
      value: !proxyCategory || proxyCategory === 'noproxy' ? $dict_map.protocol![0]?.value : proxyCategory?.toLocaleUpperCase(),
      options: $dict_map.protocol,
    },
    checkChannel: {
      value: defaultCheckChannel,
      options: $dict_map[dictKey],
    },
  })
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
  lastTestResult.value = null
  loading.value = true
  // 直连白名单用户标记
  const result = await testProxy({ ...formData, isDirect: userPayInfo.value.isDirectWhitelist })
  loading.value = false
  lastTestResult.value = result
  original.value = { ...original.value, ...result }
  batchTestShowToast([{ ...result, proxyType: ProxyType.resource }])

  if (!result.error) {
    alertVisible.value = true
    nextTick(() => {
      alertRef.value?.$el.scrollIntoView({ behavior: 'smooth' })
    })
  }
  else if (showAdvertise) {
    nextTick(() => {
      advertiseFailRef.value?.scrollIntoView({ behavior: 'smooth' })
    })
  }
}

function addRemark(platformRemarks: string) {
  original.value.remark = platformRemarks
}

function buildSubmitPayload(formData: Record<string, any>, checkResult?: CheckResult) {
  return {
    ...original.value,
    ...formData,
    ...(checkResult ?? {}),
    protocol: formData.proxyCategory, // 兼容新版接口字段名 protocol
  }
}

/** 电商模式：弹窗内完成连通性与历史库检测后再导入 */
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
          await onConfirm?.(buildSubmitPayload(formData, checkResult))
          hideModal()
        },
      }),
    },
  })
}

async function onSubmit() {
  await formRef.value?.instance!.validate()
  if (!formRef.value?.instance!.valid)
    return

  const formData = getFormData()

  if (isDeviceMode.value) {
    showDeviceDetectModal(formData)
    return
  }

  if (!alertVisible.value) {
    await onCheckProxyStatus()
  }

  if (formRef.value?.instance!.valid) {
    await onConfirm?.(buildSubmitPayload(formData))
  }
}

defineExpose({
  submit: onSubmit,
})
</script>

<template>
  <div class="flex flex-col gap-4 min-w-96 h-full min-h-0 overflow-hidden pa-4 pb-5">
    <ProxyAdvertiseBanner v-if="showAdvertise" @buy="emit('buy')" />
    <TutorialVideo v-if="!isDeviceMode && !onboardingTaskStatus?.createProxyVideoEntryStatus" class="shrink-0" video-type="proxy_management" :autoplay="false">
      <template #default="{ onPlay }">
        <div class="flex items-center justify-start pa-3 gap-2.5 rounded-xl video" @click="onPlay">
          <div class="flex items-center pa-2 rounded-md video-icon">
            <SvgIcon name="base/rx_ic_play" color="var(--pattern-tutorial-video-bg-icon)" />
          </div>
          <div class="flex-1 cursor-pointer">
            <div class="flex justify-between items-center">
              <span class="video-title">{{ labels.tutorialTitle }}</span>
              <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" color="var(--colors-icon-icon-tertiary)" @click.stop="closeGuideTipsAndUpdateTaskStatus('createProxyVideoEntryStatus')" />
            </div>
            <div class="video-desc">
              {{ labels.tutorialDesc }}
            </div>
          </div>
        </div>
      </template>
    </TutorialVideo>
    <!-- min-h-0 让 flex 子项可收缩，仅表单区域滚动 -->
    <div class="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto scrollbar">
      <TsForm v-if="inputs" ref="form" :inputs="inputs" />
      <!-- 检测成功展示结果；失败且开启广告时展示底部购买引导 -->
      <RxAlert ref="alert" v-model:visible="alertVisible" class="shrink-0 !w-full" type="success" :title="$t('测试成功')">
        <template #content>
          <i18n-t class="whitespace-pre-wrap" tag="div" scope="global"
                  :keypath="$t('位置: {location}\nIP: {ip}\n时区: {timezone}', { location: `${lastTestResult?.lastCountry ?? ''}${strConcat('/', lastTestResult?.lastCity)}`, ip: lastTestResult?.lastIp, timezone: lastTestResult?.timezone })"
          />
        </template>
      </RxAlert>
      <ProxyAdvertiseBanner v-if="showAdvertise && lastTestResult?.error" ref="advertiseFail" variant="fail" @buy="emit('buy')" />
    </div>
    <div class="shrink-0">
      <slot name="footer" :submit="onSubmit">
        <div class="inline-flex flex-row-reverse justify-between w-full">
          <RxButton size="sm" :label="$t('保存')" @click="onSubmit" />
          <RemarkIcon v-if="showRemark" :title="labels.remarkTitle" :label="$t('备注')" mode="button" :value="original.remark" :on-confirm="addRemark" />
        </div>
      </slot>
    </div>
  </div>
</template>

<style lang="scss" module>
.host {
  &:global(.p-formfield .p-inputtext) {
    border-right-width: 0px;
  }
}

.dot_eparator {
  padding: 8px 0;
  border-left-width: 0px;
  border-right-width: 0px;
  border-top-width: 1px;
  border-bottom-width: 1px;
  border-style: solid;
  background: var(--inputtext-background);
  border-color: var(--inputtext-border-color);
  color: var(--colors-text-text-tertiary);
  font-size: 13px;
  line-height: 20px;
}
</style>

<style lang="scss" scoped>
.video {
  background: linear-gradient(
    90deg,
    var(--pattern-tutorial-video-bg-start) 0%,
    var(--pattern-tutorial-video-bg-end) 100%
  );

  &-icon {
    background: var(--pattern-tutorial-video-bg-play);
  }

  &-title {
    color: var(--colors-text-text-primary);
    font-size: 13px;
    font-weight: 600;
    line-height: normal;
  }

  &-desc {
    color: var(--colors-text-text-secondary);
    font-size: 12px;
    line-height: normal;
  }
}

.scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
