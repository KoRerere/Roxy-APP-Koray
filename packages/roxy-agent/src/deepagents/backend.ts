import { FilesystemBackend, LocalShellBackend } from 'deepagents'
import { createDisableSubagentMiddleware, createRoxySkillsMiddleware, createToolErrorFallbackMiddleware } from './middlewares/index.js'
import { loadSkillFileTools } from './tools/skill'

const DEEPAGENT_ROOT_DIR = process.cwd()

export interface DeepAgentRuntime {
  backend: any
  middleware: any[]
  tools: any[]
  interruptOn: Record<string, any>
  destroy: () => Promise<void>
}

export async function createDeepAgentRuntime(options?: {
  allowExecution?: boolean
}): Promise<DeepAgentRuntime> {
  const allowExecution = options?.allowExecution === true
  const backend = allowExecution
    ? await LocalShellBackend.create({
        rootDir: DEEPAGENT_ROOT_DIR,
        timeout: 120,
        maxOutputBytes: 100_000,
        inheritEnv: true,
      })
    : new FilesystemBackend({
        rootDir: DEEPAGENT_ROOT_DIR,
      })

  return {
    backend,
    middleware: [
      createRoxySkillsMiddleware(),
      createDisableSubagentMiddleware(),
      createToolErrorFallbackMiddleware(),
    ],
    tools: [...loadSkillFileTools],
    interruptOn: {
      read_file: { allowedDecisions: ['approve', 'reject'] },
      execute: { allowedDecisions: ['approve', 'reject'] },
    } as const,
    destroy: async () => {
      const closable = backend as { close?: () => Promise<void> | void }
      if (typeof closable.close === 'function') {
        await closable.close()
      }
    },
  }
}
