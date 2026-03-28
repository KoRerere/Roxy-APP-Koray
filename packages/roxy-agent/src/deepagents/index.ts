import {
  createDeepAgent,
  createSkillsMiddleware,
  FilesystemBackend,
} from 'deepagents'
import fs from 'node:fs/promises'
import path from 'node:path'
import { env } from '../config'
import { createLLM } from '../llm'
import { ORCHESTRATOR_SYSTEM_PROMPT, SIMPLE_SYSTEM_PROMPT } from './prompt'
import { SqliteSaver } from './sqlite-checkpointer'
import { workerTools } from './tools'

export interface AgentConfig {
  apiKey: string
  baseUrl?: string
  modelName: string
  temperature: number
  maxTokens?: number
  thinking?: {
    budgetTokens: number
  }
}

function getSystemPromptByMode(mode: AgentMode) {
  if (mode === 'orchestrator') {
    return ORCHESTRATOR_SYSTEM_PROMPT
  }
  return SIMPLE_SYSTEM_PROMPT
}

type AgentMode = 'orchestrator' | 'simple'

export async function createAgent(options: {
  config?: AgentConfig
  mode: AgentMode
  name?: string
  tools?: any[]
  conversationId?: string
}) {
  const thinkingConfig = options.config?.thinking || true

  const model = createLLM(!!thinkingConfig)

  /** 技能发现用 agent-bin：middleware 列 /skills/ 时能解析到 agent-bin/skills，AI 才能识别到技能并去调 read_file */
  const fsBackendForList = new FilesystemBackend({ rootDir: env.SKILLS_DIR, virtualMode: true })
  /** read_file 时 Composite 剥掉 /skills/ 后只传 xxx/SKILL.md，需用 agent-bin/skills 做 root 才能拼对路径 */
  // const fsBackendForRead = new FilesystemBackend({ rootDir: skillsDirForRead, virtualMode: true })

  const skillsMiddleware = createSkillsMiddleware({
    backend: fsBackendForList,
    sources: ['/skills/'],
  })

  /** 把 /skills/* 的 read_file 路由到磁盘；不传则走默认 StateBackend（内存）会 not found */
  // const backend = (rt: any) =>
  //   new CompositeBackend(new StateBackend(rt), { '/skills/': fsBackendForRead })

  const tools = options.mode === 'orchestrator' ? workerTools : []
  tools.push(...(options.tools ?? []))

  let checkpointer
  if (options.conversationId) {
    const checkpointPath = path.join(env.CHECKPOINT_DIR!, `checkpoint_${options.conversationId}.db`)
    checkpointer = SqliteSaver.fromConnString(checkpointPath)
  }

  return createDeepAgent({
    model,
    checkpointer,
    backend: fsBackendForList,
    systemPrompt: getSystemPromptByMode(options.mode),
    tools,
    middleware: [skillsMiddleware],
    name: options.name,
  })
}

export async function deleteCheckpoint(conversationId: string): Promise<void> {
  const checkpointPath = path.join(env.CHECKPOINT_DIR!, `checkpoint_${conversationId}.db`)
  await fs.unlink(checkpointPath)
}
