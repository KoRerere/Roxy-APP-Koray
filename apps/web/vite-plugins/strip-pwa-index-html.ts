/** 从 HTML 中移除 vite-plugin-pwa 注入的 head 片段（manifest、SW 注册脚本） */
export function stripPwaHeadInjections(html: string): string {
  return html
    .replace(/<link\s+rel="manifest"[^>]*>\s*/gi, '')
    .replace(
      /<script\s+id="vite-plugin-pwa:register-sw"[^>]*>\s*<\/script>\s*/gi,
      '',
    )
    .replace(
      /<script\s+id="vite-plugin-pwa:inline-sw"[^>]*>[\s\S]*?<\/script>\s*/gi,
      '',
    )
}

/** 开发模式下 PWA 在 `</body>` 前注入的注册脚本 */
export function stripPwaDevBodyInjection(html: string): string {
  return html.replace(
    /<script\s+id="vite-plugin-pwa:register-dev-sw"[^>]*>[\s\S]*?<\/script>\s*/gi,
    '',
  )
}
