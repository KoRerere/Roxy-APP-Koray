export const TASK_ERROR_CODES = {
  taskInterrupted: 'TASK_INTERRUPTED',
  taskWorkspaceMismatch: 'TASK_WORKSPACE_MISMATCH',
  taskTemplateMismatch: 'TASK_TEMPLATE_MISMATCH',
  taskAlreadyRunning: 'TASK_ALREADY_RUNNING',
  missedTrigger: 'MISSED_TRIGGER',
  agentShutdown: 'AGENT_SHUTDOWN',
  agentRestarted: 'AGENT_RESTARTED',
  taskAssetInvalid: 'TASK_ASSET_INVALID',
  windowStateUnavailable: 'WINDOW_STATE_UNAVAILABLE',
  noAvailableWindows: 'NO_AVAILABLE_WINDOWS',
  leaseServiceUnavailable: 'LEASE_SERVICE_UNAVAILABLE',
  taskDisabled: 'TASK_DISABLED',
  taskExecutedByOtherUser: 'TASK_EXECUTED_BY_OTHER_USER',
  taskExecutionFailed: 'TASK_EXECUTION_FAILED',
  agentExecutionFailed: 'AGENT_EXECUTION_FAILED',
  scriptExecutionFailed: 'SCRIPT_EXECUTION_FAILED',
  partialWindowFailure: 'PARTIAL_WINDOW_FAILURE',
  artifactUploadPartialFailure: 'ARTIFACT_UPLOAD_PARTIAL_FAILURE',
  leaseLost: 'LEASE_LOST',
  heartbeatRejected: 'HEARTBEAT_REJECTED',
  heartbeatFailed: 'HEARTBEAT_FAILED',
} as const

export type TaskErrorCode = typeof TASK_ERROR_CODES[keyof typeof TASK_ERROR_CODES]

const TASK_ERROR_LOG_MESSAGES = {
  TASK_INTERRUPTED: 'Task execution was interrupted',
  TASK_WORKSPACE_MISMATCH: 'Task or template does not belong to the current workspace',
  TASK_TEMPLATE_MISMATCH: 'Task references a different template',
  TASK_ALREADY_RUNNING: 'Task is already running on this device',
  MISSED_TRIGGER: 'Scheduled trigger was missed by more than five minutes',
  AGENT_SHUTDOWN: 'Task execution was interrupted because the agent is shutting down',
  AGENT_RESTARTED: 'Task execution was interrupted because the agent restarted',
  TASK_ASSET_INVALID: 'Task asset is invalid or corrupted',
  WINDOW_STATE_UNAVAILABLE: 'Failed to read task window state',
  NO_AVAILABLE_WINDOWS: 'No configured browser windows are available',
  LEASE_SERVICE_UNAVAILABLE: 'Task execution coordination service is unavailable',
  TASK_DISABLED: 'Task is disabled',
  TASK_EXECUTED_BY_OTHER_USER: 'Task was claimed by another client',
  TASK_EXECUTION_FAILED: 'Task execution failed',
  AGENT_EXECUTION_FAILED: 'Agent task execution failed',
  SCRIPT_EXECUTION_FAILED: 'All script executions failed',
  PARTIAL_WINDOW_FAILURE: 'Script execution failed for some windows',
  ARTIFACT_UPLOAD_PARTIAL_FAILURE: 'Some task artifacts failed to upload',
  LEASE_LOST: 'Task execution lease was lost',
  HEARTBEAT_REJECTED: 'Task heartbeat request was rejected',
  HEARTBEAT_FAILED: 'Task heartbeat failed repeatedly',
} satisfies Record<TaskErrorCode, string>

export function taskErrorLogMessage(code: TaskErrorCode): string {
  return TASK_ERROR_LOG_MESSAGES[code]
}
