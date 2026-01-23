import type { AgentState } from './state'
import type { LangGraphRunnableConfig } from '@langchain/langgraph'
import { AIMessageChunk, HumanMessage, SystemMessage } from '@langchain/core/messages'
import { END, Send } from '@langchain/langgraph'
import { env } from '../../config'
import { SummaryManager } from '../../database/summary'
import { createLLM } from '../../llm'
import { streamAdapter } from '../../server/streamAdapter'
import { TokenUsageChange } from '../utils/usageAggregator'
import { genSynthesisHuman, planningPrompt, synthesisPrompt } from './prompts'

let summaryPromise: Promise<any> | null = null

export async function orchestrator(state: typeof AgentState.State, config: LangGraphRunnableConfig): Promise<Partial<typeof AgentState.State>> {
  // 创建 UsageAggregator 实例，用于聚合 token usage
  // const usageAggregator = new UsageAggregator(config.writer)
  const llm = createLLM(state.enableThinking)

  if (summaryPromise) {
    await summaryPromise
    summaryPromise = null
  }

  // 加载提示词
  // const prompts = getPrompts()

  const plan = state.plan || []
  const workerResults = state.worker_results || []
  const isPlanComplete = plan.length > 0 && workerResults.length >= plan.length

  // 上面任务如果已经做完了。就开始总结阶段了。
  if (isPlanComplete) {
    const workerResultsContext = workerResults.map((r) => {
      const task = plan.find(t => t.id === r.taskId)
      const content = r.content || r.thinking

      let resultText = `Task: ${task?.description || r.taskId}\nResult: ${content || 'No result generated'}`

      if (r.thinking && r.thinking !== content) {
        resultText += `\n\nWorker Reasoning:\n${r.thinking}`
      }

      return resultText
    }).join('\n\n---\n\n')

    const conversationContext = state.messages.map((msg) => {
      const role = msg.type === 'human' ? 'User' : 'Assistant'
      let content = ''
      if (typeof msg.content === 'string') {
        content = msg.content
      }
      else if (Array.isArray(msg.content)) {
        // If content is array of content blocks, extract text
        content = msg.content
          .map(block => typeof block === 'string' ? block : block.text || '')
          .join('')
      }
      else {
        content = String(msg.content || '')
      }
      return `${role}: ${content}`
    }).join('\n')

    const humanMessage = genSynthesisHuman(
      conversationContext,
      workerResultsContext,
    )

    const messages = [
      new SystemMessage(synthesisPrompt),
      new HumanMessage(humanMessage),
    ]

    let finalMsg = new AIMessageChunk({ content: '' })
    try {
      const stream = await llm.stream(messages, {
        callbacks: [new TokenUsageChange()],
      })

      for await (const chunk of stream) {
        finalMsg = finalMsg.concat(chunk)
        if (chunk.content.toString().trim() !== '') {
          config.writer?.(streamAdapter.synthesis(chunk.content.toString()))
        }
      }
      messages.push(finalMsg)
    }
    catch (error: any) {
      console.error('❌ Orchestrator synthesis failed:', error)
      config.writer?.(streamAdapter.error(error.message, error.stack))
    }
    finally {
      summaryPromise = SummaryManager.generateSummary(messages, config.configurable?.thread_id || '')
    }

    return {
      final_answer: finalMsg.content.toString(),
      // tokenUsage: usageAggregator.getUsage(),
    }
  }

  // 任务没完成，那就是规划阶段了。
  if (plan.length === 0) {
    let finalMsg = new AIMessageChunk({ content: '' })

    try {
      const previousSummaryItem = await SummaryManager.getSummary(config.configurable?.thread_id || '')
      if (previousSummaryItem) {
        const summary = SummaryManager.parseSummary(previousSummaryItem.summary)
        state.messages.unshift(...summary.filter((item: any) => item.name !== 'simple'))
      }

      const stream = await llm.stream([
        new SystemMessage({
          content: planningPrompt,
          name: 'orchestrator'
        }),
        ...state.messages,
      ], {
        callbacks: [new TokenUsageChange()],
      })

      for await (const chunk of stream) {
        finalMsg = finalMsg.concat(chunk)
        if (chunk.content.toString().trim() !== '') {
          config.writer?.(streamAdapter.planning(chunk.content.toString()))
        }
      }
    }
    catch (e) {
      console.error('❌ Orchestrator planning failed:', e)
      config.writer?.(streamAdapter.error(e instanceof Error ? e.message : String(e), e instanceof Error ? e.stack : undefined))
    }

    try {
      // 如果能从结果里面提取到任务，就把任务交给下游的 worker 阶段去执行。
      const jsonStr = finalMsg.content.toString().replace(/```json/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(jsonStr)

      const newPlan: any[] = parsed.tasks.map((t: any) => ({
        id: String(t.id),
        description: t.description,
        status: 'pending',
        workerId: `worker_${String(t.id)}`,
      }))

      // 没有任务，状态流转下个阶段，final_answer 有值就直接结束了。
      if (newPlan.length === 0) {
        return {
          final_answer: finalMsg.content.toString(),
          // tokenUsage: usageAggregator.getUsage(),
        }
      }

      return {
        // 最多下发多少个任务
        plan: newPlan.slice(0, env.WORKER_CONTEXT_LIMIT),
        // tokenUsage: usageAggregator.getUsage(),
      }
    } catch(error) {
      console.error('❌ Orchestrator task planning failed:', error)
      config.writer?.(streamAdapter.error('TaskError Task Planning Failed, please retry or start a new conversation.', error instanceof Error ? error.stack : undefined))
    }

    return {
      final_answer: finalMsg.content.toString(),
      // tokenUsage: usageAggregator.getUsage(),
    }
  }

  // 还有worker尚未完成。
  return {}
}

export async function routerOrchestrator(state: typeof AgentState.State) {
  const finalAnswer = state.final_answer
  const workerResults = state.worker_results
  const plan = state.plan || []

  // 已经总结过了。所以就是直接结束
  if (finalAnswer) {
    return END
  };

  if (plan.length > 0 && workerResults.length < plan.length) {
    // 还有任务没有完成。
    // const workerLimit = Number(env.WORKER_CONTEXT_LIMIT) || 10

    // const recentHistory = workerLimit > 0
    //   ? state.messages.slice(-workerLimit)
    //   : []

    // 让 langgraph 流转到下一个阶段，就是要开启 worker 的阶段了。
    return plan.map(task => new Send('worker', {
      task,
      workerId: task.workerId,
      enableThinking: state.enableThinking,
      // conversationHistory: recentHistory,
      sessionDir: state.sessionDir, // Pass sessionDir to workers
    }))
  }

  return END
}
