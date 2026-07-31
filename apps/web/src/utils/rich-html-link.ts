import type { Router } from 'vue-router'
import { emitter, type MittEvents } from '/@/utils/eventBus'

const ROXY_ACTION_PREFIX = 'roxy-action:'

/** 后端 v-html 链接 action 处理器 */
export type RichHtmlActionHandler = (
  params: URLSearchParams,
  ctx: RichHtmlActionContext,
) => void | Promise<void>

/** action 执行上下文 */
export interface RichHtmlActionContext {
  router: Router
}

/** 富文本链接点击处理选项 */
export interface HandleRichHtmlLinkOptions {
  router: Router
  /** 自定义 SPA 跳转；未提供时使用默认 router.replace */
  onNavigate?: (url: URL) => void
  /** 相对路径链接是否拦截 target="_blank"（升级提示等 Electron 场景） */
  interceptBlankTarget?: boolean
}

const actionRegistry = new Map<string, RichHtmlActionHandler>()

/** 注册 v-html 链接 action，供业务模块按需扩展 */
export function registerRichHtmlAction(name: string, handler: RichHtmlActionHandler) {
  actionRegistry.set(name, handler)
}

/** 解析 roxy-action: 协议链接 */
function parseRoxyAction(href: string): { action: string, params: URLSearchParams } | null {
  if (!href.startsWith(ROXY_ACTION_PREFIX))
    return null

  const rest = href.slice(ROXY_ACTION_PREFIX.length)
  const qIndex = rest.indexOf('?')
  const action = qIndex === -1 ? rest : rest.slice(0, qIndex)
  const params = new URLSearchParams(qIndex === -1 ? '' : rest.slice(qIndex + 1))
  return { action, params }
}

/** 默认 SPA 站内跳转 */
export function navigateByRichHtmlUrl(router: Router, url: URL) {
  router.replace({
    path: url.pathname,
    query: {
      ...Object.fromEntries(url.searchParams),
      _t: Date.now(),
    },
  })
}

/** 兼容旧版 javascript:showLiveChat 链接，仅识别已知安全模式 */
function handleLegacyJavascript(href: string) {
  if (href.includes('showLiveChat'))
    globalThis.showLiveChat?.()
}

function registerBuiltinActions() {
  registerRichHtmlAction('live-chat', () => {
    globalThis.showLiveChat?.()
  })

  registerRichHtmlAction('route', (params, ctx) => {
    const name = params.get('name')
    const path = params.get('path')
    const query = Object.fromEntries(params.entries())
    delete query.name
    delete query.path
    query._t = String(Date.now())

    if (name) {
      ctx.router.replace({ name, query })
      return
    }
    if (path) {
      ctx.router.replace({ path, query })
    }
  })

  registerRichHtmlAction('emit', (params) => {
    const event = params.get('event')
    if (!event)
      return

    const payload = params.get('payload')
    if (payload) {
      try {
        emitter.emit(event as keyof MittEvents, JSON.parse(payload))
        return
      }
      catch {
        console.warn('[rich-html-link] Failed to parse emit payload')
      }
    }
    emitter.emit(event as keyof MittEvents)
  })
}

registerBuiltinActions()

/**
 * 处理 v-html 富文本中的链接点击
 * 支持 roxy-action: 协议、旧版 javascript:showLiveChat、站内 SPA 路由
 */
export function handleRichHtmlLinkClick(e: MouseEvent, options: HandleRichHtmlLinkOptions) {
  const target = e.target as HTMLElement
  const link = target.closest('a')
  if (!link)
    return

  const interceptBlank = options.interceptBlankTarget ?? false
  if (!interceptBlank && link.target === '_blank')
    return

  const href = link.getAttribute('href')
  if (!href)
    return

  const roxyAction = parseRoxyAction(href)
  if (roxyAction) {
    e.preventDefault()
    const handler = actionRegistry.get(roxyAction.action)
    if (handler) {
      void handler(roxyAction.params, { router: options.router })
    }
    else {
      console.warn(`[rich-html-link] Unknown action: ${roxyAction.action}`)
    }
    return
  }

  if (href.startsWith('javascript:')) {
    e.preventDefault()
    handleLegacyJavascript(href)
    return
  }

  if (href.startsWith('http'))
    return

  e.preventDefault()

  const url = new URL(href.slice(href.startsWith('#') ? 1 : 0), location.origin)
  if (options.onNavigate) {
    options.onNavigate(url)
    return
  }

  navigateByRichHtmlUrl(options.router, url)
}
