import type { TemplatesApi, UserTemplatesApi } from '@roxy/agent-api'
import { isTemplateRef, parseTemplateRef } from '@roxy/shared'
import { localizedSchemaText } from './script-template-params'

export interface ScriptTemplateNameOptions {
  templates: Pick<TemplatesApi, 'getOfficialTemplate'>
  userTemplates: Pick<UserTemplatesApi, 'getUserTemplate'>
  locale?: string
}

export async function resolveCanonicalScriptTemplateName(
  templateRef: string,
  options: ScriptTemplateNameOptions,
): Promise<string | undefined> {
  if (!isTemplateRef(templateRef)) {
    return undefined
  }

  const parsed = parseTemplateRef(templateRef)
  if (parsed.namespace === 'official') {
    const response = await options.templates.getOfficialTemplate({
      templateIdOrSlug: String(parsed.id),
    })
    return localizedSchemaText(response.data?.name, options.locale).trim() || undefined
  }

  const response = await options.userTemplates.getUserTemplate({ templateId: parsed.id })
  const name = response.data?.name
  return typeof name === 'string' ? name.trim() || undefined : undefined
}
