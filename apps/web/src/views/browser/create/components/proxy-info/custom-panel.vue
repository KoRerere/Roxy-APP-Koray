<script lang="tsx" setup>
import TsForm from '/@/views/lab/components/form/index.vue'
import TsFormSelect from '/@/views/lab/components/form/m-input-select.vue'
import RxButton from '/@/components/rx-button'
import { deepClone, getDictMap, isEmptyValue, parseProxyUrl } from '/@/utils'
import { IPType } from '/@/enums/proxy'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'
import { useCheckProxy } from '/@/views/agent/hooks'
import type { ProxyInfoItem } from './types'

/** 当前自定义代理条目；向外同步完整 proxy 对象 */
const model = defineModel<ProxyInfoItem | null>({ default: null })

const [showToast] = useResponseToast()
const { getUserConfig } = useUserStore()
const { userPayInfo } = storeToRefs(useUserStore())
const { testProxy, batchTestShowToast } = useCheckProxy()

const formRef = useTemplateRef('form')
const cssModule = useCssModule()
const loading = ref(false)

/** 挂载时草稿已由外壳 hydrate，用作表单初值 */
const initial = model.value ?? {}

/** 归一化后台协议字段（兼容 protocol、带路径的历史值） */
function normalizeProxyCategory(raw: unknown) {
  const value = raw?.toString?.()?.split('/')[0]?.trim()
  if (!value || value.toLowerCase() === 'noproxy')
    return ''
  return value.toLocaleUpperCase()
}

/** 文本变更后写回 UI 草稿（nextTick 等 Form 状态落稳） */
function scheduleSyncToModel() {
  void nextTick(() => syncToModel())
}

/** 智能识别：解析成功后回填并同步 */
function onProxyRulesBlur(event: Event) {
  const result = parseProxyUrl((event.target as HTMLTextAreaElement).value)
  if (isEmptyValue(Object.values(result).filter(Boolean)))
    return

  const { host, port, proxyUserName, proxyPassword, refreshUrl } = result
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
  void applyCheckChannelOptions(ipType)
  scheduleSyncToModel()
}

/** 切换 IP 类型时刷新检测渠道选项并同步 */
async function onIpTypeChange(value: string) {
  await applyCheckChannelOptions(value, formRef.value?.getFieldState('checkChannel')?.value)
  scheduleSyncToModel()
}

/**
 * 按 ipType 解析检测渠道默认值与字典选项。
 * 当前值若在新字典中存在则保留；否则 IPV4 回落用户配置 / 字典首项，IPV6 回落字典首项。
 */
async function resolveCheckChannel(ipType: string, currentChannel?: string) {
  const [userConfigData, $dict_map] = await Promise.all([
    getUserConfig(),
    getDictMap(),
  ])
  const isIPV6 = ipType === IPType.IPV6
  const dictKey = isIPV6 ? 'ipv6-query-channels' : 'checkChannel'
  const options = $dict_map[dictKey] ?? []
  const matched = options.find(item => item.value === currentChannel)
  // 仅当当前渠道属于目标字典时才保留，避免 IPv6 渠道在切回 IPv4 后被 currentChannel 粘住
  let checkChannel = matched ? currentChannel : options[0]?.value
  if (!isIPV6 && !matched)
    checkChannel = userConfigData?.ipChecker || checkChannel

  return { checkChannel, options, dictMap: $dict_map }
}

/** 仅更新检测渠道的 options/value（IP 类型切换或智能识别后） */
async function applyCheckChannelOptions(ipType: string, currentChannel?: string) {
  const { checkChannel, options } = await resolveCheckChannel(ipType, currentChannel)
  formRef.value?.setInputsProps({
    checkChannel: {
      value: checkChannel,
      options,
    },
  })
}

const inputs = [
  {
    type: 'textarea',
    label: $t('智能识别'),
    name: 'proxyRules',
    props: {
      placeholder: $t('192.168.0.1:8000:用户名:密码[刷新 URL]\n用户名:密码{at}192.168.0.1:8000[刷新 URL]', {
        at: '@',
        notes: `{${$t('备注')}}`,
      }),
      rows: 3,
      onBlur: onProxyRulesBlur,
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
    type: 'radio',
    label: $t('代理 IP 类型'),
    name: 'ipType',
    value: initial.ipType ?? null,
    props: {
      name: 'ipType',
      onValueChange: onIpTypeChange,
    },
  },
  {
    type: 'group',
    label: $t('代理 IP 信息'),
    items: [
      {
        type: 'select',
        name: 'proxyCategory',
        itemClass: 'w-26',
        value: normalizeProxyCategory(initial.proxyCategory || initial.protocol) || null,
        props: {
          optionValue: 'value',
          onChange: scheduleSyncToModel,
        },
      },
      {
        type: 'text',
        name: 'host',
        itemClass: `flex-1 ${cssModule.host}`,
        value: initial.host ?? null,
        required: true,
        props: {
          placeholder: $t('主机'),
          onInput: scheduleSyncToModel,
          onBlur: scheduleSyncToModel,
        },
      },
      {
        type: 'text',
        name: 'port',
        itemClass: 'flex-1',
        value: initial.port?.toString?.()?.split?.('/')?.[0] ?? null,
        props: {
          placeholder: $t('端口'),
          useGrouping: false,
          onInput: scheduleSyncToModel,
          onBlur: scheduleSyncToModel,
        },
        slots: {
          preIcon: () => <span class="text-3 leading-none">:</span>,
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
    value: initial.proxyUserName ?? '',
    props: {
      placeholder: $t('请输入用户名'),
      onInput: scheduleSyncToModel,
      onBlur: scheduleSyncToModel,
    },
  },
  {
    type: 'text',
    name: 'proxyPassword',
    label: $t('密码'),
    value: initial.proxyPassword ?? '',
    props: {
      placeholder: $t('请输入密码'),
      onInput: scheduleSyncToModel,
      onBlur: scheduleSyncToModel,
    },
  },
  {
    type: 'text',
    name: 'refreshUrl',
    label: $t('刷新 URL'),
    tooltip: $t('请在填写后点击下方刷新按钮测试。'),
    value: initial.refreshUrl ?? '',
    props: {
      placeholder: $t('请输入刷新 URL'),
      icon: 'base/rx_ic_refresh',
      onInput: scheduleSyncToModel,
      onBlur: scheduleSyncToModel,
      onIconClick: async () => {
        const refreshUrl = formRef.value?.getFieldState('refreshUrl')?.value
        if (refreshUrl) {
          const isOK = await globalThis.electronAPI.send('proxy:refreshUrl', refreshUrl)
          showToast(isOK ? 0 : -1, refreshUrl)
        }
      },
    },
  },
  {
    label: $t('IP 检测'),
    name: 'checkChannel',
    tooltip: $t('若 IP 检测结果有误，请尝试切换下方查询渠道并重试。'),
    value: initial.checkChannel ?? null,
    props: {
      optionValue: 'value',
      onChange: scheduleSyncToModel,
    },
    render: (props: any) => {
      return (
        <div class="w-full flex justify-between items-center gap-1.5 overflow-hidden">
          <TsFormSelect {...props} />
          <RxButton
            class="flex-shrink-0"
            severity="secondary"
            variant="outlined"
            icon="base/rx_ic_speed_test"
            disabled={loading.value}
            label={$t('测试代理 IP')}
            onClick={onCheckProxyStatus}
          />
        </div>
      )
    },
  },
]

onBeforeMount(() => {
  void initForm()
})

async function initForm() {
  await nextTick()
  await fillForm(model.value ?? {})
  // 写出完整 draft，供切 tab / 提交读取
  syncToModel()
}

/** 用字典 + 源数据填充表单（编辑回填 / 外部写入） */
async function fillForm(source: Record<string, any>) {
  const ipType = source.ipType || IPType.IPV4
  const { checkChannel, options, dictMap } = await resolveCheckChannel(ipType, source.checkChannel)
  const proxyCategory = normalizeProxyCategory(source.proxyCategory || source.protocol)
    || dictMap.protocol?.[0]?.value

  formRef.value?.setInputsProps({
    ipType: {
      value: source.ipType || dictMap.ipType?.[0]?.value,
      options: dictMap.ipType,
    },
    proxyCategory: {
      value: proxyCategory,
      options: dictMap.protocol,
    },
    checkChannel: {
      value: checkChannel,
      options,
    },
  })

  formRef.value?.setValues({
    ipType: source.ipType || dictMap.ipType?.[0]?.value,
    proxyCategory,
    checkChannel,
    host: source.host ?? '',
    port: source.port?.toString?.()?.split?.('/')?.[0] ?? '',
    proxyUserName: source.proxyUserName ?? '',
    proxyPassword: source.proxyPassword ?? '',
    refreshUrl: source.refreshUrl ?? '',
    proxyRules: '',
  })
}

function getFormData() {
  const { host, port, proxyUserName, proxyPassword, proxyRules: _, ...formData } = formRef.value?.getValues() ?? {}
  return {
    host: host?.trim(),
    port: port?.toString?.()?.trim(),
    proxyUserName: proxyUserName?.trim(),
    proxyPassword: proxyPassword?.trim(),
    ...formData,
  } as Record<string, any>
}

/** 把当前表单写回 UI 草稿（proxyInfoList[0]）；单窗/模板持久化以扁平字段为准 */
function syncToModel() {
  if (!formRef.value)
    return

  const formData = getFormData()
  const proxyCategory = normalizeProxyCategory(formData.proxyCategory)
  const { id: _id, moduleId: _moduleId, ...rest } = model.value ?? {}
  model.value = {
    ...rest,
    ...formData,
    _tempId: model.value?._tempId ?? Date.now().toString(32),
    // 自定义代理不保留库 id，避免外壳误判为 choose
    id: undefined,
    moduleId: 0,
    proxyCategory,
    protocol: proxyCategory,
    proxyMethod: 'custom',
  }
}

/** 供外壳「购买抽屉添加成功」后回填表单 */
async function applyExternalItem(item: ProxyInfoItem) {
  model.value = item
  await fillForm(item)
  syncToModel()
}

defineExpose({ applyExternalItem })

async function onCheckProxyStatus() {
  if (!globalThis.isElectron)
    return globalThis.electronAPI.send('proxy:detect', {} as any)

  await formRef.value?.instance!.validate()
  if (!formRef.value?.instance!.valid)
    return

  // 点击测速前可能仍有未 blur 的文本框，先强制同步
  syncToModel()
  loading.value = true
  const formData = getFormData()
  // 直连白名单用户标记，与代理创建页测速一致
  const result = await testProxy({
    ...deepClone(formData),
    apiCheck: false,
    isDirect: userPayInfo.value.isDirectWhitelist,
  })
  loading.value = false
  batchTestShowToast([result], {
    reCheck: () => onCheckProxyStatus(),
  })
  if (model.value)
    Object.assign(model.value, result)
}
</script>

<template>
  <TsForm ref="form" class="!gap-3" position="left" :inputs="inputs" />
</template>

<style lang="scss" module>
.host {
  &:global(.p-formfield .p-inputtext) {
    border-right-width: 0px;
  }
}
</style>
