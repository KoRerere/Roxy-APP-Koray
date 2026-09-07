import express from 'express'
import { API } from '/@/api'

const router = express.Router()

const workspaceListFields = [
  'email',
  'id',
  'maxWindowCount',
  'role',
  'totalMemberCount',
  'totalWindowCount',
  'useMemberCount',
  'useWindowCount',
  'workspaceName',
  'workspaceNo',
] as const

function pickWorkspaceListFields(workspace: Record<string, any>) {
  return Object.fromEntries(
    workspaceListFields
      .filter(field => workspace[field] !== undefined)
      .map(field => [field, workspace[field]]),
  )
}

/** 获取当前登录用户可访问的全部工作空间（仅返回公开字段） */
router.get('/list', async (_req, res) => {
  try {
    const result = await API.limit.userGetWorkspaceListList()
    if (result.code === 0 && result.data?.rows) {
      result.data.rows = result.data.rows.map(item => pickWorkspaceListFields(item as Record<string, any>)) as typeof result.data.rows
    }
    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

export default router
