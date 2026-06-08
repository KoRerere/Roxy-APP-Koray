import type { UserModelSwitchPayload, UserModelType } from '../api/model'
import type { Request, Response } from 'express'
import { Router } from 'express'
import { aiAgentModelApi } from '../api/model'

const router: Router = Router()

const MODEL_TYPES: UserModelType[] = ['text_model', 'image_model', 'vlm_model', 'video_model']

function isUserModelType(value: unknown): value is UserModelType {
  return typeof value === 'string' && MODEL_TYPES.includes(value as UserModelType)
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
  try {
    const modelType = req.query.model_type
    if (!isUserModelType(modelType)) {
      return res.json({ code: 1, msg: `model_type is required and must be one of: ${MODEL_TYPES.join(', ')}` })
    }

    const data = await aiAgentModelApi.listUserModelOptions(modelType)
    res.json({ code: 0, data })
  }
  catch (error: any) {
    res.json({ code: 1, msg: error.message })
  }
})

router.put('/', async (req: Request, res: Response) => {
  try {
    const { model_type: modelType, model } = req.body ?? {}

    if (!isUserModelType(modelType)) {
      return res.json({ code: 1, msg: `model_type is required and must be one of: ${MODEL_TYPES.join(', ')}` })
    }

    if (model !== null && typeof model !== 'string') {
      return res.json({ code: 1, msg: 'model must be a string or null' })
    }

    const payload: UserModelSwitchPayload = {
      model_type: modelType,
      model,
    }
    const data = await aiAgentModelApi.switchUserModel(payload)
    res.json({ code: 0, data })
  }
  catch (error: any) {
    res.json({ code: 1, msg: error.message })
  }
})

export default router
