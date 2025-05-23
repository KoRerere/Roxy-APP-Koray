import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useUserStore } from '/@/stores/user'
import { API } from '/@/api'
import { isProd } from '/@/utils'

type ColorScheme = 'light' | 'dark' | 'system'

export const colorSchemeList = [
  {
    label: '跟随系统',
    value: 'system',
    icon: "base/rx_ic_doc_api",
  },
  {
    label: '浅色模式',
    value: 'light',
    icon: "base/rx_ic_doc_api",
  },
  {
    label: '深色模式',
    value: 'dark',
    icon: "base/rx_ic_doc_api",
  }
]

export const useThemeStore = defineStore('theme', () => {
  const userStore = useUserStore()
  const theme = ref<ColorScheme>('system')

  async function setTheme(value: ColorScheme) {
    theme.value = value ?? 'system'
    if (userStore.token) {
      API.base.userSetUserConfigCreate({ colorScheme: theme.value });
    }
  }

  watch(() => userStore.userConfig?.colorScheme, () => {
    const colorScheme = userStore.userConfig?.colorScheme
    colorScheme && setTheme(colorScheme)
  })

  watch(theme, toggleTheme, {
    immediate: true
  })

  function toggleTheme() {

    // TODO 生产环境暂时屏蔽
    if (isProd) {
      document.documentElement.setAttribute('data-theme', 'light')
      return
    }

    if (theme.value === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', systemTheme)
    } else {
      document.documentElement.setAttribute('data-theme', theme.value)
    }
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', toggleTheme);


  return { theme, setTheme }
}, {
  persist: true
})
