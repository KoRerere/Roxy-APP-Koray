import type { UserTemplateCreate, UserTemplateUpdate } from '@roxy/agent-api'
import type { TemplateIconInfo } from './template-store'
import { normalizeTemplateIconInfo } from './template-store'

export type MyTemplateKind = 'script' | 'skill' | 'prompt'

export interface UserTemplateDTO {
  id: number
  workspaceId: string
  officialTemplateId?: number | null
  templateType: string
  name: string
  description?: string | null
  source: 'official' | 'custom' | string
  metadata?: Record<string, unknown>
  hasFile?: boolean
  createdAt?: string | null
  updatedAt?: string | null
}

export interface UserTemplatePage {
  items: UserTemplateDTO[]
  total: number
  limit: number
  offset: number
}

export interface MyTemplateItem {
  id: number
  workspaceId: string
  kind: MyTemplateKind
  name: string
  description: string
  source: UserTemplateDTO['source']
  officialTemplateId?: number | null
  iconInfo: TemplateIconInfo | null
  metadata: Record<string, unknown>
}

export interface CustomTemplatePayload {
  templateType: MyTemplateKind
  name: string
  description: string
  metadata: Record<string, unknown>
  officialTemplateId?: number
  saveAndRun: boolean
}

export interface TemplateAssetUpload {
  fileId: string
  ossUrl: string
  sha512: string
  contentType: string
  fileSize: number
  filename: string
  skillMetadata?: Record<string, unknown> | null
  packageName?: string | null
  packageSlug?: string | null
  packageDescription?: string | null
  packageFilename?: string | null
  fileCount?: number
  files?: string[]
  skillMdPath?: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeMyTemplateKind(value: unknown): MyTemplateKind | undefined {
  return value === 'script' || value === 'skill' || value === 'prompt' ? value : undefined
}

export function normalizeTemplateSlug(value: unknown): string | undefined {
  if (typeof value !== 'string')
    return undefined

  const normalized = value.trim()
  return normalized || undefined
}

export function isReservedOfficialTemplateSlug(value: unknown): boolean {
  return normalizeTemplateSlug(value)?.toLowerCase().startsWith('official-') ?? false
}

export function readUserTemplatePage(response: unknown, fallbackMessage: string): UserTemplatePage {
  if (!isRecord(response) || response.code !== 0 || !isRecord(response.data))
    throw new Error(isRecord(response) && typeof response.message === 'string' ? response.message : fallbackMessage)

  const { items, total, limit, offset } = response.data
  if (!Array.isArray(items) || typeof total !== 'number' || typeof limit !== 'number' || typeof offset !== 'number')
    throw new Error(fallbackMessage)

  return response.data as unknown as UserTemplatePage
}

export function readUserTemplateMutation(response: unknown, fallbackMessage: string): UserTemplateDTO {
  if (!isRecord(response) || response.code !== 0 || !isRecord(response.data))
    throw new Error(isRecord(response) && typeof response.message === 'string' ? response.message : fallbackMessage)

  return response.data as unknown as UserTemplateDTO
}

export function readUserTemplateVoidMutation(response: unknown, fallbackMessage: string): void {
  if (!isRecord(response) || response.code !== 0)
    throw new Error(isRecord(response) && typeof response.message === 'string' ? response.message : fallbackMessage)
}

export function readTemplateAssetMutation(response: unknown, fallbackMessage: string): TemplateAssetUpload {
  if (!isRecord(response) || response.code !== 0 || !isRecord(response.data))
    throw new Error(isRecord(response) && typeof response.message === 'string' ? response.message : fallbackMessage)

  const data = response.data
  if (
    typeof data.fileId !== 'string'
    || typeof data.ossUrl !== 'string'
    || typeof data.sha512 !== 'string'
    || typeof data.filename !== 'string'
  ) {
    throw new TypeError(fallbackMessage)
  }

  return data as unknown as TemplateAssetUpload
}

export function buildOfficialTemplateUserMap(templates: UserTemplateDTO[]) {
  const result = new Map<number, UserTemplateDTO>()
  templates.forEach((template) => {
    if (typeof template.officialTemplateId === 'number' && !result.has(template.officialTemplateId))
      result.set(template.officialTemplateId, template)
  })
  return result
}

export function buildCustomTemplateRequest(payload: CustomTemplatePayload): UserTemplateCreate {
  if (payload.officialTemplateId !== undefined) {
    return {
      official_template_id: payload.officialTemplateId,
      name: payload.name,
      description: payload.description || null,
      metadata: payload.metadata,
    }
  }

  return {
    template_type: payload.templateType,
    name: payload.name,
    description: payload.description || null,
    metadata: payload.metadata,
  }
}

export function buildCustomTemplateUpdate(payload: CustomTemplatePayload): UserTemplateUpdate {
  return {
    name: payload.name,
    description: payload.description || null,
    metadata: payload.metadata,
  }
}

export function mapMyTemplateItem(row: UserTemplateDTO): MyTemplateItem | undefined {
  const kind = normalizeMyTemplateKind(row.templateType)
  if (!kind)
    return undefined
  const metadata = isRecord(row.metadata) ? row.metadata : {}

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    kind,
    name: row.name,
    description: row.description?.trim() ?? '',
    source: row.source,
    officialTemplateId: row.officialTemplateId,
    iconInfo: normalizeTemplateIconInfo(metadata.iconInfo),
    metadata,
  }
}
