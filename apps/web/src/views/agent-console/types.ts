import type { SvgNames } from '/@/components/rx-icon'
import type { RouteLocationRaw } from 'vue-router'
import type {
  AgentClarificationQuestion,
  AgentConversationRunEventDTO,
  AgentProfileMonitorProfile,
  AgentProfileMonitorSnapshot,
  AgentTaskMonitorBrowserSession,
  AgentTaskMonitorEventStage,
  AgentTaskMonitorSnapshot,
  AgentTaskMonitorSourceType,
  AgentTaskMonitorTask,
} from '@roxy/shared/channel'
import type { AgentErrorData } from './utils/agent-error'

export type { AgentClarificationQuestion } from '@roxy/shared/channel'

export type AgentNavId
  = | 'new-chat'
    | 'task-manager'
    | 'scripts'
    | 'skills'
    | 'prompts'
    | 'template-store'
    | 'roxyclaw'
    | 'settings'

export type AgentMessageRole = 'user' | 'assistant'

export type AgentMessageStatus = 'thinking' | 'streaming' | 'done' | 'error'

export type AgentRunStatus = 'queued' | 'streaming' | 'completed' | 'failed' | 'cancelled'

export type AgentTaskStatus = 'running' | 'idle' | 'queued' | 'completed' | 'failed'

export type AgentTaskSourceType = AgentTaskMonitorSourceType

export type AgentTaskEventStage = AgentTaskMonitorEventStage

export type AgentProcessEventType
  = | 'thinking'
    | 'tool_call'
    | 'agent_lifecycle'
    | 'skill_load'
    | 'content'
    | 'final_answer'
    | 'script_log'
    | 'context_compacted'
    | 'retrying'
    | 'agent_file'
    | 'hitl'

export type AgentProcessEventStatus = 'pending' | 'running' | 'success' | 'failed'

export interface AgentNavItem {
  id: AgentNavId
  label: string
  icon: SvgNames
  to: RouteLocationRaw
  statusActive?: boolean
}

export interface AgentConversation {
  id: string
  title: string
  updatedAt: string
  latestRunId?: string
  latestRunStatus?: AgentRunStatus
  runningRunIds: string[]
  unread: boolean
}

export interface AgentMessage {
  id: string
  conversationId: string
  runId?: string
  role: AgentMessageRole
  author: string
  content: string
  attachments?: AgentAttachment[]
  createdAt: string
  status: AgentMessageStatus
  process?: AgentConversationProcess
  errorData?: AgentErrorData | string
}

export type AgentAttachmentUploadStatus = 'pending' | 'uploading' | 'uploaded' | 'error'

export type AgentAttachmentKind = 'file' | 'folder'

export interface AgentFolderSelection {
  name: string
  path?: string
  files?: File[]
}

export interface AgentPathSelection {
  kind: AgentAttachmentKind
  name: string
  path: string
}

export interface AgentAttachment {
  fileId: string
  kind: AgentAttachmentKind
  fileName: string
  mimeType: string
  size?: number
  url?: string
  localUrl?: string
  remoteUrl?: string
  fileUrl?: string
  preview?: string
  localFile?: File
  localFiles?: File[]
  uploadedFiles?: AgentAttachment[]
  localPath?: string
  uploadStatus?: AgentAttachmentUploadStatus
}

export interface AgentConversationProcess {
  id: string
  revision?: number
  completed?: boolean
  durationLabel?: string
  durationState?: 'thinking' | 'processed'
  durationStartedAt?: number
  durationEndedAt?: number
  collapsed?: boolean
  events: AgentProcessEvent[]
}

export interface AgentProcessBaseEvent {
  id: string
  type: AgentProcessEventType
  title?: string
  status?: AgentProcessEventStatus
  expanded?: boolean
  timestamp?: string
}

export interface AgentThinkingProcessEvent extends AgentProcessBaseEvent {
  type: 'thinking'
  title: string
  content: string
  durationStartedAt?: number
  durationEndedAt?: number
  durationMs?: number
}

export interface AgentToolCallProcessEvent extends AgentProcessBaseEvent {
  type: 'tool_call'
  toolName: string
  finished?: boolean
  label?: string
  target?: string
  patchType?: 'create' | 'update' | 'delete' | 'mixed'
  input?: unknown
  output?: unknown
  durationMs?: number
}

export interface AgentLifecycleProcessEvent extends AgentProcessBaseEvent {
  type: 'agent_lifecycle'
  renderRevision?: number
  agentPath: string
  parentAgentPath?: string
  agentName: string
  agentType: string
  lifecycleStatus: 'starting' | 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt?: number
  finishedAt?: number
  report?: string
  error?: string
  events: AgentProcessEvent[]
  children: AgentLifecycleProcessEvent[]
}

export interface AgentSkillLoadProcessEvent extends AgentProcessBaseEvent {
  type: 'skill_load'
  skillPath: string
}

export interface AgentContentProcessEvent extends AgentProcessBaseEvent {
  type: 'content'
  content: string
  emphasis?: boolean
}

export interface AgentFinalAnswerProcessEvent extends AgentProcessBaseEvent {
  type: 'final_answer'
  content: string
}

export interface AgentScriptLogLine {
  level?: string
  message: string
}

export interface AgentScriptLogProcessEvent extends AgentProcessBaseEvent {
  type: 'script_log'
  toolId?: string
  scriptRunId?: string
  dirId?: string
  scriptName?: string
  lines: AgentScriptLogLine[]
}

export interface AgentContextCompactedProcessEvent extends AgentProcessBaseEvent {
  type: 'context_compacted'
  title: string
  compactedCount: number
  summary?: string
}

export interface AgentRetryProcessEvent extends AgentProcessBaseEvent {
  type: 'retrying'
  title: string
  attempt: number
  maxAttempts: number
  reason?: string
}

export interface AgentHitlClarificationAnswer {
  id: string
  question: string
  answer: string
  recommended: boolean
}

export interface AgentHitlProcessEvent extends AgentProcessBaseEvent {
  type: 'hitl'
  title: string
  prompt: string
  description?: string
  detail?: string
  requestKind?: 'approval' | 'clarification'
  clarificationQuestionCount?: number
  clarificationQuestions?: AgentClarificationQuestion[]
  clarificationAnswers?: AgentHitlClarificationAnswer[]
  approvalId?: string
}

export interface AgentFileArtifact {
  fileId: string
  fileName: string
  size: number
  mimeType: string
  op?: 'create' | 'update'
}

export interface AgentFileProcessEvent extends AgentProcessBaseEvent {
  type: 'agent_file'
  files: AgentFileArtifact[]
}

export type AgentProcessEvent
  = | AgentThinkingProcessEvent
    | AgentToolCallProcessEvent
    | AgentLifecycleProcessEvent
    | AgentSkillLoadProcessEvent
    | AgentContentProcessEvent
    | AgentFinalAnswerProcessEvent
    | AgentScriptLogProcessEvent
    | AgentContextCompactedProcessEvent
    | AgentRetryProcessEvent
    | AgentFileProcessEvent
    | AgentHitlProcessEvent

export interface AgentRun {
  id: string
  conversationId: string
  status: AgentRunStatus
  startedAt: string
  completedAt?: string
  error?: string
}

export interface AgentStream {
  id: string
  conversationId: string
  runId: string
  status: AgentRunStatus
  events: AgentConversationRunEventDTO[]
  lastSequence: number
  error?: string
}

export type AgentHitlRequestStatus = 'pending' | 'submitting' | 'resolved' | 'error'

export type AgentHitlControlKind = 'choice' | 'text' | 'textarea'

export type AgentHitlControlValue = string | boolean | number | null

export interface AgentHitlChoiceOption {
  id: string
  label: string
  value: AgentHitlControlValue
  variant?: 'primary' | 'secondary' | 'danger'
  legacyDecisionType?: 'approve' | 'reject' | 'edit'
}

export interface AgentHitlControlBase {
  id: string
  kind: AgentHitlControlKind
  label?: string
  required?: boolean
}

export interface AgentHitlChoiceControl extends AgentHitlControlBase {
  kind: 'choice'
  options: AgentHitlChoiceOption[]
}

export interface AgentHitlTextControl extends AgentHitlControlBase {
  kind: 'text' | 'textarea'
  placeholder?: string
  defaultValue?: string
}

export type AgentHitlControl = AgentHitlChoiceControl | AgentHitlTextControl

export interface AgentHitlSubject {
  id: string
  title: string
  name?: string
  description?: string
  input?: unknown
  diff?: string
}

export interface AgentHitlRequest {
  id: string
  conversationId: string
  runId: string
  title: string
  prompt: string
  description?: string
  status: AgentHitlRequestStatus
  subjects: AgentHitlSubject[]
  controls: AgentHitlControl[]
  values: Record<string, AgentHitlControlValue>
  clarificationQuestions?: AgentClarificationQuestion[]
  source?: {
    kind: 'legacy-agent-interrupt' | 'agent-hitl'
    payload?: unknown
  }
}

export interface AgentHitlSubmitPayload {
  requestId: string
  values: Record<string, AgentHitlControlValue>
  /** Continue this run with all subsequent tool calls in full-access mode. */
  fullAccess?: boolean
}

export interface AgentTask {
  id: string
  conversationId: string
  runId?: string
  name: string
  subtitle: string
  status: AgentTaskStatus
  dirId?: string
  ws?: string
  browserType?: string
  windowName?: string
  windowSortNum?: number
  platformUrl?: string
  platformUserName?: string
  platformIcon?: string
  countryCode?: string
  detailLoading?: boolean
  events?: AgentTaskEvent[]
}

export interface AgentTaskGroup {
  id: string
  conversationId: string
  runId?: string
  title: string
  description: string
  expanded: boolean
  sourceType?: AgentTaskSourceType
  browserCount?: number
  lastActivityAt?: number
  tasks: AgentTask[]
  kind?: 'running' | 'idle'
}

export interface AgentTaskEvent {
  id: string
  stage: AgentTaskEventStage
  toolName: string
  input?: Record<string, unknown>
  result?: string
  success: boolean
  errorMessage?: string
  durationMs?: number
  timestamp: number
  workerId?: string
  conversationId?: string
  summary?: string
}

export type TaskMonitorBrowserSessionDTO = AgentTaskMonitorBrowserSession
export type TaskMonitorTaskDTO = AgentTaskMonitorTask
export type TaskMonitorSnapshotDTO = AgentTaskMonitorSnapshot
export type ProfileMonitorProfileDTO = AgentProfileMonitorProfile
export type ProfileMonitorSnapshotDTO = AgentProfileMonitorSnapshot

export interface AgentConversationDraft {
  conversationId: string
  prompt: string
  attachments: AgentAttachment[]
}

export interface AgentQueuedPrompt {
  id: string
  conversationId: string
  content: string
  draftContent?: string
  attachments?: AgentAttachment[]
  createdAt: number
}

export type AgentTodoItemStatus = 'pending' | 'in_progress' | 'completed'

export interface AgentTodoItem {
  id: string
  content: string
  status: AgentTodoItemStatus
}

export interface AgentTodoProgress {
  id: string
  conversationId: string
  runId: string
  current: number
  total: number
  content?: string
  todos: AgentTodoItem[]
}

export interface AgentConsoleState {
  conversationIds: string[]
  conversationsById: Record<string, AgentConversation>
  draftsByConversationId: Record<string, AgentConversationDraft>
  queuedPromptsByConversationId: Record<string, AgentQueuedPrompt[]>
  messagesByConversationId: Record<string, AgentMessage[]>
  runsById: Record<string, AgentRun>
  streamsByRunId: Record<string, AgentStream>
  todoProgressByRunId: Record<string, AgentTodoProgress>
  taskGroupsByConversationId: Record<string, AgentTaskGroup[]>
  pendingHitlByConversationId: Record<string, AgentHitlRequest>
}
