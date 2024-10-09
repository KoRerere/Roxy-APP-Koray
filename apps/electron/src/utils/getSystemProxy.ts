import { exec } from 'node:child_process'

/** 获取环境变量中的代理设置 */
function getProxyByEnv(): Promise<string> {
  return Promise.resolve(process.env.HTTP_PROXY || process.env.HTTPS_PROXY || '')
}

/** 获取 Windows 系统的代理设置 */
function getWindowsProxy() {
  const { promise, resolve, reject } = Promise.withResolvers<string>()
  exec('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer', (error, stdout) => {
    if (error) {
      console.error('获取代理设置时出错:', error)
      reject(error)
      return
    }

    const match = stdout.match(/ProxyServer\s+REG_SZ\s+(\S+)/)
    if (match) {
      console.log(`检测到代理服务器: ${match[1]}`)
      resolve(match[1])
    }
    else {
      console.log('没有检测到代理服务器')
      reject(new Error('未检测到代理设置'))
    }
  })

  return promise
}

/** 获取 macOS 系统的代理设置 */
function getMacProxy(): Promise<string> {
  const { promise, resolve, reject } = Promise.withResolvers<string>()
  exec('networksetup -getwebproxy Wi-Fi', (error, stdout) => {
    if (error) {
      console.error('获取代理设置时出错:', error)
      reject(error)
      return
    }

    console.log('macOS 代理设置:')
    console.log(stdout)

    const proxyEnabledMatch = stdout.match(/Enabled:\s*(\w+)/)
    const proxyServerMatch = stdout.match(/Server:\s*(\S+)/)
    const proxyPortMatch = stdout.match(/Port:\s*(\d+)/)

    if (proxyEnabledMatch && proxyEnabledMatch[1] === 'Yes' && proxyServerMatch && proxyPortMatch) {
      const proxy = `${proxyServerMatch[1]}:${proxyPortMatch[1]}`
      console.log(`检测到代理服务器: ${proxy}`)
      resolve(proxy)
    }
    else {
      console.log('没有检测到代理服务器')
      reject(new Error('未检测到代理设置'))
    }
  })
  return promise
}

/** 获取系统代理设置 */
export async function getSystemProxy() {
  let fn: () => Promise<string>
  if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
    fn = getProxyByEnv
  }
  else if (process.platform === 'win32') {
    fn = getWindowsProxy
  }
  else if (process.platform === 'darwin') {
    fn = getMacProxy
  }
  else {
    console.log('getSystemProxy 不支持的操作系统')
    throw new Error('不支持的操作系统')
  }
  try {
    return await fn()
  }
  catch (error) {
    console.error('获取代理设置时出错:', error)
    throw new Error(`未检测到代理设置`)
  }
}
