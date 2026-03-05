import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'
import PrimeVue from 'primevue/config'
import type { App } from 'vue'
import ConfirmationService from 'primevue/confirmationservice'
import DialogService from 'primevue/dialogservice'
import Ripple from 'primevue/ripple'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import FocusTrap from 'primevue/focustrap'
import { customPreset } from './customPreset'

export function setupPrimeVue(app: App) {
  app.use(ToastService)
  app.use(DialogService)
  app.use(ConfirmationService)

  app.directive('ripple', Ripple)
  app.directive('tooltip', Tooltip)
  app.directive('focustrap', FocusTrap)

  app.use(PrimeVue, {
    ripple: true,
    theme: {
      options: {
        prefix: '', // 去掉 primevue 的默认前缀，基于 primevue 的 bug 运行
        // darkModeSelector: 'html[data-theme="dark"]',
        darkModeSelector: '.app-dark', // primevue bug，4.3.6 版本后，自定义属性失效需要使用 class 选择器，后续版本可能会恢复
      },
      preset: definePreset(Aura, customPreset),
    },
    pt: {
      splitbutton: {
        pcMenu: {
          item: 'text-3.25',
        },
      },
    },
  })
}

// console.log('Aura', Aura)
