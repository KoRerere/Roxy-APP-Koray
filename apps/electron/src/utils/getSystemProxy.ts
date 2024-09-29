import { exec } from 'node:child_process'

function getProxyByEnv() {
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy

  if (httpProxy || httpsProxy) {
    console.log('系统代理设置:')
    if (httpProxy) {
      console.log(`HTTP 代理: ${httpProxy}`)
      return httpProxy
    }
    if (httpsProxy) {
      console.log(`HTTPS 代理: ${httpsProxy}`)
      return httpsProxy
    }
  }
  else {
    console.log('环境变量中没有设置代理')
    throw new Error('未检测到代理设置')
  }
}

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

function getMacProxy() {
  const { promise, resolve, reject } = Promise.withResolvers<string>()
  exec('networksetup -getwebproxy Wi-Fi', (error, stdout) => {
    if (error) {
      console.error('获取代理设置时出错:', error)
      reject(error)
      return
    }

    console.log('macOS 代理设置:')
    console.log(stdout)
    resolve(stdout)
  })
  return promise
}

export async function getSystemProxy() {
  let fn
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
    console.log('不支持的操作系统')
  }
  try {
    return await fn()
  }
  catch (error) {
    console.error('获取代理设置时出错:', error)
    throw new Error(`未检测到代理设置`)
  }
}
