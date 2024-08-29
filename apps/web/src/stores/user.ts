import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { LoginCreateData } from '@roxy/backend-api'

export const useUserStore = defineStore('user', () => {
  const userInfo = ref<LoginCreateData['data']>({})

  function setUserInfo(info) {
    userInfo.value = info
  }

  function clearUserInfo() {
    userInfo.value = {}
  }

  return { userInfo, setUserInfo, clearUserInfo }
}, {
  persist: true,
})
