import type {
  LocalSkillRecord,
  TemplateSkillIdentity,
} from '@/core/skillManager'
import type {
  TemplateKind,
  TemplateRef,
  TemplateRefValue,
} from '@roxy/shared'
import { normalizeTemplateRef } from '@roxy/shared'
import AdmZip from 'adm-zip'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'
import { agentTemplatesApi, agentUserTemplatesApi } from '@/api/agentApiClient'
import { AiAgentHttpError } from '@/api/errors'
import { env } from '@/config'
import { getSkillManager } from '@/core/skillManager'
import {
  loadSkillMetadataFromDir,
  MAX_SKILL_FILE_SIZE_BYTES,
} from '@/core/skills/metadata'
import { agentPaths } from '@/core/storage/agentPaths'
import { assertAllowedRemoteScriptUrl } from '@/script/remoteScriptPolicy'

const MAX_TEMPLATE_SKILL_PACKAGE_BYTES = 50 * 1024 * 1024
const MAX_TEMPLATE_SKILL_ARCHIVE_ENTRY_COUNT = 2_000
const MAX_TEMPLATE_SKILL_UNPACKED_BYTES = 100 * 1024 * 1024

type TemplateReferenceErrorCode
  = | 'invalid_template_ref'
    | 'template_not_found'
    | 'template_access_denied'
    | 'template_fetch_failed'
    | 'template_type_mismatch'
    | 'template_detail_invalid'
    | 'template_asset_incomplete'
    | 'template_asset_download_failed'
    | 'skill_file_invalid'
    | 'skill_file_not_found'

export class TemplateReferenceError extends Error {
  readonly code: TemplateReferenceErrorCode
  readonly originalError?: unknown

  constructor(code: TemplateReferenceErrorCode, message: string, originalError?: unknown) {
    super(message)
    this.name = 'TemplateReferenceError'
    this.code = code
    this.originalError = originalError
  }
}

export interface ResolvedTemplate {
  ref: TemplateRef
  kind: TemplateKind
  id: number
  workspaceId?: string
  name: string
  description?: string
  metadata: Record<string, unknown>
  officialTemplateId?: number
  slug?: string
  createdAt: string
  updatedAt: string
}

export interface ResolvedRemoteSkill {
  slug: string
  name: string
  description?: string
  metadata: Record<string, unknown>
}

interface InstalledTemplateSkill {
  ref: TemplateRef
  rootDir: string
  skillMdPath: string
  name: string
  description: string
}

interface InstalledTemplateSkillFile extends InstalledTemplateSkill {
  filePath: string
  relativePath: string
}

interface TemplateSkillAsset {
  ossUrl: string
  sha512?: string
  skillMdPath: string
  packageSlug?: string
  packageName?: string
}

interface TemplateDetail {
  id?: unknown
  workspaceId?: unknown
  workspace_id?: unknown
  templateType?: unknown
  template_type?: unknown
  name?: unknown
  description?: unknown
  metadata?: unknown
  officialTemplateId?: unknown
  official_template_id?: unknown
  slug?: unknown
  createdAt?: unknown
  created_at?: unknown
  updatedAt?: unknown
  updated_at?: unknown
}

interface RemoteSkillDetail {
  slug?: unknown
  name?: unknown
  title?: unknown
  description?: unknown
  usage_example?: unknown
  usageExample?: unknown
  metadata?: unknown
  meta?: unknown
  ossUrl?: unknown
  oss_url?: unknown
  fileId?: unknown
  file_id?: unknown
  file_url?: unknown
  fileUrl?: unknown
  skillMdPath?: unknown
  skill_md_path?: unknown
  packageSlug?: unknown
  package_slug?: unknown
  packageName?: unknown
  package_name?: unknown
  packageDescription?: unknown
  package_description?: unknown
  packageFilename?: unknown
  package_filename?: unknown
  fileCount?: unknown
  file_count?: unknown
  files?: unknown
  sha512?: unknown
}

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

function readPositiveInteger(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return value
  }

  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    const parsed = Number(value)
    if (Number.isSafeInteger(parsed)) {
      return parsed
    }
  }

  return undefined
}

function readLocalizedString(value: unknown): string | undefined {
  const direct = readString(value)
  if (direct) {
    return direct
  }

  if (!isRecord(value)) {
    return undefined
  }

  const language = env.SYSTEM_LANGUAGE?.toLowerCase() ?? ''
  const preferredKeys = language.startsWith('zh') || language.startsWith('cn')
    ? ['zh', 'cn']
    : language.startsWith('ru')
      ? ['ru']
      : ['us', 'en']

  for (const key of [...new Set([...preferredKeys, 'us', 'en', 'zh', 'cn', 'ru'])]) {
    const localized = readString(value[key])
    if (localized) {
      return localized
    }
  }

  return undefined
}

function toOfficialSkillSlug(slug: string): string {
  return slug.startsWith('official-') ? slug : `official-${slug}`
}

function toInstalledSkillSlug(slug: string): string {
  return slug.startsWith('official-') ? slug.slice('official-'.length) : slug
}

function readDate(detail: TemplateDetail, field: 'created' | 'updated'): string {
  const camelKey = field === 'created' ? 'createdAt' : 'updatedAt'
  const snakeKey = field === 'created' ? 'created_at' : 'updated_at'
  return readString(detail[camelKey], detail[snakeKey]) ?? ''
}

function normalizeKind(value: unknown): TemplateKind | undefined {
  const normalized = readString(value)?.toLowerCase()
  if (normalized === 'script' || normalized === 'scripts') {
    return 'script'
  }
  if (normalized === 'skill' || normalized === 'skills') {
    return 'skill'
  }
  if (normalized === 'prompt') {
    return 'prompt'
  }

  return undefined
}

function normalizeFetchError(ref: TemplateRef, error: unknown): TemplateReferenceError {
  if (error instanceof TemplateReferenceError) {
    return error
  }

  if (error instanceof AiAgentHttpError) {
    if (error.status === 404 || error.code === 'not_found') {
      return new TemplateReferenceError(
        'template_not_found',
        `Template ${ref.value} was not found.`,
        error,
      )
    }

    if (error.status === 401 || error.status === 403) {
      return new TemplateReferenceError(
        'template_access_denied',
        `Access to template ${ref.value} was denied.`,
        error,
      )
    }
  }

  return new TemplateReferenceError(
    'template_fetch_failed',
    `Failed to fetch template ${ref.value}.`,
    error,
  )
}

function normalizeTemplateDetail(ref: TemplateRef, rawDetail: unknown): ResolvedTemplate {
  if (!isRecord(rawDetail)) {
    throw new TemplateReferenceError(
      'template_detail_invalid',
      `Template ${ref.value} returned an invalid detail response.`,
    )
  }

  const detail = rawDetail as TemplateDetail
  const id = readPositiveInteger(detail.id)
  if (id !== ref.id) {
    throw new TemplateReferenceError(
      'template_detail_invalid',
      `Template ${ref.value} returned a mismatched id.`,
    )
  }

  const kind = normalizeKind(detail.templateType ?? detail.template_type)
  if (!kind) {
    throw new TemplateReferenceError(
      'template_detail_invalid',
      `Template ${ref.value} has an invalid template type.`,
    )
  }

  if (!isRecord(detail.metadata)) {
    throw new TemplateReferenceError(
      'template_detail_invalid',
      `Template ${ref.value} has invalid metadata.`,
    )
  }

  const name = readLocalizedString(detail.name)
  if (!name) {
    throw new TemplateReferenceError(
      'template_detail_invalid',
      `Template ${ref.value} has an invalid name.`,
    )
  }

  const workspaceId = readString(detail.workspaceId, detail.workspace_id)
  const officialTemplateId = ref.namespace === 'user'
    ? readPositiveInteger(detail.officialTemplateId ?? detail.official_template_id)
    : undefined
  const rawOfficialTemplateId = ref.namespace === 'user'
    ? detail.officialTemplateId ?? detail.official_template_id
    : undefined
  if (rawOfficialTemplateId !== undefined && rawOfficialTemplateId !== null && officialTemplateId === undefined) {
    throw new TemplateReferenceError(
      'template_detail_invalid',
      `Template ${ref.value} has an invalid official template id.`,
    )
  }

  const result: ResolvedTemplate = {
    ref,
    kind,
    id,
    name,
    metadata: { ...detail.metadata },
    createdAt: readDate(detail, 'created'),
    updatedAt: readDate(detail, 'updated'),
  }

  if (workspaceId) {
    result.workspaceId = workspaceId
  }

  const description = readLocalizedString(detail.description)
  if (description) {
    result.description = description
  }

  const slug = readString(detail.slug)
  if (slug) {
    result.slug = slug
  }

  if (officialTemplateId) {
    result.officialTemplateId = officialTemplateId
  }

  return result
}

export async function resolveTemplate(
  refInput: TemplateRef | TemplateRefValue | string,
  expectedKind?: TemplateKind,
): Promise<ResolvedTemplate> {
  let ref: TemplateRef
  try {
    ref = normalizeTemplateRef(refInput)
  }
  catch (error) {
    throw new TemplateReferenceError(
      'invalid_template_ref',
      'Invalid template reference. Select the template again before running it.',
      error,
    )
  }

  let rawDetail: unknown
  try {
    rawDetail = ref.namespace === 'official'
      ? await agentTemplatesApi.getById(ref.id)
      : await agentUserTemplatesApi.getById(ref.id)
  }
  catch (error) {
    throw normalizeFetchError(ref, error)
  }

  const template = normalizeTemplateDetail(ref, rawDetail)
  if (expectedKind && template.kind !== expectedKind) {
    throw new TemplateReferenceError(
      'template_type_mismatch',
      `Template ${ref.value} is ${template.kind}, not ${expectedKind}.`,
    )
  }

  return template
}

function isPathInsideOrEqual(parent: string, target: string): boolean {
  const relative = path.relative(parent, target)
  return parent === target || (relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative))
}

function normalizeRelativeFile(file: string, code: 'skill_file_invalid' | 'template_asset_incomplete'): string {
  const normalizedInput = file.replace(/\\/g, '/')
  if (!normalizedInput || path.posix.isAbsolute(normalizedInput) || /^[a-z]:/i.test(normalizedInput)) {
    throw new TemplateReferenceError(code, 'Skill file must be a non-empty relative path.')
  }

  const normalized = path.posix.normalize(normalizedInput).replace(/^\.\//, '')
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new TemplateReferenceError(code, 'Skill file must stay inside the installed Skill directory.')
  }

  return normalized
}

function readTemplateSkillAsset(template: ResolvedTemplate): TemplateSkillAsset {
  const ossUrl = readString(template.metadata.ossUrl, template.metadata.oss_url)
  if (!ossUrl) {
    throw new TemplateReferenceError(
      'template_asset_incomplete',
      `Skill template ${template.ref.value} is missing OSS URL.`,
    )
  }

  const sha512 = readString(template.metadata.sha512)

  const skillMdPath = normalizeRelativeFile(
    readString(template.metadata.skillMdPath, template.metadata.skill_md_path) ?? 'SKILL.md',
    'template_asset_incomplete',
  )

  const skillMetadata = isRecord(template.metadata.skillMetadata)
    ? template.metadata.skillMetadata
    : undefined
  const packageSlug = readString(
    template.metadata.packageSlug,
    template.metadata.slug,
    template.slug,
  )
  const packageName = readString(
    template.metadata.packageName,
    skillMetadata?.name,
  )

  return {
    ossUrl,
    skillMdPath,
    ...(sha512 ? { sha512: sha512.toLowerCase() } : {}),
    ...(packageSlug ? { packageSlug } : {}),
    ...(packageName ? { packageName } : {}),
  }
}

function archiveEntryPath(entryName: string): string {
  const normalized = entryName.replace(/\\/g, '/')
  if (!normalized || path.posix.isAbsolute(normalized) || /^[a-z]:/i.test(normalized)) {
    throw new TemplateReferenceError('skill_file_invalid', 'Skill archive contains an invalid file path.')
  }

  const relativePath = path.posix.normalize(normalized).replace(/^\.\//, '')
  if (!relativePath || relativePath === '..' || relativePath.startsWith('../') || relativePath.includes('/../')) {
    throw new TemplateReferenceError('skill_file_invalid', 'Skill archive contains a path outside its root directory.')
  }

  return relativePath
}

function isArchiveSymlink(entry: unknown): boolean {
  const attr = isRecord(entry) && isRecord(entry.header) && typeof entry.header.attr === 'number'
    ? entry.header.attr
    : 0
  const unixMode = (attr >>> 16) & 0xFFFF
  return (unixMode & 0o170000) === 0o120000
}

async function extractSkillArchive(data: Buffer, targetDir: string): Promise<void> {
  let zip: AdmZip
  try {
    zip = new AdmZip(data)
  }
  catch (error) {
    throw new TemplateReferenceError('skill_file_invalid', 'Skill package is not a valid ZIP archive.', error)
  }

  const entries = zip.getEntries()
  if (entries.length === 0 || entries.length > MAX_TEMPLATE_SKILL_ARCHIVE_ENTRY_COUNT) {
    throw new TemplateReferenceError('skill_file_invalid', 'Skill package has an invalid number of archive entries.')
  }

  let unpackedBytes = 0
  for (const entry of entries) {
    if (isArchiveSymlink(entry)) {
      throw new TemplateReferenceError('skill_file_invalid', 'Skill package cannot contain symbolic links.')
    }

    const relativePath = archiveEntryPath(entry.entryName)
    const destination = path.resolve(targetDir, ...relativePath.split('/'))
    if (!isPathInsideOrEqual(targetDir, destination)) {
      throw new TemplateReferenceError('skill_file_invalid', 'Skill package contains a path outside its root directory.')
    }

    if (entry.isDirectory) {
      await fs.mkdir(destination, { recursive: true })
      continue
    }

    let fileData: Buffer
    try {
      fileData = entry.getData()
    }
    catch (error) {
      throw new TemplateReferenceError('skill_file_invalid', 'Skill package contains an unreadable archive entry.', error)
    }

    unpackedBytes += fileData.byteLength
    if (unpackedBytes > MAX_TEMPLATE_SKILL_UNPACKED_BYTES) {
      throw new TemplateReferenceError('skill_file_invalid', 'Skill package exceeds the uncompressed size limit.')
    }

    await fs.mkdir(path.dirname(destination), { recursive: true })
    try {
      await fs.writeFile(destination, fileData, { flag: 'wx' })
    }
    catch (error) {
      throw new TemplateReferenceError('skill_file_invalid', 'Skill package contains duplicate or invalid archive entries.', error)
    }
  }
}

async function resolveExtractedSkillRoot(extractedDir: string): Promise<string> {
  const directSkillMdPath = path.join(extractedDir, 'SKILL.md')
  const directSkillMdStat = await fs.lstat(directSkillMdPath).catch(() => null)
  if (directSkillMdStat?.isFile() && !directSkillMdStat.isSymbolicLink()) {
    return extractedDir
  }

  const entries = await fs.readdir(extractedDir, { withFileTypes: true })
  const visibleDirectories = entries.filter(entry => entry.isDirectory() && entry.name !== '__MACOSX' && !entry.name.startsWith('.'))
  if (visibleDirectories.length !== 1) {
    throw new TemplateReferenceError('skill_file_invalid', 'Skill package must contain one Skill root directory.')
  }

  const rootDir = path.join(extractedDir, visibleDirectories[0]!.name)
  const nestedSkillMdPath = path.join(rootDir, 'SKILL.md')
  const nestedSkillMdStat = await fs.lstat(nestedSkillMdPath).catch(() => null)
  if (!nestedSkillMdStat?.isFile() || nestedSkillMdStat.isSymbolicLink()) {
    throw new TemplateReferenceError('skill_file_invalid', 'Skill package is missing a regular SKILL.md file.')
  }

  return rootDir
}

async function ensureNoSymlink(rootDir: string, candidate: string): Promise<void> {
  const relative = path.relative(rootDir, candidate)
  const segments = relative.split(path.sep).filter(Boolean)
  let current = rootDir

  for (const segment of segments) {
    current = path.join(current, segment)
    const stat = await fs.lstat(current).catch(() => null)
    if (!stat) {
      throw new TemplateReferenceError('skill_file_not_found', 'Skill file was not found.')
    }
    if (stat.isSymbolicLink()) {
      throw new TemplateReferenceError('skill_file_invalid', 'Symbolic links are not allowed in template Skills.')
    }
  }
}

async function validateInstalledSkill(
  ref: TemplateRef,
  installDir: string,
  skillMdRelativePath: string,
): Promise<InstalledTemplateSkill> {
  const installStat = await fs.lstat(installDir).catch(() => null)
  if (!installStat?.isDirectory() || installStat.isSymbolicLink()) {
    throw new TemplateReferenceError('skill_file_invalid', 'Installed Skill directory is invalid.')
  }

  const metadataResult = await loadSkillMetadataFromDir(installDir)
  if (!metadataResult.ok) {
    throw new TemplateReferenceError('skill_file_invalid', metadataResult.message)
  }

  const rootDir = path.resolve(metadataResult.rootDir)
  if (!isPathInsideOrEqual(path.resolve(installDir), rootDir)) {
    throw new TemplateReferenceError('skill_file_invalid', 'Skill root escapes the installed Skill directory.')
  }

  const skillMdPath = path.resolve(rootDir, ...skillMdRelativePath.split('/'))
  if (!isPathInsideOrEqual(rootDir, skillMdPath)) {
    throw new TemplateReferenceError('skill_file_invalid', 'Skill entry file escapes the Skill root directory.')
  }

  await ensureNoSymlink(rootDir, skillMdPath)
  const entryStat = await fs.lstat(skillMdPath).catch(() => null)
  if (!entryStat?.isFile() || entryStat.isSymbolicLink()) {
    throw new TemplateReferenceError('skill_file_not_found', `Skill entry file ${skillMdRelativePath} was not found.`)
  }
  if (entryStat.size > MAX_SKILL_FILE_SIZE_BYTES) {
    throw new TemplateReferenceError('skill_file_invalid', 'Skill entry file exceeds the size limit.')
  }

  return {
    ref,
    rootDir,
    skillMdPath,
    name: metadataResult.metadata.name,
    description: metadataResult.metadata.description,
  }
}

const installationsInFlight = new Map<string, Promise<InstalledTemplateSkill>>()
const knownTemplateSkills = new Map<string, InstalledTemplateSkill>()

export async function ensureTemplateSkillInstalled(
  refInput: TemplateRef | TemplateRefValue | string,
  signal?: AbortSignal,
): Promise<InstalledTemplateSkill> {
  let ref: TemplateRef
  try {
    ref = normalizeTemplateRef(refInput)
  }
  catch (error) {
    throw new TemplateReferenceError('invalid_template_ref', 'Invalid Skill template reference.', error)
  }

  const template = await resolveTemplate(ref, 'skill')
  return ensureResolvedTemplateSkillInstalled(template, signal)
}

export async function ensureResolvedTemplateSkillInstalled(
  template: ResolvedTemplate,
  signal?: AbortSignal,
): Promise<InstalledTemplateSkill> {
  let ref: TemplateRef
  try {
    ref = normalizeTemplateRef(template.ref)
  }
  catch (error) {
    throw new TemplateReferenceError('invalid_template_ref', 'Invalid Skill template reference.', error)
  }

  if (template.ref.value !== ref.value) {
    throw new TemplateReferenceError(
      'template_detail_invalid',
      'Resolved Skill template reference does not match its identifier.',
    )
  }
  if (template.kind !== 'skill') {
    throw new TemplateReferenceError(
      'template_type_mismatch',
      `Template ${ref.value} is ${template.kind}, not skill.`,
    )
  }

  const asset = readTemplateSkillAsset(template)
  const installationKey = asset.packageSlug ?? ref.value
  const pending = installationsInFlight.get(installationKey)
  const waitForPending = pending
    ? pending.then(() => undefined, () => undefined)
    : Promise.resolve()
  const installation = waitForPending
    .then(() => ensureTemplateSkillInstalledUncached(template, asset, signal))
    .then((installed) => {
      knownTemplateSkills.set(ref.value, installed)
      return installed
    })
  installationsInFlight.set(installationKey, installation)

  try {
    return await installation
  }
  finally {
    if (installationsInFlight.get(installationKey) === installation) {
      installationsInFlight.delete(installationKey)
    }
  }
}

export async function resolveTemplateSkillFile(
  refInput: TemplateRef | TemplateRefValue | string,
  file = 'SKILL.md',
  signal?: AbortSignal,
): Promise<InstalledTemplateSkillFile> {
  const installed = await ensureTemplateSkillInstalled(refInput, signal)
  const relativePath = normalizeRelativeFile(file, 'skill_file_invalid')
  const filePath = path.resolve(installed.rootDir, ...relativePath.split('/'))
  if (!isPathInsideOrEqual(installed.rootDir, filePath)) {
    throw new TemplateReferenceError('skill_file_invalid', 'Skill file escapes the Skill root directory.')
  }

  await ensureNoSymlink(installed.rootDir, filePath)
  const stat = await fs.lstat(filePath).catch(() => null)
  if (!stat?.isFile() || stat.isSymbolicLink()) {
    throw new TemplateReferenceError('skill_file_not_found', `Skill file ${relativePath} was not found.`)
  }
  if (stat.size > MAX_SKILL_FILE_SIZE_BYTES) {
    throw new TemplateReferenceError('skill_file_invalid', 'Skill file exceeds the size limit.')
  }

  return {
    ...installed,
    filePath,
    relativePath,
  }
}

export function getKnownTemplateSkill(
  refInput: TemplateRef | TemplateRefValue | string,
): InstalledTemplateSkill | undefined {
  try {
    return knownTemplateSkills.get(normalizeTemplateRef(refInput).value)
  }
  catch {
    return undefined
  }
}

function toTemplateSkillIdentity(
  template: ResolvedTemplate,
  asset: TemplateSkillAsset,
): TemplateSkillIdentity {
  return {
    templateRef: template.ref.value,
    ...(asset.sha512 ? { sha512: asset.sha512 } : {}),
    ...(asset.packageSlug ? { slug: asset.packageSlug } : {}),
    ...(asset.packageName ? { packageName: asset.packageName } : {}),
  }
}

function normalizeRemoteSkillDetail(slug: string, rawDetail: unknown): ResolvedRemoteSkill {
  if (!isRecord(rawDetail)) {
    throw new TemplateReferenceError(
      'template_detail_invalid',
      `Skill template ${slug} returned an invalid detail response.`,
    )
  }

  const detail = rawDetail as RemoteSkillDetail
  const canonicalSlug = readString(detail.slug) ?? slug
  const metadata = isRecord(detail.metadata)
    ? { ...detail.metadata }
    : isRecord(detail.meta)
      ? { ...detail.meta }
      : {}
  const name = readLocalizedString(detail.name) ?? readString(detail.name, detail.title, canonicalSlug)
  if (!canonicalSlug || !name) {
    throw new TemplateReferenceError(
      'template_detail_invalid',
      `Skill template ${slug} returned incomplete detail metadata.`,
    )
  }

  const ossUrl = readString(
    detail.ossUrl,
    detail.oss_url,
    metadata.ossUrl,
    metadata.oss_url,
    detail.file_url,
    detail.fileUrl,
    metadata.file_url,
    metadata.fileUrl,
  )
  if (ossUrl && metadata.ossUrl === undefined) {
    metadata.ossUrl = ossUrl
  }

  const sha512 = readString(detail.sha512, metadata.sha512)
  if (sha512 && metadata.sha512 === undefined) {
    metadata.sha512 = sha512
  }

  const skillMdPath = readString(
    detail.skillMdPath,
    detail.skill_md_path,
    metadata.skillMdPath,
    metadata.skill_md_path,
  )
  if (skillMdPath && metadata.skillMdPath === undefined) {
    metadata.skillMdPath = skillMdPath
  }

  const packageSlug = readString(
    detail.packageSlug,
    detail.package_slug,
    metadata.packageSlug,
    metadata.package_slug,
    canonicalSlug,
  )
  if (packageSlug && metadata.packageSlug === undefined) {
    metadata.packageSlug = packageSlug
  }

  const packageName = readString(
    detail.packageName,
    detail.package_name,
    metadata.packageName,
    metadata.package_name,
    name,
  )
  if (packageName && metadata.packageName === undefined) {
    metadata.packageName = packageName
  }

  const packageDescription = readString(
    detail.packageDescription,
    detail.package_description,
    metadata.packageDescription,
    metadata.package_description,
    readLocalizedString(detail.description),
    readString(detail.description, detail.usage_example, detail.usageExample),
  )
  if (packageDescription && metadata.packageDescription === undefined) {
    metadata.packageDescription = packageDescription
  }

  const packageFilename = readString(
    detail.packageFilename,
    detail.package_filename,
    metadata.packageFilename,
    metadata.package_filename,
  )
  if (packageFilename && metadata.packageFilename === undefined) {
    metadata.packageFilename = packageFilename
  }

  const fileCount = readPositiveInteger(detail.fileCount ?? detail.file_count ?? metadata.fileCount ?? metadata.file_count)
  if (fileCount !== undefined && metadata.fileCount === undefined) {
    metadata.fileCount = fileCount
  }

  const files = Array.isArray(detail.files)
    ? detail.files
    : Array.isArray(metadata.files)
      ? metadata.files
      : undefined
  if (files && metadata.files === undefined) {
    metadata.files = files
  }

  return {
    slug: canonicalSlug,
    name,
    ...(packageDescription ? { description: packageDescription } : {}),
    metadata,
  }
}

function remoteSkillToResolvedTemplate(skill: ResolvedRemoteSkill): ResolvedTemplate {
  const installedSlug = toInstalledSkillSlug(skill.slug)
  return {
    ref: {
      namespace: 'official',
      id: Number.MAX_SAFE_INTEGER,
      value: `official:${Number.MAX_SAFE_INTEGER}`,
    },
    kind: 'skill',
    id: Number.MAX_SAFE_INTEGER,
    name: skill.name,
    ...(skill.description ? { description: skill.description } : {}),
    metadata: {
      ...skill.metadata,
      slug: installedSlug,
      packageSlug: installedSlug,
      packageName: skill.name,
    },
    slug: installedSlug,
    createdAt: '',
    updatedAt: '',
  }
}

export async function ensureRemoteSkillInstalledBySlug(
  slug: string,
  signal?: AbortSignal,
): Promise<InstalledTemplateSkill> {
  const normalizedSlug = readString(slug)
  if (!normalizedSlug) {
    throw new TemplateReferenceError('invalid_template_ref', 'Invalid Skill slug.')
  }
  const officialSlug = toOfficialSkillSlug(normalizedSlug)

  let rawDetail: unknown
  try {
    rawDetail = await agentTemplatesApi.getById(officialSlug)
  }
  catch (error) {
    throw new TemplateReferenceError(
      'template_fetch_failed',
      `Failed to fetch Skill ${officialSlug}.`,
      error,
    )
  }

  return ensureResolvedTemplateSkillInstalled(
    remoteSkillToResolvedTemplate(normalizeRemoteSkillDetail(normalizedSlug, rawDetail)),
    signal,
  )
}

async function tryReuseInstalledSkill(
  ref: TemplateRef,
  asset: TemplateSkillAsset,
  identity: TemplateSkillIdentity,
  existing: LocalSkillRecord | null,
): Promise<InstalledTemplateSkill | null> {
  if (!existing) {
    return null
  }
  if (asset.sha512 && existing.sha512 !== asset.sha512) {
    return null
  }

  const manager = getSkillManager()
  const refreshed = await manager.refreshInstalledTemplateSkillMetadata(existing, identity)
  try {
    return await validateInstalledSkill(ref, refreshed.dirPath, asset.skillMdPath)
  }
  catch (error) {
    if (error instanceof TemplateReferenceError
      && (error.code === 'skill_file_invalid' || error.code === 'skill_file_not_found')) {
      return null
    }

    throw error
  }
}

async function ensureTemplateSkillInstalledUncached(
  template: ResolvedTemplate,
  asset: TemplateSkillAsset,
  signal?: AbortSignal,
): Promise<InstalledTemplateSkill> {
  const ref = template.ref
  const identity = toTemplateSkillIdentity(template, asset)
  const manager = getSkillManager()
  const existing = await manager.findInstalledTemplateSkill(identity)
  const reused = await tryReuseInstalledSkill(ref, asset, identity, existing)
  if (reused) {
    return reused
  }

  // Download and validate the complete package before changing the installed Skill.
  let data: Buffer
  try {
    assertAllowedRemoteScriptUrl(asset.ossUrl)
    console.info('[skill-install] Downloading Skill package', {
      templateRef: ref.value,
      packageSlug: asset.packageSlug,
      skillMdPath: asset.skillMdPath,
      ossUrl: asset.ossUrl,
    })
    const response = await fetch(asset.ossUrl, { signal })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`)
    }

    const contentLength = Number(response.headers.get('content-length') ?? 0)
    if (contentLength > MAX_TEMPLATE_SKILL_PACKAGE_BYTES) {
      throw new Error(`Skill package is too large: ${contentLength} bytes`)
    }

    data = Buffer.from(await response.arrayBuffer())
    if (data.byteLength > MAX_TEMPLATE_SKILL_PACKAGE_BYTES) {
      throw new Error(`Skill package is too large: ${data.byteLength} bytes`)
    }
  }
  catch (error) {
    throw new TemplateReferenceError(
      'template_asset_download_failed',
      `Failed to download Skill template ${ref.value}.`,
      error,
    )
  }

  await fs.mkdir(agentPaths.tmpDir, { recursive: true })
  const stagingDir = await fs.mkdtemp(path.join(agentPaths.tmpDir, 'template-skill-'))
  const extractedDir = path.join(stagingDir, 'extracted')

  try {
    await fs.mkdir(extractedDir, { recursive: true })
    await extractSkillArchive(data, extractedDir)

    const extractedRoot = await resolveExtractedSkillRoot(extractedDir)
    await validateInstalledSkill(ref, extractedRoot, asset.skillMdPath)

    const installed = await manager.installTemplateSkillFromDir(extractedRoot, identity)
    return validateInstalledSkill(ref, installed.dirPath, asset.skillMdPath)
  }
  catch (error) {
    if (error instanceof TemplateReferenceError) {
      throw error
    }

    throw new TemplateReferenceError(
      'skill_file_invalid',
      `Skill template ${ref.value} could not be installed safely.`,
      error,
    )
  }
  finally {
    await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => {})
  }
}
