

export interface SSEEvent {
  type: 'content',
  phase: 'planning' | 'calling' | 'synthesis',
  status: 'started' | 'generating' | 'completed' | 'error',
  data?: {
    text?: string,
  },
  timestamp?: number,
}