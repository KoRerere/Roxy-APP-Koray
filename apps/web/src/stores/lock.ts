import { safeParseJSON } from '/@/utils'

const LOCK_KEY = '__lock__';

export const useLock = defineStore('lock', () => {
  const defaultValue = {
    password: '',
    openScreenLock: false,
  }
  let __localLockData = localStorage.getItem(LOCK_KEY);
  if (__localLockData == 'null') {
    __localLockData = JSON.stringify(defaultValue)
  }
  const localLockData = __localLockData || JSON.stringify(defaultValue);
  const lockData = reactive(decrypt(safeParseJSON(localLockData, defaultValue)))

  const route = useRoute()
  const isLocked = computed(() => lockData.openScreenLock && route.name !== 'login');

  // 密码加密
  function encrypt(__lockData: typeof lockData) {
    const data = { ...toRaw(__lockData) }
    data.password = atob(data.password)
    return JSON.stringify(data)
  }

  // 密码解密
  function decrypt(data: any) {
    data.password = data.password ? btoa(data.password) : '';
    return data;
  }

  const setLockData = (data: { password?: string, openScreenLock?: boolean }) => {
    Object.assign(lockData, data)
    localStorage.setItem(LOCK_KEY, encrypt(lockData))
  }

  const resetLockData = () => {
    lockData.password = ''
    lockData.openScreenLock = false
    localStorage.setItem(LOCK_KEY, encrypt(lockData))
  }

  window.addEventListener("storage", (e) => {
    localStorage.setItem(LOCK_KEY, encrypt(lockData))
  });

  return {
    lockData,
    setLockData,
    resetLockData,
    isLocked
  }
})
