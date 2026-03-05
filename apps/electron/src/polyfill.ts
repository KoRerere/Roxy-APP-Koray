import inspector from 'node:inspector'
import { isDev } from '/@/constants/common'

function enableDebugger() {
  try {
    // 检查是否已经开启了调试器
    if (inspector.url()) {
      console.log('Debugger already enabled:', inspector.url())
      return
    }

    const port = isDev ? 9237 : 9238
    // 只在特定条件下启用调试器
    inspector.open(port, '127.0.0.1', false)
    console.debug(`Debugger started on ws://127.0.0.1:${port}`)
  }
  catch (error) {
    console.warn('Failed to enable debugger:', error)
  }
}

enableDebugger()
