import type { Request, Response } from 'express'
import { Router } from 'express'
import { z } from 'zod'
import { extractScriptSelfDescription } from '@/script/scriptMeta'

const router: Router = Router()

function firstIssue(error: z.ZodError, fallback: string) {
  return error.issues[0]?.message ?? fallback
}

const ScriptSelfDescriptionSchema = z.object({
  code: z.string().min(1, 'code is required'),
})

/** POST /api/scripts/self-description - 静态解析脚本源码，不执行脚本代码。 */
router.post('/self-description', (req: Request, res: Response) => {
  const parsed = ScriptSelfDescriptionSchema.safeParse(req.body)
  if (!parsed.success)
    return res.json({ code: 1, msg: firstIssue(parsed.error, 'Invalid request') })

  try {
    const result = extractScriptSelfDescription(parsed.data.code)
    return res.json({ code: 0, data: result })
  }
  catch (err: any) {
    return res.json({ code: 1, msg: err?.message ?? String(err) })
  }
})

export default router
