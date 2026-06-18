import type { ConversationAsset } from '../../database/conversations'
import type { ImageGenerationSpec, ImageSpecAttachmentRef, ImageSpecStore } from '../imageSpec'
import type { StructuredToolInterface } from '@langchain/core/tools'
import { ToolMessage } from '@langchain/core/messages'
import { Command, END } from '@langchain/langgraph'
import { tool } from 'langchain'
import { z } from 'zod'
import { fileManager } from '@/core/fileManager'
import { ChatContextAPI } from '../../database/conversations'
import { ImageGenerationSpecSchema } from '../imageSpec'

interface ImageToolContext {
  conversationId: string
  messageId?: string
  attachments: ImageSpecAttachmentRef[]
}

interface SearchArtifactsInput {
  query?: string
  limit?: number
  batchIndex?: number
  imageIndex?: number
}

interface CompactImageReference {
  assetId: string
  imagePath: string
  batchIndex: number
  imageIndex: number
  generationPrompt: string
}

function getImageToolContext(config: any): ImageToolContext {
  const context = config?.imageContext ?? config?.configurable?.imageContext
  if (!context?.conversationId)
    throw new Error('image tool context is missing')

  return {
    conversationId: context.conversationId,
    messageId: context.messageId,
    attachments: Array.isArray(context.attachments) ? context.attachments : [],
  }
}

function formatAssetReferenceForTool(asset: ConversationAsset): CompactImageReference | null {
  // 文件寻址统一交给 FileManager（优先 OSS URL，其次本地 /api/files，再回退 asset 自带 URL）
  const imagePath = fileManager.resolveImagePath(asset.file_id, { fallbackUrl: asset.remote_url ?? asset.url })
  if (!imagePath)
    return null

  return {
    assetId: asset.id,
    imagePath,
    batchIndex: asset.batch_index,
    imageIndex: asset.ordinal_in_batch,
    generationPrompt: asset.prompt?.trim() || '',
  }
}

function parsePositiveInteger(value: unknown) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function formatMarkdownValue(value: unknown) {
  return value === undefined || value === null || value === '' ? 'N/A' : String(value)
}

function formatMarkdownReferences(referenceImages: CompactImageReference[]) {
  if (referenceImages.length === 0)
    return '- None'

  return referenceImages
    .map((referenceImage, index) => [
      `${index + 1}.`,
      `   - assetId: \`${referenceImage.assetId}\``,
      `   - imagePath: \`${referenceImage.imagePath}\``,
      `   - batchIndex: \`${formatMarkdownValue(referenceImage.batchIndex)}\``,
      `   - imageIndex: \`${formatMarkdownValue(referenceImage.imageIndex)}\``,
      `   - generationPrompt: \`${formatMarkdownValue(referenceImage.generationPrompt)}\``,
    ].join('\n'))
    .join('\n')
}

function formatSearchArtifactsMarkdown(result: {
  status: 'error' | 'found' | 'not_found'
  strategy: 'direct_reference' | 'fts_match'
  code?: string
  query?: string
  batchIndex?: number
  imageIndex?: number
  referenceImages: CompactImageReference[]
  message?: string
}) {
  const lines = [
    '## search_artifacts result',
    '',
    `- status: \`${result.status}\``,
    `- strategy: \`${result.strategy}\``,
  ]

  if (result.code)
    lines.push(`- code: \`${result.code}\``)
  if (result.query)
    lines.push(`- query: \`${result.query}\``)
  if (result.batchIndex !== undefined)
    lines.push(`- batchIndex: \`${formatMarkdownValue(result.batchIndex)}\``)
  if (result.imageIndex !== undefined)
    lines.push(`- imageIndex: \`${formatMarkdownValue(result.imageIndex)}\``)
  if (result.message)
    lines.push(`- message: ${result.message}`)

  lines.push('', '### referenceImages', formatMarkdownReferences(result.referenceImages))

  const output = lines.join('\n')
  console.log('formatted search_artifacts result: ', output)
  return output
}

function buildDirectReferenceError(message: string, input: SearchArtifactsInput) {
  return formatSearchArtifactsMarkdown({
    status: 'error',
    strategy: 'direct_reference',
    code: 'direct_reference_unresolved',
    batchIndex: input.batchIndex,
    imageIndex: input.imageIndex,
    referenceImages: [],
    message,
  })
}

function formatSaveImageSpecMarkdown(spec: ImageGenerationSpec) {
  return [
    '## save_image_spec result',
    '',
    '- status: `saved`',
    `- promptLength: \`${spec.prompt.length}\``,
    `- searchTermsLength: \`${spec.searchTerms?.length ?? 0}\``,
    `- referenceImageCount: \`${spec.referenceImages?.length ?? 0}\``,
  ].join('\n')
}

const SaveImageSpecInputSchema = z.object({
  prompt: z.string().optional().describe('Required. The final natural-language image-generation brief, written in the system-prompt output language.'),
  searchTerms: z.string().optional().describe('Required. 2-40 space-separated English keyword tokens, used to index this image for later search_artifacts retrieval.'),
  referenceImages: z.array(z.object({
    assetId: z.string().optional(),
    imagePath: z.string(),
  })).optional().describe('Optional selected historical reference images (assetId + imagePath only).'),
})

function formatSaveImageSpecValidationError(error: z.ZodError) {
  const issues = error.issues.map((issue) => {
    const fieldPath = issue.path.length > 0 ? issue.path.join('.') : '(root)'
    return `- \`${fieldPath}\`: ${issue.message}`
  })
  return [
    '## save_image_spec validation failed',
    '',
    'The spec was NOT saved. Fix the following and call save_image_spec again (do not give up or reply with plain text):',
    ...issues,
  ].join('\n')
}

const searchArtifactsTool = tool(
  async (
    input: SearchArtifactsInput,
    config: any,
  ): Promise<string> => {
    console.log('search_artifacts called with input: ', JSON.stringify(input), ' conversation: ', config?.conversationId, 'message: ', config?.messageId)

    const context = getImageToolContext(config)
    ChatContextAPI.backfillAssetsFromHistory(context.conversationId)
    const batchIndex = parsePositiveInteger(input.batchIndex)
    const imageIndex = parsePositiveInteger(input.imageIndex)

    if (input.batchIndex !== undefined || input.imageIndex !== undefined) {
      if ((input.batchIndex !== undefined && !batchIndex) || !imageIndex) {
        return buildDirectReferenceError(
          'Direct image reference requires a positive integer imageIndex and, when provided, a positive integer batchIndex. Call search_artifacts again with corrected direct parameters, or omit them and use query search terms.',
          input,
        )
      }

      const resolvedBatchIndex = batchIndex ?? ChatContextAPI.getLatestAssetBatchIndex(context.conversationId)
      if (!resolvedBatchIndex) {
        return buildDirectReferenceError(
          'No generated image batch is available for direct image reference. Call search_artifacts again with query search terms if a reference image is still needed.',
          input,
        )
      }

      const asset = ChatContextAPI.getAssetByBatchOrdinal(context.conversationId, resolvedBatchIndex, imageIndex, {
        assetType: 'image',
        status: 'success',
      })

      if (!asset) {
        return buildDirectReferenceError(
          'No image asset matched batchIndex and imageIndex. Call search_artifacts again with corrected direct parameters from the conversation context, or omit direct parameters and use query search terms.',
          input,
        )
      }

      const referenceImage = formatAssetReferenceForTool(asset)
      if (!referenceImage) {
        return buildDirectReferenceError(
          'The matched image asset has no reusable imagePath. Call search_artifacts again with another direct reference, or omit direct parameters and use query search terms.',
          input,
        )
      }
      console.log('search_artifacts direct reference: ', { batchIndex: resolvedBatchIndex, imageIndex }, 'found: ', JSON.stringify(referenceImage), ' conversation: ', context.conversationId, 'message: ', context.messageId)

      return formatSearchArtifactsMarkdown({
        status: 'found',
        strategy: 'direct_reference',
        batchIndex: resolvedBatchIndex,
        imageIndex,
        referenceImages: [referenceImage],
      })
    }

    const query = typeof input.query === 'string' ? input.query.trim() : ''
    if (!query)
      return buildDirectReferenceError('search_artifacts requires either batchIndex plus imageIndex, or a non-empty query. Call it again with corrected direct parameters or rewritten search terms.', input)

    const limit = Math.min(Math.max(Number(input.limit) || 4, 1), 4)
    const assets = ChatContextAPI.searchAssetsByFts(context.conversationId, query, {
      assetType: 'image',
      status: 'success',
      limit,
    })

    if (assets.length === 0) {
      return formatSearchArtifactsMarkdown({
        status: 'not_found',
        strategy: 'fts_match',
        query,
        referenceImages: [],
        message: 'No image asset matched this query. Rewrite the search terms from the conversation context and call search_artifacts again if a reference image is still needed.',
      })
    }

    const referenceImages = assets
      .map(formatAssetReferenceForTool)
      .filter((referenceImage): referenceImage is CompactImageReference => Boolean(referenceImage))
    if (referenceImages.length === 0) {
      return formatSearchArtifactsMarkdown({
        status: 'not_found',
        strategy: 'fts_match',
        query,
        referenceImages: [],
        message: 'Matched image assets had no reusable imagePath. Rewrite the search terms from the conversation context and call search_artifacts again if a reference image is still needed.',
      })
    }
    console.log('search_artifacts query: ', query, 'found: ', JSON.stringify(referenceImages), ' conversation: ', context.conversationId, 'message: ', context.messageId)

    return formatSearchArtifactsMarkdown({
      status: 'found',
      strategy: 'fts_match',
      query,
      referenceImages,
    })
  },
  {
    name: 'search_artifacts',
    description: 'Search or directly resolve image assets generated in the current conversation. For exact references, pass batchIndex and imageIndex to resolve one image directly. For descriptive references, pass query for FTS search. The query is matched against the keyword terms (searchTerms) that were recorded in English when each image was generated, so the query must be space-separated English keyword tokens, not a full sentence. Returns Markdown with compact image references containing assetId, imagePath, batchIndex, imageIndex, and generationPrompt. Use generationPrompt only to validate whether a matched historical image fits the user-described content; do not include generationPrompt, batchIndex, or imageIndex in save_image_spec.referenceImages. Include selected references in the final save_image_spec call with only assetId and imagePath.',
    schema: z.object({
      query: z.string().min(1).optional().describe('Space-separated English keyword tokens for FTS5 (e.g. discrete subject/object/color/style words) so they match the English searchTerms stored at generation time. Do not pass a full natural-language sentence. Use this only when direct batchIndex/imageIndex resolution is unavailable or failed.'),
      limit: z.number().int().min(1).max(4).optional().describe('Maximum number of matched image references to return. Defaults to 4.'),
      batchIndex: z.number().int().min(1).optional().describe('1-based image generation batch index for direct references, such as 1 for the first generated batch. If omitted with imageIndex, the latest generated batch is used.'),
      imageIndex: z.number().int().min(1).optional().describe('1-based image index within the selected generation batch, such as 2 for the second image in that batch. Required for direct references.'),
    }),
  },
) as StructuredToolInterface

export function createImageTools(imageSpecStore: ImageSpecStore): StructuredToolInterface[] {
  return [
    searchArtifactsTool,
    tool(
      async (
        input: any,
        config: any,
      ): Promise<string | Command> => {
        const context = getImageToolContext(config)
        if (!context.messageId)
          throw new Error('image tool context is missing messageId')

        // 工具内校验并据此决定流程（取代静态 returnDirect）：
        // - 校验失败：返回可操作的错误文本，工具不退出循环 → 模型据错误修正后重试。
        // - 校验成功：保存 spec，并用 Command(goto END) 直接结束本轮 agent 循环。
        const parsed = ImageGenerationSpecSchema.safeParse(input)
        if (!parsed.success)
          return formatSaveImageSpecValidationError(parsed.error)

        let spec
        try {
          spec = imageSpecStore.save(parsed.data, {
            uploadedAttachments: context.attachments,
          })
        }
        catch (error: any) {
          return `## save_image_spec failed\n\n${error?.message || String(error)}\n\nPlease adjust the spec and call save_image_spec again.`
        }

        console.log('Saved image generation spec for conversation', context.conversationId, 'message', context.messageId, 'spec:', JSON.stringify(spec))

        const content = formatSaveImageSpecMarkdown(spec)
        const toolCallId: string | undefined = config?.toolCall?.id ?? config?.configurable?.tool_call_id
        // 校验通过即直接结束本轮循环，避免成功保存后模型继续输出文本或调用工具。
        // 拿不到 tool_call_id 时退化为普通字符串返回（不强制退出，靠系统提示词让模型停止），避免消息配对错误。
        if (!toolCallId)
          return content

        return new Command({
          goto: END,
          update: {
            messages: [new ToolMessage({ content, name: 'save_image_spec', tool_call_id: toolCallId })],
          },
        })
      },
      {
        name: 'save_image_spec',
        description: 'Save the final image generation data for the later image generation flow. This is an internal final-step tool. Provide "prompt" (the generation brief), "searchTerms" (space-separated English keyword tokens describing this image for future retrieval), and optional "referenceImages". The input is validated: on success the turn ends immediately; on a validation error the tool returns the problems so you can fix them and call it again. Do not include image parameters such as aspect ratio, quality, or count; those are applied automatically by the system from the user\'s UI selection. Only call this tool when the user input carries an actionable image-generation intent.',
        schema: SaveImageSpecInputSchema,
      },
    ) as StructuredToolInterface,
  ]
}
