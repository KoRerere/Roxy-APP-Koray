interface ProxyObject {
  protocol: string | undefined
  host: string | undefined
  port: string | undefined
  proxyUserName: string | undefined
  proxyPassword: string | undefined
  refreshUrl: string | undefined
  remark: string | undefined
}

export function parseProxyUrl(url: string): ProxyObject {
  const [_, protocol, host, port, proxyUserName, proxyPassword] = url.match(/^\*?(?:(?<protocol>\w+):\/\/)?(?<host>[^:]+):(?<port>\d+)(?::(?<proxyUserName>[^:]*)(?::(?<proxyPassword>[^[{]*))?)?/) || []
  const refreshUrl = url.match(/\[(.*?)\]/)?.[1]
  const remark = url.match(/\{(.*?)\}/)?.[1]
  return {
    protocol,
    host,
    port,
    proxyUserName,
    proxyPassword,
    refreshUrl,
    remark,
  }
}
