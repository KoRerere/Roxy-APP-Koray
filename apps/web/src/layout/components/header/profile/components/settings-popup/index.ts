// import { useAbout } from "/@/layout/components/header/profile/components/settings-popup/useAbout";
// import { useKernel } from "/@/layout/components/header/profile/components/settings-popup/useKernel";
import type { SettingsModule } from '/@/layout/components/header/profile/type'
import { $t } from '/@/locales'
import { useUserStore } from '/@/stores/user'
import { useLoginActive } from './useLoginActivity'
import { useNetworkPanel } from './useNetwork'
import { usePreferencesPanel } from './usePreferences'
import { useUserProfilePanel } from './useUserProfile'
import { useAuthentication } from './useAuthentication'
import { getIdentityStatus, setIdentityPollingScope } from './identity-verification'
import type { DynamicDialogInstance } from 'primevue/dynamicdialogoptions'

export type PanelKeyType = ReturnType<typeof getSettings>[number]['name']

export interface Active {
  key: PanelKeyType
  panel: SettingsModule | null
}

export function getSettings() {
  return [
    {
      label: $t('个人信息'),
      name: 'profiles',
      icon: 'base/rx_ic_user_circle',
    },
    {
      label: $t('账号安全'),
      name: 'authentication',
      icon: 'base/rx_ic_key',
    },
    {
      label: $t('软件设置'),
      name: 'preferences',
      icon: 'base/rx_ic_slider',
    },
    {
      label: $t('网络设置'),
      name: 'network',
      icon: 'base/rx_ic_wifi',
    },
    {
      label: $t('登录历史'),
      name: 'loginActivity',
      icon: 'base/rx_ic_monitor',
    },
    // {
    //   label: $t("内核管理"),
    //   name: "kernel",
    //   icon: "base/rx_ic_chrome",
    // },
    // {
    //   label: $t("关于"),
    //   name: "about",
    //   icon: "base/rx_ic_info_line",
    // },
  ] as const
}

export function useSettingsPopup() {
  const dialogRef = inject<ComputedRef<DynamicDialogInstance>>('dialogRef')

  const userStore = useUserStore()

  const { getNetworkPanels } = useNetworkPanel()
  const { getPreferencesPanels } = usePreferencesPanel()
  const { getLoginActivityPanels } = useLoginActive()
  const { getUserProfilePanels } = useUserProfilePanel()
  const { getAuthentication } = useAuthentication()
  // const { getKernelPanels } = useKernel()
  // const { getAboutPanels } = useAbout()

  const promiseMap = {
    preferences: getPreferencesPanels,
    network: getNetworkPanels,
    loginActivity: getLoginActivityPanels,
    authentication: getAuthentication,
    // kernel: getKernelPanels,
    // about: getAboutPanels,
  }

  const activePanel = reactive<Active>({
    key: 'profiles',
    panel: null,
  })

  const settingsPanel = reactive<Partial<Record<PanelKeyType, any>>>({})

  const settings = getSettings().map(item => ({
    ...item,
    command: async () => {
      activePanel.key = item.name
      activePanel.panel = await (settingsPanel[activePanel.key].value ?? settingsPanel[activePanel.key].get())
    },
  }))

  async function initPanels() {
    const data = toRaw(await userStore.getUserConfig())

    Object.entries(promiseMap).forEach(([key, getSettingPanel]) => {
      settingsPanel[key as PanelKeyType] = {
        value: null,
        get: async () => {
          const value = await getSettingPanel(data)
          settingsPanel[key as PanelKeyType].value = value
          return value
        },
      }
    })

    settingsPanel.profiles = {
      value: null,
      get: async () => {
        const value = await getUserProfilePanels(toRaw(userStore.userInfo))
        settingsPanel.profiles.value = value
        return value
      },
    }

    activePanel.panel = await settingsPanel[activePanel.key].get()
  }

  watch(
    () => [activePanel.key, getIdentityStatus().value.status] as const,
    ([key, status]) => {
      setIdentityPollingScope('profilesPanel', key === 'profiles' && status === 'pending')
    },
    { immediate: true, flush: 'sync' },
  )

  onUnmounted(() => {
    setIdentityPollingScope('profilesPanel', false)
  })

  return {
    dialogRef,
    activePanel,
    initPanels,
    panels: ref(settings),
  }
}

// 显示书签只能上传500个url
export class MaximumLimitExceeded extends Error {
  static MAX_BOOKMARK_COUNT = 500
  constructor() {
    super($t('URL 数量超过{count}，请检查文件', { count: MaximumLimitExceeded.MAX_BOOKMARK_COUNT }))
  }
}
