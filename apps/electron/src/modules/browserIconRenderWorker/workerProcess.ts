import type { BrowserIconRenderWorkerRequest } from './taskTypes'
import { writeBrowserIconFile } from './writeBrowserIcon'

process.parentPort?.on('message', async (event) => {
  const { taskId, payload } = event.data as BrowserIconRenderWorkerRequest

  try {
    await writeBrowserIconFile(payload)
    process.parentPort?.postMessage({ taskId, status: 'success' })
  }
  catch (error) {
    process.parentPort?.postMessage({
      taskId,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    })
  }
})
