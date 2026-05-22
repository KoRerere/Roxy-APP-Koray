import { useUserStore } from '/@/stores/user'
import { compare } from 'compare-versions'

export function useAppVersion() {
  const userStore = useUserStore()
  const appVersion = userStore.appVersion

  return {
    appVersion,
    max_3_8_7: compare(appVersion, '3.8.7', '>='),
  }
}
