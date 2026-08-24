import { randomUUID } from 'node:crypto'
import { AgentImpl } from '../../src/runtime/agent.ts'
import { buildAgentGraph } from '../../src/runtime/graph.ts'
import { FakeProvider, chatResponse } from '../../src/provider/fake.ts'
import { InMemoryProvider } from '../../src/memory/memory.ts'
import { ToolRegistry } from '../../src/tools/registry.ts'
import { registerBuiltinTools } from '../../src/tools/builtin/index.ts'
import { FullAccessHandler } from '../../src/hitl/handler.ts'
import { NullClarificationHandler } from '../../src/clarification/handler.ts'
import { InMemoryTrajectoryRecorder } from '../../src/observability/trajectory.ts'
import { createLogger } from '../../src/logging/logger.ts'
import type {
  AgentLifecycleHooks,
  AgentDefinition,
  AgentPath,
  ChatRequest,
  ChatResponse,
  IAgentManager,
  Message,
  IClarificationHandler,
  IContextContributor,
  IHITLHandler,
  ISessionStore,
  Summarizer,
  ToolDescriptor,
  ToolHandler,
  ToolMiddleware,
  TrimPolicy,
  RoxyPlugin,
  MemoryLifecycle,
} from '../../src/core/interfaces.ts'

export { chatResponse }
export { FakeProvider } from '../../src/provider/fake.ts'
export { endTurnResponse, toolCallResponse } from './makeFakeProvider.ts'

export interface TestAgentOpts {
  responses?: ChatResponse[]
  handler?: (req: ChatRequest, callIndex: number) => ChatResponse
  tokenCounter?: (messages: Message[]) => number
  tools?: Array<{ descriptor: ToolDescriptor; handler: ToolHandler }>
  hitl?: IHITLHandler
  hooks?: AgentLifecycleHooks
  clarification?: IClarificationHandler
  sessionId?: string
  systemPrompt?: string
  contributors?: IContextContributor[]
  middleware?: ToolMiddleware[]
  sessionStore?: ISessionStore
  skills?: import('../../src/core/interfaces.ts').SkillManifest[]
  trimPolicy?: TrimPolicy
  contextWindowTokens?: number
  triggerTokens?: number
  summarizer?: Summarizer
  plugins?: RoxyPlugin[]
  memoryLifecycles?: MemoryLifecycle[]
  agentManager?: IAgentManager
  agentPath?: AgentPath
}

export function buildTestAgent(opts: TestAgentOpts = {}): {
  agent: AgentImpl
  provider: FakeProvider
  memory: InMemoryProvider
  registry: ToolRegistry
} {
  const provider = new FakeProvider({
    responses: opts.responses,
    handler: opts.handler,
    ...(opts.tokenCounter ? { tokenCounter: opts.tokenCounter } : {}),
  })
  const memory = new InMemoryProvider()
  const registry = new ToolRegistry()
  // Mirror AgentRuntime.create: register the builtin file/shell family so test
  // agents reflect production tool availability (read_file/glob/grep/ls/...).
  for (const t of registerBuiltinTools()) {
    registry.add(t.descriptor, t.handler)
  }
  for (const { descriptor, handler } of opts.tools ?? []) {
    registry.add(descriptor, handler)
  }
  const hitl = opts.hitl ?? new FullAccessHandler()
  const clarification = opts.clarification ?? new NullClarificationHandler()
  const recorder = new InMemoryTrajectoryRecorder()
  const logger = createLogger({ level: 'error' })
  const sessionId = opts.sessionId ?? randomUUID()

  const graph = buildAgentGraph({
    provider,
    tools: registry,
    memory,
    hitl,
    clarification,
    recorder,
    logger,
    hooks: opts.hooks,
    contributors: opts.contributors,
    middleware: opts.middleware,
    model: 'fake',
    maxTokens: 4096,
    systemPrompt: opts.systemPrompt ?? '',
    ...(opts.sessionStore ? { sessionStore: opts.sessionStore } : {}),
    ...(opts.skills ? { skills: opts.skills } : {}),
    ...(opts.trimPolicy ? { trimPolicy: opts.trimPolicy } : {}),
    ...(opts.contextWindowTokens !== undefined ? { contextWindowTokens: opts.contextWindowTokens } : {}),
    ...(opts.triggerTokens !== undefined ? { triggerTokens: opts.triggerTokens } : {}),
    ...(opts.summarizer ? { summarizer: opts.summarizer } : {}),
    ...(opts.memoryLifecycles ? { memoryLifecycles: opts.memoryLifecycles } : {}),
    ...(opts.agentManager ? { agentManager: opts.agentManager } : {}),
    ...(opts.agentPath ? { agentPath: opts.agentPath } : {}),
  })
  const agent = new AgentImpl(graph, {}, agentId(), sessionId)
  return { agent, provider, memory, registry }
}

export function createTestAgentDefinition(opts: TestAgentOpts = {}): AgentDefinition {
  const provider = new FakeProvider({
    responses: opts.responses,
    handler: opts.handler,
    ...(opts.tokenCounter ? { tokenCounter: opts.tokenCounter } : {}),
  })
  const tools = new ToolRegistry()
  for (const tool of registerBuiltinTools()) {
    tools.add(tool.descriptor, tool.handler)
  }
  for (const { descriptor, handler } of opts.tools ?? []) {
    tools.add(descriptor, handler)
  }

  return {
    ...(opts.sessionId ? { sessionId: opts.sessionId } : {}),
    model: 'fake',
    maxTokens: 4096,
    systemPrompt: opts.systemPrompt ?? '',
    provider,
    memory: new InMemoryProvider(),
    tools,
    hitl: opts.hitl ?? new FullAccessHandler(),
    clarification: opts.clarification ?? new NullClarificationHandler(),
    recorder: new InMemoryTrajectoryRecorder(),
    logger: createLogger({ level: 'error' }),
    ...(opts.sessionStore ? { sessionStore: opts.sessionStore } : {}),
    ...(opts.skills ? { skills: opts.skills } : {}),
    ...(opts.trimPolicy ? { trimPolicy: opts.trimPolicy } : {}),
    ...(opts.contextWindowTokens !== undefined ? { contextWindowTokens: opts.contextWindowTokens } : {}),
    ...(opts.triggerTokens !== undefined ? { triggerTokens: opts.triggerTokens } : {}),
    ...(opts.summarizer ? { summarizer: opts.summarizer } : {}),
    ...(opts.hooks ? { hooks: opts.hooks } : {}),
    ...(opts.contributors ? { contributors: opts.contributors } : {}),
    ...(opts.middleware ? { middleware: opts.middleware } : {}),
    ...(opts.plugins ? { plugins: opts.plugins } : {}),
    ...(opts.memoryLifecycles ? { memoryLifecycles: opts.memoryLifecycles } : {}),
  }
}

function agentId(): string {
  return randomUUID()
}
