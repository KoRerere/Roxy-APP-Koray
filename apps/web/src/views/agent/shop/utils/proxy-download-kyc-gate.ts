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

/** 是否可在子菜单内嵌展示代理二维码 */
export function canShowProxyQrcode(item: ProxyItem): boolean {
  if (item.isDirect)
    return false

  if (!item.proxyUserName || !item.proxyPassword)
    return false

  if (!isBuyProxy(item))
    return true

  return getWorkspaceKycUnlockedCachedSync() === true
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

async function resolveProxyDownloadRow(item: ProxyItem): Promise<ProxyDownloadRow> {
  const base: ProxyDownloadRow = {
    host: item.host,
    port: item.port,
    username: item.proxyUserName,
    password: item.proxyPassword,
  }

  const encryptItem = item as ProxyItem & {
    isEncryptProxy?: boolean
    proxyEncryptInfo?: string
  }

  if (!encryptItem.isEncryptProxy || !encryptItem.proxyEncryptInfo)
    return base

  const decrypted = await decryptAESGCM(encryptItem.proxyEncryptInfo) as Record<string, string | undefined>

  return {
    host: decrypted.host ?? base.host,
    port: decrypted.port ?? base.port,
    username: decrypted.proxyUserName ?? decrypted.username ?? base.username,
    password: decrypted.proxyPassword ?? decrypted.password ?? base.password,
  }
}

export async function resolveProxyDownloadRows(items: ProxyItem[]) {
  return Promise.all(items.map(item => resolveProxyDownloadRow(item)))
}
