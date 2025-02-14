import { usePrimeVue } from "primevue/config"
import { $t } from "/@/locales"

// https://primevue.org/configuration/#localeapi
export function updatePrimeVueLocale() {
  const primevue = usePrimeVue()

  primevue.config.locale!.selectionMessage = $t('已选择{count}项', { count: '{0}' })
}
