import type { StreamEvent } from './types'

/**
 * Adapter to convert internal events to SSE format
 */
export class StreamAdapter {
  /**
   * Format event as SSE message
   */
  static formatSSE(event: StreamEvent): string {
    const data = JSON.stringify(event)
    const timestamp = event.timestamp || Date.now()

    return `event: ${event.type}\ndata: ${data}\nid: ${timestamp}\n\n`
  }

  // ==================== 会话管理类 ====================

  /**
   * Create session event
   */
  static session(sessionId: string): string {
    return this.formatSSE({
      type: 'session',
      data: { sessionId },
      timestamp: Date.now(),
    })
  }

  // ==================== 规划阶段 (Planning Phase) ====================

  /**
   * Create planning thinking event (流式)
   */
  static planningThinking(text: string): string {
    return this.formatSSE({
      type: 'planning_thinking',
      data: { text },
      timestamp: Date.now(),
    })
  }

  /**
   * Create planning content event (流式)
   */
  static planningContent(text: string): string {
    return this.formatSSE({
      type: 'planning_content',
      data: { text },
      timestamp: Date.now(),
    })
  }

  /**
   * Create plan status event
   */
  static planStatus(status: 'analyzing' | 'drafting' | 'generated'): string {
    return this.formatSSE({
      type: 'plan_status',
      data: { status },
      timestamp: Date.now(),
    })
  }

  /**
   * Create plan event (流式 - 单个任务项)
   */
  static plan(task: { taskId: string, task: string, dependencies?: string[] }): string {
    return this.formatSSE({
      type: 'plan',
      data: { task },
      timestamp: Date.now(),
    })
  }

  // ==================== Worker 阶段 (Worker Phase) ====================

  /**
   * Create worker start event
   */
  static workerStart(taskId: string, task: string): string {
    return this.formatSSE({
      type: 'worker_start',
      data: { taskId, task },
      timestamp: Date.now(),
    })
  }

  /**
   * Create worker thinking event (流式)
   */
  static workerThinking(taskId: string, text: string): string {
    return this.formatSSE({
      type: 'worker_thinking',
      data: { taskId, text },
      timestamp: Date.now(),
    })
  }

  /**
   * Create worker content event (流式)
   */
  static workerContent(taskId: string, text: string): string {
    return this.formatSSE({
      type: 'worker_content',
      data: { taskId, text },
      timestamp: Date.now(),
    })
  }

  /**
   * Create worker status event
   */
  static workerStatus(taskId: string, status: 'running' | 'completed' | 'error', message?: string): string {
    return this.formatSSE({
      type: 'worker_status',
      data: { taskId, status, message },
      timestamp: Date.now(),
    })
  }

  /**
   * Create worker complete event
   */
  static workerComplete(taskId: string, result?: any): string {
    return this.formatSSE({
      type: 'worker_complete',
      data: { taskId, result },
      timestamp: Date.now(),
    })
  }

  // ==================== 综合阶段 (Synthesis Phase) ====================

  /**
   * Create synthesis thinking event (流式)
   */
  static synthesisThinking(text: string): string {
    return this.formatSSE({
      type: 'synthesis_thinking',
      data: { text },
      timestamp: Date.now(),
    })
  }

  /**
   * Create synthesis content event (流式)
   */
  static synthesisContent(text: string): string {
    return this.formatSSE({
      type: 'synthesis_content',
      data: { text },
      timestamp: Date.now(),
    })
  }

  /**
   * Create synthesis status event
   */
  static synthesisStatus(status: 'started' | 'thinking' | 'generating' | 'completed'): string {
    return this.formatSSE({
      type: 'synthesis_status',
      data: { status },
      timestamp: Date.now(),
    })
  }

  // ==================== 系统类 ====================

  /**
   * Create error event
   */
  static error(message: string, details?: any, taskId?: string): string {
    return this.formatSSE({
      type: 'error',
      data: { message, details, taskId },
      timestamp: Date.now(),
    })
  }

  /**
   * Create done event
   */
  static done(finalAnswer?: string): string {
    return this.formatSSE({
      type: 'done',
      data: { finalAnswer },
      timestamp: Date.now(),
    })
  }

  // ==================== 工具调用类 ====================

  /**
   * Create tool call event
   */
  static toolCall(toolName: string, args: any, taskId?: string): string {
    return this.formatSSE({
      type: 'tool_call',
      data: { toolName, args, taskId },
      timestamp: Date.now(),
    })
  }

  /**
   * Create tool result event
   */
  static toolResult(toolName: string, result: any, executionTime?: number, taskId?: string): string {
    return this.formatSSE({
      type: 'tool_result',
      data: { toolName, result, executionTime, taskId },
      timestamp: Date.now(),
    })
  }
}


type LangGraphStreamEvent = {
  event: string;
  name: string;
  run_id: string;
  tags?: string[];
  metadata: Record<string, any>;
  data: any;
};

// 只保留你关心的事件类型
const KEEP = new Set([
  "on_chat_model_stream",
  "on_chat_model_end",
  "on_tool_start",
  "on_tool_end",
  "on_chain_start",
  "on_chain_end",
]);

export function parseEvent(e: LangGraphStreamEvent) {
  if (!KEEP.has(e.event)) return null;

  switch (e.event) {
    case "on_chat_model_stream": {
      const delta = e.data?.chunk?.content ?? "";
      return { type: "delta", runId: e.run_id, node: e.metadata?.langgraph_node ?? e.name, delta, tags: e.tags };
    }
    case "on_chat_model_end": {
      // end 时可能拿 usage/完整 message
      const output = e.data?.output ?? e.data;
      return { type: "end", runId: e.run_id, node: e.metadata?.langgraph_node ?? e.name, output, tags: e.tags };
    }
    case "on_tool_start":
      return { type: "tool_start", runId: e.run_id, tool: e.name, input: e.data?.input, tags: e.tags };
    case "on_tool_end":
      return { type: "tool_end", runId: e.run_id, tool: e.name, output: e.data?.output , tags: e.tags};
    default:
      return { type: "event", raw: e, tags: e.tags };
  }
}
