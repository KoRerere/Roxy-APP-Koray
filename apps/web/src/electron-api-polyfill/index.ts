import { sendCallback } from './send-callback'

if (!globalThis.electronAPI) {
  globalThis.electronAPI = {
    send: sendCallback,
    on: () => {},
    getPathForFile: () => '',
    setZoomFactor: () => {},
    versions: {
      electron: '',
      chrome: '',
      node: '',
      v8: '',
    },
  } as const
}
