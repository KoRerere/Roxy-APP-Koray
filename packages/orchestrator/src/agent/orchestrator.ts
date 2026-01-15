import type { AIMessageChunk, MessageStructure } from '@langchain/core/messages'
import type { LangGraphRunnableConfig } from '@langchain/langgraph'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { END, Send } from '@langchain/langgraph'
import type { AgentState } from './state'
import { createLLM } from '../llm'
import { getPrompts } from '../prompts'
import { outputLangGraphTokenUsage } from './toLangGraphTokenUsage'

export async function orchestrator(state: typeof AgentState.State, config: LangGraphRunnableConfig) {
  const llm = createLLM(state.enableThinking)

  // 加载提示词
  const prompts = getPrompts()

  const plan = state.plan || []
  const workerResults = state.worker_results || []
  const isPlanComplete = plan.length > 0 && workerResults.length >= plan.length

  const contextLimit = Number(process.env.CONTEXT_MESSAGE_LIMIT) || 15

  const recentMessages = contextLimit > 0
    ? state.messages.slice(-contextLimit)
    : []

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

    const conversationContext = recentMessages.map((msg) => {
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

    const systemPrompt = prompts.orchestrator.synthesisSystem

    const humanMessage = prompts.orchestrator.synthesisHuman(
      conversationContext,
      workerResultsContext,
    )

    config.writer?.({
      type: 'content',
      phase: 'synthesis',
      status: 'started',
    })

    let finalContent = ''
    let lastChunk: AIMessageChunk<MessageStructure>
    try {
      const stream = await llm.stream([
        new SystemMessage(systemPrompt),
        new HumanMessage(humanMessage),
      ], {
        tags: ['orchestrator_synthesis'],
      })

      for await (const chunk of stream) {
        if (chunk.content) {
          finalContent += chunk.content
        }

        lastChunk = chunk

        config.writer?.({
          type: 'content',
          phase: 'synthesis',
          status: 'generating',
          data: {
            text: chunk.content,
          },
        })
      }

      config.writer?.({
        type: 'content',
        phase: 'synthesis',
        status: 'completed',
        data: {
          text: finalContent,
        },
      })
    }
    catch (error: any) {
      config.writer?.({
        type: 'content',
        phase: 'synthesis',
        status: 'error',
        data: {
          text: error.message,
        },
      })
    }

    outputLangGraphTokenUsage(config, lastChunk!)

    return {
      final_answer: finalContent,
    }
  }

  // 任务没完成，那就是规划阶段了。
  if (plan.length === 0) {
    const planningPrompt = prompts.orchestrator.planning

    config.writer?.({
      type: 'content',
      phase: 'planning',
      status: 'started',
    })

    // stream 方法区别于 invoke 方法，在于 stream 方法会返回一个流，而不是一个结果。
    const stream = await llm.stream([
      new SystemMessage(planningPrompt),
      // 传递最近 N 条历史消息
      ...recentMessages,
    ], {
      tags: ['orchestrator_planning'],
    })

    let content = ''
    let lastChunk: AIMessageChunk<MessageStructure> | null = null
    for await (const chunk of stream) {
      if (chunk.content) {
        const chunkContent = typeof chunk.content === 'string' ? chunk.content : ''
        content += chunkContent
        config.writer?.({
          type: 'content',
          phase: 'planning',
          status: 'generating',
          data: {
            text: chunkContent,
          },
        })
      }

      // 注意：planning 阶段的 thinking 内容目前未使用，但保留提取逻辑以备将来使用
      const reasoning = chunk.additional_kwargs?.reasoning
        || (chunk.additional_kwargs as any)?.reasoning_content
        || (chunk as any).response_metadata?.reasoning

      // thinking 内容可以用于日志记录或调试
      if (reasoning && process.env.DEBUG === 'true') {
        const thinkingStr = typeof reasoning === 'string' ? reasoning : JSON.stringify(reasoning)
        console.log('[DEBUG] Planning thinking:', thinkingStr)
      }

      // 保存最后一个 chunk，可能包含 token usage 信息
      lastChunk = chunk
    }

    outputLangGraphTokenUsage(config, lastChunk!)

    config.writer?.({
      type: 'content',
      phase: 'planning',
      status: 'completed',
    })

    try {
      // 如果能从结果里面提取到任务，就把任务交给下游的 worker 阶段去执行。
      const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim()
      const parsed = JSON.parse(jsonStr)

      const newPlan: any[] = parsed.tasks.map((t: any) => ({
        id: String(t.id),
        description: t.description,
        status: 'pending',
        workerId: `worker_${String(t.id)}`,
      }))

      if (newPlan.length === 0) {
        // Fallback if no plan generated: just answer directly (treat as simple)
        return { final_answer: content }
      }

      // Log planning to file if sessionDir is provided
      // if (state.sessionDir) {
      //   await SessionManager.logPlanning(
      //     state.sessionDir,
      //     newPlan,
      //     planningThinking,
      //   )
      // }

      return {
        plan: newPlan,
        // tokenUsage 已从状态定义中移除，不再通过状态返回
      }
    }
    catch (e) {
      console.warn('没有任务，不需要开启 worker', e)
      return {
        final_answer: content,
        // tokenUsage 已从状态定义中移除，不再通过状态返回
      }
    }
  }

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
    const workerLimit = Number(process.env.WORKER_CONTEXT_LIMIT) || 10

    const recentHistory = workerLimit > 0
      ? state.messages.slice(-workerLimit)
      : []

    // 让 langgraph 流转到下一个阶段，就是要开启 worker 的阶段了。
    return plan.map(task => new Send('worker', {
      task,
      workerId: task.workerId,
      enableThinking: state.enableThinking,
      conversationHistory: recentHistory,
      sessionDir: state.sessionDir, // Pass sessionDir to workers
    }))
  }

  return END
}
