import { basename } from 'node:path'
import type { PluginOption } from 'vite'
import { stripPwaDevBodyInjection, stripPwaHeadInjections } from './strip-pwa-index-html'

/** 仅在这些 HTML 入口保留 vite-plugin-pwa 注入（多页构建默认会注入所有入口） */
export const PWA_HTML_ENTRY_BASENAMES = new Set(['index.html', 'launch.html'])

/**
 * 须放在 `VitePWA()` 之后，从非白名单 HTML 中剥离 manifest 与 SW 注册。
 */
export function vitePwaLimitToHtmlEntries(
  allowedBasenames: Set<string> = PWA_HTML_ENTRY_BASENAMES,
): PluginOption {
  return {
    name: 'vite-pwa-limit-html-entries',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const name = basename(ctx.path)
        if (allowedBasenames.has(name))
          return html
        return stripPwaDevBodyInjection(stripPwaHeadInjections(html))
      },
    },
  }
}
