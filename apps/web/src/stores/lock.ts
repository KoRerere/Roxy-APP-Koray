export const useLock = defineStore('lock', () => {
  const lockData = reactive({
    password: '',
    openScreenLock: false,
  })

  const setLockData = (data: { password?: string, openScreenLock?: boolean }) => {
    Object.assign(lockData, data)
  }

  const resetLockData = () => {
    lockData.password = ''
    lockData.openScreenLock = false
  }

  return {
    lockData,
    setLockData,
    resetLockData,
  }
}, {
  persist: {
    storage: localStorage,
    pick: ['lockData'],
  },
})
