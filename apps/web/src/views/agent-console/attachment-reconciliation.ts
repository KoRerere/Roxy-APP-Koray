import type { AgentAttachment } from './types'

function mergeAttachment(pending: AgentAttachment, received: AgentAttachment): AgentAttachment {
  const {
    localFile: _localFile,
    localFiles: _localFiles,
    localPath: _localPath,
    ...displayAttachment
  } = pending

  return {
    ...displayAttachment,
    ...received,
    kind: pending.kind,
    ...(pending.preview ? { preview: pending.preview } : {}),
    uploadStatus: 'uploaded',
  }
}

export function reconcilePendingAttachments(
  pendingAttachments: AgentAttachment[],
  eventAttachments: AgentAttachment[],
): AgentAttachment[] {
  const unmatchedEventAttachments = [...eventAttachments]

  return pendingAttachments.map((pending) => {
    let eventIndex = unmatchedEventAttachments.findIndex(received => received.fileId === pending.fileId)

    if (eventIndex < 0 && pending.kind === 'file' && pending.localPath) {
      eventIndex = unmatchedEventAttachments.findIndex((received) => {
        return received.kind === 'file' && received.fileName === pending.fileName
      })
    }

    if (eventIndex < 0) {
      return pending
    }

    const [received] = unmatchedEventAttachments.splice(eventIndex, 1)
    return received ? mergeAttachment(pending, received) : pending
  })
}
