import type { LibraryStoreLike } from './script_source'
import type { StructuredToolInterface } from '@langchain/core/tools'
import type { ParamsSchema, ScriptMetadata, ScriptMetadataLanguage } from '@roxy/sandbox'
import { tool } from 'langchain'
import { z } from 'zod'
import { agentOfficialScriptsApi } from '@/api/agentApiClient'
import { env } from '@/config'
import { extractScriptSelfDescription } from '@/script/scriptMeta'
import { isAbsoluteLikePath, isHttpScriptUrl, resolveReadableScriptSource } from './script_source'
import { parseScriptTemplateReference, resolveScriptTemplate } from './script_template_source'

interface GetScriptSelfDescriptionInput {
  /** 用户脚本模板 id、官方脚本 slug，或本地脚本绝对路径。 */
  scriptPath: string
}

interface OfficialScriptDetail {
  slug?: unknown
  name?: unknown
  description?: unknown
  version?: unknown
  optionsSchema?: unknown
  options_schema?: unknown
  createdAt?: unknown
  created_at?: unknown
  updatedAt?: unknown
  updated_at?: unknown
}

export interface ScriptSelfDescriptionResult {
  script: {
    slug: string
    name: string
    description?: string
    scriptFile: string
    createdAt: string
    updatedAt: string
  }
  metadata: ScriptMetadata
  paramsSchema: ParamsSchema
  templateParams?: Record<string, unknown>
}

function inputValue(input: GetScriptSelfDescriptionInput): string {
  return input.scriptPath.trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function resolveMetadataLanguage(systemLanguage: string | undefined): ScriptMetadataLanguage {
  const normalized = systemLanguage?.toLowerCase()
  if (normalized?.startsWith('zh'))
    return 'zh'
  if (normalized?.startsWith('ru'))
    return 'ru'
  return 'us'
}

function plainText(value: unknown, allowMarkdownLines: boolean): string | undefined {
  if (typeof value === 'string')
    return value
  if (allowMarkdownLines && Array.isArray(value) && value.every(item => typeof item === 'string'))
    return value.join('\n')
  return undefined
}

function localizedText(
  value: unknown,
  language: ScriptMetadataLanguage,
  allowMarkdownLines: boolean,
): string | undefined {
  const direct = plainText(value, allowMarkdownLines)
  if (direct !== undefined)
    return direct
  if (!isRecord(value))
    return undefined

  const fallbackOrder: ScriptMetadataLanguage[] = [language, 'us', 'zh', 'ru']
  for (const key of new Set(fallbackOrder)) {
    const localized = plainText(value[key], allowMarkdownLines)
    if (localized !== undefined)
      return localized
  }
  return undefined
}

function normalizeLocalizedText(value: unknown): unknown {
  if (!isRecord(value))
    return value

  const normalized: Record<string, unknown> = { ...value }
  normalized.zh ??= value.cn
  normalized.us ??= value.en
  return normalized
}

function parseOfficialParamsSchema(slug: string, value: unknown): ParamsSchema {
  if (value === undefined || value === null || value === '')
    return { type: 'object', properties: {} }

  let parsed: unknown = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    }
    catch (error: any) {
      throw new Error(`Official script "${slug}" has invalid optionsSchema JSON: ${error?.message ?? String(error)}`)
    }
  }

  if (!isRecord(parsed) || parsed.type !== 'object')
    throw new Error(`Official script "${slug}" optionsSchema must be a JSON object schema with type "object".`)
  return parsed as ParamsSchema
}

function optionalString(...values: unknown[]): string | undefined {
  return values.find(value => typeof value === 'string') as string | undefined
}

function officialDetailToSelfDescription(
  requestedSlug: string,
  rawDetail: unknown,
): ScriptSelfDescriptionResult {
  if (!isRecord(rawDetail))
    throw new Error(`Official script "${requestedSlug}" returned an invalid detail response.`)

  const detail = rawDetail as OfficialScriptDetail
  const slug = typeof detail.slug === 'string' && detail.slug.trim() ? detail.slug.trim() : requestedSlug
  const name = normalizeLocalizedText(detail.name)
  const description = normalizeLocalizedText(detail.description)
  const metadata: ScriptMetadata = {
    name: (typeof name === 'string' || isRecord(name) ? name : slug) as ScriptMetadata['name'],
    slug,
  }

  if (typeof description === 'string' || Array.isArray(description) || isRecord(description))
    metadata.description = description as ScriptMetadata['description']
  if (typeof detail.version === 'string' || typeof detail.version === 'number')
    metadata.version = String(detail.version)

  const paramsSchema = parseOfficialParamsSchema(slug, detail.optionsSchema ?? detail.options_schema)
  const localizedName = localizedText(metadata.name, resolveMetadataLanguage(env.SYSTEM_LANGUAGE), false) ?? slug
  const localizedDescription = localizedText(metadata.description, resolveMetadataLanguage(env.SYSTEM_LANGUAGE), true)

  return {
    script: {
      slug,
      name: localizedName,
      description: localizedDescription,
      scriptFile: slug,
      createdAt: optionalString(detail.createdAt, detail.created_at) ?? '',
      updatedAt: optionalString(detail.updatedAt, detail.updated_at) ?? '',
    },
    metadata,
    paramsSchema,
  }
}

function templateToSelfDescription(template: Awaited<ReturnType<typeof resolveScriptTemplate>>): ScriptSelfDescriptionResult {
  return {
    script: {
      slug: template.sourceSlug,
      name: template.name,
      description: template.description,
      scriptFile: template.templateRef,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    },
    metadata: template.metadata,
    paramsSchema: template.paramsSchema,
    templateParams: template.params,
  }
}

function localizeDescriptionFields(value: unknown, language: ScriptMetadataLanguage): unknown {
  if (Array.isArray(value))
    return value.map(item => localizeDescriptionFields(item, language))
  if (!isRecord(value))
    return value

  const localized: Record<string, unknown> = {}
  for (const [key, nestedValue] of Object.entries(value)) {
    if (key === 'description') {
      const description = localizedText(normalizeLocalizedText(nestedValue), language, true)
      if (description !== undefined)
        localized[key] = description
      continue
    }
    localized[key] = localizeDescriptionFields(nestedValue, language)
  }
  return localized
}

/** 仅用于模型上下文：选择系统语言并压平 Markdown 行数组，不修改原始自描述。 */
export function localizeScriptSelfDescription(
  result: ScriptSelfDescriptionResult,
  systemLanguage: string | undefined = env.SYSTEM_LANGUAGE,
): ScriptSelfDescriptionResult {
  const language = resolveMetadataLanguage(systemLanguage)
  const name = localizedText(result.metadata.name, language, false) ?? result.script.name
  const description = localizedText(result.metadata.description, language, true)
  const metadata: ScriptMetadata = { ...result.metadata, name }

  if (description === undefined)
    delete metadata.description
  else
    metadata.description = description

  return {
    ...result,
    script: {
      ...result.script,
      name,
      description: description ?? result.script.description,
    },
    metadata,
    paramsSchema: localizeDescriptionFields(result.paramsSchema, language) as ParamsSchema,
  }
}

export async function getScriptSelfDescription(
  input: GetScriptSelfDescriptionInput,
  store?: LibraryStoreLike,
): Promise<ScriptSelfDescriptionResult> {
  const rawValue = input.scriptPath
  const value = inputValue(input)
  if (!value) {
    throw new Error('scriptPath is required.')
  }

  if (isHttpScriptUrl(value)) {
    throw new Error('Direct script URLs are not allowed. Pass a canonical template reference or official script slug instead.')
  }

  if (!isAbsoluteLikePath(value)) {
    const templateRef = parseScriptTemplateReference(rawValue)
    if (templateRef) {
      const template = await resolveScriptTemplate(templateRef)
      return templateToSelfDescription(template)
    }

    const detail = await agentOfficialScriptsApi.getBySlug(value)
    return officialDetailToSelfDescription(value, detail)
  }

  const { script, code } = await resolveReadableScriptSource(value, store)
  const meta = extractScriptSelfDescription(code)

  return {
    script,
    metadata: meta.metadata,
    paramsSchema: meta.paramsSchema,
  }
}

function formatSelfDescriptionResult(result: ScriptSelfDescriptionResult): string {
  const localized = localizeScriptSelfDescription(result)
  const lines = [
    `Script: ${localized.script.name}`,
    `Slug: ${localized.script.slug}`,
    `ScriptFile: ${localized.script.scriptFile}`,
    'Metadata:',
    JSON.stringify(localized.metadata, null, 2),
    'Params JSON Schema:',
    JSON.stringify(localized.paramsSchema, null, 2),
  ]

  if (localized.templateParams) {
    lines.push(
      'Template Params:',
      JSON.stringify(localized.templateParams, null, 2),
    )
  }

  return lines.join('\n')
}

export const getScriptSelfDescriptionTool: StructuredToolInterface = tool(
  async (input: GetScriptSelfDescriptionInput): Promise<string> => {
    try {
      const result = await getScriptSelfDescription(input)
      return formatSelfDescriptionResult(result)
    }
    catch (err: any) {
      return `Failed to get script self-description: ${err?.message ?? String(err)}`
    }
  },
  {
    name: 'get_script_self_description',
    // 获取脚本自描述：metadata + params JSON Schema；运行脚本前必须先读取自描述并传入符合 schema 的 params。
    description: 'Get a script self-description from an official:<id> or user:<id> template reference, an official script slug, or an absolute local script path. Canonical template references are read from their matching backend detail API.',
    schema: z.object({
      // canonical 模板引用、官方脚本 slug 或可读取的本地脚本绝对路径。
      scriptPath: z.string().describe('Canonical official:<id> or user:<id> script template reference, official script slug, or absolute local script path.'),
    }),
  },
) as unknown as StructuredToolInterface
