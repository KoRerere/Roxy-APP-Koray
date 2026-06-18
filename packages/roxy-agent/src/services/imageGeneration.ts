import type { ConversationAsset } from '@/database/conversations'
import type { ImageGenerationSpec } from '@/deepagents/imageSpec'
import type { ImageGeneratePayload } from '@/imageProvider/index.js'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { AgentUpstreamError } from '@/core/agentError'
import { fileManager } from '@/core/fileManager'
import { AbortError } from '@/core/registry/abortRegistry'
import { streamAdapter } from '@/core/sse/streamAdapter'
import { ChatContextAPI } from '@/database/conversations'
import { resolveImageGenerator } from '@/imageProvider/index.js'
import { env } from '../config'

export interface AttachmentRef {
  fileId: string
  fileName: string
  mimeType: string
  size?: number
  url?: string
  localUrl?: string
  remoteUrl?: string
  fileUrl?: string
}

export interface ReferenceImageInput {
  assetId?: string
  imagePath?: string
}

export interface AssetGenerationOptions {
  aspectRatio?: string
  quality?: string
  count?: string | number
}

export interface ImageGenerationProviderOptions {
  imageModel?: string
  imageProtocol?: string
}

export type ImageGenerationPlan = ImageGenerationSpec

export interface ImageGenerationContext {
  conversationId: string
  turnId: string
  messageId: string
  attachments: AttachmentRef[]
  assetOptions?: AssetGenerationOptions
  writer: (event: string) => void
  signal?: AbortSignal
}

interface GeneratedImageRecord {
  fileId: string
  fileName: string
  mimeType: string
  size: number
  localUrl: string
  remoteUrl: string
}

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
}

const IMAGE_SIZE_MAP: Record<string, Record<string, string>> = {
  '2K': {
    '1:1': '2048x2048',
    '4:3': '2304x1728',
    '3:4': '1728x2304',
    '16:9': '2848x1600',
    '9:16': '1600x2848',
    '3:2': '2496x1664',
    '2:3': '1664x2496',
    '21:9': '3136x1344',
  },
  '3K': {
    '1:1': '3072x3072',
    '4:3': '3456x2592',
    '3:4': '2592x3456',
    '16:9': '4096x2304',
    '9:16': '2304x4096',
    '3:2': '3744x2496',
    '2:3': '2496x3744',
    '21:9': '4704x2016',
  },
  '4K': {
    '1:1': '4096x4096',
    '4:3': '4704x3520',
    '3:4': '3520x4704',
    '16:9': '5504x3040',
    '9:16': '3040x5504',
    '3:2': '4992x3328',
    '2:3': '3328x4992',
    '21:9': '6240x2656',
  },
}

function normalizeMimeType(mimeType: string) {
  const normalized = mimeType.split(';')[0].trim().toLowerCase()
  return normalized === 'image/jpg' ? 'image/jpeg' : normalized
}

function guessMimeTypeFromName(name?: string) {
  if (!name)
    return undefined

  try {
    const pathname = /^https?:\/\//i.test(name) ? new URL(name).pathname : name
    return EXT_TO_MIME[path.extname(pathname).toLowerCase()]
  }
  catch {
    return EXT_TO_MIME[path.extname(name).toLowerCase()]
  }
}

function resolveAttachmentMimeType(att: AttachmentRef) {
  return normalizeMimeType(att.mimeType || '')
    || guessMimeTypeFromName(att.fileName)
    || guessMimeTypeFromName(att.fileId)
    || guessMimeTypeFromName(att.url)
    || guessMimeTypeFromName(att.localUrl)
    || guessMimeTypeFromName(att.remoteUrl)
    || 'image/png'
}

function extractPositiveInteger(value: unknown, fallback: number) {
  const match = String(value ?? '').match(/\d+/)
  const parsed = match ? Number(match[0]) : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function resolveImageCount(options?: AssetGenerationOptions) {
  return Math.min(extractPositiveInteger(options?.count, 1), 4)
}

function resolveImageSize(options?: AssetGenerationOptions) {
  const quality = options?.quality === '4K' || options?.quality === '3K' ? options.quality : '2K'
  const aspectRatio = options?.aspectRatio && IMAGE_SIZE_MAP[quality][options.aspectRatio]
    ? options.aspectRatio
    : '1:1'
  return {
    quality,
    aspectRatio,
    size: IMAGE_SIZE_MAP[quality][aspectRatio],
  }
}

function parseSize(size: string) {
  const match = size.match(/^(\d+)x(\d+)$/)
  if (!match)
    return { width: undefined, height: undefined }

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  }
}

function resolveFileIdFromImagePath(imagePath?: string) {
  if (!imagePath)
    return undefined

  const apiFileMatch = imagePath.match(/\/api\/files\/([^/?#]+)/)
  if (apiFileMatch?.[1])
    return decodeURIComponent(apiFileMatch[1])

  if (path.isAbsolute(imagePath) && path.dirname(imagePath) === fileManager.uploadsDir)
    return path.basename(imagePath)

  return undefined
}

async function resolveAttachmentUrl(att: AttachmentRef) {
  const candidate = att.remoteUrl || att.fileUrl || (/^https?:\/\//i.test(att.url || '') ? att.url : undefined)
  if (candidate)
    return candidate

  if (att.fileId) {
    // 优先经 FileManager 取/上传 OSS URL；上传失败时回退本地 base64
    const remoteUrl = await fileManager.resolveRemoteUrl(att.fileId)
    if (remoteUrl)
      return remoteUrl
    if (fileManager.exists(att.fileId))
      return fileManager.readDataUrl(att.fileId, resolveAttachmentMimeType(att))
  }

  throw new Error(`Attachment has no remote URL and local file was not found: ${att.fileId}`)
}

function normalizeStylePrompt(prompt: string) {
  return prompt.trim().replace(/\s+/g, ' ')
}

function addImageSpec(prompt: string, count: number, aspectRatio: string, quality: string) {
  const isZh = env.SYSTEM_LANGUAGE === 'zh-CN'
  const parts: string[] = []
  if (isZh) {
    if (count > 1)
      parts.push(`输出 ${count} 张不同的图片`)
    parts.push(`分辨率为 ${quality}`)
    parts.push(`画面比例为 ${aspectRatio}`)
    return `${prompt} <生成指令：${parts.join('，')}，不要把本指令文字画进图中>`
  }
  if (count > 1)
    parts.push(`generate exactly ${count} distinct images`)
  parts.push(`use ${quality} resolution`)
  parts.push(`use a ${aspectRatio} aspect ratio`)
  return `${prompt} <instruction: ${parts.join('; ')}; do not render this instruction text into the image>`
}

async function buildImageGenerationRequest(
  prompt: string,
  attachments: AttachmentRef[],
  options: AssetGenerationOptions,
  providerOptions: ImageGenerationProviderOptions,
) {
  const imageInputs = await Promise.all(
    attachments
      .filter(att => normalizeMimeType(att.mimeType).startsWith('image/'))
      .slice(0, 14)
      .map(resolveAttachmentUrl),
  )
  const count = resolveImageCount(options)
  const { size, quality, aspectRatio } = resolveImageSize(options)
  const payload: ImageGeneratePayload = {
    ...(providerOptions.imageModel ? { model: providerOptions.imageModel } : {}),
    prompt: addImageSpec(prompt, count, aspectRatio, quality),
    size,
    count,
  }

  if (imageInputs.length > 0)
    payload.image = imageInputs

  return payload
}

async function persistImage(ossUrl: string, mimeTypeHint?: string, signal?: AbortSignal): Promise<GeneratedImageRecord> {
  const response = await fetch(ossUrl, {
    headers: {
      Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8,*/*;q=0.1',
    },
    signal,
  })
  if (!response.ok)
    throw new Error(`Failed to download generated image: ${ossUrl}`)

  const mimeType = response.headers.get('content-type') || mimeTypeHint || guessMimeTypeFromName(ossUrl) || 'image/png'
  const buffer = Buffer.from(await response.arrayBuffer())
  // 写本地 + 入库（files 表）；上游图片地址作为远程 URL 一并登记，供后续寻址/复用
  const record = await fileManager.saveBuffer({
    buffer,
    mimeType,
    source: 'generated',
    ossUrl,
  })
  return {
    fileId: record.file_id,
    fileName: record.file_name || record.file_id,
    mimeType: record.mime_type || mimeType,
    size: record.size ?? buffer.length,
    localUrl: `/api/files/${record.file_id}`,
    remoteUrl: ossUrl,
  }
}

function assetToAttachment(asset: ConversationAsset): AttachmentRef | null {
  const imageUrl = fileManager.resolveImagePath(asset.file_id, { fallbackUrl: asset.remote_url ?? asset.url })
  if (!imageUrl)
    return null

  const remoteUrl = /^https?:\/\//i.test(imageUrl) ? imageUrl : asset.remote_url || undefined
  return {
    fileId: asset.file_id || asset.id,
    fileName: asset.file_name || asset.file_id || asset.id,
    mimeType: asset.mime_type || 'image/png',
    url: imageUrl,
    localUrl: asset.file_id && asset.url?.startsWith('/api/files/') ? asset.url : undefined,
    remoteUrl,
    fileUrl: remoteUrl,
  }
}

async function ensureAssetRemoteUrl(asset: ConversationAsset): Promise<ConversationAsset> {
  if (asset.remote_url || !asset.file_id)
    return asset

  const remoteUrl = await fileManager.resolveRemoteUrl(asset.file_id)
  if (!remoteUrl)
    return asset

  ChatContextAPI.updateAssetRemoteUrl(asset.conversation_id, asset.id, remoteUrl)

  return {
    ...asset,
    remote_url: remoteUrl,
  }
}

function dedupeAttachments(attachments: AttachmentRef[]) {
  const seen = new Set<string>()
  return attachments.filter((attachment) => {
    const key = attachment.remoteUrl || attachment.fileUrl || attachment.localUrl || attachment.url || attachment.fileId || attachment.fileName
    if (seen.has(key))
      return false
    seen.add(key)
    return true
  })
}

function referenceImageToAttachment(referenceImage: ReferenceImageInput): AttachmentRef | null {
  const fileId = resolveFileIdFromImagePath(referenceImage.imagePath)
  const imagePath = referenceImage.imagePath
  const fileName = fileId || (imagePath ? path.basename(imagePath.split(/[?#]/)[0]) : 'reference-image')
  if (!fileId && !imagePath)
    return null

  return {
    fileId: fileId || '',
    fileName,
    mimeType: guessMimeTypeFromName(fileName) || guessMimeTypeFromName(imagePath) || 'image/png',
    url: fileId ? `/api/files/${fileId}` : imagePath,
    localUrl: fileId ? `/api/files/${fileId}` : undefined,
    remoteUrl: imagePath && /^https?:\/\//i.test(imagePath) ? imagePath : undefined,
    fileUrl: imagePath && /^https?:\/\//i.test(imagePath) ? imagePath : undefined,
  }
}

function formatAssetForResult(asset: ConversationAsset) {
  const remoteUrl = asset.remote_url || (asset.url && /^https?:\/\//i.test(asset.url) ? asset.url : undefined)
  return {
    assetId: asset.id,
    batchId: asset.batch_id,
    batchIndex: asset.batch_index,
    ordinalInBatch: asset.ordinal_in_batch,
    fileId: asset.file_id || asset.id,
    fileName: asset.file_name,
    url: asset.url,
    localUrl: asset.file_id && asset.url?.startsWith('/api/files/') ? asset.url : undefined,
    remoteUrl,
    fileUrl: remoteUrl,
    mimeType: asset.mime_type,
    prompt: asset.prompt,
    aspectRatio: asset.aspect_ratio,
    quality: asset.quality,
    width: asset.width,
    height: asset.height,
    dependsOn: asset.depends_on,
    createdAt: asset.created_at,
  }
}

export async function generateImagesFromPlan(
  plan: ImageGenerationPlan,
  context: ImageGenerationContext,
  providerOptions: ImageGenerationProviderOptions = {},
) {
  ChatContextAPI.backfillAssetsFromHistory(context.conversationId)

  const planReferenceImages = Array.isArray(plan.referenceImages) ? plan.referenceImages.slice(0, 14) : []
  const referenceAssetIds = [
    ...new Set(
      planReferenceImages
        .map(referenceImage => referenceImage.assetId)
        .filter((assetId): assetId is string => Boolean(assetId)),
    ),
  ]
  const referenceImagePaths = [
    ...new Set(
      planReferenceImages
        .map(referenceImage => referenceImage.imagePath)
        .filter((imagePath): imagePath is string => Boolean(imagePath)),
    ),
  ]
  const referenceFileIds = referenceImagePaths
    .map(resolveFileIdFromImagePath)
    .filter((fileId): fileId is string => Boolean(fileId))
  const referenceAssetsById = referenceAssetIds.length > 0
    ? ChatContextAPI.getAssetsByIds(context.conversationId, referenceAssetIds)
    : []
  const referenceAssetsByFileId = referenceFileIds.length > 0
    ? ChatContextAPI.getAssetsByFileIds(context.conversationId, referenceFileIds)
    : []
  const referenceAssetsByKey = new Map<string, ConversationAsset>()
  for (const asset of [...referenceAssetsById, ...referenceAssetsByFileId])
    referenceAssetsByKey.set(asset.id, asset)
  const referenceAssets = await Promise.all([...referenceAssetsByKey.values()].map(ensureAssetRemoteUrl))
  const referenceAttachments = referenceAssets
    .map(assetToAttachment)
    .filter((attachment): attachment is AttachmentRef => Boolean(attachment))
  const directReferenceAttachments = planReferenceImages
    .filter(referenceImage => !referenceAssets.some(asset => asset.remote_url === referenceImage.imagePath || asset.url === referenceImage.imagePath || (asset.file_id && referenceImage.imagePath?.includes(asset.file_id))))
    .map(referenceImageToAttachment)
    .filter((attachment): attachment is AttachmentRef => Boolean(attachment))
  const attachments = dedupeAttachments([
    ...context.attachments.filter(att => normalizeMimeType(att.mimeType).startsWith('image/')),
    ...referenceAttachments,
    ...directReferenceAttachments,
  ])

  // 生图参数只认前端请求时传入的 assetOptions，不再从模型保存的 spec 读取
  const options = {
    aspectRatio: context.assetOptions?.aspectRatio || '1:1',
    quality: context.assetOptions?.quality || '2K',
    count: context.assetOptions?.count || 1,
  }
  const count = resolveImageCount(options)
  const { aspectRatio, quality, size } = resolveImageSize(options)
  const { width, height } = parseSize(size)
  const stylePrompt = normalizeStylePrompt(plan.prompt)
  // 模型产出的检索关键词（系统语言、空格分词）：写入 FTS 索引供后续 search_artifacts 命中。
  // 缺省时回退用 prompt（英文 prompt 可被空格分词；中文自然语言 prompt 无法被子词命中，故需模型提供）。
  const searchTerms = plan.searchTerms?.trim() || ''
  const payload = await buildImageGenerationRequest(
    stylePrompt,
    attachments,
    { aspectRatio, quality, count },
    providerOptions,
  )
  payload.conversationId = context.conversationId;
  payload.turnId = context.turnId;

  // 用户可能在 agent 轮次结束后、生图真正开始前就点了取消：进入上游请求前先检查中断信号，
  // 抛 AbortError 让路由 catch 走 interrupt（而非误报错误，也不白白发起一次计费请求）。
  if (context.signal?.aborted)
    throw new AbortError('User cancelled')

  console.log('generating image with payload: ', JSON.stringify(payload))

  const batchId = `batch_${Date.now()}_${randomUUID().slice(0, 8)}`
  const batchIndex = ChatContextAPI.getNextAssetBatchIndex(context.conversationId)
  const dependsOn = referenceAssets.map(asset => asset.id)
  const foundReferenceAssetIds = new Set(referenceAssets.map(asset => asset.id))
  const missingReferenceImagePaths = planReferenceImages
    .filter(referenceImage => referenceImage.assetId && !foundReferenceAssetIds.has(referenceImage.assetId))
    .map(referenceImage => referenceImage.imagePath)
    .filter((imagePath): imagePath is string => Boolean(imagePath))
  const missingReferenceAssetIds = referenceAssetIds.filter(assetId => !foundReferenceAssetIds.has(assetId))
  const generatedAssets: ConversationAsset[] = []
  const generator = resolveImageGenerator(providerOptions.imageProtocol)

  context.writer(streamAdapter.imageGenerating({ count }))

  const upstreamResponse = await generator.generate(payload, context.signal)

  if (!upstreamResponse.ok) {
    const errorText = await upstreamResponse.text()
    let errorResult: any = {}
    try {
      errorResult = errorText ? JSON.parse(errorText) : {}
    }
    catch {}
    const message = errorResult?.error?.message || errorResult?.message || errorResult?.detail?.error?.message || 'Image generation failed'
    // 透传上游状态码与原始 body，供 normalizeAgentError 还原出稳定的 code/category/requestId
    throw new AgentUpstreamError(message, {
      status: upstreamResponse.status,
      code: errorResult?.code || errorResult?.error?.code,
      body: errorResult,
      requestId: errorResult?.data?.request_id || errorResult?.request_id,
    })
  }

  const reader = upstreamResponse.body?.getReader()
  if (!reader)
    throw new Error('Image generation response body is empty')

  for await (const imageEvent of generator.readStream(reader)) {
    // 取消可能发生在逐张流式生成期间（seedream 真流式尤其明显）：每张落库前检查信号，
    // 及时中断并停止继续写库 / 推送 image_partial。
    if (context.signal?.aborted)
      throw new AbortError('User cancelled')

    const index = imageEvent.image_index
    let record: GeneratedImageRecord | undefined
    try {
      record = await persistImage(imageEvent.url, imageEvent.mime_type, context.signal)
    }
    catch (err) {
      // 下载途中被取消：abort 信号优先级最高，直接向上抛出按 interrupt 处理，不吞成“跳过”。
      if (AbortError.isAbortError(err))
        throw err
      console.warn(`[ImageGeneration] Failed to persist image at index ${index}, skipping:`, (err as Error).message)
    }

    if (!record)
      continue

    const asset = ChatContextAPI.addAsset({
      id: `asset_${Date.now()}_${randomUUID().slice(0, 8)}`,
      conversation_id: context.conversationId,
      message_id: context.messageId,
      batch_id: batchId,
      batch_index: batchIndex,
      ordinal_in_batch: index + 1,
      asset_type: 'image',
      file_id: record.fileId,
      file_name: record.fileName,
      url: record.localUrl,
      remote_url: record.remoteUrl,
      mime_type: record.mimeType,
      status: 'success',
      prompt: stylePrompt,
      aspect_ratio: aspectRatio,
      quality,
      width,
      height,
      depends_on: dependsOn,
      search_text: [
        stylePrompt,
        searchTerms,
        'image picture generated asset',
        `batch ${batchIndex}`,
        `ordinal ${index + 1}`,
        `asset ${index + 1}`,
        aspectRatio,
        quality,
        dependsOn.join(' '),
      ].filter(Boolean).join('\n'),
      metadata: {
        prompt: stylePrompt,
        ...(searchTerms ? { searchTerms } : {}),
        requestedOptions: options,
        provider: providerOptions.imageModel || 'seedream',
        providerProtocol: providerOptions.imageProtocol,
        referenceImagePaths,
        referenceAssetIds: dependsOn,
        directReferenceCount: directReferenceAttachments.length,
        uploadedReferenceCount: context.attachments.filter(att => normalizeMimeType(att.mimeType).startsWith('image/')).length,
        missingReferenceAssetIds: missingReferenceAssetIds.length > 0 ? missingReferenceAssetIds : undefined,
        missingReferenceImagePaths: missingReferenceImagePaths.length > 0 ? missingReferenceImagePaths : undefined,
      },
    })
    generatedAssets.push(asset)

    context.writer(streamAdapter.imagePartial({
      index,
      image: {
        ...record,
        prompt: stylePrompt,
        assetId: asset.id,
        fileId: asset.file_id || record.fileId,
        url: asset.url || undefined,
        localUrl: asset.file_id && asset.url?.startsWith('/api/files/') ? asset.url : undefined,
        remoteUrl: asset.remote_url || undefined,
        fileUrl: asset.remote_url || undefined,
      },
    }))
  }

  if (generatedAssets.length === 0)
    throw new Error('No generated images returned')

  return {
    status: 'success',
    batchId,
    batchIndex,
    images: generatedAssets.map(asset => formatAssetForResult(asset)),
    referenceAssetIds: dependsOn,
  }
}
