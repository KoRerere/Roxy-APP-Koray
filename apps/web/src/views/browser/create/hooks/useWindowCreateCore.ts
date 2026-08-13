import type { ComputedRef, Ref } from 'vue'
import { computed, ref, toRaw } from 'vue'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'
import { useCheckProxy } from '/@/views/agent/hooks'
import { filterFieldByValue, findInputByName, getFormDataByList, isEmptyValue } from '/@/utils'
import { ensureApiExtractProxyInfo } from '../components/proxy-info/api-extract'
import { buildUiProxyInfoList, toSingleWindowProxyParams } from '../components/proxy-info/proxy-params'
import { ceateRandomFinger, getInputsGroup, switchMoblieInputVisible } from '../form-inputs'
import { createFormAsyncGate } from './useAsyncGate'

type Awaitable<T> = T | Promise<T>
type FormInputs = any[][]
type CreateParams = Record<string, any>

export interface WindowCreateFormState {
  mainSetting: Ref<any[]>
  extraSettings: Ref<FormInputs>
  original: Ref<CreateParams>
  inputsGroup: ComputedRef<FormInputs>
}

interface UseWindowCreateCoreOptions {
  getFingerprintInputs?: (state: WindowCreateFormState) => FormInputs
  resolveMobileVisible?: (state: WindowCreateFormState) => boolean | undefined
  onInputsInitialized?: (state: WindowCreateFormState) => Awaitable<void>
  onInitialized?: (state: WindowCreateFormState) => Awaitable<void>
}

/** initialize 可选行为 */
export interface InitializeOptions {
  /**
   * 初始化后是否刷新预览指纹（UA / WebGL 厂商渲染等）。
   * 默认 true（创建页需要预览）；快速创建编辑已存模板时应传 false，避免冲掉回填值。
   */
  refreshFingerprint?: boolean
}

/** buildCreateParams 入参；导出供 ReturnType 等跨模块类型引用 */
export interface BuildCreateParamsOptions {
  inputs?: FormInputs
  metadata?: Record<string, any>
  createCount?: number
  additionalParams?: CreateParams
}

/** executeSingleCreate 入参；导出供 ReturnType 等跨模块类型引用 */
export interface ExecuteSingleCreateOptions {
  params?: CreateParams
  buildParams?: () => Awaitable<CreateParams>
  beforeSubmit?: () => Awaitable<boolean | void>
  collectAdditionalParams?: (params: CreateParams) => Awaitable<CreateParams>
  onSuccess?: (data: any, params: CreateParams) => Awaitable<void>
  onFailure?: (response: { code: number, data: any, msg: string }, params: CreateParams) => Awaitable<void>
}

export function useWindowCreateCore(options: UseWindowCreateCoreOptions = {}) {
  const [showToast, onlyErrorToast] = useResponseToast()
  const { userConfig, userPayInfo } = storeToRefs(useUserStore())
  const { testProxy } = useCheckProxy()
  const mainSetting = ref<any[]>([])
  const extraSettings = ref<FormInputs>([])
  const original = ref<CreateParams>({})
  const loading = ref(false)
  const formGate = createFormAsyncGate()
  const inputsGroup = computed<FormInputs>(() => [mainSetting.value, ...extraSettings.value])
  const canSubmit = computed(() => formGate.isReady.value && !loading.value)

  const state: WindowCreateFormState = {
    mainSetting,
    extraSettings,
    original,
    inputsGroup,
  }

  async function initialize(template: CreateParams = {}, initOptions: InitializeOptions = {}) {
    await formGate.run(async () => {
      const [groups, originalData] = await getInputsGroup(template, showToast, formGate)
      const [windowInputs, basicInputs, highLevelInputs, otherInputs] = groups

      mainSetting.value = windowInputs
      extraSettings.value = [basicInputs, highLevelInputs, otherInputs]
      original.value = originalData

      await options.onInputsInitialized?.(state)
      syncMobileVisibility()
      // 编辑已存模板时跳过：否则会覆盖 webGLManufacturer / webGLRender / userAgent 等回填值
      if (initOptions.refreshFingerprint ?? true)
        await updateFingerprint()
      await options.onInitialized?.(state)
    })
  }

  function syncMobileVisibility(forceVisible?: boolean) {
    const configuredVisible = forceVisible ?? options.resolveMobileVisible?.(state)
    const osInput = findInputByName(mainSetting.value, 'os')
    const mobileVisible = configuredVisible ?? ['Android', 'IOS'].includes(osInput?.value?.value)
    switchMoblieInputVisible(extraSettings.value, mobileVisible)
  }

  async function updateFingerprint(inputs?: FormInputs) {
    // PreviewCard 等处 @click="onShuffle" 会把 MouseEvent 当作首参传入，需忽略非表单数组
    const fingerprintInputs = (Array.isArray(inputs) ? inputs : undefined)
      ?? options.getFingerprintInputs?.(state)
      ?? inputsGroup.value
    const data = await formGate.run(() => ceateRandomFinger(fingerprintInputs))
    Object.assign(original.value, data[0])
  }

  async function shuffleFingerprint(inputs?: FormInputs) {
    await updateFingerprint(inputs)
    showToast(0, $t('指纹刷新成功'))
  }

  function buildCreateParams({
    inputs = inputsGroup.value,
    metadata = {},
    createCount = 1,
    additionalParams = {},
  }: BuildCreateParamsOptions = {}): CreateParams {
    const filteredMetadata = filterFieldByValue(toRaw(metadata), value => !isEmptyValue(value))
    const formData = getFormDataByList(inputs, filteredMetadata)

    const params: CreateParams = {
      createCount,
      ...original.value,
      ...formData,
      ...additionalParams,
    }
    // 批量创建允许 count=1，仍要带 proxyInfoList；单窗提交由 executeSingleCreate 再摊平
    return params
  }

  /**
   * 仅 API 静默提取成功后写回 UI。
   * ensure 无改动时禁止重建 proxyInfoList，否则会冲掉「已有代理」草稿里的 lastIp 等字段，
   * 且 ProxyInfo 因 hydrated 不再 hydrate，造成界面与提交参数不一致。
   */
  function syncApiProxyInfoList(params: CreateParams) {
    const input = findInputByName(mainSetting.value, 'proxyInfoList')
    if (input)
      input.value = buildUiProxyInfoList(params)
  }

  /**
   * 组装创建参数；仅 API 提取未测过时静默提取并测速（失败不阻断）。
   * choose / custom / noproxy 不会走测速，也不会改写表单代理草稿。
   */
  async function prepareCreateParams(options: BuildCreateParamsOptions = {}): Promise<CreateParams> {
    const params = buildCreateParams(options)
    const ensured = await ensureApiExtractProxyInfo(params, {
      checkChannel: userConfig.value.ipChecker,
      isDirect: userPayInfo.value.isDirectWhitelist,
      testProxy,
    })
    // ensure 成功时返回新对象；未触发/失败时返回同一引用——据此避免误伤其他代理方式
    if (ensured !== params)
      syncApiProxyInfoList(ensured)
    return ensured
  }

  async function executeSingleCreate({
    params,
    buildParams,
    beforeSubmit,
    collectAdditionalParams,
    onSuccess,
    onFailure,
  }: ExecuteSingleCreateOptions = {}) {
    await formGate.waitUntilReady()

    if (loading.value)
      return

    loading.value = true
    try {
      if (await beforeSubmit?.() === false)
        return

      const baseParams = params ?? await buildParams?.() ?? buildCreateParams()
      const additionalParams = await collectAdditionalParams?.(baseParams) ?? {}
      const mergedParams = { ...baseParams, ...additionalParams }
      const requestParams = await ensureApiExtractProxyInfo(mergedParams, {
        checkChannel: userConfig.value.ipChecker,
        isDirect: userPayInfo.value.isDirectWhitelist,
        testProxy,
      })
      if (requestParams !== mergedParams)
        syncApiProxyInfoList(requestParams)
      const singleParams = toSingleWindowProxyParams(requestParams)
      const response = await API.window.userAddWindowInfoV2Create(singleParams as any)
      onlyErrorToast(response.code, response.msg)

      if (response.code === 0)
        await onSuccess?.(response.data, singleParams)
      else
        await onFailure?.(response, singleParams)

      return response
    }
    finally {
      loading.value = false
    }
  }

  return {
    mainSetting,
    extraSettings,
    original,
    inputsGroup,
    loading,
    formGate,
    canSubmit,
    initialize,
    syncMobileVisibility,
    updateFingerprint,
    shuffleFingerprint,
    buildCreateParams,
    prepareCreateParams,
    executeSingleCreate,
  }
}
