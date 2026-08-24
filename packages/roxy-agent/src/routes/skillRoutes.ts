import type { Request, Response } from 'express'
import { Router } from 'express'
import path from 'node:path'
import { z } from 'zod'
import { agentPaths } from '@/core/storage/agentPaths'

const router: Router = Router()

const SkillPathQuerySchema = z.object({
  slug: z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/).optional(),
})

router.get('/path-info', (req: Request, res: Response) => {
  const parsed = SkillPathQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.json({ code: 1, msg: parsed.error.issues[0]?.message ?? 'Invalid request' })
  }

  const { slug } = parsed.data
  return res.json({
    code: 0,
    data: {
      installedRoot: agentPaths.skillsInstalledDir,
      ...(slug ? { skillMdPath: path.join(agentPaths.skillsInstalledDir, slug, 'SKILL.md') } : {}),
    },
  })
})

export default router
