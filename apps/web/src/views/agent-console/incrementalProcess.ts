import type { AgentConversationRunEventDTO } from '@roxy/shared/channel'
import type { AgentConversationProcess } from './types'
import { buildProcessFromEvents, updateProcessFromCheckpoint } from './historyAdapter'
import type { ProcessBuildCheckpoint, ProcessBuildResult } from './historyAdapter'

/**
 * Applies append-only run events from the checkpoint captured by the full adapter.
 * Events with rollback semantics deliberately return false so the caller can replay
 * visibleRunEvents once and replace the checkpoint with a safe one.
 */
export class IncrementalProcessUpdater {
  private checkpoint: ProcessBuildCheckpoint | undefined

  reset(events: AgentConversationRunEventDTO[], checkpoint?: ProcessBuildCheckpoint): void {
    this.checkpoint = checkpoint ?? buildProcessFromEvents('incremental-process', events, { finalize: false }).checkpoint
  }

  update(messageId: string, process: AgentConversationProcess, events: AgentConversationRunEventDTO[]): ProcessBuildResult | false
  update(process: AgentConversationProcess, events: AgentConversationRunEventDTO[]): boolean
  update(
    messageIdOrProcess: string | AgentConversationProcess,
    processOrEvents: AgentConversationProcess | AgentConversationRunEventDTO[],
    maybeEvents?: AgentConversationRunEventDTO[],
  ): ProcessBuildResult | boolean {
    const legacy = typeof messageIdOrProcess !== 'string'
    const messageId = legacy ? 'incremental-process' : messageIdOrProcess
    const process = legacy ? messageIdOrProcess : processOrEvents as AgentConversationProcess
    const events = legacy ? processOrEvents as AgentConversationRunEventDTO[] : maybeEvents
    if (!events || !this.checkpoint) {
      return false
    }

    const result = updateProcessFromCheckpoint(messageId, process, events, this.checkpoint, { finalize: false })
    if (!result) {
      return false
    }

    this.checkpoint = result.checkpoint
    return legacy ? true : result
  }
}
