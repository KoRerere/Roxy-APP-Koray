import { z } from 'zod'

// 生图参数（比例/清晰度/张数）一律以前端请求时传入的 assetOptions 为准，
// 不再由模型写入 spec，故 schema 不含 parameters。
// searchTerms：模型为本次生成的图片产出的检索关键词（固定英文、空格分词），落库进 FTS 的
// search_terms 列，供后续 search_artifacts 检索命中（unicode61 对中文不分词，自然语言 prompt
// 无法被中文子词命中，必须靠空格分词的关键词）。
// 这里对 searchTerms 做必填 + 语言/格式校验：上下文过长或模型幻觉时，宁可让工具校验失败触发重试，
// 也不要把错误语言/错误格式的检索词写进 FTS 索引污染后续检索。

const LATIN_PATTERN = /[A-Z]/i

const SearchTermsSchema = z.string()
  .min(1)
  .refine(value => !/[\n\r]/.test(value), {
    message: 'searchTerms must be a single line of space-separated keyword tokens, with no line breaks.',
  })
  .refine(value => value.trim().length <= 300, {
    message: 'searchTerms is too long; provide a short list of discrete keyword tokens (<= 300 chars), not a sentence or the full prompt.',
  })
  .refine((value) => {
    const tokens = value.trim().split(/\s+/).filter(Boolean)
    return tokens.length >= 2 && tokens.length <= 40
  }, {
    message: 'searchTerms must be 2 to 40 space-separated keyword tokens (discrete words, not a sentence).',
  })
  .refine(value => LATIN_PATTERN.test(value), {
    message: 'searchTerms must be written in English (Latin letters) so it matches the English search_artifacts queries.',
  })

export const ImageGenerationSpecSchema = z.object({
  prompt: z.string().min(1),
  searchTerms: SearchTermsSchema,
  referenceImages: z.array(z.object({
    assetId: z.string().min(1).optional(),
    imagePath: z.string().min(1),
  }).strict()).optional(),
}).strict()

export type ImageGenerationSpec = z.infer<typeof ImageGenerationSpecSchema>

export interface ImageSpecAttachmentRef {
  fileId?: string
  fileName?: string
  mimeType?: string
  size?: number
  url?: string
  localUrl?: string
  remoteUrl?: string
  fileUrl?: string
}

function normalizeMimeType(mimeType?: string) {
  return (mimeType || '').split(';')[0].trim().toLowerCase()
}

function asRemoteFileUrl(url?: string) {
  return url && /^https?:\/\//i.test(url) ? url : undefined
}

function uploadedAttachmentToReferenceImage(attachment: ImageSpecAttachmentRef) {
  if (!normalizeMimeType(attachment.mimeType).startsWith('image/'))
    return undefined

  const imagePath = asRemoteFileUrl(attachment.remoteUrl) || asRemoteFileUrl(attachment.fileUrl) || (attachment.fileId
    ? `/api/files/${attachment.fileId}`
    : attachment.localUrl || attachment.url)

  return imagePath ? { imagePath } : undefined
}

function dedupeReferenceImages(referenceImages: NonNullable<ImageGenerationSpec['referenceImages']>) {
  const seen = new Set<string>()
  return referenceImages.filter((referenceImage) => {
    const key = referenceImage.assetId
      ? `asset:${referenceImage.assetId}`
      : `path:${referenceImage.imagePath}`
    if (seen.has(key))
      return false
    seen.add(key)
    return true
  })
}

function normalizeImageGenerationSpec(
  spec: ImageGenerationSpec,
  uploadedAttachments: ImageSpecAttachmentRef[] = [],
): ImageGenerationSpec {
  const prompt = spec.prompt.trim()
  if (!prompt)
    throw new Error('Image generation spec prompt is required')

  const referenceImages = spec.referenceImages?.map((referenceImage) => {
    const assetId = referenceImage.assetId?.trim()
    const imagePath = referenceImage.imagePath.trim()
    if (!imagePath)
      throw new Error('Image generation spec referenceImages.imagePath is required')

    return {
      ...(assetId ? { assetId } : {}),
      imagePath,
    }
  }) ?? []
  const uploadedReferenceImages = uploadedAttachments
    .map(uploadedAttachmentToReferenceImage)
    .filter((referenceImage): referenceImage is { imagePath: string } => Boolean(referenceImage))
  const mergedReferenceImages = dedupeReferenceImages([
    ...referenceImages,
    ...uploadedReferenceImages,
  ])

  const searchTerms = spec.searchTerms.trim()

  return {
    prompt,
    searchTerms,
    referenceImages: mergedReferenceImages,
  }
}

export interface ImageSpecStore {
  save: (
    spec: unknown,
    options?: { uploadedAttachments?: ImageSpecAttachmentRef[] },
  ) => ImageGenerationSpec
  consume: () => ImageGenerationSpec | undefined
}

export function createImageSpecStore(): ImageSpecStore {
  let savedSpec: ImageGenerationSpec | undefined

  return {
    save(spec, options = {}) {
      savedSpec = normalizeImageGenerationSpec(
        ImageGenerationSpecSchema.parse(spec),
        options.uploadedAttachments,
      )
      return savedSpec
    },
    consume() {
      const spec = savedSpec
      savedSpec = undefined
      return spec
    },
  }
}
