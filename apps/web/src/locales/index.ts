import { i18n, loadLocaleMessages, loadLocalesMap, setupI18n } from './i18n'

// 保存原始的 $t 方法
const originalT = i18n.global.t

/**
 * 创建自定义的 $t 方法
 */
i18n.global.t = function (key, ...args: any[]) {
  const result = originalT.apply(this, [key, ...args])

  // 返回原始的结果
  return result || key
}

const $t = i18n.global.t

export { $t, i18n, loadLocaleMessages, loadLocalesMap, setupI18n }
export {
  type ImportLocaleFn,
  type LocaleSetupOptions,
  type SupportedLanguagesType,
} from './typing'
// export type { CompileError } from '@intlify/core-base';

export { useI18n } from 'vue-i18n'

export type { Locale } from 'vue-i18n'
