import type { ExtensionsInstallStatus, ExtensionsInstallType } from '/@/enums'

export interface InstallType {
  installType: ExtensionsInstallType
  installStatus: ExtensionsInstallStatus[]
  pluginId: number
  projectId: number[]
}
