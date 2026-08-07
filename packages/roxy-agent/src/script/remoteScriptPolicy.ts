const ALLOWED_REMOTE_SCRIPT_HOST = 'roxy-web.oss-cn-beijing.aliyuncs.com'

export function assertAllowedRemoteScriptUrl(rawUrl: string): void {
  let url: URL
  try {
    url = new URL(rawUrl)
  }
  catch {
    throw new Error(`Invalid script URL: ${rawUrl}`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error(`Unsupported script URL protocol: ${url.protocol}`)

  if (url.hostname !== ALLOWED_REMOTE_SCRIPT_HOST) {
    throw new Error(
      `Remote script host is not allowed: ${url.hostname}. Allowed host: ${ALLOWED_REMOTE_SCRIPT_HOST}`,
    )
  }
}
