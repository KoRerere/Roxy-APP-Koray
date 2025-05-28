import { definePreset } from '@primevue/themes'
import Aura from '@primevue/themes/aura'
import PrimeVue from "primevue/config";
import type { App } from 'vue';
import ConfirmationService from "primevue/confirmationservice";
import DialogService from "primevue/dialogservice";
import Ripple from "primevue/ripple";
import ToastService from "primevue/toastservice";
import Tooltip from "primevue/tooltip";
import { customPreset } from './customPreset';

export function setupPrimeVue(app: App) {
  app.use(ToastService);
  app.use(DialogService);
  app.use(ConfirmationService);

  app.directive("ripple", Ripple);
  app.directive("tooltip", Tooltip);

  app.use(PrimeVue, {
    ripple: true,
    theme: {
      options: {
        darkModeSelector: 'html[data-theme="dark"]',
      },
      preset: definePreset(Aura, customPreset),
    },
  });
}

// console.log('Aura', Aura)

