import { useAppVersionUpdateReport } from './useAppVersionUpdateReport'
import { useKickedOut } from './useKickedOut'
import { useMainWindowNavigation } from './useMainWindowNavigation'
import { useRestoreWindow } from './useRestoreWindow'
import { useRoxyClawAutoStart } from './useRoxyClawAutoStart'

/** 应用级全局初始化：组合各子 hook，在 App.vue 根组件中调用一次。 */
export function useApp() {
  useMainWindowNavigation()
  useRoxyClawAutoStart()
  useKickedOut()
  useAppVersionUpdateReport()
  useRestoreWindow()
}
