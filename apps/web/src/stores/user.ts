import type { UserGetUserInfoListData } from '@roxy/backend-api'
import { defineStore } from 'pinia'
import { ref } from 'vue'

type UserInfo = Partial<UserGetUserInfoListData['data']>

export const useUserStore = defineStore('user', () => {
  const userInfo = ref<UserInfo>({})
  const tokenRef = ref('')

  function setUserInfo(info: UserInfo) {
    userInfo.value = info
  }

  function clearUserInfo() {
    userInfo.value = {}
    tokenRef.value = ''
  }

  function setToken(token: string) {
    tokenRef.value = token
    window.electronAPI.send('user:setToken', token)
  }

  return { token: tokenRef, userInfo, setUserInfo, clearUserInfo, setToken }
}, {
  persist: true,
})
