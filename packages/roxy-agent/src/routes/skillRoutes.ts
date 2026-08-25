import type { Request, Response } from 'express'
import { Router } from 'express'
import path from 'node:path'
import { z } from 'zod'
import { getSkillManager } from '@/core/skillManager'
import { agentPaths } from '@/core/storage/agentPaths'

const router: Router = Router()

const SkillPathQuerySchema = z.object({
  slug: z.string().trim().min(1).max(256).optional(),
})
const InstalledSkillSlugSchema = z.string().trim().min(1).max(256)

function normalizeInstalledSkillSlugCandidate(slug: string): string {
  const trimmed = slug.trim()
  if (!trimmed || trimmed.startsWith('/') || /^[a-z]:/i.test(trimmed)) {
    return ''
  }

  const normalizedInput = trimmed.replace(/\\/g, '/')
  const segments = normalizedInput.split('/')
  if (segments.includes('..')) {
    return ''
  }

  return segments.filter(segment => segment && segment !== '.').join('/')
}

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

function readSlugParam(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(part => String(part)).join('/')
  }
  return typeof value === 'string' ? value : ''
}

function isInvalidInstalledSkillSlugError(error: unknown): boolean {
  return error instanceof Error && error.message === 'Invalid installed Skill slug.'
}

router.delete('/installed/*slug', async (req: Request, res: Response) => {
  const rawSlug = readSlugParam(req.params.slug)
  const parsed = InstalledSkillSlugSchema.safeParse(rawSlug)
  if (!parsed.success) {
    return res.status(400).json({ code: 1, msg: 'Invalid installed Skill slug' })
  }

  try {
    const normalizedSlug = normalizeInstalledSkillSlugCandidate(parsed.data)
    if (!normalizedSlug) {
      return res.status(400).json({ code: 1, msg: 'Invalid installed Skill slug' })
    }

    const deleted = await getSkillManager().deleteInstalledSkillBySlug(normalizedSlug)
    return res.json({ code: 0, data: { deleted } })
  }
  catch (error) {
    if (isInvalidInstalledSkillSlugError(error)) {
      return res.status(400).json({ code: 1, msg: 'Invalid installed Skill slug' })
    }
    console.error('[skillRoutes] failed to delete installed Skill:', error)
    return res.status(500).json({ code: 1, msg: 'Failed to delete installed Skill' })
  }
})

export default router
