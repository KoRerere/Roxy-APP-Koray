import type { ParamsSchema } from '@/modes/sandbox-api'

export function isScriptParamsRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function cloneScriptParamsValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cloneScriptParamsValue)
  }

  if (isScriptParamsRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, cloneScriptParamsValue(child)]),
    )
  }

  return value
}

interface ExtractedDefault {
  found: boolean
  value?: unknown
}

function extractDefault(schema: unknown): ExtractedDefault {
  if (!isScriptParamsRecord(schema)) {
    return { found: false }
  }

  const hasOwnDefault = Object.hasOwn(schema, 'default')
  const defaultValue = hasOwnDefault ? cloneScriptParamsValue(schema.default) : undefined
  const properties = schema.properties
  if (!isScriptParamsRecord(properties)) {
    return hasOwnDefault ? { found: true, value: defaultValue } : { found: false }
  }

  const objectDefaults = isScriptParamsRecord(defaultValue)
    ? defaultValue
    : {}
  let found = hasOwnDefault

  for (const [key, propertySchema] of Object.entries(properties)) {
    const childDefault = extractDefault(propertySchema)
    if (!childDefault.found) {
      continue
    }

    if (!(key in objectDefaults)) {
      objectDefaults[key] = cloneScriptParamsValue(childDefault.value)
    }
    found = true
  }

  return found ? { found: true, value: objectDefaults } : { found: false }
}

export function extractScriptParamsDefaults(schema: ParamsSchema): Record<string, unknown> {
  const extracted = extractDefault(schema)
  return extracted.found && isScriptParamsRecord(extracted.value)
    ? extracted.value
    : {}
}

export function mergeScriptParams(defaults: unknown, overrides: unknown): unknown {
  if (overrides === undefined) {
    return cloneScriptParamsValue(defaults)
  }

  if (isScriptParamsRecord(defaults) && isScriptParamsRecord(overrides)) {
    const merged = cloneScriptParamsValue(defaults) as Record<string, unknown>
    for (const [key, value] of Object.entries(overrides)) {
      merged[key] = key in merged
        ? mergeScriptParams(merged[key], value)
        : cloneScriptParamsValue(value)
    }
    return merged
  }

  return cloneScriptParamsValue(overrides)
}

function isEmptyRequiredValue(value: unknown): boolean {
  return value == null
    || (typeof value === 'string' && !value.trim())
    || (Array.isArray(value) && value.length === 0)
}

function collectMissingRequiredParams(
  schema: unknown,
  data: unknown,
  prefix: string,
  missing: string[],
): void {
  if (!isScriptParamsRecord(schema)) {
    return
  }

  const properties = isScriptParamsRecord(schema.properties) ? schema.properties : {}
  const required = Array.isArray(schema.required)
    ? schema.required.filter((key): key is string => typeof key === 'string' && key !== 'debug')
    : []
  const dataRecord = isScriptParamsRecord(data) ? data : {}

  for (const key of required) {
    const value = dataRecord[key]
    const path = prefix ? `${prefix}.${key}` : key
    if (isEmptyRequiredValue(value)) {
      missing.push(path)
    }
  }

  for (const [key, propertySchema] of Object.entries(properties)) {
    if (key === 'debug' || !isScriptParamsRecord(propertySchema)) {
      continue
    }

    if (!isScriptParamsRecord(dataRecord[key])) {
      continue
    }

    const childPath = prefix ? `${prefix}.${key}` : key
    collectMissingRequiredParams(propertySchema, dataRecord[key], childPath, missing)
  }
}

export function findMissingRequiredScriptParams(
  schema: ParamsSchema,
  data: unknown,
): string[] {
  const missing: string[] = []
  collectMissingRequiredParams(schema, data, '', missing)
  return missing
}
