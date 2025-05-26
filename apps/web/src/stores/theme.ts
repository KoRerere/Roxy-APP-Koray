import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useUserStore } from '/@/stores/user'
import { API } from '/@/api'
import { isMainWindow, isProd } from '/@/utils'
import { SWITCH_THEME_CHANNEL_NAME } from '/@/constants/channel'
import { debounce } from 'es-toolkit'

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

const channel = new BroadcastChannel(SWITCH_THEME_CHANNEL_NAME);

export const useThemeStore = defineStore('theme', () => {
  const userStore = useUserStore()
  const theme = ref<ColorScheme>('system')
  const realTheme = ref<Omit<ColorScheme, 'system'>>('light')

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
    if (theme.value === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', systemTheme)
      realTheme.value = systemTheme
    } else {
      document.documentElement.setAttribute('data-theme', theme.value)
      realTheme.value = theme.value
    }
    channel.postMessage({ theme: theme.value })
  }

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', toggleTheme);
  // 监听其他窗口/标签页发来的消息
  channel.onmessage = debounce((event) => {
    if (!isMainWindow && event.data.theme !== theme.value) {
      console.log('Received message:', event.data);
      theme.value = event.data.theme
    }
  }, 60);

  return { theme, realTheme, setTheme }
}, {
  persist: true
})
