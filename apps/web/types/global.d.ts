import type { ElectronAPI } from '@roxy/electron-preload'
import type { OverridedMixpanel } from 'mixpanel-browser'

declare global {
  var electronAPI: ElectronAPI
  var mixpanel: OverridedMixpanel
}
