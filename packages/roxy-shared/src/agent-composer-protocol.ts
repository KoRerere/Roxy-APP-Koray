import type { TemplateRef } from './template-ref'
import { normalizeTemplateRef } from './template-ref'

function templateRefValue(templateRef: TemplateRef | string): string {
  return normalizeTemplateRef(templateRef).value
}

export function serializeAgentScriptReference(name: string, templateRef: TemplateRef | string): string {
  return `[@script:${name}](${templateRefValue(templateRef)})`
}

export function serializeAgentSkillReference(name: string, skillMdPath: string): string {
  return `[$${name}](${skillMdPath.trim()})`
}

export function serializeAgentProfileReference(dirIds: readonly string[]): string {
  return `[@profile:${dirIds.length}](${dirIds.join(',')})`
}
