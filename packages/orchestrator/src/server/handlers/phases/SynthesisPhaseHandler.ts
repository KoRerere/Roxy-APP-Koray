import type { StreamEvent } from '../../types.js'

/**
 * Synthesis 阶段事件处理器
 * 处理综合阶段的所有事件转换
 */
export class SynthesisPhaseHandler {
  private state = {
    synthesisStatus: 'started' as 'started' | 'thinking' | 'generating' | 'completed',
    synthesisStarted: false,
    synthesisThinkingStarted: false,
    synthesisContentStarted: false,
  }

  /**
   * 处理 LangGraph 事件
   * @param event - LangGraph 原始事件
   * @param enableThinking - 是否启用思考模式
   * @returns 转换后的 SSE 事件数组
   */
  handleEvent(event: any, enableThinking: boolean = false): StreamEvent[] {
    const events: StreamEvent[] = []
    const eventType = event.event
    const tags = event.tags || []

    // 检测 orchestrator_synthesis tag
    if (tags.includes('orchestrator_synthesis')) {
      // 1. 处理 synthesis_status: 'started' (首次检测到 synthesis tag 时)
      if (!this.state.synthesisStarted) {
        events.push({
          type: 'synthesis_status',
          data: { status: 'started' },
          timestamp: Date.now(),
        })
        this.state.synthesisStatus = 'started'
        this.state.synthesisStarted = true
      }

      // 2. 处理 synthesis_thinking 和 synthesis_content (on_chat_model_stream)
      if (eventType === 'on_chat_model_stream') {
        const chunk = event.data?.chunk
        if (chunk) {
          // 提取 thinking
          const thinking = this.extractThinking(chunk)
          if (thinking && enableThinking) {
            // 首次收到 thinking 时，更新状态
            if (!this.state.synthesisThinkingStarted) {
              events.push({
                type: 'synthesis_status',
                data: { status: 'thinking' },
                timestamp: Date.now(),
              })
              this.state.synthesisStatus = 'thinking'
              this.state.synthesisThinkingStarted = true
            }

            // 发送 thinking 片段
            events.push({
              type: 'synthesis_thinking',
              data: { text: thinking },
              timestamp: Date.now(),
            })
          }

          // 提取 content
          const content = this.extractContent(chunk)
          if (content && content.length > 0) {
            // 首次收到 content 时，更新状态
            if (!this.state.synthesisContentStarted) {
              events.push({
                type: 'synthesis_status',
                data: { status: 'generating' },
                timestamp: Date.now(),
              })
              this.state.synthesisStatus = 'generating'
              this.state.synthesisContentStarted = true
            }

            // 发送 content 片段
            events.push({
              type: 'synthesis_content',
              data: { text: content },
              timestamp: Date.now(),
            })
          }
        }
      }

      // 3. 处理 synthesis_status: 'completed' (on_chain_end + orchestrator)
      if (eventType === 'on_chain_end' && event.name === 'orchestrator') {
        const finalAnswer = event.data?.output?.final_answer
        if (finalAnswer && this.state.synthesisStatus !== 'completed') {
          events.push({
            type: 'synthesis_status',
            data: { status: 'completed' },
            timestamp: Date.now(),
          })
          this.state.synthesisStatus = 'completed'
        }
      }
    }

    return events
  }

  /**
   * 提取思考内容
   */
  private extractThinking(chunk: any): string | undefined {
    if (!chunk) {
      return undefined
    }

    // 使用与 OrchestratorUI.extractThinking 相同的逻辑
    if (chunk.additional_kwargs?.reasoning) {
      return chunk.additional_kwargs.reasoning
    }
    if ((chunk.additional_kwargs as any)?.reasoning_content) {
      return (chunk.additional_kwargs as any).reasoning_content
    }
    if ((chunk.additional_kwargs as any)?.reasoning_details?.[0]?.text) {
      return (chunk.additional_kwargs as any).reasoning_details[0].text
    }
    if ((chunk as any).response_metadata?.reasoning) {
      return (chunk as any).response_metadata.reasoning
    }

    return undefined
  }

  /**
   * 提取内容文本
   */
  private extractContent(chunk: any): string {
    if (!chunk) {
      return ''
    }

    // 如果是字符串，直接返回
    if (typeof chunk.content === 'string') {
      return chunk.content
    }

    // 如果是数组，提取文本
    if (Array.isArray(chunk.content)) {
      return chunk.content
        .map((c: any) => {
          if (typeof c === 'string') {
            return c
          }
          return c?.text || ''
        })
        .join('')
    }

    return ''
  }

  /**
   * 获取当前状态
   */
  getState() {
    return { ...this.state }
  }

  /**
   * 检查是否已完成
   */
  isCompleted(): boolean {
    return this.state.synthesisStatus === 'completed'
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.state = {
      synthesisStatus: 'started',
      synthesisStarted: false,
      synthesisThinkingStarted: false,
      synthesisContentStarted: false,
    }
  }
}
