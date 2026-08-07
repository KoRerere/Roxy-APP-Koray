/**
 * roxy-agent 后端 i18n 文案表。
 *
 * 与前端 i18n 分离的轻量后端本地化：用于 HTTP 响应中返回给用户的错误/提示消息。
 * 语言由 env.SYSTEM_LANGUAGE 决定（Electron 启动时注入）。当前覆盖 zh-CN / en，
 * 结构预留其他 locale；未命中的 locale 或 key 自动回退到 en 表，再回退到 key 本身。
 *
 * 注意：仅放「面向用户、需本地化」的文案。纯技术/开发日志消息（console.warn 等）保持英文，不入表。
 * 占位符用 {name} 形式，由 t() 做插值。
 */

export type Locale = 'zh-CN' | 'en'

export const DEFAULT_LOCALE: Locale = 'en'

export const MESSAGES: Record<Locale, Record<string, string>> = {
  'zh-CN': {
    'common.networkError': '网络异常',
    'script.syncFailed': '同步失败',
    'script.cloudDeleteFailed': '云端删除失败：{detail}，请重试',
    'script.cloudDeleteFailedNetwork': '云端删除失败（连接错误）：{detail}，请重试',
    'script.cloudUpdateFailed': '云端同步失败：{detail}，请重试',
    'script.cloudUpdateFailedNetwork': '云端同步失败（连接错误）：{detail}，请重试',
    'script.contentSaveFailed': '脚本内容保存失败：{detail}，请重试',
    'script.officialReadonly': '官方脚本不支持编辑或删除',
    'script.localUpdateFailed': '本地更新失败',
  },
  'en': {
    'common.networkError': 'Network error',
    'script.syncFailed': 'Sync failed',
    'script.cloudDeleteFailed': 'Failed to delete from cloud: {detail}. Please retry.',
    'script.cloudDeleteFailedNetwork': 'Failed to delete from cloud (connection error): {detail}. Please retry.',
    'script.cloudUpdateFailed': 'Failed to sync changes to cloud: {detail}. Please retry.',
    'script.cloudUpdateFailedNetwork': 'Failed to sync changes to cloud (connection error): {detail}. Please retry.',
    'script.contentSaveFailed': 'Failed to save script content: {detail}. Please retry.',
    'script.officialReadonly': 'Official scripts cannot be edited or deleted',
    'script.localUpdateFailed': 'Local update failed',
  },
}
