import {
  createDeepAgent,
  createSkillsMiddleware,
  FilesystemBackend,
} from 'deepagents'
import fs from 'node:fs/promises'
import path from 'node:path'
import { env } from '../config'
import { createLLM } from '../llm'
import { ORCHESTRATOR_SYSTEM_PROMPT, SIMPLE_SYSTEM_PROMPT, SIMPLE_SYSTEM_PROMPT_IM_COMPACT } from './prompt'
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

function getSystemPromptByMode(mode: AgentMode, variant?: 'default' | 'im-compact') {
  if (mode === 'orchestrator') {
    return ORCHESTRATOR_SYSTEM_PROMPT
  }
  if (variant === 'im-compact') {
    return SIMPLE_SYSTEM_PROMPT_IM_COMPACT
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
  promptVariant?: 'default' | 'im-compact'
}) {
  const thinkingConfig = options.config?.thinking || true

  const model = createLLM(!!thinkingConfig)

  /** 技能发现用 agent-bin：middleware 列 /skills/ 时能解析到 agent-bin/skills，AI 才能识别到技能并去调 read_file */
  const fsBackendForList = new FilesystemBackend({ rootDir: env.SKILLS_DIR, virtualMode: true })

  const skillsMiddleware = createSkillsMiddleware({
    backend: fsBackendForList,
    sources: ['/skills/'],
  })

  const tools = options.mode === 'orchestrator' ? workerTools : []
  tools.push(...(options.tools ?? []))

  let checkpointer
  if (options.conversationId) {
    const checkpointPath = path.join(env.CHECKPOINT_DIR, `checkpoint_${options.conversationId}.db`)
    checkpointer = SqliteSaver.fromConnString(checkpointPath)
  }

  return createDeepAgent({
    model,
    checkpointer,
    backend: fsBackendForList,
    systemPrompt: getSystemPromptByMode(options.mode, options.promptVariant),
    tools,
    middleware: [skillsMiddleware],
    name: options.name,
  })
}

export async function deleteCheckpoint(conversationId: string): Promise<void> {
  const checkpointPath = path.join(env.CHECKPOINT_DIR!, `checkpoint_${conversationId}.db`)
  try {
    await fs.unlink(checkpointPath)
    console.log(`Deleted checkpoint for conversation ${conversationId}`)
  }
  catch (err) {
    console.log(`Checkpoint not found for conversation ${conversationId}, skipping delete`)
  }
}
