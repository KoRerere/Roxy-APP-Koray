import type { TemplateRef } from './template-ref'
import { normalizeTemplateRef } from './template-ref'

export interface AgentComposerPromptValidationResult {
  valid: boolean
  issues: string[]
}

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

/** Extract the browser profile ids carried by Composer profile references. */
export function extractAgentProfileDirIds(prompt: string): string[] {
  const ids: string[] = []
  const pattern = /\[@profile:[^\]\r\n]*\]\(([^)\r\n]*)\)/g

  for (const match of prompt.matchAll(pattern)) {
    match[1]
      .split(',')
      .map(id => id.trim())
      .filter(Boolean)
      .forEach(id => ids.push(id))
  }

  return Array.from(new Set(ids))
}

/**
 * Validate the small Composer token subset persisted with Skill templates.
 * This is deliberately syntactic: the editor remains the owner of rendering.
 */
export function validateAgentComposerTemplatePrompt(
  prompt: string,
): AgentComposerPromptValidationResult {
  const value = prompt.trim()
  const issues: string[] = []
  if (!value) {
    issues.push('Composer prompt must not be empty.')
  }

  if (/\{\{[^}]+}}/.test(value)) {
    issues.push('Composer prompt must not use double-brace variables.')
  }
  if (/\$(?:\{[A-Za-z_]\w*}|[A-Za-z_]\w*)/.test(value)) {
    issues.push('Composer prompt must not use dollar variables.')
  }
  if (/\[@script:|\[\$[^\]]*]\(/.test(value)) {
    issues.push('Composer prompt must not embed script or Skill reference tokens.')
  }
  if (/(?:\b(?:password|passcode|cookie|token|api[\s_-]?key|secret|authorization|credential)\b|密码|口令|令牌|密钥|凭证)/i.test(value)) {
    issues.push('Composer prompt must not contain sensitive values or secret input fields.')
  }
  if (/(?:^|[\s"'])\/?(?:Users|home)\/[\w.-]+\//.test(value) || /(?:^|[\s"'(])[A-Za-z]:[\\/]/.test(value)) {
    issues.push('Composer prompt must not retain a local filesystem path.')
  }

  const marker = /\[(?:input|url|@profile):/g
  for (const match of value.matchAll(marker)) {
    const fragment = value.slice(match.index)
    if (fragment.startsWith('[@profile:')) {
      issues.push('Composer prompt must not contain browser-window selection tokens; select windows when using the template.')
      continue
    }

    if (!/^\[(?:input|url):[^\]\r\n]+\]\([^\)\r\n]*\)|^\[@profile:0]\(\)/.test(fragment)) {
      issues.push('Composer prompt contains an unsupported or malformed Composer token.')
      break
    }
  }

  return { valid: issues.length === 0, issues }
}
