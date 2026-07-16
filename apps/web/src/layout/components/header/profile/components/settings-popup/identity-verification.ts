import {
  type KycStatusItem,
  KycStatusItemAuthTypeEnum,
  KycStatusItemStatusEnum,
  type KycStatusResult,
} from '@roxy/backend-api'
import { API } from '/@/api'

export type IdentityVerificationStatus = 'unverified' | 'pending' | 'rejected' | 'verified'
export type IdentityVerificationType = 'personal' | 'enterprise'

export interface PersonalVerificationDetails {
  type: 'personal'
  maskedName: string
  maskedPhone: string
  maskedIdNumber: string
}

export interface EnterpriseVerificationDetails {
  type: 'enterprise'
  companyName: string
  creditCode: string
  maskedLegalName: string
  maskedIdNumber: string
  licenseImageUrl: string
}

export type IdentityVerificationDetails = PersonalVerificationDetails | EnterpriseVerificationDetails

export interface IdentityRejectedReason {
  type: IdentityVerificationType
  failReason: string
}

export interface IdentityVerificationInfo {
  status: IdentityVerificationStatus
  type?: IdentityVerificationType
  details?: IdentityVerificationDetails
  failReason?: string
  rejectedReasons?: IdentityRejectedReason[]
  unlocked?: boolean
}

const identityState = ref<IdentityVerificationInfo>({
  status: 'unverified',
})

const STATUS_PRIORITY: Record<number, number> = {
  [KycStatusItemStatusEnum.Value2]: 4,
  [KycStatusItemStatusEnum.Value1]: 3,
  [KycStatusItemStatusEnum.Value3]: 2,
  [KycStatusItemStatusEnum.Value0]: 1,
}

function mapApiStatus(status?: KycStatusItemStatusEnum): IdentityVerificationStatus {
  switch (status) {
    case KycStatusItemStatusEnum.Value1:
      return 'pending'
    case KycStatusItemStatusEnum.Value2:
      return 'verified'
    case KycStatusItemStatusEnum.Value3:
      return 'rejected'
    default:
      return 'unverified'
  }
}

function mapAuthType(authType?: KycStatusItemAuthTypeEnum): IdentityVerificationType {
  return authType === KycStatusItemAuthTypeEnum.Enterprise ? 'enterprise' : 'personal'
}

function getReviewedAtTime(item: KycStatusItem) {
  const reviewedAt = item.reviewedAt?.trim()
  if (!reviewedAt)
    return 0

  const time = Date.parse(reviewedAt.replace(' ', 'T'))
  return Number.isNaN(time) ? 0 : time
}

function compareKycCandidates(
  a: { type: IdentityVerificationType, item: KycStatusItem },
  b: { type: IdentityVerificationType, item: KycStatusItem },
) {
  const priorityDiff = (STATUS_PRIORITY[b.item.status ?? 0] ?? 0) - (STATUS_PRIORITY[a.item.status ?? 0] ?? 0)
  if (priorityDiff !== 0)
    return priorityDiff

  return getReviewedAtTime(b.item) - getReviewedAtTime(a.item)
}

function collectRejectedReasons(result: KycStatusResult): IdentityRejectedReason[] {
  const candidates: Array<{ type: IdentityVerificationType, item: KycStatusItem }> = []

  if (result.personal && mapApiStatus(result.personal.status) === 'rejected' && result.personal.failReason?.trim())
    candidates.push({ type: 'personal', item: result.personal })
  if (result.enterprise && mapApiStatus(result.enterprise.status) === 'rejected' && result.enterprise.failReason?.trim())
    candidates.push({ type: 'enterprise', item: result.enterprise })

  return [...candidates]
    .sort(compareKycCandidates)
    .map(({ type, item }) => ({
      type,
      failReason: item.failReason!.trim(),
    }))
}

export function formatIdentityRejectedTooltip(rejectedReasons?: IdentityRejectedReason[]) {
  if (!rejectedReasons?.length)
    return ''

  return rejectedReasons.map(({ type, failReason }) => {
    const label = type === 'personal' ? $t('个人认证') : $t('企业认证')
    return `${label}：${failReason}`
  }).join('\n')
}

function mapKycStatusItemToDetails(
  item: KycStatusItem,
  type: IdentityVerificationType,
): IdentityVerificationDetails | undefined {
  if (type === 'personal') {
    const maskedName = item.realNameMasked || item.realName
    const maskedIdNumber = item.idNumberMasked || item.idNumber
    if (!maskedName && !maskedIdNumber)
      return undefined

    return {
      type: 'personal',
      maskedName: maskedName ?? '',
      maskedPhone: item.phoneMasked || item.phone || '',
      maskedIdNumber: maskedIdNumber ?? '',
    }
  }

  const companyName = item.companyNameMasked || item.companyName
  const creditCode = item.creditCodeMasked || item.creditCode
  const maskedLegalName = item.legalNameMasked || item.legalName
  const maskedIdNumber = item.legalIdNumberMasked || item.legalIdNumber
  if (!companyName && !creditCode && !maskedLegalName && !maskedIdNumber)
    return undefined

  return {
    type: 'enterprise',
    companyName: companyName ?? '',
    creditCode: creditCode ?? '',
    maskedLegalName: maskedLegalName ?? '',
    maskedIdNumber: maskedIdNumber ?? '',
    licenseImageUrl: item.licenseUrl ?? '',
  }
}

function resolveEffectiveKyc(result: KycStatusResult) {
  const candidates: Array<{ type: IdentityVerificationType, item: KycStatusItem }> = []

  if (result.personal)
    candidates.push({ type: 'personal', item: result.personal })
  if (result.enterprise)
    candidates.push({ type: 'enterprise', item: result.enterprise })

  if (!candidates.length)
    return { status: 'unverified' as const }

  const effective = [...candidates].sort(compareKycCandidates)[0]!

  const status = mapApiStatus(effective.item.status)
  if (status === 'unverified')
    return { status }

  const type = mapAuthType(effective.item.authType) || effective.type
  const details = mapKycStatusItemToDetails(effective.item, type)

  return {
    status,
    type,
    details,
    failReason: effective.item.failReason,
  }
}

function buildIdentityInfo(result?: KycStatusResult): IdentityVerificationInfo {
  if (!result)
    return { status: 'unverified' }

  const effective = resolveEffectiveKyc(result)
  const rejectedReasons = effective.status === 'rejected'
    ? collectRejectedReasons(result)
    : undefined

  return {
    ...effective,
    rejectedReasons,
    unlocked: result.unlocked,
  }
}

export async function fetchIdentityStatus(): Promise<IdentityVerificationInfo> {
  const { code, data } = await API.kyc.kycStatus()
  if (code !== 0) {
    return { ...identityState.value }
  }

  const info = buildIdentityInfo(data)
  identityState.value = info
  return info
}

export function getIdentityStatus() {
  return identityState
}

export type IdentityPollingScope = 'dialog' | 'profilesPanel'

const IDENTITY_POLL_INTERVAL_MS = 10_000

const pollingScopes = reactive({
  dialog: false,
  profilesPanel: false,
})

const settledCallbacks = new Set<(info: IdentityVerificationInfo) => void>()

let pollTimer: ReturnType<typeof setInterval> | null = null

function shouldPollIdentityStatus() {
  return (pollingScopes.dialog || pollingScopes.profilesPanel)
    && identityState.value.status === 'pending'
}

function notifyIdentityStatusIfSettled(
  prevStatus: IdentityVerificationStatus,
  info: IdentityVerificationInfo,
) {
  if (prevStatus === 'pending' && info.status !== 'pending') {
    settledCallbacks.forEach(callback => callback(info))
  }
}

async function pollIdentityStatusOnce() {
  if (!shouldPollIdentityStatus()) {
    stopIdentityStatusPolling()
    return
  }

  const prevStatus = identityState.value.status
  if (prevStatus !== 'pending') {
    stopIdentityStatusPolling()
    return
  }

  try {
    const info = await fetchIdentityStatus()
    notifyIdentityStatusIfSettled(prevStatus, info)
    if (info.status !== 'pending')
      stopIdentityStatusPolling()
  }
  catch (error) {
    console.warn('[IdentityVerification] poll status failed:', error)
  }
}

function startIdentityStatusPolling() {
  if (pollTimer)
    return

  void pollIdentityStatusOnce()
  pollTimer = setInterval(pollIdentityStatusOnce, IDENTITY_POLL_INTERVAL_MS)
}

export function stopIdentityStatusPolling() {
  if (!pollTimer)
    return

  clearInterval(pollTimer)
  pollTimer = null
}

export function syncIdentityStatusPolling() {
  if (shouldPollIdentityStatus())
    startIdentityStatusPolling()
  else
    stopIdentityStatusPolling()
}

export function setIdentityPollingScope(scope: IdentityPollingScope, active: boolean) {
  if (scope === 'dialog')
    pollingScopes.dialog = active
  else
    pollingScopes.profilesPanel = active

  syncIdentityStatusPolling()
}

export async function fetchIdentityStatusWithNotify(): Promise<IdentityVerificationInfo> {
  const prevStatus = identityState.value.status
  const info = await fetchIdentityStatus()
  notifyIdentityStatusIfSettled(prevStatus, info)
  return info
}

export function onIdentityStatusSettled(callback: (info: IdentityVerificationInfo) => void) {
  settledCallbacks.add(callback)
  return () => settledCallbacks.delete(callback)
}

export interface PersonalSubmitPayload {
  realName: string
  idNumber: string
  idFront: string
  idBack: string
}

export interface EnterpriseSubmitPayload {
  companyName: string
  creditCode: string
  legalName: string
  idNumber: string
  license: string
}

/** 与 KycPersonalSubmitRequest.idNumber / KycEnterpriseSubmitRequest.legalIdNumber 的 @pattern 对齐 */
export const KYC_ID_NUMBER_REGEXP = /^\d{17}[\dXx]$/

/** 与 KycEnterpriseSubmitRequest.creditCode 的 @pattern 对齐 */
export const KYC_CREDIT_CODE_REGEXP = /^[0-9A-Z]{18}$/

export function validateKycIdNumber(value: string) {
  return KYC_ID_NUMBER_REGEXP.test(value.trim())
}

export function validateKycCreditCode(value: string) {
  return KYC_CREDIT_CODE_REGEXP.test(value.trim().toUpperCase())
}

export async function submitIdentityVerification(
  type: IdentityVerificationType,
  payload: PersonalSubmitPayload | EnterpriseSubmitPayload,
): Promise<{ code: number, msg: string }> {
  if (type === 'personal') {
    const personal = payload as PersonalSubmitPayload
    const idNumber = personal.idNumber.trim()
    if (!validateKycIdNumber(idNumber))
      return { code: -1, msg: 'INVALID_KYC_ID_NUMBER' }

    return API.kyc.kycPersonalSubmit({
      realName: personal.realName.trim(),
      idNumber,
      idFrontUrl: personal.idFront,
      idBackUrl: personal.idBack,
      agreed: true,
    })
  }

  const enterprise = payload as EnterpriseSubmitPayload
  const creditCode = enterprise.creditCode.trim().toUpperCase()
  const legalIdNumber = enterprise.idNumber.trim()
  if (!validateKycCreditCode(creditCode))
    return { code: -1, msg: 'INVALID_KYC_CREDIT_CODE' }
  if (!validateKycIdNumber(legalIdNumber))
    return { code: -1, msg: 'INVALID_KYC_ID_NUMBER' }

  return API.kyc.kycEnterpriseSubmit({
    companyName: enterprise.companyName.trim(),
    creditCode,
    legalName: enterprise.legalName.trim(),
    legalIdNumber,
    licenseUrl: enterprise.license,
    agreed: true,
  })
}
