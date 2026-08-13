<script lang="tsx" setup>
import TsForm from '/@/views/lab/components/form/index.vue'
import RxButton from '/@/components/rx-button'
import { RxAlert } from '/@/components/rx-alert'
// import RxToggleSwitch from '/@/components/rx-toggle-switch'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'
import { useCheckProxy } from '/@/views/agent/hooks'
import { ProxyCheckStatus, ProxyProtocol } from '/@/enums/proxy'
import { getDictMap, isEmptyValue, strConcat } from '/@/utils'
import { runApiExtractAndTest } from './api-extract'
import type { CheckResult } from '/@/views/agent/hooks'
import type { ProxyInfoItem } from './types'

/** API 提取占位表单对应的代理条目 */
const model = defineModel<ProxyInfoItem | null>({ default: null })

const [showToast] = useResponseToast()
const { userConfig, userPayInfo } = storeToRefs(useUserStore())
const { testProxy } = useCheckProxy()
const formRef = useTemplateRef('form')
/** 避免回填 setValues 时 watch 覆盖尚未写完的 model */
const syncingFromModel = ref(false)

const alertVisible = ref(false)
const alertType = ref<'success' | 'error'>('success')
const alertTitle = ref('')
const alertMessage = ref('')
const lastTestResult = ref<CheckResult | null>(null)

const extractMethodOptions = [
  { label: $t('每次打开窗口时提取新 IP'), value: true },
  { label: $t('IP 失效时重新提取新 IP'), value: false },
]

const data = computed(() => model.value ?? {})

const successContent = computed(() => $t('位置: {location}\nIP: {ip}\n时区: {timezone}', {
  location: `${lastTestResult.value?.lastCountry ?? ''}${strConcat('/', lastTestResult.value?.lastCity)}`,
  ip: lastTestResult.value?.lastIp,
  timezone: lastTestResult.value?.timezone,
}))

const inputs = computed(() => {
  // 结果区状态变化时重渲染自定义 render
  void alertVisible.value
  void alertType.value
  void alertTitle.value
  void alertMessage.value
  void successContent.value

  return [
    {
      type: 'radio',
      label: $t('代理类型'),
      name: 'proxyCategory',
      props: {
        name: 'proxyCategory',
      },
    },
    {
      type: 'select',
      label: $t('提取方式'),
      name: 'isExtraNewIp',
      value: data.value.isExtraNewIp ?? true,
      props: {
        optionValue: 'value',
        options: extractMethodOptions,
      },
    },
    // {
    //   label: $t('重复校验'),
    //   name: 'isRepectCheck',
    //   tooltip: $t('打开窗口时检测提取 IP 是否重复，重复则重新提取'),
    //   value: data.value.isRepectCheck ?? true,
    //   render: () => {
    //     const checked = formRef.value?.getFieldState('isRepectCheck')?.value ?? data.value.isRepectCheck ?? true
    //     return (
    //       <div>
    //         <RxToggleSwitch
    //           modelValue={checked}
    //           onChange={(value: boolean) => {
    //             formRef.value?.setValues({ isRepectCheck: value })
    //             syncToModel()
    //           }}
    //         />
    //       </div>
    //     )
    //   },
    // },
    {
      type: 'text',
      label: $t('提取链接'),
      name: 'extraUrl',
      value: data.value.extraUrl ?? '',
      props: {
        placeholder: $t('请输入提取链接'),
      },
    },
    {
      name: 'testExtract',
      label: ' ',
      render: () => (
        <div class="flex flex-col gap-2 w-full">
          <RxAlert
            class="!w-full"
            type={alertType.value}
            title={alertTitle.value}
            visible={alertVisible.value}
            {...{
              'onUpdate:visible': (visible: boolean) => {
                alertVisible.value = visible
              },
            }}
          >
            {{
              content: () => (
                <div class="whitespace-pre-wrap">
                  {alertType.value === 'success' ? successContent.value : alertMessage.value}
                </div>
              ),
            }}
          </RxAlert>
          <div>
            <RxButton
              severity="secondary"
              variant="outlined"
              label={$t('测试提取')}
              onClick={onTestExtract}
            />
          </div>
        </div>
      ),
    },
  ]
})

onBeforeMount(() => {
  void initForm()
})

/** 表单字段变更时同步到外层 proxyInfoList */
watch(
  () => formRef.value?.instance?.states,
  () => {
    if (!syncingFromModel.value && formRef.value)
      syncToModel()
  },
  { deep: true },
)

async function initForm() {
  await nextTick()
  await applyDictAndValues(data.value)
  syncToModel()
}

/** API 提取不支持 SSH，从协议字典中剔除 */
function filterApiProtocols(protocols: Array<{ label?: string, value?: string }> = []) {
  return protocols.filter(item => String(item.value ?? '').toUpperCase() !== ProxyProtocol.SSH)
}

async function applyDictAndValues(source: Record<string, any>) {
  const $dict_map = await getDictMap()
  const protocols = filterApiProtocols($dict_map.protocol ?? [])
  const rawCategory = (source.proxyCategory || source.protocol || protocols[0]?.value || 'SOCKS5')
    .toString()
    .toUpperCase()
  // 历史数据若仍是 SSH，回落到可选协议首项
  const proxyCategory = rawCategory === ProxyProtocol.SSH
    ? (protocols[0]?.value || 'SOCKS5')
    : rawCategory

  syncingFromModel.value = true
  formRef.value?.setInputsProps({
    proxyCategory: {
      value: proxyCategory,
      options: protocols,
    },
  })
  formRef.value?.setValues({
    extraChannel: source.extraChannel ?? '',
    isExtraNewIp: source.isExtraNewIp ?? true,
    isRepectCheck: source.isRepectCheck ?? true,
    extraUrl: source.extraUrl ?? '',
  })
  await nextTick()
  syncingFromModel.value = false
}

function getFormData() {
  const { testExtract: _, ...formData } = formRef.value?.getValues() ?? {}
  return formData as Record<string, any>
}

function syncToModel(extra?: Record<string, any>) {
  const formData = getFormData()
  model.value = {
    ...model.value,
    ...formData,
    ...extra,
    proxyMethod: 'api',
    protocol: formData.proxyCategory,
    proxyCategory: formData.proxyCategory,
  }
}

function resetAlert() {
  alertVisible.value = false
  lastTestResult.value = null
  alertTitle.value = ''
  alertMessage.value = ''
}

function showFailureAlert(message: string, title = $t('提取失败')) {
  alertType.value = 'error'
  alertTitle.value = title
  alertMessage.value = message
  lastTestResult.value = null
  alertVisible.value = true
}

async function onTestExtract() {
  const extraUrl = String(formRef.value?.getFieldState('extraUrl')?.value ?? '').trim()
  if (isEmptyValue(extraUrl)) {
    showToast(-1, $t('请输入提取链接'))
    return
  }

  if (!globalThis.isElectron)
    return globalThis.electronAPI.send('proxy:detect', {} as any)

  resetAlert()

  const formData = getFormData()
  const result = await runApiExtractAndTest({
    extraUrl,
    proxyCategory: formData.proxyCategory || 'SOCKS5',
    checkChannel: userConfig.value.ipChecker,
    isDirect: userPayInfo.value.isDirectWhitelist,
    testProxy,
  })

  if (!result.ok) {
    showFailureAlert(result.message)
    return
  }

  const { connection, checkResult } = result
  lastTestResult.value = checkResult
  syncToModel({
    ...connection,
    lastIp: checkResult.lastIp,
    lastCity: checkResult.lastCity,
    lastCountry: checkResult.lastCountry,
    timezone: checkResult.timezone,
    checkStatus: checkResult.checkStatus,
    checkTime: checkResult.checkTime,
  })

  if (checkResult.checkStatus === ProxyCheckStatus.success && !checkResult.error) {
    alertType.value = 'success'
    alertTitle.value = $t('测试成功')
    alertVisible.value = true
    return
  }

  showFailureAlert(
    (typeof checkResult.error === 'string' && checkResult.error) || $t('代理测试失败'),
    $t('测试失败'),
  )
}
</script>

<template>
  <TsForm v-if="inputs" ref="form" position="left" :inputs="inputs" />
</template>
