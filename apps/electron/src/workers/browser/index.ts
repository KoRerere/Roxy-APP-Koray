import { parentPort } from 'node:worker_threads'

parentPort?.on('message', (message) => {
  console.log('Message from main thread:', message)
  parentPort?.postMessage('Hello from worker thread!')
})

parentPort?.postMessage('Hello from worker thread!')
