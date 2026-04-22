import primitivesTokens from '/@/styles/primevuePresets/_Primitives_tokens.json'
import { updatePreset } from '@primeuix/themes'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useUserStore } from '/@/stores/user'
import { API } from '/@/api'
import { isMainWindow } from '/@/utils'
import { SWITCH_THEME_CHANNEL_NAME } from '/@/constants/channel'
import { debounce } from 'es-toolkit'

type ColorScheme = 'light' | 'dark' | 'system'

export function getColorSchemeList() {
  return [
    {
      label: $t('跟随系统'),
      value: 'system',
      icon: 'base/rx_ic_laptop',
    },
    {
      label: $t('浅色模式'),
      value: 'light',
      icon: 'base/rx_ic_sun',
    },
    {
      label: $t('深色模式'),
      value: 'dark',
      icon: 'base/rx_ic_moon',
    },
  ]
}

const channel = new BroadcastChannel(SWITCH_THEME_CHANNEL_NAME)

export const useThemeStore = defineStore('theme', () => {
  const userStore = useUserStore()
  const theme = ref<ColorScheme>('system')
  const realTheme = ref<Omit<ColorScheme, 'system'>>('light')

  const isDarkTheme = computed(() => realTheme.value === 'dark')

  async function setTheme(value: ColorScheme) {
    if (userStore.token && isMainWindow && theme.value !== value) {
      API.base.userSetUserConfigCreate({ colorScheme: value })
    }
    theme.value = value
  }

  watch(() => userStore.userConfig?.colorScheme, () => {
    const colorScheme = userStore.userConfig?.colorScheme
    colorScheme && setTheme(colorScheme as ColorScheme)
  })

  const toggleTheme = debounce(() => {
    if (theme.value === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', systemTheme)
      document.documentElement.classList.toggle('app-dark', systemTheme === 'dark')
      realTheme.value = systemTheme
    }
    else {
      document.documentElement.setAttribute('data-theme', theme.value)
      realTheme.value = theme.value
      document.documentElement.classList.toggle('app-dark', theme.value === 'dark')
    }
    // 更新 primevue 的 primitive 以适应不同风格 theme
    updatePreset({
      primitive: primitivesTokens[realTheme.value as keyof typeof primitivesTokens],
    })
    channel.postMessage({ theme: theme.value })

    if (isMainWindow) {
      globalThis.electronAPI.send('app:setSystemTheme', theme.value)
    }
  }, 0)

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', toggleTheme)

  watch(theme, toggleTheme, {
    immediate: true,
  })

  // 监听其他窗口/标签页发来的消息
  channel.onmessage = debounce((event) => {
    if (!isMainWindow && event.data.theme !== theme.value) {
      console.log('Received message:', event.data)
      theme.value = event.data.theme
    }
  }, 60)

  return { theme, realTheme, isDarkTheme, setTheme }
}, {
  persist: true,
})
