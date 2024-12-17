import type { UserGetUserConfigListData, UserGetUserInfoListData } from '@roxy/backend-api'
import mixpanel from 'mixpanel-browser'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { API } from '/@/api'
import { useSimpleLocale } from '/@/stores/locale'
import { useWorkspaceStore } from '/@/stores/workspace'

type UserInfo = Partial<UserGetUserInfoListData['data']>
type UserConfig = Partial<UserGetUserConfigListData['data']>

export const useUserStore = defineStore('user', () => {
  const locale = useSimpleLocale()
  const workspaceStore = useWorkspaceStore()

  const userInfo = ref<UserInfo>({})
  const userConfig = ref<UserConfig>()
  const token = ref(localStorage.getItem('__token') || '')
  const appVersion = ref('')
  const rememberMe = ref(false)
  /** rememberMe 为 true 的时候有值 */
  const password = ref('')

  async function getUserInfo() {
    const { code, data } = await API.base.userGetUserInfoList()
    console.log(data)

    if (code === 0) {
      setUserInfo(data)
      await workspaceStore.getWorkspaceList()
      workspaceStore.setCurrentWorkspace(data.workspaceId)
    }
  }

  function setUserInfo(info: UserInfo) {
    userInfo.value = info
    // 这里是为了避免频繁切换语言的时候，频繁的进程通信导致页面卡顿
    setTimeout(() => {
      window.electronAPI.send('user:setUserInfo', {
        token: token.value,
        userId: userInfo.value.id!,
      })
    })

    requestIdleCallback(async () => {
      mixpanel.identify(String(userInfo.value.id))

      const localNetwork = await window.electronAPI.send('proxy:detectNetwork', 'local')

      mixpanel.people.set({
        $name: userInfo.value.userName,
        $email: userInfo.value.email,
        $language: locale.currentLocale,
        $region: localNetwork.region,
        $city: localNetwork.city,
        $localNetwork: localNetwork,
        $appVersion: appVersion.value,
      })
    })
  }

  function clearUserInfo() {
    userInfo.value = {
      userName: userInfo.value.userName,
    }
    // password.value = ''
    token.value = ''
    localStorage.setItem('__token', '')
    electronAPI.send('user:logout')
    mixpanel.reset()
    workspaceStore.resetWorkspace()
  }

  async function getUserConfig() {
    if (userConfig.value) {
      return userConfig.value
    }
    return updateUserConfig()
  }

  async function updateUserConfig() {
    const { code, data } = await API.base.userGetUserConfigList()
    if (code === 0) {
      userConfig.value = data
    }
    return userConfig.value
  }

  function setToken(_token: string) {
    token.value = _token
  }

  /** 记住我的时候需要保存密码 */
  function setPassword(pwd: string) {
    password.value = btoa(pwd)
  }

  scheduler.postTask(() => {
    if (token.value) {
      getUserInfo()
    }
  }, { priority: 'background' })

  electronAPI.send('app:getAppVersion').then((version) => {
    appVersion.value = version
  })

  return {
    token,
    rememberMe,
    userInfo,
    password,
    appVersion,
    setPassword,
    clearUserInfo,
    setToken,
    getUserInfo,
    getUserConfig,
    updateUserConfig,
  }
}, {
  persist: true,
})
