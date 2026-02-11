import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

/**
 * 任务 Schema 定义
 */
const TaskSchema = z.object({
  id: z.string().describe('Unique task identifier, e.g., "1", "2", "3"'),
  description: z.string().describe('Task description (must include CDP WebSocket link and specific operations)'),
})

/**
 * 统一的任务提交工具
 * 用于 before 阶段和 orchestrator 阶段，让 AI 通过工具调用传递任务列表
 * - 传入空数组 [] 表示结束流程（无需浏览器自动化）
 * - 传入任务数组表示继续执行（需要浏览器自动化）
 *
 * 使用工具调用而不是 JSON 文本解析，可以避免各种 JSON 格式问题
 */
const submitTasksTool = new DynamicStructuredTool({
  name: 'submit_tasks',
  description: `Submit browser automation tasks for execution, or end the workflow if no tasks are needed.

When to call:
- After completing pre-tasks (window creation, proxy binding, etc.), call this to submit browser automation tasks
- If no browser automation is needed (pure chat, resource management only), call with empty tasks array []

Rules:
- Each task must be independent and executable in parallel
- Each task description must include the CDP WebSocket link (extracted from context)
- Pass empty array [] to end the workflow without browser automation
- Task descriptions should be in the same language as the user's request`,
  schema: z.object({
    tasks: z
      .array(TaskSchema)
      .describe('Array of tasks to be executed by Worker Agents. Pass empty array [] if no tasks needed (workflow ends).'),
  }),
  func: async (args) => {
    return args
  },
})

/**
 * 内部工具集合（用于 before 阶段）
 * 包含 submit_tasks 用于结束流程或提交任务
 */
export const orchestratorTools = [submitTasksTool]

/**
 * 规划工具集合（用于 orchestrator 阶段）
 * 与 orchestratorTools 使用同一个 submit_tasks 工具
 */
export const planningTools = [submitTasksTool]
