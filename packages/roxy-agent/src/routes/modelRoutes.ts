import type { UserModelSwitchPayload } from '@/api/model'
import type { Request, Response } from 'express'
import { Router } from 'express'
import { z } from 'zod'
import { aiAgentModelApi } from '@/api/model'
import * as chatService from '@/services/chatService'

const router: Router = Router()

const ModelTypeSchema = z.enum(['text_model', 'image_model', 'vlm_model', 'video_model'])
const MODEL_TYPES = ModelTypeSchema.options

const ModelOptionsQuerySchema = z.object({
  model_type: ModelTypeSchema,
})

const SwitchModelSchema = z.object({
  model_type: ModelTypeSchema,
  model: z.string().nullable(),
  conversation_id: z.string().optional(),
})

function apiFormatFamily(apiFormat?: string | null): 'anthropic' | 'openai' | undefined {
  const normalized = apiFormat?.trim().toLowerCase()
  if (normalized === 'anthropic' || normalized === 'openai')
    return normalized
  return undefined
}

function shouldResetConversationRuntime(
  modelType: z.infer<typeof ModelTypeSchema>,
  previousFormat?: string | null,
  nextFormat?: string | null,
) {
  if (modelType !== 'text_model')
    return false

  const previous = apiFormatFamily(previousFormat)
  const next = apiFormatFamily(nextFormat)
  return Boolean(previous && next && previous !== next)
}

function modelTypeError() {
  return `model_type is required and must be one of: ${MODEL_TYPES.join(', ')}`
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const data = await aiAgentModelApi.getUserModel()
    res.json({ code: 0, data })
  }
  catch (error: any) {
    res.json({ code: 1, msg: error.message })
  }
})

router.get('/options', async (req: Request, res: Response) => {
  const parsed = ModelOptionsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.json({ code: 1, msg: modelTypeError() })
  }
  try {
    const data = await aiAgentModelApi.listUserModelOptions(parsed.data.model_type)
    res.json({ code: 0, data })
  }
  catch (error: any) {
    res.json({ code: 1, msg: error.message })
  }
})

router.put('/', async (req: Request, res: Response) => {
  const parsed = SwitchModelSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const msg = issue?.path?.[0] === 'model' ? 'model must be a string or null' : modelTypeError()
    return res.json({ code: 1, msg })
  }
  try {
    let previousFormat: string | null | undefined
    try {
      const currentModel = await aiAgentModelApi.getUserModel()
      previousFormat = currentModel[parsed.data.model_type]?.api_format
    }
    catch (error) {
      console.warn('Failed to fetch current model before switching:', error)
    }

    const payload: UserModelSwitchPayload = {
      model_type: parsed.data.model_type,
      model: parsed.data.model,
    }
    const data = await aiAgentModelApi.switchUserModel(payload)

    const nextFormat = data[parsed.data.model_type]?.api_format
    if (
      parsed.data.conversation_id
      && shouldResetConversationRuntime(parsed.data.model_type, previousFormat, nextFormat)
    ) {
      await chatService.resetConversationRuntime(parsed.data.conversation_id)
    }

    res.json({ code: 0, data })
  }
  catch (error: any) {
    res.json({ code: 1, msg: error.message })
  }
})

export default router
