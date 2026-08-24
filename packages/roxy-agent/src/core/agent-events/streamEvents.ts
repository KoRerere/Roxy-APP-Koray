import type { AgentErrorEnvelope } from '@/core/agentError'
import type { AgentClarificationQuestion, AgentRunEvent, AgentRunEventMap } from '@roxy/shared/channel'
import { runEvents } from './events'

export type StreamEvent = AgentRunEvent

export const streamEvents = {
  thinkingEvent(text: string, thinkingId: string, workerId?: string) {
    return runEvents.thinking(text, thinkingId, workerId)
  },
  thinkingCompleteEvent(data: {
    id?: string
    thinkingId: string
    startTimestamp: number
    endTimestamp: number
    durationMs: number
    taskId?: string
    workerId?: string
  }) {
    const { taskId, workerId, ...timing } = data
    return runEvents.thinkingCompleted({
      ...timing,
      id: data.id ?? data.thinkingId,
      ...((workerId ?? taskId) ? { workerId: workerId ?? taskId } : {}),
    })
  },
  contentEvent(text: string, contentId: string, workerId?: string) {
    return runEvents.content(text, contentId, workerId)
  },
  workerThinkingEvent(workerId: string, text: string, thinkingId: string) {
    return runEvents.thinking(text, thinkingId, workerId)
  },
  workerContentEvent(workerId: string, text: string, contentId: string) {
    return runEvents.content(text, contentId, workerId)
  },
  workerResultEvent(data: {
    taskId: string
    dispatchId?: string
    status: 'success' | 'failed' | 'cancelled' | 'timeout'
    exitCode?: number | null
    signal?: NodeJS.Signals | null
    error?: unknown
    durationMs?: number
  }) {
    return runEvents.workerCompleted({
      workerId: data.taskId,
      ...(data.dispatchId ? { dispatchId: data.dispatchId } : {}),
      status: data.status,
      exitCode: data.exitCode,
      signal: data.signal,
      error: data.error,
      durationMs: data.durationMs,
    })
  },
  workerResult(data: {
    taskId: string
    dispatchId?: string
    status: 'success' | 'failed' | 'cancelled' | 'timeout'
    exitCode?: number | null
    signal?: NodeJS.Signals | null
    error?: unknown
    durationMs?: number
  }) {
    return this.workerResultEvent(data)
  },
  workerStoppedEvent(data: { taskId: string, error: string }) {
    return runEvents.workerCompleted({
      workerId: data.taskId,
      status: 'cancelled',
      error: data.error,
    })
  },
  workerStopped(data: { taskId: string, error: string }) {
    return this.workerStoppedEvent(data)
  },
  agentLifecycle(data: AgentRunEventMap['agent_lifecycle']) {
    return runEvents.agentLifecycle(data)
  },
  workerDispatchEvent(data: { taskId: string, title: string, dispatchId?: string }) {
    return runEvents.workerDispatched(data.taskId, data.title, data.dispatchId)
  },
  workerDispatch(data: { taskId: string, title: string, dispatchId?: string }) {
    return this.workerDispatchEvent(data)
  },
  retryEvent(data: { id?: string, attempt: number, maxAttempts: number, reason?: string, workerId?: string }) {
    return runEvents.retry({
      retryId: data.id,
      attempt: data.attempt,
      maxAttempts: data.maxAttempts,
      reason: data.reason,
      workerId: data.workerId,
    })
  },
  retry(data: { id?: string, attempt: number, maxAttempts: number, reason?: string, workerId?: string }) {
    return this.retryEvent(data)
  },
  workerRetryEvent(data: { taskId: string, attempt: number, maxAttempts: number, reason?: string }) {
    return runEvents.retry({
      attempt: data.attempt,
      maxAttempts: data.maxAttempts,
      reason: data.reason,
      workerId: data.taskId,
    })
  },
  cancelled(data: { message: string }) {
    return runEvents.cancelled('user', data.message)
  },
  toolCallEvent(data: {
    toolName: string
    args: unknown
    taskId?: string
    toolId?: string
    assignmentsCount?: number
    patchType?: 'create' | 'update' | 'delete' | 'mixed'
    skillName?: string
    skillFilePath?: string
    target?: string
  }) {
    return runEvents.toolStarted({
      toolName: data.toolName,
      input: data.args,
      toolId: data.toolId,
      workerId: data.taskId,
      patchType: data.patchType,
      assignmentsCount: data.assignmentsCount,
      skillName: data.skillName,
      skillFilePath: data.skillFilePath,
      target: data.target,
    })
  },
  toolResultEvent(data: {
    toolName: string
    result: unknown
    et?: number
    taskId?: string
    toolId?: string
    status?: 'success' | 'failed'
  }) {
    return runEvents.toolFinished({
      toolName: data.toolName,
      output: data.result,
      toolId: data.toolId,
      workerId: data.taskId,
      durationMs: data.et,
      status: data.status,
    })
  },
  planUpdatedEvent(data: unknown) {
    return runEvents.planUpdated(data)
  },
  workerPlanUpdatedEvent(workerId: string, data: unknown) {
    return runEvents.planUpdated(data, workerId)
  },
  title(title: string) {
    return runEvents.title(title)
  },
  hitlInterrupt(data: { actionRequests: unknown[], reviewConfigs: unknown[], interruptsId: string }) {
    return runEvents.approvalRequested({
      approvalId: data.interruptsId,
      actionRequests: data.actionRequests,
      reviewConfigs: data.reviewConfigs,
    })
  },
  hitlResume(data: { interruptsId: string, decisions: unknown[] }) {
    return runEvents.approvalResolved({
      approvalId: data.interruptsId,
      decisions: data.decisions,
    })
  },
  clarificationRequest(data: {
    clarificationId: string
    questions?: AgentClarificationQuestion[]
    question?: string
    options?: string[]
  }) {
    const firstQuestion = data.questions?.[0]
    const controls = firstQuestion
      ? []
      : data.options?.length
      ? [{
          id: 'answer',
          kind: 'choice',
          required: true,
          options: data.options.map((option, index) => ({
            id: `option-${index + 1}`,
            label: option,
            value: option,
            variant: 'secondary',
          })),
        }]
      : [
          {
            id: 'answer',
            kind: 'textarea',
            label: '回答',
            required: true,
            placeholder: '请输入回答',
          },
          {
            id: 'submit',
            kind: 'choice',
            required: true,
            options: [{ id: 'submit', label: '提交', value: true, variant: 'primary' }],
          },
        ]
    return runEvents.approvalRequested({
      approvalId: data.clarificationId,
      actionRequests: [],
      reviewConfigs: [],
      requestKind: 'clarification',
      title: '需要您的输入',
      prompt: firstQuestion?.question ?? data.question,
      subjects: [],
      controls,
      values: { answer: null },
      ...(data.questions ? { questions: data.questions } : {}),
    })
  },
  scriptLogEvent(data: { scriptName?: string, level: string, message: string, toolId?: string, runId?: string, dirId?: string, workerId?: string }) {
    return runEvents.scriptOutput({
      scriptName: data.scriptName,
      level: data.level,
      message: data.message,
      toolId: data.toolId,
      scriptRunId: data.runId,
      dirId: data.dirId,
      workerId: data.workerId,
    })
  },
  scriptLog(data: { scriptName?: string, level: string, message: string, toolId?: string, runId?: string, dirId?: string, workerId?: string }) {
    return this.scriptLogEvent(data)
  },
  agentFile(data: {
    fileId: string
    fileName: string
    size: number
    mimeType: string
    op: 'create' | 'update'
  }) {
    return runEvents.artifactCreated({
      fileId: data.fileId,
      fileName: data.fileName,
      size: data.size,
      mimeType: data.mimeType,
      operation: data.op,
    })
  },
  tokenUsage(data: AgentRunEventMap['token_usage']) {
    return runEvents.tokenUsage(data)
  },
  contextCompacted(data: AgentRunEventMap['context_compacted']) {
    return runEvents.contextCompacted(data)
  },
  done(finalAnswer?: string) {
    return runEvents.completed(finalAnswer)
  },
  error(error: string | AgentErrorEnvelope, httpStatus?: number) {
    return runEvents.failed(error, httpStatus)
  },
}
