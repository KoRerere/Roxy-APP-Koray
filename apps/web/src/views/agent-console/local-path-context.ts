import type { AgentConversationRunStartCommand } from '@roxy/shared/channel'
import type { AgentAttachment } from './types'

export type AgentLocalPathAttachment = NonNullable<AgentConversationRunStartCommand['localAttachments']>[number]

export function collectLocalPathAttachments(attachments: AgentAttachment[]): AgentLocalPathAttachment[] {
  return attachments.flatMap(attachment => attachment.localPath
    ? [{
        kind: attachment.kind,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        localPath: attachment.localPath,
      }]
    : [])
}
