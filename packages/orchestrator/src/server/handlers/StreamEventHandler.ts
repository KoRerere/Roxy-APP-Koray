import type { StreamEvent } from '../types.js'
import { OrchestratorEventConverter } from './OrchestratorEventConverter.js'
import { SimpleEventConverter } from './SimpleEventConverter.js'

/**
 * 统一的事件处理管理器
 * 负责路由不同模式的事件处理
 */
export class StreamEventHandler {
  private orchestratorConverter: OrchestratorEventConverter
  private simpleConverter: SimpleEventConverter

  constructor() {
    this.orchestratorConverter = new OrchestratorEventConverter()
    this.simpleConverter = new SimpleEventConverter()
  }

  /**
   * 处理 Orchestrator 模式的流式事件
   */
  async handleOrchestratorStream(
    input: any,
    config: any,
    onStream: (event: StreamEvent) => void,
  ): Promise<void> {
    /**
     * 包装 onStream，添加统一的事件过滤
     */
    const filteredOnStream = (event: StreamEvent) => {
      onStream(event)
    }

    // 使用转换器处理事件
    await this.orchestratorConverter.convertStream(
      input,
      config,
      onStream,
    )
  }

  /**
   * 处理 Simple 模式的流式事件
   */
  async handleSimpleStream(
    input: any,
    config: any,
    onStream: (event: StreamEvent) => void,
  ): Promise<void> {
    /**
     * 包装 onStream，添加统一的事件过滤
     */
    const filteredOnStream = (event: StreamEvent) => {
      onStream(event)
    }

    await this.simpleConverter.convertStream(
      input,
      config,
      onStream,
    )
  }

  /**
   * 过滤和验证事件
   * 统一的事件过滤逻辑
   */
  private filterEvent(event: StreamEvent): boolean {
    // 过滤空的 content 类型事件
    const contentEventTypes = [
      'planning_content',
      'worker_content',
      'synthesis_content',
    ]

    if (contentEventTypes.includes(event.type)) {
      const text = event.data?.text || ''
      if (!text || text.trim() === '') {
        return false
      }
    }

    return true
  }
}
