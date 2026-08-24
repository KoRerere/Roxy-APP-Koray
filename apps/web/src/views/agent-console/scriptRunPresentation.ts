import type { AgentConversationRunEventDTO } from '@roxy/shared/channel'
import { isTemplateRef } from '@roxy/shared'
import type { ScriptTemplateNameOptions } from './scriptTemplatePresentation'
import { resolveCanonicalScriptTemplateName } from './scriptTemplatePresentation'

export interface ScriptRunPresentationOptions extends ScriptTemplateNameOptions {
  workspaceId?: number | string
}

const resolvedNames = new Map<string, string>()
const pendingNames = new Map<string, Promise<string | undefined>>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function scriptTemplateRef(item: AgentConversationRunEventDTO): string | undefined {
  if (item.event.type === 'tool_started' && item.event.data.toolName === 'roxy_script_run') {
    const input = isRecord(item.event.data.input) ? item.event.data.input : {}
    const candidates = [item.event.data.target, input.scriptPath]
    return candidates.find(isTemplateRef)
  }

  if (item.event.type === 'script_output' && isTemplateRef(item.event.data.scriptName)) {
    return item.event.data.scriptName
  }

  return undefined
}

function cacheKey(templateRef: string, options: ScriptRunPresentationOptions): string {
  return `${String(options.workspaceId ?? '')}\u0000${options.locale ?? ''}\u0000${templateRef}`
}

async function resolveCachedScriptName(
  templateRef: string,
  options: ScriptRunPresentationOptions,
): Promise<string | undefined> {
  const key = cacheKey(templateRef, options)
  const cached = resolvedNames.get(key)
  if (cached) {
    return cached
  }

  const pending = pendingNames.get(key)
  if (pending) {
    return pending
  }

  const request = resolveCanonicalScriptTemplateName(templateRef, options)
    .then((name) => {
      if (name) {
        resolvedNames.set(key, name)
      }
      return name
    })
    .catch((error) => {
      console.warn(`[agent-console] Failed to resolve script template ${templateRef}:`, error)
      return undefined
    })
    .finally(() => {
      pendingNames.delete(key)
    })
  pendingNames.set(key, request)
  return request
}

function withScriptName(
  item: AgentConversationRunEventDTO,
  templateRef: string,
  scriptName: string,
): AgentConversationRunEventDTO {
  if (item.event.type === 'tool_started') {
    return {
      ...item,
      event: {
        ...item.event,
        data: {
          ...item.event.data,
          target: scriptName,
        },
      },
    }
  }

  if (item.event.type === 'script_output' && item.event.data.scriptName === templateRef) {
    return {
      ...item,
      event: {
        ...item.event,
        data: {
          ...item.event.data,
          scriptName,
        },
      },
    }
  }

  return item
}

export async function resolveScriptRunPresentationEvents(
  items: readonly AgentConversationRunEventDTO[],
  options: ScriptRunPresentationOptions,
): Promise<AgentConversationRunEventDTO[]> {
  const templateRefs = [...new Set(items.map(scriptTemplateRef).filter(isTemplateRef))]
  if (templateRefs.length === 0) {
    return [...items]
  }

  const names = new Map(await Promise.all(templateRefs.map(async templateRef => [
    templateRef,
    await resolveCachedScriptName(templateRef, options),
  ] as const)))

  return items.map((item) => {
    const templateRef = scriptTemplateRef(item)
    if (!templateRef) {
      return item
    }

    const scriptName = names.get(templateRef)
    return scriptName ? withScriptName(item, templateRef, scriptName) : item
  })
}
