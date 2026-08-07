import type { MyTemplateItem, UserTemplateDTO } from './my-templates'
import type { UserTaskDTO } from './task-manager'
import { serializeAgentProfileReference } from '@roxy/shared'
import { templateItemToPrompt } from './components/chat-composer/protocol'
import { mapUserTemplateComposerItem } from './components/chat-composer/templateItems'
import { normalizeMyTemplateKind } from './my-templates'

export type RunnableUserTemplate = UserTemplateDTO | MyTemplateItem

export function getRunnableTemplateKind(template: RunnableUserTemplate) {
  return 'kind' in template
    ? template.kind
    : normalizeMyTemplateKind(template.templateType)
}

export function buildTemplateTaskComposerPrompt(
  template: RunnableUserTemplate,
  task: Pick<UserTaskDTO, 'metadata' | 'windowIds'>,
): string {
  const snapshotPrompt = typeof task.metadata.prompt === 'string'
    ? task.metadata.prompt.trim()
    : ''
  const composerTemplate = {
    ...template,
    metadata: {
      ...(template.metadata ?? {}),
      prompt: snapshotPrompt,
    },
  }
  const templatePrompt = templateItemToPrompt(mapUserTemplateComposerItem(composerTemplate))
  const windowPrompt = task.windowIds.length
    ? serializeAgentProfileReference(task.windowIds)
    : ''
  return [templatePrompt, windowPrompt].filter(Boolean).join(' ').trim()
}
