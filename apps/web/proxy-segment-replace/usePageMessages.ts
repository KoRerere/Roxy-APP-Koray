import { PAGE_MESSAGES } from './messages'
import { pageLocale } from './locale'

/** 落地页当前语言下的文案 */
export function usePageMessages() {
  return computed(() => PAGE_MESSAGES[pageLocale])
}
