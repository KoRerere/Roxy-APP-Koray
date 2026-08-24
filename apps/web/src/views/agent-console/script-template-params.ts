import type { JsonSchema, UISchemaElement } from '@jsonforms/core'
import type { ErrorObject } from 'ajv'
import type AjvCore from 'ajv'
import { extractDefaults, generateDefaultUISchema } from '@jsonforms/core'
import Ajv from 'ajv'
import Ajv2019 from 'ajv/dist/2019'
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import { toRaw } from 'vue'

export type ScriptParamsSchema = JsonSchema

export class ScriptParamsFormError extends Error {}

const scriptParamsSchemaMapKeywords = [
  '$defs',
  'definitions',
  'dependentSchemas',
  'patternProperties',
  'properties',
] as const
const scriptParamsSchemaKeywords = [
  'additionalItems',
  'additionalProperties',
  'allOf',
  'anyOf',
  'contains',
  'contentSchema',
  'dependencies',
  'else',
  'if',
  'items',
  'not',
  'oneOf',
  'prefixItems',
  'propertyNames',
  'then',
  'unevaluatedItems',
  'unevaluatedProperties',
] as const

export function isScriptParamsRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function cloneScriptParamsValue(value: unknown): unknown {
  const rawValue = toRaw(value)
  if (Array.isArray(rawValue))
    return rawValue.map(cloneScriptParamsValue)
  if (isScriptParamsRecord(rawValue)) {
    return Object.fromEntries(
      Object.entries(rawValue).map(([key, child]) => [key, cloneScriptParamsValue(child)]),
    )
  }
  return rawValue
}

function cloneScriptParams(data: Record<string, unknown>): Record<string, unknown> {
  return cloneScriptParamsValue(data) as Record<string, unknown>
}

export function localizedSchemaText(value: unknown, locale?: string): string {
  if (typeof value === 'string')
    return value
  if (Array.isArray(value))
    return value.filter(item => typeof item === 'string').join('\n')
  if (!isScriptParamsRecord(value))
    return ''

  const normalizedLocale = (locale || 'en').toLowerCase()
  const language = normalizedLocale.startsWith('zh') || normalizedLocale.startsWith('cn')
    ? 'zh'
    : normalizedLocale.startsWith('ru') ? 'ru' : 'en'
  const aliases = language === 'zh' ? ['zh', 'cn'] : language === 'en' ? ['en', 'us'] : [language]
  const candidateKeys = [...aliases, 'en', 'us', 'zh', 'cn', 'ru']
  for (const key of candidateKeys) {
    const candidate = value[key]
    if (typeof candidate === 'string' && candidate.trim())
      return candidate
    if (Array.isArray(candidate)) {
      const lines = candidate.filter(item => typeof item === 'string')
      if (lines.length)
        return lines.join('\n')
    }
  }
  return ''
}

export function parseScriptParamsSchema(raw: unknown): ScriptParamsSchema | null {
  if (raw == null || raw === '')
    return null

  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    }
    catch {
      throw new ScriptParamsFormError('脚本入参 Schema 必须是合法的 JSON')
    }
  }
  if (!isScriptParamsRecord(parsed))
    throw new ScriptParamsFormError('脚本入参 Schema 必须是 JSON 对象')

  const type = parsed.type
  if (typeof type === 'string' && type !== 'object')
    throw new ScriptParamsFormError(`脚本入参 Schema 的顶层 type 必须是 'object'`)
  if (Array.isArray(type) && !type.includes('object'))
    throw new ScriptParamsFormError(`脚本入参 Schema 的顶层 type 必须包含 'object'`)
  return parsed as ScriptParamsSchema
}

export function localizeScriptParamsSchema(
  schema: ScriptParamsSchema,
  locale?: string,
): ScriptParamsSchema {
  const localizedSchema = structuredClone(schema) as Record<string, unknown>
  const visitSchema = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visitSchema)
      return
    }
    if (!isScriptParamsRecord(value))
      return

    for (const key of ['title', 'description']) {
      const localized = localizedSchemaText(value[key], locale)
      if (localized)
        value[key] = localized
    }
    for (const key of scriptParamsSchemaMapKeywords) {
      const schemaMap = value[key]
      if (isScriptParamsRecord(schemaMap))
        Object.values(schemaMap).forEach(visitSchema)
    }
    for (const key of scriptParamsSchemaKeywords)
      visitSchema(value[key])
  }

  visitSchema(localizedSchema)
  return localizedSchema as ScriptParamsSchema
}

function transformScriptParamsDebugFields(
  schema: ScriptParamsSchema,
  omitDebugFields: boolean,
): ScriptParamsSchema {
  const transformedSchema = structuredClone(schema) as Record<string, unknown>

  const visitSchema = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visitSchema)
      return
    }
    if (!isScriptParamsRecord(value))
      return

    if (Array.isArray(value.required))
      value.required = value.required.filter(key => key !== 'debug')

    const properties = value.properties
    if (isScriptParamsRecord(properties) && 'debug' in properties) {
      if (omitDebugFields)
        delete properties.debug
      else
        properties.debug = {}
    }

    for (const key of scriptParamsSchemaMapKeywords) {
      const schemaMap = value[key]
      if (isScriptParamsRecord(schemaMap))
        Object.values(schemaMap).forEach(visitSchema)
    }
    for (const key of scriptParamsSchemaKeywords)
      visitSchema(value[key])
  }

  visitSchema(transformedSchema)
  return transformedSchema as ScriptParamsSchema
}

export function createScriptParamsFormSchema(schema: ScriptParamsSchema): ScriptParamsSchema {
  return transformScriptParamsDebugFields(schema, false)
}

export function createScriptParamsFormUISchema(schema: ScriptParamsSchema): UISchemaElement {
  const visibleSchema = transformScriptParamsDebugFields(schema, true)
  return generateDefaultUISchema(visibleSchema)
}

function isEmptyScriptParamValue(value: unknown): boolean {
  return value == null
    || (typeof value === 'string' && !value.trim())
    || (Array.isArray(value) && value.length === 0)
}

function mergeScriptParamsDefaults(defaults: unknown, initialValue: unknown): unknown {
  if (isScriptParamsRecord(defaults) && isScriptParamsRecord(initialValue)) {
    const merged = cloneScriptParams(initialValue)
    for (const [key, defaultValue] of Object.entries(defaults)) {
      const currentValue = merged[key]
      merged[key] = isEmptyScriptParamValue(currentValue)
        ? cloneScriptParamsValue(defaultValue)
        : mergeScriptParamsDefaults(defaultValue, currentValue)
    }
    return merged
  }

  return isEmptyScriptParamValue(initialValue)
    ? cloneScriptParamsValue(defaults)
    : cloneScriptParamsValue(initialValue)
}

function extractScriptParamDefaultValue(
  schema: ScriptParamsSchema,
  rootSchema: ScriptParamsSchema,
): { found: boolean, value?: unknown } {
  const extracted = extractDefaults(schema, rootSchema)
  const hasOwnDefault = schema.default !== undefined
  const defaults = isScriptParamsRecord(extracted) ? cloneScriptParams(extracted) : extracted

  if (hasOwnDefault && !isScriptParamsRecord(defaults)) {
    return { found: true, value: cloneScriptParamsValue(defaults) }
  }
  if (!isScriptParamsRecord(schema.properties)) {
    return hasOwnDefault
      ? { found: true, value: cloneScriptParamsValue(defaults) }
      : { found: false }
  }

  const objectDefaults = isScriptParamsRecord(defaults) ? defaults : {}
  let found = hasOwnDefault || Object.keys(objectDefaults).length > 0
  for (const [key, propertySchema] of Object.entries(schema.properties)) {
    if (!isScriptParamsRecord(propertySchema)) {
      continue
    }

    const childDefault = extractScriptParamDefaultValue(
      propertySchema as ScriptParamsSchema,
      rootSchema,
    )
    if (!childDefault.found) {
      continue
    }

    objectDefaults[key] = mergeScriptParamsDefaults(childDefault.value, objectDefaults[key])
    found = true
  }

  return found ? { found: true, value: objectDefaults } : { found: false }
}

export function extractScriptParamsDefaults(schema: ScriptParamsSchema): Record<string, unknown> {
  const defaults = extractScriptParamDefaultValue(schema, schema)
  return defaults.found && isScriptParamsRecord(defaults.value) ? defaults.value : {}
}

export function hasDefaultsForAllScriptParams(
  schema: ScriptParamsSchema,
  defaults: Record<string, unknown>,
): boolean {
  if (!isScriptParamsRecord(schema.properties)) {
    return true
  }

  return Object.entries(schema.properties).every(([key, propertySchema]) => {
    if (key === 'debug') {
      return true
    }
    if (!(key in defaults)) {
      return false
    }
    if (!isScriptParamsRecord(propertySchema) || !isScriptParamsRecord(propertySchema.properties)) {
      return true
    }

    return isScriptParamsRecord(defaults[key])
      && hasDefaultsForAllScriptParams(propertySchema as ScriptParamsSchema, defaults[key])
  })
}

export function createScriptParamsData(
  schema: ScriptParamsSchema,
  initialParams: Record<string, unknown> = {},
): Record<string, unknown> {
  return mergeScriptParamsDefaults(
    extractScriptParamsDefaults(schema),
    initialParams,
  ) as Record<string, unknown>
}

export function createScriptParamsAjv(schema: ScriptParamsSchema): AjvCore {
  const draft = typeof schema.$schema === 'string' ? schema.$schema : ''
  const Validator = draft.includes('2020-12')
    ? Ajv2020
    : draft.includes('2019-09') ? Ajv2019 : Ajv
  const ajv = new Validator({ allErrors: true, verbose: true, strict: false, addUsedSchema: false })
  addFormats(ajv)
  return ajv
}

export function validateScriptParamsData(
  schema: ScriptParamsSchema,
  data: Record<string, unknown>,
  locale?: string,
): ErrorObject[] {
  const localizedSchema = localizeScriptParamsSchema(schema, locale)
  const validate = createScriptParamsAjv(localizedSchema).compile(localizedSchema)
  return validate(data) ? [] : [...(validate.errors ?? [])]
}

export function formatScriptParamsError(error: ErrorObject): string {
  const missingProperty = error.keyword === 'required'
    ? String((error.params as { missingProperty?: unknown }).missingProperty ?? '')
    : ''
  const path = [error.instancePath.replace(/^\//, '').replaceAll('/', '.'), missingProperty]
    .filter(Boolean)
    .join('.') || '$'
  return `${path} ${error.message || '校验失败'}`
}

export function buildScriptParams(
  data: unknown,
  errors: ErrorObject[] = [],
): Record<string, unknown> {
  if (errors.length)
    throw new ScriptParamsFormError(formatScriptParamsError(errors[0]!))
  if (!isScriptParamsRecord(data))
    throw new ScriptParamsFormError('脚本参数必须是 JSON 对象')
  return cloneScriptParams(data)
}
