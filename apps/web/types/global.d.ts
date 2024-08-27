import type { ElectronAPI } from '@roxy/electron-preload'

declare global {
  var electronAPI: ElectronAPI
}
