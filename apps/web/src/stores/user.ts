import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { LoginCreateData } from '@roxy/backend-api'

type UserInfo = Partial<LoginCreateData['data']>

export const useUserStore = defineStore('user', () => {
  const userInfo = ref<UserInfo>({})

  function setUserInfo(info: UserInfo) {
    userInfo.value = info
  }

  function clearUserInfo() {
    userInfo.value = {}
  }

  return { userInfo, setUserInfo, clearUserInfo }
}, {
  persist: true,
})
