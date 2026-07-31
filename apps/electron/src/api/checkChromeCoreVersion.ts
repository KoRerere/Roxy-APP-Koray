import { coreManager } from '/@/modules/browser'
import { createCoreVersionChecker } from './createCoreVersionChecker'

export const checkChromeCoreVersion = createCoreVersionChecker({
  logPrefix: 'checkChromeCoreVersion',
  headerName: 'r-core_last_version_list',
  getLastCoreVersionList: () => coreManager.chromeCoreManager.lastCoreVersionList,
  fetchAvailableCoreList: () => coreManager.chromeCoreManager.fetchAvailableCoreList(),
})
