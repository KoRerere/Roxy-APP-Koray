import type { UserGetUserInfoListData } from '@roxy/backend-api'
import mixpanel from 'mixpanel-browser'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { API } from '/@/api'

type UserInfo = Partial<UserGetUserInfoListData['data']>

export const useUserStore = defineStore('user', () => {
  const userInfo = ref<UserInfo>({})
  const tokenRef = ref('')
  const appVersion = ref('')
  const rememberMe = ref(false)
  /** rememberMe 为 true 的时候有值 */
  const password = ref('')

  async function getUserInfo() {
    const { code, data } = await API.base.userGetUserInfoList()
    console.log(data)

    if (code === 0) {
      setUserInfo(data)
    }
  }

  function setUserInfo(info: UserInfo) {
    userInfo.value = info
    window.electronAPI.send('user:setUserInfo', {
      token: tokenRef.value,
      userId: userInfo.value.id!,
    })

    mixpanel.identify(String(userInfo.value.id))
    mixpanel.people.set({ $name: userInfo.value.userName, $email: userInfo.value.email })
  }

  function clearUserInfo() {
    userInfo.value = {
      userName: userInfo.value.userName,
    }
    // password.value = ''
    tokenRef.value = ''
    electronAPI.send('user:logout')
    mixpanel.reset()
  }

  function setToken(token: string) {
    tokenRef.value = token
  }

  /** 记住我的时候需要保存密码 */
  function setPassword(pwd: string) {
    password.value = btoa(pwd)
  }

  scheduler.postTask(() => {
    if (tokenRef.value) {
      getUserInfo()
    }
  }, { priority: 'background' })

  electronAPI.send('app:getAppVersion').then((version) => {
    appVersion.value = version
  })

  return { token: tokenRef, rememberMe, userInfo, password, appVersion, setPassword, clearUserInfo, setToken, getUserInfo }
}, {
  persist: true,
})
