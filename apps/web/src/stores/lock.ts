import { safeParseJSON } from '/@/utils'
import { useSubscribe } from '/@/components/business/global-component/useSubscribe'

const LOCK_KEY = '__lock__';

export const useLock = defineStore('lock', () => {
  const { isMainWindow } = useSubscribe()

  const defaultValue = {
    password: '',
    openScreenLock: false,
  }
  let __localLockData = localStorage.getItem(LOCK_KEY);
  // 兼容localStorage.getItem(LOCK_KEY)返回值为字符串的'null'，导致页面奔溃
  if (__localLockData == 'null') {
    __localLockData = JSON.stringify(defaultValue)
  }
  const localLockData = __localLockData || JSON.stringify(defaultValue);
  const lockData = reactive(safeParseJSON(localLockData, defaultValue))

  const route = useRoute()
  const isLocked = computed(() => lockData.password && lockData.openScreenLock && route.name !== 'login' && isMainWindow.value);

  async function sha256(password: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  // 密码是否正确
  async function checkPassword(password: string) {
    const text = await sha256(password)
    return text === lockData.password
  }

  const openLockMark = async () => {
    lockData.openScreenLock = true;
    localStorage.setItem(LOCK_KEY, JSON.stringify(lockData))
  }

  const closeLockMark = async () => {
    lockData.openScreenLock = false;
    localStorage.setItem(LOCK_KEY, JSON.stringify(lockData))
  }

  const setPassword = async (password: string) => {
    if (password) {
      lockData.password = await sha256(password)
    } else {
      lockData.password = '';
    }
    localStorage.setItem(LOCK_KEY, JSON.stringify(lockData))
  }

  const resetLockData = () => {
    lockData.password = ''
    lockData.openScreenLock = false
    localStorage.setItem(LOCK_KEY, JSON.stringify(lockData))
  }

  onMounted(() => {
    const handleStorage = () => {
      localStorage.setItem(LOCK_KEY, JSON.stringify(lockData))
    }
    window.addEventListener("storage", handleStorage);
    onBeforeUnmount(() => {
      window.removeEventListener("storage", handleStorage);
    })
  })

  return {
    lockData,
    resetLockData,
    isLocked,
    checkPassword,
    openLockMark,
    setPassword,
    closeLockMark
  }
})
