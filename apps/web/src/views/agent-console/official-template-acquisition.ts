import type { UserTemplateCreate } from '@roxy/agent-api'
import type { OfficialTemplate } from './template-store'
import {
  createScriptParamsFormSchema,
  extractScriptParamsDefaults,
  parseScriptParamsSchema,
} from './script-template-params'
import { pickOfficialTemplatePrompt } from './template-store'

interface OfficialTemplateAcquisition {
  requiresConfirmation: boolean
  request: UserTemplateCreate
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isEmptyRequiredValue(value: unknown): boolean {
  return value == null
    || (typeof value === 'string' && !value.trim())
    || (Array.isArray(value) && value.length === 0)
}

function hasEmptyRequiredValue(schema: unknown, data: unknown): boolean {
  if (!isRecord(schema))
    return false

  const required = Array.isArray(schema.required)
    ? schema.required.filter((key): key is string => typeof key === 'string' && key !== 'debug')
    : []
  if (required.some(key => !isRecord(data) || isEmptyRequiredValue(data[key])))
    return true

  if (!isRecord(data) || !isRecord(schema.properties))
    return false

  return Object.entries(schema.properties).some(([key, propertySchema]) =>
    key !== 'debug' && key in data && hasEmptyRequiredValue(propertySchema, data[key]),
  )
}

export function prepareOfficialTemplateAcquisition(
  template: OfficialTemplate,
  locale?: string,
): OfficialTemplateAcquisition {
  const request: UserTemplateCreate = { official_template_id: template.id }

  if (template.templateType === 'prompt') {
    return {
      requiresConfirmation: !pickOfficialTemplatePrompt(template, locale).trim(),
      request,
    }
  }

  if (template.templateType !== 'script') {
    return { requiresConfirmation: false, request }
  }

  try {
    const schema = parseScriptParamsSchema(template.metadata.optionsSchema)
    if (!schema) {
      return {
        requiresConfirmation: false,
        request: { ...request, metadata: { params: {} } },
      }
    }

    const params = extractScriptParamsDefaults(schema)
    const formSchema = createScriptParamsFormSchema(schema)
    const requiresConfirmation = hasEmptyRequiredValue(formSchema, params)
    return {
      requiresConfirmation,
      request: { ...request, metadata: { params } },
    }
  }
  catch {
    return { requiresConfirmation: true, request }
  }
}
