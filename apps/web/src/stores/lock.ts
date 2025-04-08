
export const useLock = defineStore('lock', () => {
  const lockData = reactive({
    password: '',
    openScreenLock: false,
  })

  const setLockData = (data: { password?: string, openScreenLock?: boolean }) => {
    Object.assign(lockData, data)
  }

  return {
    lockData,
    setLockData
  }
}, {
  persist: {
    storage: localStorage,
    pick: ['lockData'],
  },
})
