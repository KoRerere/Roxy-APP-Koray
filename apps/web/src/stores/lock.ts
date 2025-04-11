import { safeParseJSON } from '/@/utils'

export const useLock = defineStore('lock', () => {
  const defaultValue = {
    password: '',
    openScreenLock: false,
  }
  let __localLockData = localStorage.getItem('lock');
  if (__localLockData == 'null') {
    __localLockData = JSON.stringify(defaultValue)
  }
  const localLockData = __localLockData || JSON.stringify(defaultValue);
  const lockData = reactive(safeParseJSON(localLockData, defaultValue))

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
