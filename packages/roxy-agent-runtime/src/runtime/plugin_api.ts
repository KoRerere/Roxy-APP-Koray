import { randomUUID } from 'node:crypto'
import type {
  AgentLifecycleHooks,
  AuthRequest,
  AuthToken,
  IClarificationHandler,
  IContextContributor,
  ILogger,
  PluginAPI,
  PluginSetupContext,
  MemoryLifecycle,
  ToolDescriptor,
  ToolHandler,
  ToolMiddleware,
} from '../core/interfaces.ts'

export interface AssembledPlugins {
  tools: Array<{ descriptor: ToolDescriptor; handler: ToolHandler }>
  contributors: IContextContributor[]
  hooks: AgentLifecycleHooks[]
  middleware: ToolMiddleware[]
  memoryLifecycles: MemoryLifecycle[]
  disposeCallbacks: Array<() => void | Promise<void>>
}

/**
 * Concrete `PluginAPI` handed to each plugin during setup. Collects all
 * registrations and exposes them via `collect()`.
 */
export class PluginAPIImpl implements PluginAPI {
  readonly ctx: PluginSetupContext

  private readonly _tools: Array<{ descriptor: ToolDescriptor; handler: ToolHandler }> = []
  private readonly _contributors: IContextContributor[] = []
  private readonly _hooks: AgentLifecycleHooks[] = []
  private readonly _middleware: ToolMiddleware[] = []
  private readonly _memoryLifecycles: MemoryLifecycle[] = []
  private readonly _disposeCallbacks: Array<() => void | Promise<void>> = []
  private readonly _clarification?: IClarificationHandler

  constructor(logger: ILogger, clarification?: IClarificationHandler) {
    this.ctx = { logger }
    this._clarification = clarification
  }

  registerTools(tools: Array<{ descriptor: ToolDescriptor; handler: ToolHandler }>): void {
    this._tools.push(...tools)
  }

  addContextContributor(contributor: IContextContributor): void {
    this._contributors.push(contributor)
  }

  addHooks(hooks: AgentLifecycleHooks): void {
    this._hooks.push(hooks)
  }

  addToolMiddleware(middleware: ToolMiddleware): void {
    this._middleware.push(middleware)
  }

  addMemoryLifecycle(lifecycle: MemoryLifecycle): void {
    this._memoryLifecycles.push(lifecycle)
  }

  async requestAuth(req: AuthRequest): Promise<AuthToken> {
    if (!this._clarification) {
      throw new Error(`requestAuth: no clarification handler configured (service: "${req.service}")`)
    }
    const result = await this._clarification.request({
      traceId: randomUUID(),
      question: req.description
        ? `Authorize ${req.service} — ${req.description}\n${req.authUrl}`
        : `Authorize ${req.service}: ${req.authUrl}`,
      options: req.scopes,
    })
    return { accessToken: result.answer }
  }

  onDispose(fn: () => void | Promise<void>): void {
    this._disposeCallbacks.push(fn)
  }

  collect(): AssembledPlugins {
    return {
      tools: [...this._tools],
      contributors: [...this._contributors],
      hooks: [...this._hooks],
      middleware: [...this._middleware],
      memoryLifecycles: [...this._memoryLifecycles],
      disposeCallbacks: [...this._disposeCallbacks],
    }
  }
}
