import type { ProxyDetectionParams } from '/@/utils'
import { format } from 'date-fns'
import express from 'express'
import { randomUUID } from 'node:crypto'
import pLimit from 'p-limit'
import { API } from '/@/api'
import { openAPICommonHeaders } from '/@/constants/common'
import { boughtProxyMapping, proxyMapping } from '/@/modules/openapi/routes/mapping/'
import { mappingKeys } from '/@/modules/openapi/routes/util'
import { delRoxynetProxy } from '/@/modules/roxynet'
import { proxyDetection } from '/@/utils'

const router = express.Router()
const proxyStorePriceLimit = pLimit(6)

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

function onlyTruthy<T extends Record<string, any>>(params: T) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

function normalizeProxyStoreQuery(query: Record<string, any>) {
  return {
    workspaceId: query.workspaceId,
    workspaceType: query.workspaceType,
    entryType: String(query.entryType ?? 0),
    quantity: Math.max(Number(query.quantity ?? 1), 1),
    vendorId: query.vendorId ? String(query.vendorId) : undefined,
    sceneId: query.sceneId ? String(query.sceneId) : undefined,
    countryCode: query.countryCode ? String(query.countryCode).toLowerCase() : undefined,
    includeJump: query.includeJump === 'true' || query.includeJump === true,
  }
}

function apiFailed(result: any) {
  return result.code !== 0
}

function proxyStoreApiRequest<T>(task: () => Promise<T>) {
  return proxyStorePriceLimit(task)
}

function money(value: number) {
  return Number(value.toFixed(6))
}

function discountCalculate(discounts: number[]) {
  return discounts.reduce((acc, discount) => {
    const safeDiscount = Number.isNaN(discount) ? 0 : discount
    return Math.abs(money((safeDiscount / 100 - 1) * acc))
  }, 1)
}

function getDiscountSummary(userPayInfo: any) {
  const proxyDiscount = Number(userPayInfo?.proxyDiscount ?? 0)
  return {
    proxyDiscount,
    discountRate: discountCalculate([proxyDiscount]),
  }
}

function applyProxyPriceDiscount(proxyPriceList: any[] = [], options: {
  quantity: number
  proxyDiscount: number
  discountRate: number
  isSpecialOffer?: boolean
}) {
  return proxyPriceList.map((price) => {
    const originalAmount = money(Number(price.proxyPrice ?? 0) * options.quantity)
    const finalAmount = options.isSpecialOffer
      ? originalAmount
      : money(originalAmount * options.discountRate)

    return {
      ...price,
      quantity: options.quantity,
      discountPercent: options.isSpecialOffer ? 0 : options.proxyDiscount,
      discountRate: options.isSpecialOffer ? 1 : options.discountRate,
      originalAmount,
      finalAmount,
      discountAmount: money(originalAmount - finalAmount),
      currency: 'USD',
    }
  })
}

function pickVendorInfo(vendor: any) {
  return {
    id: vendor.id,
    vendorName: vendor.vendorName,
    vendorWebsite: vendor.vendorWebsite,
    vendorIcon: vendor.vendorIcon,
    vendorDesc: vendor.vendorDesc,
    vendorAdv: vendor.vendorAdv,
    vendorDiscount: vendor.vendorDiscount,
    vendorDiscountTitle: vendor.vendorDiscountTitle,
    vendorDiscountDesc: vendor.vendorDiscountDesc,
    proxyTypeList: vendor.proxyTypeList,
    isJump: vendor.isJump,
    isNew: vendor.isNew,
    isOfficial: vendor.isOfficial,
    status: vendor.status,
  }
}

function buildPriceRows(vendor: any) {
  return vendor.businessScenes.flatMap((scene: any) => {
    return scene.countries.flatMap((country: any) => {
      return country.proxyTypes.map((proxyType: any) => ({
        vendorId: vendor.id,
        vendorName: vendor.vendorName,
        sceneId: scene.id,
        sceneKey: scene.sceneKey,
        sceneValue: scene.sceneValue,
        sceneDesc: scene.sceneDesc,
        countryCode: country.country_code,
        countryName: country.country_name,
        continent: country.continent,
        continentName: country.continent_name,
        proxyTypeId: proxyType.id,
        typeName: proxyType.typeName,
        proxyType: proxyType.proxyType,
        inventory: proxyType.inventory,
        canBandwidthUpgrade: proxyType.canBandwidthUpgrade,
        showDefaultSupport100M: proxyType.showDefaultSupport100M,
        proxyPriceList: proxyType.proxyPriceList,
        settlementPriceList: proxyType.settlementPriceList,
        defaultSettlement: proxyType.settlementPriceList?.[0],
        proxyBandwidthPriceList: proxyType.proxyBandwidthPriceList,
      }))
    })
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
router.get('/list_merged', async (req, res) => {
  const { workspaceId, ...params } = req.query as Record<string, any>
  try {
    const result = await API.proxy.userGetProxyListMergedList(params, { headers: { workspaceId, ...openAPICommonHeaders } })
    // if (result.code === 0 && result.data?.rows) {
    //   result.data.rows = mappingKeys(proxyMapping, result.data.rows)
    // }
    res.json(result)
  }
  catch (error) {
    res.error(error)
  }
})

/* 代理 IP 列表 */
router.get('/detail', async (req, res) => {
  const { workspaceId, ...params } = req.query as Record<string, any>
  try {
    const result = await API.proxy.userGetProxyDetailMergedList(params, { headers: { workspaceId, ...openAPICommonHeaders } })
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

/* 代理 IP 商店价格列表 */
router.get('/store_list', async (req, res) => {
  const { workspaceId, workspaceType, entryType, quantity, vendorId, sceneId, countryCode, includeJump } = normalizeProxyStoreQuery(req.query as Record<string, any>)

  try {
    const [vendorResult, payInfoResult] = await Promise.all([
      API.proxy.userGetProxyVendorListList(),
      API.pay.userGetUserPayInfoList({ headers: { workspaceId, ...openAPICommonHeaders } }),
    ])
    if (apiFailed(vendorResult)) {
      return res.json(vendorResult)
    }
    if (apiFailed(payInfoResult)) {
      return res.json(payInfoResult)
    }

    const discountSummary = getDiscountSummary(payInfoResult.data)

    const vendors = vendorResult.data
      .filter(vendor => includeJump || !vendor.isJump)
      .filter(vendor => !vendorId || String(vendor.id) === vendorId)

    const vendorRows = await Promise.all(vendors.map(async (vendor) => {
      const sceneResult = await proxyStoreApiRequest(() => API.proxy.userGetProxyBusinessSceneListList(onlyTruthy({
        vendorId: String(vendor.id),
        workspaceType,
      }), { headers: { workspaceId, ...openAPICommonHeaders } }))

      if (apiFailed(sceneResult)) {
        return {
          ...pickVendorInfo(vendor),
          error: sceneResult.msg,
          businessScenes: [],
        }
      }

      const scenes = sceneResult.data
        .filter(scene => !sceneId || String(scene.id) === sceneId)

      const businessScenes = await Promise.all(scenes.map(async (scene) => {
        const countryResult = await proxyStoreApiRequest(() => API.proxy.userGetProxyCountryListByBusinessSceneList(onlyTruthy({
          sceneId: String(scene.id),
          entryType,
        }), { headers: { workspaceId, ...openAPICommonHeaders } }))

        if (apiFailed(countryResult)) {
          return {
            ...scene,
            error: countryResult.msg,
            countries: [],
          }
        }

        const countries = countryResult.data
          .filter(country => !countryCode || country.country_code?.toLowerCase() === countryCode)

        const countryRows = await Promise.all(countries.map(async (country) => {
          const proxyTypeResult = await proxyStoreApiRequest(() => API.proxy.userGetProxyProvidersByBusinessSceneCountryList(onlyTruthy({
            sceneId: String(scene.id),
            countryCode: country.country_code,
            entryType,
            workspaceType,
          }), { headers: { workspaceId, ...openAPICommonHeaders } }))

          const isSpecialOffer = Boolean(scene.isSpecialOffer)

          return {
            ...country,
            proxyTypes: apiFailed(proxyTypeResult)
              ? []
              : proxyTypeResult.data.map((proxyType: any) => ({
                  ...proxyType,
                  settlementPriceList: applyProxyPriceDiscount(proxyType.proxyPriceList, {
                    quantity,
                    isSpecialOffer,
                    ...discountSummary,
                  }),
                })),
            error: apiFailed(proxyTypeResult) ? proxyTypeResult.msg : undefined,
          }
        }))

        return {
          ...scene,
          countries: countryRows,
        }
      }))

      return {
        ...pickVendorInfo(vendor),
        businessScenes,
      }
    }))

    const priceRows = vendorRows.flatMap(buildPriceRows)

    res.success({
      total: priceRows.length,
      quantity,
      userDiscount: {
        proxyDiscount: discountSummary.proxyDiscount,
        discountRate: discountSummary.discountRate,
        payInfo: {
          balance: payInfoResult.data.balance,
          subLevel: payInfoResult.data.subLevel,
          identity: payInfoResult.data.identity,
        },
      },
      vendors: vendorRows,
      priceRows,
    })
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
      const result = await modifyProxy({ proxyList: [{ ...params, ...checkResult }] }, workspaceId)
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
    const result = await modifyProxy({ proxyList: [{ ...params, ...checkResult }] }, workspaceId)
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
