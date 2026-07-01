import type { AttachmentRef } from './fileService'
import type { Response } from 'express'
import { HumanMessage } from '@langchain/core/messages'
import { Command } from '@langchain/langgraph'
import { randomUUID } from 'node:crypto'
import { isAbortLike, normalizeAgentError } from '@/core/agentError'
import { cleanupRun } from '@/core/registry/abortRegistry'
import { cancelInterrupt, createInterruptGate } from '@/core/registry/interruptRegistry'
import { sseLoggerManager } from '@/core/sse/sseLogger'
import { streamAdapter } from '@/core/sse/streamAdapter'
import { ChatContextAPI } from '@/database/conversations'
import { createImageAgent } from '@/deepagents'
import { handleStreamEvents, StreamState } from '@/deepagents/handle-stream'
import { env } from '../config'
import { generateConversationTitle } from './chatService'
import { buildMessageContent } from './fileService'
import { generateImagesFromPlan } from './imageGeneration'
import { createStreamCallback, initSSEHeaders, resolveSSEFilePath } from './sseStream'

/**
 * 构造给 image agent 的真实用户输入文本：
 * - 用「用户输入如下：」+ Markdown 代码块包裹原始输入，把用户文字与系统框架彻底隔离，
 *   让模型按字面解读（顺带抵御提示注入），不再把生图参数/兜底指令混进提示词。
 * - 生图参数（比例/清晰度/张数）一律以前端 assetOptions 为准，不进提示词、不进 save_image_spec。
 * - 空输入（仅附件、无文字）也放进代码块，不再自动生图，交由 image agent 的「无效输入护栏」澄清。
 * 附件信息仍由 buildMessageContent 在其后追加，保持不变。
 */
function buildImageAgentUserMessage(message: string) {
  const isZh = env.SYSTEM_LANGUAGE === 'zh-CN'
  const trimmed = message.trim()
  const preface = isZh ? '用户输入如下：' : 'User input is as follows:'
  const inputText = trimmed || (isZh ? '（用户未输入任何文字。）' : '(The user did not enter any text.)')

  // 用比输入中最长反引号串更长的围栏，避免用户输入里自带的 ``` 破坏代码块
  const longestBacktickRun = (inputText.match(/`+/g) ?? [])
    .reduce((max, run) => Math.max(max, run.length), 0)
  const fence = '`'.repeat(Math.max(3, longestBacktickRun + 1))

  return `${preface}\n${fence}\n${inputText}\n${fence}`
}

function streamImageAgentEvents(rawChunk: any, state: StreamState, streamCallback: (event: string) => void) {
  const result = handleStreamEvents(rawChunk, state)
  const events = Array.isArray(result) ? result : result ? [result] : []
  for (const event of events) {
    if (
      (event.type === 'tool_call' || event.type === 'tool_result')
      && event.data?.toolName === 'save_image_spec'
    ) {
      continue
    }

    streamCallback(streamAdapter.formatSSE(event))
  }
}

export interface RunImageStreamOptions {
  prompt: string
  conversationId: string
  attachmentList: AttachmentRef[]
  assetOptions: any
  conversation: any
  signal: AbortSignal
  res: Response
}

/**
 * 运行一次 /images/generations 流式生图：落消息 → 标题 → image agent（含 HITL 循环）
 * → 消费 image spec → 生图编排 → 清理。
 * 调用方（路由）已完成入参校验、附件注水、对话存在性检查与 abort 注册。
 */
export async function runImageStream(opts: RunImageStreamOptions): Promise<void> {
  const { prompt, conversationId, attachmentList, assetOptions, conversation, signal, res } = opts

  initSSEHeaders(res)

  const { fileName, sseFilePath } = resolveSSEFilePath()

  const sseLogger = sseLoggerManager.createLogger(sseFilePath)

  const streamCallback = createStreamCallback(res, sseLogger)

  let destroy: (() => Promise<void>) | undefined

  try {
    ChatContextAPI.setActiveConversation(conversationId)

    const userMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    ChatContextAPI.addMessage({
      id: userMessageId,
      conversation_id: conversationId,
      role: 'user',
      content: prompt,
      content_type: 'text',
      storage_type: 'inline',
      agent_mode: 'image',
      metadata: {
        timestamp: Date.now(),
        source: 'api_image_generation',
        attachments: attachmentList.length > 0 ? attachmentList : undefined,
        assetOptions,
      },
    })

    // 预先注册 assistant 消息，指向 SSE 文件（和 /chat 一致）
    ChatContextAPI.addMessage({
      id: fileName,
      conversation_id: conversationId,
      role: 'assistant',
      content: '',
      content_type: 'file',
      storage_type: 'file',
      file_path: sseFilePath,
      agent_mode: 'image',
      metadata: {
        timestamp: Date.now(),
        source: 'sse_stream',
        assetOptions,
      },
    })

    if (conversation.is_title_set === 0 || conversation.is_title_set === undefined) {
      await generateConversationTitle(prompt, attachmentList, conversationId, userMessageId, streamCallback)
        .then((generatedTitle) => {
          if (generatedTitle) {
            ChatContextAPI.updateConversation(conversationId, { title: generatedTitle })
          }
        })
        .catch((err) => {
          console.error('Failed to generate title:', err)
        })
    }

    const imageAgent = await createImageAgent({
      conversationId,
      turnId: userMessageId,
      onRetry: info => streamCallback(streamAdapter.retry(info)),
    })
    const agent = imageAgent.agent
    destroy = imageAgent.destroy

    const config: any = {
      configurable: {
        thread_id: conversation.thread_id,
        imageContext: {
          conversationId,
          messageId: fileName,
          userMessageId,
          attachments: attachmentList,
          assetOptions,
        },
      },
      conversationId,
      turnId: userMessageId,
      streamMode: ['messages', 'custom', 'tools', 'updates'],
      signal,
      writer: streamCallback,
      imageContext: {
        conversationId,
        messageId: fileName,
        userMessageId,
        attachments: attachmentList,
        assetOptions,
      },
    }
    const imageRequest = buildImageAgentUserMessage(prompt)
    const messageContent = await buildMessageContent(imageRequest, attachmentList, { requireRemoteImageUrl: true })
    const input = {
      messages: [
        Array.isArray(messageContent)
          ? new HumanMessage({ content: messageContent })
          : new HumanMessage(messageContent || imageRequest),
      ],
      streamCallback,
    }
    const checkpointer = (agent as any).checkpointer
    let invokeInput: any = input

    if (checkpointer) {
      const checkpointState = await (agent as any).getState(config)
      if (checkpointState.next && checkpointState.next.length > 0)
        invokeInput = null
    }

    const runImageAgentTurn = async (turnInput: any, turnConfig = config) => {
      const turnState = new StreamState()
      let currentInput = turnInput

      while (true) {
        const stream = await (agent as any).stream(currentInput, turnConfig)
        let interrupted = false
        let interruptValue: any = null

        for await (const rawChunk of stream) {
          const [, chunk] = rawChunk

          if (chunk?.__interrupt__) {
            interrupted = true
            interruptValue = chunk.__interrupt__
            continue
          }

          streamImageAgentEvents(rawChunk, turnState, streamCallback)
        }

        if (!interrupted)
          break

        const interrupts = interruptValue[0]?.value ?? interruptValue
        const actionRequests = interrupts?.actionRequests ?? []
        const reviewConfigs = interrupts?.reviewConfigs ?? []
        const interruptsId = randomUUID()
        streamCallback(streamAdapter.hitlInterrupt({ actionRequests, reviewConfigs, interruptsId }))
        const decision = await createInterruptGate(conversationId)
        streamCallback(streamAdapter.hitlResume({ interruptsId, decisions: decision.decisions }))
        currentInput = new Command({ resume: { decisions: decision.decisions } })
      }

      return turnState
    }

    await runImageAgentTurn(invokeInput)
    const generationPlan = imageAgent.consumeImageSpec?.()
    if (generationPlan) {
      await generateImagesFromPlan(generationPlan, {
        conversationId,
        turnId: userMessageId,
        messageId: fileName,
        attachments: attachmentList,
        assetOptions,
        writer: streamCallback,
        signal,
      }, imageAgent.imageProviderOptions)
    }
    else {
      console.log('Image agent did not save an image generation spec; skipping image generation for conversation', conversationId, 'message', fileName)
    }

    streamCallback(streamAdapter.done())
  }
  catch (error: any) {
    // 清理可能挂起的 interrupt gate
    cancelInterrupt(conversationId)
    if (isAbortLike(error)) {
      console.log('Image generation interrupted by user')
    }
    else {
      console.error('Error generating image:', error)
      streamCallback(streamAdapter.error(normalizeAgentError(error)))
    }
    streamCallback(streamAdapter.done())
  }
  finally {
    await destroy?.()
    cleanupRun(conversationId)
    sseLoggerManager.closeLogger(sseFilePath)
  }
}
