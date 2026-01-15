/**
 * Router 分类 Prompts
 */
export interface RouterPrompts {
  /** 查询分类系统提示词 */
  classify: string
}

/**
 * Orchestrator Prompts
 */
export interface OrchestratorPrompts {
  /** 规划阶段：分解任务 */
  planning: string

  /** 综合阶段：系统提示词 */
  synthesisSystem: string

  /** 综合阶段：人类消息模板（带参数） */
  synthesisHuman: (conversationContext: string, resultsContext: string) => string
}

/**
 * Worker Prompts
 */
export interface WorkerPrompts {
  /** Worker 执行任务的系统提示词 */
  execute: string
}

/**
 * 所有 Prompts 的集合
 */
/**
 * Simple Prompts
 */
export interface SimplePrompts {
  /** 综合阶段：系统消息 */
  synthesisSystem: string

  /** 综合阶段：人类消息模板（带参数） */
  synthesisHuman: (conversationContext: string) => string
}

export interface AllPrompts {
  router: RouterPrompts
  orchestrator: OrchestratorPrompts
  simple: SimplePrompts
  worker: WorkerPrompts
  system: string
}
