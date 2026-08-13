import type { ConfirmationOptions } from 'primevue/confirmationoptions'
import type { ResourceUpdateMessage } from '@roxy/electron-preload'

/** 确认重启并安装所需的文案与 confirm API */
export interface ConfirmAppQuitAndInstallOptions {
  /** PrimeVue confirm.require */
  require: (options: ConfirmationOptions) => void
  /** 更新将关闭所有窗口等提示 */
  closeAllEntitiesMessage: string
  /** 待安装的更新条目 */
  updateItem: Partial<ResourceUpdateMessage>
}

/**
 * 弹出「重启并安装」确认框，确认后调用 app:quitAndInstall。
 * 供头部更新入口与前置更新公告共用。
 */
export function confirmAppQuitAndInstall(options: ConfirmAppQuitAndInstallOptions) {
  const { require, closeAllEntitiesMessage, updateItem } = options
  require({
    message: closeAllEntitiesMessage,
    header: $t('你确认要重启并安装新版本吗？'),
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('重启'),
    },
    accept: () => {
      globalThis.electronAPI.send('app:quitAndInstall', updateItem)
    },
  })
}

type FeatureTip = { content?: string, [key: string]: any }

/** 从单份 tips 源按 locale 抽出有正文的条目 */
function pickTipsByLocale(
  newFeatureTips: Record<string, any> | string[] | undefined,
  locale: string,
): FeatureTip[] {
  if (!newFeatureTips)
    return []

  // getAppUpgradeCreate 可能是 string[]：当作 HTML 正文
  if (Array.isArray(newFeatureTips)) {
    if (!newFeatureTips.length)
      return []
    if (typeof newFeatureTips[0] === 'string') {
      return (newFeatureTips as string[])
        .filter(content => content?.length)
        .map(content => ({ content }))
    }
    return (newFeatureTips as FeatureTip[]).filter(item => item.content?.length)
  }

  const localFeature = newFeatureTips[locale]
  return localFeature?.[0]?.content
    ? localFeature.filter((item: FeatureTip) => item.content?.length)
    : []
}

/** 按当前语言抽出 tips，并尝试常见 locale 别名 */
export function getLocalizedFeatureTips(
  newFeatureTips: Record<string, any> | string[] | undefined,
  locale: string,
): FeatureTip[] {
  const candidates = [
    locale,
    locale.replace('_', '-'),
    locale.split('-')[0],
    'zh-CN',
    'en',
  ].filter(Boolean)

  for (const key of candidates) {
    const tips = pickTipsByLocale(newFeatureTips, key)
    if (tips.length)
      return tips
  }
  return []
}
