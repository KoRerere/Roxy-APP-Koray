import type { ParamsSchema, ScriptMetadata } from '@/modes/sandbox-api'
import type { TemplateRef, TemplateRefValue } from '@roxy/shared'
import {
  isTemplateRef,
  parseTemplateRef,
} from '@roxy/shared'
import {
  resolveTemplate,
  TemplateReferenceError,
} from '@/services/templateService'

interface ResolvedScriptTemplate {
  templateRef: TemplateRefValue
  name: string
  description?: string
  ossUrl: string
  sha512: string
  sourceSlug: string
  params?: Record<string, unknown>
  paramsSchema: ParamsSchema
  metadata: ScriptMetadata
  createdAt: string
  updatedAt: string
}

const TEMPLATE_REFERENCE_LIKE_PATTERN = /^(?:official|user|template|workspace):/i
const BARE_NUMERIC_TEMPLATE_ID_PATTERN = /^\d+$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return undefined
}

function readParams(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

function parseParamsSchema(reference: string, value: unknown): ParamsSchema {
  if (value === undefined || value === null || value === '') {
    return { type: 'object', properties: {} }
  }

  let parsed = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    }
    catch (error) {
      throw new TemplateReferenceError(
        'template_detail_invalid',
        `${reference} has invalid optionsSchema JSON: ${error instanceof Error ? error.message : String(error)}`,
        error,
      )
    }
  }

  if (!isRecord(parsed) || parsed.type !== 'object') {
    throw new TemplateReferenceError(
      'template_detail_invalid',
      `${reference} optionsSchema must be a JSON object schema with type "object".`,
    )
  }

  return parsed as ParamsSchema
}

function requireAssetMetadata(
  ref: TemplateRef,
  metadata: Record<string, unknown>,
): { ossUrl: string, sha512: string } {
  const ossUrl = readString(metadata.ossUrl, metadata.oss_url)
  if (!ossUrl) {
    throw new TemplateReferenceError(
      'template_asset_incomplete',
      `Script template ${ref.value} is missing OSS URL.`,
    )
  }

  const sha512 = readString(metadata.sha512)
  if (!sha512) {
    throw new TemplateReferenceError(
      'template_asset_incomplete',
      `Script template ${ref.value} is missing SHA-512.`,
    )
  }

  return { ossUrl, sha512 }
}

/**
 * Returns a canonical template reference when scriptPath is a template source.
 * Bare ids and malformed namespace-looking inputs are never treated as slugs.
 */
export function parseScriptTemplateReference(value: string): TemplateRef | null {
  if (isTemplateRef(value)) {
    return parseTemplateRef(value)
  }

  const trimmed = value.trim()
  if (BARE_NUMERIC_TEMPLATE_ID_PATTERN.test(trimmed) || TEMPLATE_REFERENCE_LIKE_PATTERN.test(trimmed)) {
    throw new TemplateReferenceError(
      'invalid_template_ref',
      'Invalid template reference. Select the script template again before running it.',
    )
  }

  return null
}

export async function resolveScriptTemplate(
  templateRef: TemplateRef | TemplateRefValue | string,
): Promise<ResolvedScriptTemplate> {
  const template = await resolveTemplate(templateRef, 'script')
  const asset = requireAssetMetadata(template.ref, template.metadata)
  const sourceSlug = readString(template.metadata.slug, template.metadata.packageSlug, template.slug)
    ?? template.ref.value
  const metadata: ScriptMetadata = {
    name: template.name,
    slug: sourceSlug,
  }

  if (template.description) {
    metadata.description = template.description
  }

  return {
    templateRef: template.ref.value,
    name: template.name,
    description: template.description,
    ossUrl: asset.ossUrl,
    sha512: asset.sha512,
    sourceSlug,
    params: readParams(template.metadata.params),
    paramsSchema: parseParamsSchema(
      `Script template ${template.ref.value}`,
      template.metadata.optionsSchema ?? template.metadata.options_schema,
    ),
    metadata,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  }
}
