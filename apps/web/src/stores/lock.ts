import { safeParseJSON } from '/@/utils'

export const useLock = defineStore('lock', () => {
  const localLockData = localStorage.getItem('lock')
  const lockData = reactive(safeParseJSON(localLockData, {
    password: '',
    openScreenLock: false,
  }))

  const route = useRoute()
  const isLocked = computed(() => lockData.openScreenLock && route.name !== 'login');

  const setLockData = (data: { password?: string, openScreenLock?: boolean }) => {
    Object.assign(lockData, data)
    localStorage.setItem('lock', JSON.stringify(lockData))
  }

  const resetLockData = () => {
    lockData.password = ''
    lockData.openScreenLock = false
    localStorage.setItem('lock', JSON.stringify(lockData))
  }

  window.addEventListener("storage", (e) => {
    localStorage.setItem('lock', JSON.stringify(lockData))
  });

  return {
    lockData,
    setLockData,
    resetLockData,
    isLocked
  }
})
