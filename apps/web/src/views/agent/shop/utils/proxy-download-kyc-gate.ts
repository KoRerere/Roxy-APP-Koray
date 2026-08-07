import { API } from '/@/api'
import { ProxyType } from '/@/enums'
import { useWorkspaceStore } from '/@/stores/workspace'
import { decryptAESGCM } from '/@/utils'
import { emitter } from '/@/utils/eventBus'
import { isCurrentEcommerceWorkspace } from '/@/utils/workspace-mode'
import { createProxyShopLabels } from './proxy-shop-labels'
import type { ProxyItem } from '../operation'

export type ProxyDownloadBlockVariant = 'member' | 'owner' | 'support'

export interface ProxyDownloadRow {
  host?: string
  port?: string
  username?: string
  password?: string
}

/** 列表接口对未解锁凭据使用的占位符 */
const PROXY_MASKED_PLACEHOLDER = '--'

/** 是否为后端脱敏占位，不能当作真实代理凭据 */
export function isProxyMaskedCredential(value?: string): boolean {
  return !value || value === PROXY_MASKED_PLACEHOLDER
}

/** 合并解密字段与列表字段，脱敏占位不参与回退 */
function pickProxyCredential(decrypted?: string, base?: string): string | undefined {
  if (!isProxyMaskedCredential(decrypted))
    return decrypted
  if (!isProxyMaskedCredential(base))
    return base
  return undefined
}

function getEncryptProxyFields(item: ProxyItem) {
  return item as ProxyItem & {
    isEncryptProxy?: boolean
    proxyEncryptInfo?: string
  }
}

/** 大陆直连默认不可导出；凭据仅在加密包内时实名通过后可解密导出 */
export function isDirectExportBlocked(item: ProxyItem): boolean {
  if (!item.isDirect)
    return false

  const { isEncryptProxy, proxyEncryptInfo } = getEncryptProxyFields(item)
  return !isEncryptProxy || !proxyEncryptInfo
}

/** 行数据是否具备明文代理凭据（非 `--` 占位） */
export function hasPlaintextProxyCredentials(item: ProxyItem): boolean {
  return !isProxyMaskedCredential(item.proxyUserName) && !isProxyMaskedCredential(item.proxyPassword)
}

export function isBuyProxy(item: ProxyItem) {
  return item.proxyType === ProxyType.buy
}

export function hasBuyProxy(items: ProxyItem[]) {
  return items.some(isBuyProxy)
}

export async function fetchWorkspaceKycUnlocked() {
  const { code, data } = await API.kyc.workspaceStatusList()
  if (code !== 0)
    return false

  return Boolean(data?.unlocked)
}

interface WorkspaceKycCacheEntry {
  unlocked: boolean
  /** 仅 unlocked=false 时有效 */
  expiresAt?: number
}

const UNLOCKED_FALSE_TTL_MS = 60_000
const cacheByWorkspace = new Map<number, WorkspaceKycCacheEntry>()
const pendingByWorkspace = new Map<number, Promise<boolean>>()

function isWorkspaceKycCacheValid(entry: WorkspaceKycCacheEntry) {
  if (entry.unlocked)
    return true

  return entry.expiresAt != null && Date.now() < entry.expiresAt
}

export function fetchWorkspaceKycUnlockedCached() {
  const workspaceId = useWorkspaceStore().currentWorkspace?.id
  if (workspaceId == null)
    return fetchWorkspaceKycUnlocked()

  const cached = cacheByWorkspace.get(workspaceId)
  if (cached && isWorkspaceKycCacheValid(cached))
    return Promise.resolve(cached.unlocked)

  const pending = pendingByWorkspace.get(workspaceId)
  if (pending)
    return pending

  const promise = fetchWorkspaceKycUnlocked().then((unlocked) => {
    cacheByWorkspace.set(workspaceId, unlocked
      ? { unlocked: true }
      : { unlocked: false, expiresAt: Date.now() + UNLOCKED_FALSE_TTL_MS })
    return unlocked
  }).finally(() => {
    pendingByWorkspace.delete(workspaceId)
  })

  pendingByWorkspace.set(workspaceId, promise)
  return promise
}

export function resetWorkspaceKycUnlockedCache(workspaceId?: number) {
  if (workspaceId != null) {
    cacheByWorkspace.delete(workspaceId)
    pendingByWorkspace.delete(workspaceId)
    return
  }

  cacheByWorkspace.clear()
  pendingByWorkspace.clear()
}

/** 同步读取当前工作区 KYC 缓存；无有效缓存时返回 null */
export function getWorkspaceKycUnlockedCachedSync(): boolean | null {
  const workspaceId = useWorkspaceStore().currentWorkspace?.id
  if (workspaceId == null)
    return null

  const cached = cacheByWorkspace.get(workspaceId)
  if (!cached || !isWorkspaceKycCacheValid(cached))
    return null

  return cached.unlocked
}

/** 行数据是否具备可导出的代理凭据（明文、加密包，或购买代理的 `--` 脱敏占位） */
export function hasExportableProxyCredentials(item: ProxyItem): boolean {
  if (hasPlaintextProxyCredentials(item))
    return true

  const { isEncryptProxy, proxyEncryptInfo } = getEncryptProxyFields(item)
  if (isEncryptProxy && proxyEncryptInfo)
    return true

  // 购买代理列表常以 `--` 占位；实名通过后由解密或刷新列表获得真实凭据
  if (isBuyProxy(item)
    && item.proxyUserName === PROXY_MASKED_PLACEHOLDER
    && item.proxyPassword === PROXY_MASKED_PLACEHOLDER)
    return true

  return false
}

/** 购买代理是否允许展示导出入口（KYC 缓存未就绪时不隐藏，由组件内异步拦截） */
function isBuyProxyExportAllowedByKycCache(): boolean {
  const kycUnlocked = getWorkspaceKycUnlockedCachedSync()
  return kycUnlocked !== false
}

/** 是否可在子菜单内嵌展示代理二维码 */
export function canShowProxyQrcode(item: ProxyItem): boolean {
  if (isDirectExportBlocked(item))
    return false

  if (!hasExportableProxyCredentials(item))
    return false

  if (!isBuyProxy(item))
    return true

  return isBuyProxyExportAllowedByKycCache()
}

export function getProxyDownloadBlockVariant(locale: string, isOwner: boolean): ProxyDownloadBlockVariant {
  if (locale !== 'zh-CN')
    return 'support'

  return isOwner ? 'owner' : 'member'
}

export function getProxyDownloadBlockTitle(variant: ProxyDownloadBlockVariant) {
  if (variant === 'support')
    return $t('下载权限待开通')
  return $t('无法导出数据')
}

export function getProxyDownloadBlockDescription(variant: ProxyDownloadBlockVariant) {
  const shopLabels = createProxyShopLabels(isCurrentEcommerceWorkspace())
  if (variant === 'member')
    return shopLabels.exportRequiresKycDescMember
  if (variant === 'owner')
    return shopLabels.exportRequiresKycDesc
  return $t('当前无法直接下载，请联系 Roxy AI 技术支持人工审核并开通权限')
}

export function getProxyDownloadBlockTooltip(locale: string, isOwner: boolean) {
  return getProxyDownloadBlockDescription(getProxyDownloadBlockVariant(locale, isOwner))
}

/** 从代理 KYC 拦截入口跳转实名认证 */
export function openProxyKycVerification() {
  emitter.emit('openIdentityVerification', { showRegulatoryNotice: true })
}

/** 解析单行代理导出凭据；加密代理需客户端解密后与下载逻辑一致 */
export async function resolveProxyDownloadRow(item: ProxyItem): Promise<ProxyDownloadRow> {
  const base: ProxyDownloadRow = {
    host: item.host,
    port: item.port,
    username: item.proxyUserName,
    password: item.proxyPassword,
  }

  const { isEncryptProxy, proxyEncryptInfo } = getEncryptProxyFields(item)

  if (!isEncryptProxy || !proxyEncryptInfo)
    return {
      host: pickProxyCredential(undefined, base.host),
      port: pickProxyCredential(undefined, base.port),
      username: pickProxyCredential(undefined, base.username),
      password: pickProxyCredential(undefined, base.password),
    }

  const decrypted = await decryptAESGCM(proxyEncryptInfo) as Record<string, string | undefined>

  return {
    host: pickProxyCredential(decrypted.host, base.host),
    port: pickProxyCredential(decrypted.port, base.port),
    username: pickProxyCredential(decrypted.proxyUserName ?? decrypted.username, base.username),
    password: pickProxyCredential(decrypted.proxyPassword ?? decrypted.password, base.password),
  }
}

export async function resolveProxyDownloadRows(items: ProxyItem[]) {
  return Promise.all(items.map(item => resolveProxyDownloadRow(item)))
}
