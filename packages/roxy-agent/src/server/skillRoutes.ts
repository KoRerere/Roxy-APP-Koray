import type { Request, Response } from 'express'
import { Router } from 'express'
import { getSkillManager } from '../skillManager'

const router: Router = Router()

router.get('/', async (_req: Request, res: Response) => {
  try {
    const skills = await getSkillManager().listSkills()
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

router.delete('/:name', async (req: Request, res: Response) => {
  try {
    const name = req.params.name as string
    await getSkillManager().uninstallSkill(name)
    res.json({ code: 0, msg: 'Skill 已卸载' })
  }
  catch (error: any) {
    res.json({ code: 1, msg: error.message })
  }
})

export default router
