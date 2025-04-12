import { defineStore } from 'pinia'
import { ref } from 'vue'

let getIsMainWindowPromise: Promise<boolean> | null = null

export const useCommonStore = defineStore('common', () => {
  /** 当前是否为 APP 主窗口 */
  const isMainWindow = ref(true)

  const getIsMainWindow = async () => {
    getIsMainWindowPromise ||= electronAPI.send('app:isMainWindow')
    isMainWindow.value = await getIsMainWindowPromise
    return isMainWindow.value
  }

  getIsMainWindow()

  return { getIsMainWindow, isMainWindow }
})
