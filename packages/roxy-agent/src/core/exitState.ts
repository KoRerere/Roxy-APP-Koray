import fs from 'node:fs'
import path from 'node:path'
import { agentPaths } from '@/core/storage/agentPaths'

type ExitState = '0' | '1'

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function writeExitState(state: ExitState, filePath: string): void {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, state, 'utf8')
  }
  catch (error) {
    console.error(`[exit-state] Failed to write ${filePath}: ${formatError(error)}`)
  }
}

export function markStarted(filePath: string = agentPaths.exitStateFile): void {
  try {
    if (fs.readFileSync(filePath, 'utf8').trim() === '1') {
      console.warn('Agent crashed last time')
    }
  }
  catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
      console.error(`[exit-state] Failed to read ${filePath}: ${formatError(error)}`)
    }
  }

  writeExitState('1', filePath)
}

export function markExited(filePath: string = agentPaths.exitStateFile): void {
  writeExitState('0', filePath)
}
