import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { UserGetUserInfoListData } from '@roxy/backend-api'

type UserInfo = Partial<UserGetUserInfoListData['data']>

export const useUserStore = defineStore('user', () => {
  const userInfo = ref<UserInfo>({})
  const tokenRef = ref('')

  function setUserInfo(info: UserInfo) {
    userInfo.value = info
  }

  function clearUserInfo() {
    userInfo.value = {}
  }

  function setToken(token: string) {
    tokenRef.value = token
  }

  return { token: tokenRef, userInfo, setUserInfo, clearUserInfo, setToken }
}, {
  persist: true,
})
