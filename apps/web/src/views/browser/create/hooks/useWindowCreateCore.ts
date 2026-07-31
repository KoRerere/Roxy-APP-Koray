import type { ComputedRef, Ref } from 'vue'
import { computed, ref, toRaw } from 'vue'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { filterFieldByValue, findInputByName, getFormDataByList, isEmptyValue } from '/@/utils'
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

interface BuildCreateParamsOptions {
  inputs?: FormInputs
  metadata?: Record<string, any>
  createCount?: number
  additionalParams?: CreateParams
}

interface ExecuteSingleCreateOptions {
  params?: CreateParams
  buildParams?: () => Awaitable<CreateParams>
  beforeSubmit?: () => Awaitable<boolean | void>
  collectAdditionalParams?: (params: CreateParams) => Awaitable<CreateParams>
  onSuccess?: (data: any, params: CreateParams) => Awaitable<void>
  onFailure?: (response: { code: number, data: any, msg: string }, params: CreateParams) => Awaitable<void>
}

export function useWindowCreateCore(options: UseWindowCreateCoreOptions = {}) {
  const [showToast, onlyErrorToast] = useResponseToast()
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

  async function initialize(template: CreateParams = {}) {
    await formGate.run(async () => {
      const [groups, originalData] = await getInputsGroup(template, showToast, formGate)
      const [windowInputs, basicInputs, highLevelInputs, otherInputs] = groups

      mainSetting.value = windowInputs
      extraSettings.value = [basicInputs, highLevelInputs, otherInputs]
      original.value = originalData

      await options.onInputsInitialized?.(state)
      syncMobileVisibility()
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
    const fingerprintInputs = inputs ?? options.getFingerprintInputs?.(state) ?? inputsGroup.value
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

    return {
      createCount,
      ...original.value,
      ...formData,
      ...additionalParams,
    }
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
      const requestParams = { ...baseParams, ...additionalParams }
      const response = await API.window.userAddWindowInfoV2Create(requestParams as any)
      onlyErrorToast(response.code, response.msg)

      if (response.code === 0)
        await onSuccess?.(response.data, requestParams)
      else
        await onFailure?.(response, requestParams)

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
    executeSingleCreate,
  }
}
