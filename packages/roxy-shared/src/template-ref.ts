export type TemplateNamespace = 'official' | 'user'

export type TemplateKind = 'script' | 'skill' | 'prompt'

export type TemplateRefValue = `${TemplateNamespace}:${number}`

export interface TemplateRef {
  namespace: TemplateNamespace
  id: number
  value: TemplateRefValue
}

const TEMPLATE_REF_PATTERN = /^(official|user):([1-9]\d*)$/

export class TemplateRefParseError extends Error {
  readonly code = 'invalid_template_ref'

  constructor() {
    super('Invalid template reference. Expected official:<positive id> or user:<positive id>.')
    this.name = 'TemplateRefParseError'
  }
}

function assertTemplateId(id: number): void {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new TemplateRefParseError()
  }
}

export function serializeTemplateRef(namespace: TemplateNamespace, id: number): TemplateRefValue {
  if (namespace !== 'official' && namespace !== 'user') {
    throw new TemplateRefParseError()
  }

  assertTemplateId(id)
  return `${namespace}:${id}`
}

export function parseTemplateRef(value: string): TemplateRef {
  if (typeof value !== 'string') {
    throw new TemplateRefParseError()
  }

  const match = TEMPLATE_REF_PATTERN.exec(value)
  if (!match) {
    throw new TemplateRefParseError()
  }

  const namespace = match[1] as TemplateNamespace
  const id = Number(match[2])
  assertTemplateId(id)

  return {
    namespace,
    id,
    value: serializeTemplateRef(namespace, id),
  }
}

export function isTemplateRef(value: unknown): value is TemplateRefValue {
  if (typeof value !== 'string') {
    return false
  }

  try {
    parseTemplateRef(value)
    return true
  }
  catch {
    return false
  }
}

export function normalizeTemplateRef(value: TemplateRef | string): TemplateRef {
  if (typeof value === 'string') {
    return parseTemplateRef(value)
  }

  return parseTemplateRef(serializeTemplateRef(value.namespace, value.id))
}
