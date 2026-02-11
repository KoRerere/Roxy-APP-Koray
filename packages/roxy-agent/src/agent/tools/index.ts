import { fileSystemTools } from './file_system'
import { orchestratorTools } from './orchestrator'
import { twoFactorTools } from './two-factor'

export function getTools() {
  return [
    ...fileSystemTools,
    ...twoFactorTools,
    ...orchestratorTools,
  ]
}

export function getToolsForWorker() {
  return [
    ...fileSystemTools,
    ...twoFactorTools,
  ]
}
