import { usePrimeVue } from "primevue/config"
import { $t } from "/@/locales"

// https://primevue.org/configuration/#localeapi
export function updatePrimeVueLocale() {
  const primevue = usePrimeVue()

  if (!primevue.config.locale) {
    return
  }

  primevue.config.locale.selectionMessage = $t('已选择{count}项', { count: '{0}' })
  primevue.config.locale.emptyMessage = $t('暂无数据')
}
