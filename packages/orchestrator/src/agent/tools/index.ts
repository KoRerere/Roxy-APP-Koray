import { fileSystemTools } from './file_system'
import { twoFactorTools } from './two-factor'

export function getTools() {
  return [
    ...fileSystemTools,
    ...twoFactorTools,
  ]
}