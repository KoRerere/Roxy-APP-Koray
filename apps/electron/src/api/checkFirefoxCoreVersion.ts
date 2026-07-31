import { coreManager } from '/@/modules/browser'
import { createCoreVersionChecker } from './createCoreVersionChecker'

export const checkFirefoxCoreVersion = createCoreVersionChecker({
  logPrefix: 'checkFirefoxCoreVersion',
  headerName: 'r-firefox_core_last_version_list',
  getLastCoreVersionList: () => coreManager.firefoxCoreManager.lastCoreVersionList,
  fetchAvailableCoreList: () => coreManager.firefoxCoreManager.fetchAvailableCoreList(),
})
