import express from 'express'
import { API } from '/@/api'
import { openAPICommonHeaders } from '/@/constants/common'
import { accountMapping } from '/@/modules/openapi/routes/mapping/'
import { mappingKeys } from '/@/modules/openapi/routes/util'

const router = express.Router()

/* 平台账号列表 */
router.get('/list', async (req, res) => {
  const { workspaceId, ...params } = req.query as Record<string, any>
  try {
    const result = await API.platform.userGetPlatformInfoV2List(params, { headers: { workspaceId, ...openAPICommonHeaders } })
    if (result.code === 0 && result.data?.rows) {
      result.data.rows = mappingKeys(accountMapping, result.data.rows)
    }
    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

/* 创建平台账号 */
router.post('/create', async (req, res) => {
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

// 修改平台账号
router.post('/mdf', async (req, res) => {
  const { workspaceId, ...params } = req.body || {}
  const result = await API.platform.userMdfPlatformInfoCreate(params, {
    headers: {
      workspaceId,
      ...openAPICommonHeaders,
    },
  })
  res.json(result)
})

/* 删除平台账号 */
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
