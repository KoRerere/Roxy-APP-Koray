import { setupI18n, type SupportedLanguagesType } from "/@/locales";


electronAPI.send("app:getSoftConfig").then((softConfig) => {
  const { language, token } = softConfig;

  setupI18n({ defaultLocale: language as SupportedLanguagesType }).finally(async () => {
    const { app } = await import('./app')
    const { useSimpleLocale } = await import("/@/stores/locale")
    const { useUserStore } = await import("/@/stores/user")

    const simpleLocale = useSimpleLocale();
    const userStore = useUserStore()
    simpleLocale.currentLocale = language;
    userStore.setToken(token || '')
    app.mount('#app')
  })
})
