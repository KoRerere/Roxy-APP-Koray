import { createMiddleware } from 'langchain'

/**
 * 禁用 deepagents 默认注入的 `task` 子 agent 工具。
 *
 * deepagents 框架在 `createSubAgentMiddleware` 中默认向每个 agent 注入一个
 * `task` 工具，允许 agent 递归派发子任务。该工具在当前 Roxy 场景下不需要，
 * 且可能导致 agent 意外启动子 agent 消耗配额，因此统一屏蔽。
 *
 * 实现方式：通过 `wrapModelCall` 钩子在每次模型调用前把名为 `task` 的工具
 * 从工具列表中剔除，模型本身永远不会看到该工具描述，也不会尝试调用它。
 */
export function createDisableSubagentMiddleware() {
  return createMiddleware({
    name: 'DisableSubagentMiddleware',
    wrapModelCall: async (request, handler) => {
      const tools = request.tools.filter(t => t.name !== 'task')
      return handler({ ...request, tools })
    },
  })
}
