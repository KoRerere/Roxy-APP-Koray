import { API } from '/@/api'
import { ProxyCheckStatus } from '/@/enums'
import { ProxyType } from '/@/enums/proxy'
import { strConcat } from '/@/utils'
import { buildDeviceInfoFromProxy } from '/@/views/ecommerce/accounts/ecommerce-window-mode'
import type { EcommerceDeviceInfo } from '/@/views/ecommerce/accounts/ecommerce-window-mode'
import { useCheckProxy } from '/@/views/agent/hooks'
import type { CheckResult } from '/@/views/agent/hooks'

/** 设备检测结果阶段 */
export type DeviceDetectPhase = 'checking' | 'success' | 'connectivity-failed' | 'history-risk'

/** 设备历史库匹配检测参数 */
export interface DeviceHistoryMatchParams {
  host: string
  port: string
  proxyUserName?: string
  proxyPassword?: string
}

/** 设备连通性检测入参（与代理测速字段对齐） */
export interface DeviceDetectionParams {
  host?: string
  port?: string | number
  proxyUserName?: string
  proxyPassword?: string
  protocol?: string
  proxyCategory?: string
  id?: number | string
  proxyType?: ProxyType | number
  isDirect?: boolean
  isEncryptProxy?: boolean
  proxyEncryptInfo?: string
  [key: string]: unknown
}

export interface DeviceDetectionResult {
  phase: Exclude<DeviceDetectPhase, 'checking'>
  checkResult: CheckResult
  historyMatched: boolean
}

export interface RunDeviceDetectionOptions {
  /** 直连白名单用户标记 */
  isDirect?: boolean
  /** 电商导入场景检测平台半年内历史库；绑定风险场景仅需连通性 */
  enableHistoryCheck?: boolean
}

export interface DeviceDetectResultMeta {
  icon: 'status/rx_ic_check_fill' | 'base/rx_ic_delete_fill' | 'base/rx_ic_warn_fill'
  iconColor: string
  title: string
  desc: string
}

/** 绑定风险弹窗检测步骤（首步为设备连通性） */
export const BIND_RISK_CHECK_STEPS = [
  $t('检测设备'),
  $t('检验同平台绑定历史'),
  $t('校验设备出口地区'),
  $t('核对账号平台信息'),
] as const

/** 绑定风险 API 动画起始步骤索引 */
export const BIND_RISK_RISK_STEP_START = 1

/** 检测设备是否在平台半年内历史库中命中 */
export async function checkDeviceHistoryMatch(params: DeviceHistoryMatchParams): Promise<boolean> {
  const tempId = Date.now().toString(32)

  const { code, data } = await API.proxy.userBatchCheckProxyImportCreate({
    items: [{
      tempId,
      host: params.host,
      port: params.port,
      proxyUserName: params.proxyUserName,
      proxyPassword: params.proxyPassword,
    }],
  })

  if (code !== 0 || !data.items)
    return true

  const item = data.items.find(it => it.tempId === tempId) ?? data.items[0]
  return !!item.hasImportRecord
}

/**
 * 解析设备测速字段：优先使用调用方传入的完整设备行，否则按 ID 拉详情
 */
export async function resolveDeviceProxyForDetection(
  proxyId: string | number,
  deviceProxy?: Record<string, unknown>,
  onError?: (code: number, msg: string) => void,
): Promise<DeviceDetectionParams> {
  if (deviceProxy && (deviceProxy.host || deviceProxy.id)) {
    return {
      ...deviceProxy,
      id: deviceProxy.id ?? proxyId,
    } as DeviceDetectionParams
  }

  const { code, data, msg } = await API.proxy.userGetProxyDeviceDetailList({ id: String(proxyId) })
  if (code !== 0 || !data) {
    onError?.(code, msg)
    throw new Error('[DeviceDetection] resolve device proxy failed')
  }

  return data as DeviceDetectionParams
}

/** 设备检测通过后，合并出口信息供绑定风险弹窗展示 */
export function buildDeviceInfoFromDetection(
  deviceProxy: DeviceDetectionParams,
  checkResult: CheckResult,
  fallbackId?: string | number,
): EcommerceDeviceInfo {
  return buildDeviceInfoFromProxy({
    ...deviceProxy,
    ...checkResult,
    id: deviceProxy.id ?? fallbackId,
  })
}

/** 设备出口展示文案 */
export function formatDeviceExitDisplay(result: CheckResult | null | undefined) {
  if (!result?.lastCountry && !result?.lastCity && !result?.lastIp)
    return '--'

  const location = `${result.lastCountry ?? ''}${strConcat('/', result.lastCity)}`
  return `${location} · ${result.lastIp ?? '--'}`
}

/** 设备检测结果态对应的标题与描述 */
export function getDeviceDetectResultMeta(phase: Exclude<DeviceDetectPhase, 'checking'>): DeviceDetectResultMeta {
  if (phase === 'success') {
    return {
      icon: 'status/rx_ic_check_fill',
      iconColor: 'var(--colors-icon-icon-success)',
      title: $t('检测通过'),
      desc: $t('设备连通正常，且未匹配到平台半年内的历史库，可放心绑定账号。'),
    }
  }
  if (phase === 'connectivity-failed') {
    return {
      icon: 'base/rx_ic_delete_fill',
      iconColor: 'var(--colors-icon-icon-error)',
      title: $t('设备连通失败'),
      desc: $t('无法连通该设备，请检查主机 / 端口 / 账号密码后重试'),
    }
  }
  return {
    icon: 'base/rx_ic_warn_fill',
    iconColor: 'var(--colors-icon-icon-warning)',
    title: $t('检测到关联风险'),
    desc: $t('该设备在过去 6 个月内曾被导入使用，继续绑定可能造成账号关联风险，建议更换设备。'),
  }
}

/** 计算检测步骤进度（进行中，带部分偏移） */
export function calcCheckingStepProgress(stepIndex: number, totalSteps: number, partial = 0.35) {
  return Math.round(((stepIndex + partial) / totalSteps) * 100)
}

/** 计算检测步骤进度（步骤已完成） */
export function calcCheckingStepComplete(stepIndex: number, totalSteps: number) {
  return Math.round((stepIndex / totalSteps) * 100)
}

/**
 * 设备连通性与历史库检测
 */
export function useDeviceDetection() {
  const { testProxy } = useCheckProxy()

  /** 依次执行连通性检测与可选的历史库匹配 */
  async function runDeviceDetection(
    formData: DeviceDetectionParams,
    options: RunDeviceDetectionOptions = {},
  ): Promise<DeviceDetectionResult> {
    const { isDirect, enableHistoryCheck = true } = options
    const id = formData.id != null && formData.id !== '' && formData.id !== 0 && String(formData.id) !== '0'
      ? formData.id
      : undefined

    const result = await testProxy({
      ...formData,
      id,
      isDirect: isDirect ?? formData.isDirect,
      apiCheck: formData.proxyType === ProxyType.buy && !!id,
    })

    if (result.error || result.checkStatus !== ProxyCheckStatus.success) {
      return {
        phase: 'connectivity-failed',
        checkResult: result,
        historyMatched: false,
      }
    }

    if (!enableHistoryCheck) {
      return {
        phase: 'success',
        checkResult: result,
        historyMatched: false,
      }
    }

    const historyMatched = await checkDeviceHistoryMatch({
      host: String(formData.host ?? ''),
      port: String(formData.port ?? ''),
      proxyUserName: formData.proxyUserName,
      proxyPassword: formData.proxyPassword,
    })

    return {
      phase: historyMatched ? 'history-risk' : 'success',
      checkResult: result,
      historyMatched,
    }
  }

  return { runDeviceDetection }
}

/**
 * 设备检测会话：统一管理阶段、结果与重跑
 */
export function useDeviceDetectionSession() {
  const { runDeviceDetection } = useDeviceDetection()
  const phase = ref<DeviceDetectPhase>('checking')
  const checkResult = ref<CheckResult | null>(null)
  const historyMatched = ref(false)

  async function run(formData: DeviceDetectionParams, options: RunDeviceDetectionOptions = {}) {
    phase.value = 'checking'
    checkResult.value = null
    historyMatched.value = false

    const detection = await runDeviceDetection(formData, options)
    checkResult.value = detection.checkResult
    historyMatched.value = detection.historyMatched
    phase.value = detection.phase
    return detection
  }

  return {
    phase,
    checkResult,
    historyMatched,
    run,
  }
}
