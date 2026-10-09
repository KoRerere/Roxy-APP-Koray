import { h } from 'vue'
import type { Ref } from 'vue'
import type { Input } from '/@/views/lab/components/form/type'
import DevicePickerField from '/@/views/ecommerce/accounts/components/device-picker-field.vue'
import type { BindRiskOriginalContext, EcommerceBasicInfo, EcommerceRequestFields } from '../ecommerce-window-mode'
import { ACCOUNT_PLATFORM_CASCADE_PROPS, ACCOUNT_PLATFORM_ICON_LEVELS, buildBasicInfoFromFormValues, isCustomAccountPlatform, parseAccountPlatformChangePayload, resolveBindRiskSubmitPlan, toEcommerceRequestFields, validateEcommerceBasicInfo, withCascadePlatformImages } from '../ecommerce-window-mode'
import { useProxyBindRiskCheck } from './useProxyBindRiskCheck'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useThemeStore } from '/@/stores/theme'
import { API } from '/@/api'

/** 绑定风险检测提交选项 */
export interface ConfirmBindRiskBeforeSubmitOptions {
  /** 编辑时的原始绑定上下文，用于判断设备/平台是否变更 */
  original?: BindRiskOriginalContext
  /** 账号窗口 ID（编辑场景传入） */
  windowId?: string | number
}

/** 账号基础信息表单对外暴露的能力 */
export interface EcommerceBasicInfoFormExpose {
  validate: () => boolean
  getRequestFields: () => EcommerceRequestFields
  confirmBindRiskBeforeSubmit: (options?: ConfirmBindRiskBeforeSubmitOptions) => Promise<boolean>
}

interface TsFormExpose {
  setInputsProps: (map: Record<string, unknown>) => void
  setValues: (values: Record<string, unknown>) => void
  getValues: () => Record<string, unknown>
  submit: () => void
  validateField: (field: string) => Promise<{ values?: unknown, errors: unknown }> | undefined
}

interface UseEcommerceBasicInfoFormReturn {
  inputs: Ref<Input[]>
  platformOptions: Ref<unknown[]>
  isCustomPlatform: Ref<boolean>
  customPlatformUrl: Ref<string>
  customPlatformUrlError: Ref<string>
  onCustomPlatformUrlUpdate: (value: string) => void
  loadPlatformOptions: () => Promise<void>
  expose: EcommerceBasicInfoFormExpose
}

/**
 * 电商账号基础信息表单：平台树、自定义平台、校验、提交字段与绑定风险检测
 */
export function useEcommerceBasicInfoForm(
  model: Ref<EcommerceBasicInfo>,
  formRef: Ref<TsFormExpose | null | undefined>,
): UseEcommerceBasicInfoFormReturn {
  const [, onlyErrorToast] = useResponseToast()
  const { checkProxyBindRisk } = useProxyBindRiskCheck()
  const { realTheme } = storeToRefs(useThemeStore())

  const platformOptions = ref<unknown[]>([])
  const platformOptionsLoaded = ref(false)
  const isCustomPlatform = ref(false)
  const customPlatformUrl = ref('')
  const customPlatformUrlError = ref('')

  /** 所属平台级联选择器公共 props（含暗色图标切换） */
  function getAccountPlatformCascadeProps(options: unknown[] = platformOptions.value) {
    return {
      options,
      placeholder: $t('选择或搜索平台（亚马逊/ TikTok Shop/eBay...）'),
      ...ACCOUNT_PLATFORM_CASCADE_PROPS,
      darkMode: realTheme.value === 'dark',
      onChange: handleAccountPlatformChange,
    }
  }

  /** 读取当前表单快照；moduleId/deviceInfo 以 v-model 为准（设备选择器写 model） */
  function readFormBasicInfo(): EcommerceBasicInfo {
    const values = formRef.value?.getValues() ?? {}
    const info = buildBasicInfoFromFormValues(values, {
      deviceInfo: model.value.deviceInfo ?? null,
    })
    return {
      ...info,
      moduleId: model.value.moduleId ?? info.moduleId,
      customPlatformUrl: String(customPlatformUrl.value || info.customPlatformUrl || ''),
    }
  }

  /** 同步自定义平台 UI 与表单隐藏字段 */
  function syncCustomPlatformUi(info: EcommerceBasicInfo) {
    const isCustom = isCustomAccountPlatform(info.accountPlatform, platformOptions.value)
    isCustomPlatform.value = isCustom

    if (!isCustom) {
      customPlatformUrl.value = ''
      customPlatformUrlError.value = ''
      formRef.value?.setValues({ customPlatformUrl: '' })
      return
    }

    const url = String(info.customPlatformUrl ?? '').trim()
    customPlatformUrl.value = url
    if (url)
      formRef.value?.setValues({ customPlatformUrl: url })
  }

  function handleAccountPlatformChange(payload: unknown) {
    const platform = parseAccountPlatformChangePayload(payload)
    model.value.accountPlatform = platform
    syncCustomPlatformUi({
      ...readFormBasicInfo(),
      accountPlatform: platform,
    })
  }

  function onCustomPlatformUrlUpdate(value: string) {
    customPlatformUrl.value = value
    customPlatformUrlError.value = ''
    formRef.value?.setValues({ customPlatformUrl: value })
  }

  function syncFromModel() {
    const info: EcommerceBasicInfo = {
      ...readFormBasicInfo(),
      accountPlatform: model.value.accountPlatform,
      customPlatformUrl: model.value.customPlatformUrl ?? '',
    }
    syncCustomPlatformUi(info)
  }

  async function loadPlatformOptions() {
    platformOptionsLoaded.value = false
    const { data } = await API.platform.userGetPlatformUrlTreeList()
    platformOptions.value = withCascadePlatformImages(data ?? [], ACCOUNT_PLATFORM_ICON_LEVELS)
    platformOptionsLoaded.value = true
    formRef.value?.setInputsProps({
      accountPlatform: getAccountPlatformCascadeProps(),
    })
    syncFromModel()
  }

  watch(
    () => model.value.accountPlatform,
    () => {
      if (platformOptions.value.length)
        syncFromModel()
    },
  )

  watch(realTheme, () => {
    formRef.value?.setInputsProps({
      accountPlatform: {
        darkMode: realTheme.value === 'dark',
      },
    })
  })

  const inputs = ref<Input[]>([
    {
      type: 'cascade',
      label: $t('电商平台'),
      name: 'accountPlatform',
      required: true,
      value: model.value.accountPlatform,
      props: getAccountPlatformCascadeProps([]),
    },
    {
      name: 'customPlatformUrl',
      value: model.value.customPlatformUrl ?? '',
      render: () => null,
      resolver: zod => zod.any().refine(
        val => !isCustomPlatform.value || Boolean(String(val ?? customPlatformUrl.value ?? '').trim()),
        $t('请输入平台地址'),
      ),
    },
    {
      type: 'text',
      label: $t('账号名称'),
      name: 'windowName',
      required: true,
      value: model.value.windowName,
      props: {
        placeholder: $t('请输入账号备注名称，便于区分不同账号'),
      },
    },
    {
      type: 'text',
      label: $t('登录账号'),
      name: 'platformUserName',
      value: model.value.platformUserName,
      props: {
        placeholder: $t('请输入平台登录账号'),
      },
    },
    {
      type: 'password',
      label: $t('登录密码'),
      name: 'platformPassword',
      value: model.value.platformPassword,
      props: {
        inputId: 'platformPassword',
        placeholder: $t('请输入平台登录密码'),
        toggleMask: true,
        feedback: false,
        fluid: true,
      },
    },
    {
      label: $t('绑定设备'),
      name: 'moduleId',
      value: model.value.moduleId,
      render: () => h(DevicePickerField, {
        modelValue: model.value.moduleId,
        deviceInfo: model.value.deviceInfo,
        onChange: ({ moduleId, deviceInfo }: Pick<EcommerceBasicInfo, 'moduleId' | 'deviceInfo'>) => {
          model.value.moduleId = moduleId
          model.value.deviceInfo = deviceInfo
          formRef.value?.setValues({ moduleId })
          // 设备为自定义字段，validate-on-value-update 关闭时需手动重校验以清除错误态
          void formRef.value?.validateField('moduleId')
        },
      }),
    },
  ])

  function validate() {
    if (!platformOptionsLoaded.value) {
      onlyErrorToast(-1, $t('平台数据加载中，请稍后'))
      return false
    }

    formRef.value?.submit()
    const info = readFormBasicInfo()
    const { valid, customPlatformUrlError: urlError } = validateEcommerceBasicInfo(info, platformOptions.value, {
      onError: msg => onlyErrorToast(-1, msg),
    })
    customPlatformUrlError.value = urlError ?? ''
    return valid
  }

  function getRequestFields(): EcommerceRequestFields {
    const info = readFormBasicInfo()
    model.value = info
    return toEcommerceRequestFields(info, platformOptions.value)
  }

  async function confirmBindRiskBeforeSubmit(
    options: ConfirmBindRiskBeforeSubmitOptions = {},
  ): Promise<boolean> {
    if (!validate())
      return false

    const info = readFormBasicInfo()
    const plan = resolveBindRiskSubmitPlan(info, platformOptions.value, options.original)
    if (!plan.shouldCheck)
      return true

    const result = await checkProxyBindRisk({
      ...plan.params,
      windowId: options.windowId,
      formContext: {
        accountPlatform: info.accountPlatform,
        windowName: info.windowName,
        platformUserName: info.platformUserName,
        deviceInfo: info.deviceInfo ?? null,
      },
    })
    return result === 'continue'
  }

  const expose: EcommerceBasicInfoFormExpose = {
    validate,
    getRequestFields,
    confirmBindRiskBeforeSubmit,
  }

  return {
    inputs,
    platformOptions,
    isCustomPlatform,
    customPlatformUrl,
    customPlatformUrlError,
    onCustomPlatformUrlUpdate,
    loadPlatformOptions,
    expose,
  }
}
