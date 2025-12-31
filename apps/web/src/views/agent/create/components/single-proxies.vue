<script lang="tsx" setup>
import TsForm from '/@/views/lab/components/form/index.vue'
import TsFormSelect from '/@/views/lab/components/form/m-input-select.vue'
import RxButton from '/@/components/rx-button'
import RemarkIcon from '/@/components/remark-icon'
import TutorialVideo from '/@/views/tutorial/components/tutorial-video.vue'
import { RxAlert } from '/@/components/rx-alert'

import { deepClone, getDictMap, IPType, isEmptyValue, parseProxyUrl, strConcat } from '/@/utils'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'
import { useCheckProxy } from '/@/views/agent/hooks'
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks.ts'

const {
  data = {},
  showRemark = false,
  onConfirm,
} = defineProps<{
  data?: Record<string, any>
  showRemark?: boolean
  onConfirm?: (params: Record<string, any>[]) => void | Promise<void>
}>()

const [showToast] = useResponseToast()
const { getUserConfig } = useUserStore()
const { testProxy, checkResult, batchTestShowToast } = useCheckProxy()
const { onboardingTaskStatus, closeGuideTipsAndUpdateTaskStatus } = useOnboardingTaskStatus()

const formRef = useTemplateRef('form')
const alertRef = useTemplateRef('alert')
const cssModule = useCssModule()

const loading = ref(false)
const alertVisible = ref(false)
const original = ref(deepClone(data))
const inputs = ref([
  {
    type: 'textarea',
    label: $t('智能识别'),
    name: 'proxyRules',
    props: {
      placeholder: $t('示例（刷新 URL 与备注为选填）:\n192.168.0.1:8000:用户名:密码[刷新 URL]{notes}\n用户名:密码{at}192.168.0.1:8000[刷新 URL]{notes}', { at: '@', notes: `{${$t('备注')}}` }),
      rows: 3,
      size: 'md',
      onBlur: (event: Event) => {
        const result = parseProxyUrl((event.target as HTMLTextAreaElement).value)
        if (isEmptyValue(Object.values(result).filter(Boolean)))
          return

        const { host, port, proxyUserName, proxyPassword, refreshUrl, remark } = result

        const ipType = host?.startsWith('[') ? IPType.IPV6 : IPType.IPV4

        formRef.value?.setValues({
          ipType,
          host: host?.replace(/\[|\]/g, ''),
          port,
          proxyUserName,
          proxyPassword,
          refreshUrl,
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
    label: $t('代理类型'),
    name: 'ipType',
    props: {
      name: 'ipType',
      size: 'md',
    },
  },
  {
    type: 'group',
    label: $t('代理信息'),
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
        itemClass: `justify-center ${cssModule.separator}`,
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
  {
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
          const isOK = await window.electronAPI.send('proxy:refreshUrl', refreshUrl)
          showToast(isOK ? 0 : -1, refreshUrl)
        }
      },
    },
  },
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
          <RxButton class="flex-shrink-0" size="md" severity="secondary" variant="outlined" icon="base/rx_ic_speed_test" disabled={loading.value} label={$t('测试代理')} onClick={onCheckProxyStatus} />
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
      value: data.checkChannel || userConfig?.ipChecker || $dict_map.checkChannel![0]?.value,
      options: $dict_map.checkChannel,
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
  await formRef.value?.instance!.validate()
  if (!formRef.value?.instance!.valid)
    return

  const formData = getFormData()
  alertVisible.value = false
  loading.value = true
  const result = await testProxy(formData!)
  loading.value = false
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
  original.value.remark = platformRemarks
}

async function onSubmit() {
  if (!alertVisible.value) {
    await onCheckProxyStatus()
  }

  if (formRef.value?.instance!.valid) {
    const formData = getFormData()

    await onConfirm?.([{
      ...original.value,
      ...formData,
      protocol: formData.proxyCategory, // 兼容新版接口字段名 protocol
    }])
  }
}

defineExpose({
  submit: onSubmit,
})
</script>

<template>
  <div class="h-full flex flex-col gap-4">
    <TutorialVideo v-if="!onboardingTaskStatus?.createProxyVideoEntryStatus" video-type="proxy_management" :autoplay="false">
      <template #default="{ onPlay }">
        <div class="flex items-center justify-start pa-3 gap-2.5 rounded-xl video" @click="onPlay">
          <div class="flex items-center pa-2 rounded-md video-icon">
            <SvgIcon name="base/rx_ic_play" color="var(--pattern-tutorial-video-bg-icon)" />
          </div>
          <div class="flex-1 cursor-pointer">
            <div class="flex justify-between items-center">
              <span class="video-title">{{ $t('代理教程') }}</span>
              <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" color="var(--colors-icon-icon-tertiary)" @click.stop="closeGuideTipsAndUpdateTaskStatus('createProxyVideoEntryStatus')" />
            </div>
            <div class="video-desc">
              {{ $t('了解如何导入和配置代理 IP') }}
            </div>
          </div>
        </div>
      </template>
    </TutorialVideo>
    <div class="flex-1 flex flex-col gap-4 overflow-y-auto scrollbar">
      <TsForm v-if="inputs" ref="form" :inputs="inputs" />
      <RxAlert ref="alert" v-model:visible="alertVisible" class="shrink-0 !w-full" type="success" :title="$t('测试成功')">
        <template #content>
          <i18n-t class="whitespace-pre-wrap" tag="div" scope="global"
                  :keypath="$t('位置: {location}\nIP: {ip}\n时区: {timezone}', { location: `${checkResult.lastCountry}${strConcat('/', checkResult.lastCity)}`, ip: checkResult.lastIp, timezone: checkResult.timezone })"
          />
        </template>
      </RxAlert>
    </div>
    <slot name="footer" :submit="onSubmit">
      <div class="inline-flex flex-row-reverse justify-between w-full">
        <RxButton size="sm" :label="$t('保存')" @click="onSubmit" />
        <RemarkIcon v-if="showRemark" :title="$t('请为代理添加备注')" :label="$t('备注')" mode="button" :value="original.remark" :on-confirm="addRemark" />
      </div>
    </slot>
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
