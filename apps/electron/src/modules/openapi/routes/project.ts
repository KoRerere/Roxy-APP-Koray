import type { UserGetProjectInfoByWorkspaceListParams } from '@roxy/backend-api'
import express from 'express'
import { API } from '/@/api'
import { openAPICommonHeaders } from '/@/constants/common'

const router = express.Router()

const defaultProjectListParams = {
  page_index: 1,
  page_size: 10,
  default: 2,
} satisfies UserGetProjectInfoByWorkspaceListParams

/** 获取项目列表 */
router.get('/list', async (req, res) => {
  const { workspaceId, ...params } = req.query as Record<string, any>

  try {
    const result = await API.limit.userGetProjectInfoByWorkspaceList({
      ...defaultProjectListParams,
      ...params,
    }, { headers: { workspaceId, ...openAPICommonHeaders } })

    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

export default router
