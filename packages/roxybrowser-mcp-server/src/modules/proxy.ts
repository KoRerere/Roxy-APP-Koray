import { request } from '../utils'

/** 代理列表 */
export class ProxyList {
  name = 'roxy_list_proxies'
  // 仅当用户没有指定商店时调用
  description = 'Get list of proxy configurations. If you want to get the list of proxies configurations you\'ve bought, please use `roxy_store_proxies`.'
  inputSchema = {
    type: 'object',
    properties: {
      workspaceId: {
        type: 'number',
        description: 'Workspace ID (required)',
      },
      id: {
        type: 'number',
        description: 'Filter by proxy ID (optional)',
      },
      pageIndex: {
        type: 'number',
        description: 'Page index for pagination (default: 1)',
        default: 1,
      },
      pageSize: {
        type: 'number',
        description: 'Number of items per page (default: 15)',
        default: 15,
      },
    },
    required: ['workspaceId'],
  }

  get toolSchema() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
    }
  }

  async handle(params: any) {
    const searchParams = new URLSearchParams()
    searchParams.append('workspaceId', params.workspaceId)
    if (params.id)
      searchParams.append('id', params.id)
    if (params.page_index)
      searchParams.append('page_index', params.pageIndex)
    if (params.page_size)
      searchParams.append('page_size', params.pageSize)

    if (!params.workspaceId) {
      throw new Error('workspaceId is required')
    }

    const result = await request(`/proxy/list?${searchParams}`)
    let text = ''
    if (result.code === 0) {
      const data = result.data;
      const proxyListText = data.rows.length > 0
        ? data.rows.map((proxy: any, index: number) => {
            const statusText = proxy.checkStatus === 1 ? '✅ available' : proxy.checkStatus === 2 ? '❌ unavailable' : '⏳ not checked'
            const name = `proxy (id: ${proxy.id}) ` + (proxy.remark ? `remark: ${proxy.remark}` : '')

            const location = proxy.lastCountry
              ? `${proxy.lastCity || ''}${proxy.lastCity && proxy.lastCountry ? ', ' : ''}${proxy.lastCountry}`
              : null
            
            // 构建简洁的输出
            let baseInfo = `${index + 1}. ${statusText} **${name}**\nprotocol: ${proxy.protocol || 'N/A'}\nipType: ${proxy.ipType || 'N/A'}\nbind profile count: ${proxy.bindCount || 'N/A'}\nDetection channel: ${proxy.checkChannel || 'N/A'}`
            
            let ipInfo = [];
            if (proxy.host && proxy.port) {
              ipInfo.push(...[proxy.host, ':', proxy.port])
              if (proxy.proxyUserName && proxy.proxyPassword) {
                ipInfo.push(...['@', proxy.proxyUserName, ':', proxy.proxyPassword])
              }
            }
            
            if (location) {
              baseInfo += `\n${ipInfo.length > 0 ? ipInfo.join('') + '\n' : ''}\n📍 ${location}`
            }
            return baseInfo
          }).join('\n\n')
        : ''
      text = `📋 **proxy list** (total: ${data.total})\n\n${proxyListText}`
    } else {
      text = `❌ **get proxy list failed**\n\n${result.msg}`
    }

    return { content: [{ type: 'text', text }] }
  }
}

/** 代理商店 */
export class ProxyStore {
  name = 'roxy_store_proxies'
  description = 'Get list of proxy configurations in the Proxy Store'
  inputSchema = {
    type: 'object',
    properties: {
      workspaceId: {
        type: 'number',
        description: 'Workspace ID (required)',
      },
      pageIndex: {
        type: 'number',
        description: 'Page index for pagination (default: 1)',
        default: 1,
      },
      pageSize: {
        type: 'number',
        description: 'Number of items per page (default: 15)',
        default: 15,
      },
      type: {
        type: 'number',
        description: 'Type of proxies to get (0: list_use, 1: available_list)',
        default: 0,
      },
    },
    required: ['workspaceId'],
  }

  get toolSchema() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
    }
  }

  async handle(params: any) {
    const searchParams = new URLSearchParams()
    searchParams.append('workspaceId', params.workspaceId.toString())
    if (params.page_index)
      searchParams.append('page_index', params.page_index.toString())
    if (params.page_size)
      searchParams.append('page_size', params.page_size.toString())
    if (params.type)
      searchParams.append('type', params.type.toString())

    const result = await request(`/proxy/bought_list?${searchParams}`)
    let text = ''
    if (result.code === 0) {
      const data = result.data;
      const proxyListText = data.rows.length > 0
        ? data.rows.map((proxy: any, index: number) => {
            const statusText = proxy.checkStatus === 1 ? '✅ available' : proxy.checkStatus === 2 ? '❌ unavailable' : '⏳ not checked'
            const name = `proxy (id: ${proxy.id}) ` + (proxy.remark ? `remark: ${proxy.remark}` : '')

            const location = proxy.lastCountry
              ? `${proxy.lastCity || ''}${proxy.lastCity && proxy.lastCountry ? ', ' : ''}${proxy.lastCountry}`
              : null

            // 构建简洁的输出
            let baseInfo = `${index + 1}. ${statusText} **${name}**\nprotocol: ${proxy.protocol || 'N/A'}\nipType: ${proxy.ipType || 'N/A'}\nbind profile count: ${proxy.bindCount || 'N/A'}\nDetection channel: ${proxy.checkChannel || 'N/A'}\nexpire date: ${proxy.expireDate}`

            let ipInfo = [proxy.host, ':', proxy.port];
            if (proxy.proxyUserName) {
              ipInfo.push(...[proxy.proxyUserName, '@', proxy.proxyPassword])
            }
            if (location) {
              baseInfo += `\n${ipInfo.join('')}\n📍 ${location}`
            }
            return baseInfo
          }).join('\n\n')
        : ''
      text = `📋 **proxy store** (total: ${data.total})\n\n${proxyListText}`
    } else {
      text = `❌ **get proxy store failed**\n\n${result.msg}`
    }

    return { content: [{ type: 'text', text }] }
  }
}

export const proxyList = new ProxyList()
export const proxyStore = new ProxyStore()
