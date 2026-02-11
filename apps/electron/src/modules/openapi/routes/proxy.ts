import type { ProxyDetectionParams } from '/@/utils'
import { format } from 'date-fns'
import express from 'express'
import { randomUUID } from 'node:crypto'
import { API } from '/@/api'
import { openAPICommonHeaders } from '/@/constants/common'
import { boughtProxyMapping, proxyMapping } from '/@/modules/openapi/routes/mapping/'
import { mappingKeys } from '/@/modules/openapi/routes/util'
import { delRoxynetProxy } from '/@/modules/roxynet'
import { proxyDetection } from '/@/utils'

const router = express.Router()

interface CheckResult {
  error?: any
  checkStatus: number
  lastIp?: string
  lastCity?: string
  lastCountry?: string
  checkTime?: string
  timezone?: string
}

async function detect(params: ProxyDetectionParams) {
  const checkResult: CheckResult = {
    checkStatus: 0, // 0 未检测 1 检测成功 2 检测失败
    lastIp: '',
    lastCity: '',
    lastCountry: '',
    timezone: '',
  }

  const dirId = randomUUID()
  try {
    const checkRes = await proxyDetection({ ...params, dirId })
    checkResult.checkStatus = !checkRes.ip ? 2 : 1
    checkResult.lastIp = checkRes.ip ?? ''
    checkResult.lastCity = checkRes.city ?? ''
    checkResult.lastCountry = checkRes.country_code ?? ''
    checkResult.timezone = checkRes.timezone ?? ''
  }
  catch (error) {
    checkResult.error = error
    checkResult.checkStatus = 2
  }
  finally {
    checkResult.checkTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss')
    delRoxynetProxy(dirId)
  }

  return checkResult
}

async function createProxy(params, workspaceId) {
  return API.proxy.userAddProxyModuleCreate(params, {
    headers: {
      workspaceId,
      ...openAPICommonHeaders,
    },
  })
}

async function modifyProxy(params, workspaceId) {
  return API.proxy.userMdfProxyModuleCreate(params, {
    headers: {
      workspaceId,
      ...openAPICommonHeaders,
    },
  })
}

/* 获取 IP 检测渠道 */
router.get('/detect_channel', async (req, res) => {
  const { workspaceId } = req.query as Record<string, any>
  try {
    const result = await API.base.userGetSystemDictV2Create({ type: ['checkChannel'] }, { headers: { workspaceId, ...openAPICommonHeaders } })
    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

/* 代理 IP 列表 */
router.get('/list', async (req, res) => {
  const { workspaceId, ...params } = req.query as Record<string, any>
  try {
    const result = await API.proxy.userGetProxyModuleList(params, { headers: { workspaceId, ...openAPICommonHeaders } })
    if (result.code === 0 && result.data?.rows) {
      result.data.rows = mappingKeys(proxyMapping, result.data.rows)
    }
    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

/* 已购代理 IP 列表 */
router.get('/bought_list', async (req, res) => {
  const { workspaceId, type, ...params } = req.query as Record<string, any>
  const _type = ['list_use', 'available_list'][type] || 'list_use'
  try {
    const result = await API.proxy.userGetUserBuyProxyListList({ ...params, type: _type }, { headers: { workspaceId, ...openAPICommonHeaders } })
    if (result.code === 0 && result.data?.rows) {
      result.data.rows = mappingKeys(boughtProxyMapping, result.data.rows)
    }
    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

/* 创建代理 IP */
router.post('/create', async (req, res) => {
  const { workspaceId, ...params } = req.body || {}
  try {
    const checkResult = await detect(params)
    const result = await createProxy([{ ...params, ...checkResult }], workspaceId)
    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

/* 批量创建代理 IP */
router.post('/batch_create', async (req, res) => {
  const { workspaceId, checkChannel, proxyList } = req.body || {}

  if (!Array.isArray(proxyList)) {
    return res.error('proxyList is required')
  }

  const list = proxyList.map(item => ({ ...item, checkStatus: 0, checkChannel: item.checkChannel || checkChannel }))

  try {
    const result = await createProxy(list, workspaceId)
    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

// 检测代理 IP
router.post('/detect', async (req, res) => {
  const { workspaceId, id } = req.body || {}
  try {
    const { code, data, msg } = await API.proxy.userGetProxyModuleList({ id }, { headers: { workspaceId, ...openAPICommonHeaders } })
    if (code !== 0)
      throw new Error(msg)
    const params = data.rows[0]! as unknown as ProxyDetectionParams
    const checkResult = await detect(params)
    if (checkResult.error) {
      res.error(checkResult.error)
    }
    else {
      const result = await modifyProxy([{ ...params, ...checkResult }], workspaceId)
      res.json({
        ...result,
        data: checkResult,
      })
    }
  }
  catch (error) {
    res.error(error)
  }
})

// 修改代理 IP
router.post('/modify', async (req, res) => {
  const { workspaceId, ...params } = req.body || {}
  try {
    const checkResult = await detect(params)
    const result = await modifyProxy([{ ...params, ...checkResult }], workspaceId)
    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

/* 删除代理 IP */
router.post('/delete', async (req, res) => {
  const { ids, workspaceId } = req.body

  if (!Array.isArray(ids)) {
    return res.error('ids is required')
  }

  try {
    const result = await API.proxy.userDelProxyModuleV2Create({ ids }, {
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
