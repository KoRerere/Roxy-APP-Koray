import express from 'express'
import { API } from '/@/api'
import { openAPICommonHeaders } from '/@/constants/common'
import { teamMapping } from '/@/modules/openapi/routes/mapping/'
import { mappingKeys } from '/@/modules/openapi/routes/util'

const router = express.Router()

/* 团队成员列表 */
router.get('/list', async (req, res) => {
  const { workspaceId, ...params } = req.query as Record<string, any>
  try {
    const result = await API.team.userGetMemberInfoByWorkspaceList(params, { headers: { workspaceId, ...openAPICommonHeaders } })
    if (result.code === 0 && result.data?.rows) {
      result.data.rows = mappingKeys(teamMapping, result.data.rows)
    }
    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

/* 邀请团队成员 */
router.post('/invite', async (req, res) => {
  const { workspaceId, ...params } = req.body || {}
  try {
    const result = await API.platform.userAddPlatformInfoCreate(params, {
      headers: {
        workspaceId,
        ...openAPICommonHeaders,
      },
    })

    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

/* 批量邀请团队成员 */
router.post('/batch_invite', async (req, res) => {
  const { workspaceId, platformList } = req.body || {}

  if (!Array.isArray(platformList)) {
    return res.error('platformList is required')
  }

  try {
    const result = await API.platform.userAddPlatformInfoBatchCreate(platformList, {
      headers: {
        workspaceId,
        ...openAPICommonHeaders,
      },
    })

    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

// 修改团队成员
router.post('/modify', async (req, res) => {
  const { workspaceId, ...params } = req.body || {}
  const result = await API.platform.userMdfPlatformInfoCreate(params, {
    headers: {
      workspaceId,
      ...openAPICommonHeaders,
    },
  })
  res.json(result)
})

/* 删除团队成员 */
router.post('/delete', async (req, res) => {
  const { ids, workspaceId } = req.body

  if (!Array.isArray(ids)) {
    return res.error('ids is required')
  }

  try {
    const result = await API.platform.userDelPlatformInfoCreate({ ids }, {
      headers: {
        workspaceId,
        ...openAPICommonHeaders,
      },
    })
    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

export default router
