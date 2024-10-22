import type { UserGetUserInfoListData } from '@roxy/backend-api'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { API } from '/@/api'

type UserInfo = Partial<UserGetUserInfoListData['data']>

export const useUserStore = defineStore('user', () => {
  const userInfo = ref<UserInfo>({})
  const tokenRef = ref('')

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
  }

  function clearUserInfo() {
    userInfo.value = {
      userName: userInfo.value.userName,
    }
    tokenRef.value = ''
    electronAPI.send('user:logout')
  }

  function setToken(token: string) {
    tokenRef.value = token
  }

  scheduler.postTask(() => {
    if (tokenRef.value) {
      getUserInfo()
    }
  }, { priority: 'background' })

  return { token: tokenRef, userInfo, setUserInfo, clearUserInfo, setToken, getUserInfo }
}, {
  persist: true,
})
