/**
 * Skill 管理 API 路由
 *
 * GET    /api/skills                  — 获取已安装 skill 列表
 * POST   /api/skills/validate         — 校验路径是否符合 skill 规范（支持目录或 .zip）
 * POST   /api/skills/install          — 从本地目录或 .zip 安装 skill
 * DELETE /api/skills/:name            — 卸载 skill
 */

import type { Request, Response } from 'express'
import { Router } from 'express'
import { getSkillManager } from '../skillManager'

const router: Router = Router()

/**
 * GET /api/skills
 * 返回所有已安装的 skill 列表
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const skills = await getSkillManager().listSkills()
    res.json({ code: 0, data: skills })
  }
  catch (err: any) {
    res.json({ code: 1, msg: err.message })
  }
})

/**
 * POST /api/skills/validate
 * 校验本地路径（目录 或 .zip 文件）是否符合 skill 规范，安装前调用
 * Body: { sourcePath: string }
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { sourcePath } = req.body
    if (!sourcePath || typeof sourcePath !== 'string')
      return res.json({ code: 1, msg: 'sourcePath is required' })

    const result = await getSkillManager().validateSkillSource(sourcePath)
    res.json({
      code: result.valid ? 0 : 1,
      msg: result.valid ? 'Skill 格式正确' : result.error,
      data: result.valid ? { name: result.name, description: result.description, hasScripts: result.hasScripts } : undefined,
    })
  }
  catch (err: any) {
    res.json({ code: 1, msg: err.message })
  }
})

/**
 * POST /api/skills/install
 * 从本地目录或 .zip 文件安装 skill（先校验，通过后复制到 SKILLS_DIR）
 * Body: { sourcePath: string }
 */
router.post('/install', async (req: Request, res: Response) => {
  try {
    const { sourcePath } = req.body
    if (!sourcePath || typeof sourcePath !== 'string')
      return res.json({ code: 1, msg: 'sourcePath is required' })

    const entry = await getSkillManager().installSkill(sourcePath)
    res.json({ code: 0, msg: 'Skill 安装成功', data: entry })
  }
  catch (err: any) {
    res.json({ code: 1, msg: err.message })
  }
})

/**
 * DELETE /api/skills/:name
 * 卸载（删除）指定 skill
 */
router.delete('/:name', async (req: Request, res: Response) => {
  try {
    const name = req.params.name as string
    await getSkillManager().uninstallSkill(name)
    res.json({ code: 0, msg: 'Skill 已卸载' })
  }
  catch (err: any) {
    res.json({ code: 1, msg: err.message })
  }
})

export default router
