import type { Request, Response } from 'express'
import { Router } from 'express'
import { aiAgentSkillsApi } from '../api/skills'
import { getSkillManager } from '../skillManager'

const router: Router = Router()

function resolveLanguageHeader(req: Request): string | undefined {
  const value = req.headers.language
  if (Array.isArray(value)) {
    return value[0]
  }
  return value || undefined
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const language = resolveLanguageHeader(req)
    const skills = await getSkillManager().listSkills({ language })
    res.json({ code: 0, data: skills })
  }
  catch (error: any) {
    res.json({ code: 1, msg: error.message })
  }
})

router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { sourcePath } = req.body
    if (!sourcePath || typeof sourcePath !== 'string') {
      return res.json({ code: 1, msg: 'sourcePath is required', errorCode: 'invalid-source-type' })
    }

    const result = await getSkillManager().validateSkillSource(sourcePath)
    res.json({
      code: result.valid ? 0 : 1,
      msg: result.valid ? 'Skill 格式正确' : result.error,
      errorCode: result.valid ? undefined : result.errorCode,
      data: result.valid ? { name: result.name, description: result.description } : undefined,
    })
  }
  catch (error: any) {
    res.json({ code: 1, msg: error.message })
  }
})

router.post('/install', async (req: Request, res: Response) => {
  try {
    const { sourcePath } = req.body
    if (!sourcePath || typeof sourcePath !== 'string') {
      return res.json({ code: 1, msg: 'sourcePath is required' })
    }

    const entry = await getSkillManager().installSkill(sourcePath)
    res.json({ code: 0, msg: 'Skill 安装成功', data: entry })
  }
  catch (error: any) {
    res.json({ code: 1, msg: error.message })
  }
})

// ============ Skills Store (remote) ============

router.get('/store/categories', async (_req: Request, res: Response) => {
  try {
    const data = await aiAgentSkillsApi.listCategories()
    res.json({ code: 0, data })
  }
  catch (error: any) {
    res.json({ code: 1, msg: error.message })
  }
})

router.get('/store/skills', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined
    const data = await aiAgentSkillsApi.listSkills({ category })
    res.json({ code: 0, data })
  }
  catch (error: any) {
    res.json({ code: 1, msg: error.message })
  }
})

router.get('/store/skills/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params

  try {
    const data = await aiAgentSkillsApi.getSkill(slug as string)
    res.json({ code: 0, data })
  }
  catch (error: any) {
    res.json({ code: 1, msg: error.message })
  }
})

router.get('/store/user-skills', async (_req: Request, res: Response) => {
  try {
    const data = await aiAgentSkillsApi.listUserSkills()
    res.json({ code: 0, data })
  }
  catch (error: any) {
    res.json({ code: 1, msg: error.message })
  }
})

router.post('/store/install/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params

    const userSkill = await aiAgentSkillsApi.installSkill(slug as string)
    const entry = await getSkillManager().installFromRemote(slug as string)

    res.json({ code: 0, data: { userSkill, localEntry: entry } })
  }
  catch (error: any) {
    res.json({ code: 1, msg: error.message })
  }
})

router.delete('/store/user-skills/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params

    await aiAgentSkillsApi.removeInstalledSkill(slug as string)
    try {
      await getSkillManager().uninstallSkillBySlug(slug as string)
    }
    catch {
      // Ignore if not installed locally
    }

    res.json({ code: 0, data: null })
  }
  catch (error: any) {
    res.json({ code: 1, msg: error.message })
  }
})

router.post('/:slug/enable', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params
    await getSkillManager().setSkillEnabled(slug as string, true)
    res.json({ code: 0, msg: `Skill ${slug} 已启用` })
  }
  catch (error: any) {
    res.json({ code: 1, msg: error.message })
  }
})

router.post('/:slug/disable', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params
    await getSkillManager().setSkillEnabled(slug as string, false)
    res.json({ code: 0, msg: `Skill ${slug} 已禁用` })
  }
  catch (error: any) {
    res.json({ code: 1, msg: error.message })
  }
})

router.delete('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params
    if (!slug) {
      return res.json({ code: 1, msg: 'Skill 名称不能为空' })
    }
    await getSkillManager().uninstallSkill(slug as string)
    res.json({ code: 0, msg: 'Skill 已卸载' })
  }
  catch (error: any) {
    res.json({ code: 1, msg: error.message })
  }
})

export default router
