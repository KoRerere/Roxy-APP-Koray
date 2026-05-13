/// <reference types="vite/client" />
/// <reference types="vite-svg-loader" />
declare const __WEB_VERSION__: string

interface ImportMetaEnv {
  /** 中文 Web App 根地址，与语言 zh-* 对应 */
  readonly VITE_LOCALE_APP_ORIGIN_ZH: string
  /** 非中文 Web App 根地址 */
  readonly VITE_LOCALE_APP_ORIGIN_EN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
