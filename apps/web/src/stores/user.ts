import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { LoginCreateData } from '@roxy/backend-api'

export const useUserStore = defineStore('user', () => {
  const userInfo = ref<LoginCreateData>({})

  function setUserInfo(info) {
    userInfo.value = info
  }

  return { userInfo, setUserInfo }
}, {
  persist: true,
})
