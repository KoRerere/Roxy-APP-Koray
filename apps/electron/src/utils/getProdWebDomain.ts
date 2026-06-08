import axios from 'axios'
import { store } from '/@/modules/store'

const webDomains: string[] = JSON.parse(import.meta.env.VITE_WEB_BASE_URL)
const defaultDomain = webDomains.find(domain => domain.includes('roxybrowser.cn')) || webDomains[0]

let lastWebDomain = ''

/** 并发测试多个域名，返回第一个可用的域名，如果都不可用，则返回 CN 的域名 */
export async function getProdWebDomain(force = false) {
  if (!force && lastWebDomain) {
    return lastWebDomain
  }

  if (store.lastSelectedNetworkNode !== 'auto' && store.lastSelectedNetworkNode?.site) {
    lastWebDomain = `https://${store.lastSelectedNetworkNode.site}`
    store.lastWebDomain = lastWebDomain
    return lastWebDomain
  }

  if (store.lastWebDomain) {
    try {
      const result = await axios.get(store.lastWebDomain, {
        proxy: false,
        timeout: 5000,
        validateStatus: status => status >= 200 && status < 300,
      })
      if (result.status === 200) {
        lastWebDomain = store.lastWebDomain
        return store.lastWebDomain
      }
      console.error(`${store.lastWebDomain} is not available`)
    }
    catch (error) {
      console.error(`${store.lastWebDomain} is not available`, error)
    }
  }

  const attempts = webDomains.map(async (domain) => {
    const result = await axios.get(domain, {
      proxy: false,
      timeout: 5000,
      validateStatus: status => status >= 200 && status < 300,
    })
    if (result.status === 200) {
      return domain
    }
    throw new Error(`${domain} is not available`)
  })
  try {
    const result = await Promise.any(attempts)
    console.log('getProdWebDomain result', result)
    lastWebDomain = result || defaultDomain
    store.lastWebDomain = lastWebDomain
    return lastWebDomain
  }
  catch (error) {
    console.error('getProdWebDomain error', error)
    lastWebDomain = defaultDomain
    store.lastWebDomain = lastWebDomain
    return lastWebDomain
  }
}
