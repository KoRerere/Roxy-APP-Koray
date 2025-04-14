import { session } from "electron"

const net = require('net')
const http = require('http')

async function testProxyConnection(proxyHostPort: string) {
  const [host, port] = proxyHostPort.includes(':') ?
    proxyHostPort.split(':') :
    [proxyHostPort, '80']

  const portNum = parseInt(port)

  // 测试SOCKS5
  try {
    const sock = net.createConnection(portNum, host)
    const isSocks5 = await new Promise((resolve) => {
      sock.on('connect', () => {
        sock.write(Buffer.from([0x05, 0x01, 0x00])) // SOCKS5握手
        sock.once('data', (data) => {
          resolve(data[0] === 0x05)
        })
        sock.setTimeout(2000, () => resolve(false))
      })
      sock.on('error', () => resolve(false))
    })
    sock.destroy()
    if (isSocks5) return 'socks5'
  } catch { }

  // 测试HTTPS CONNECT
  try {
    const req = http.request({
      host,
      port: portNum,
      method: 'CONNECT',
      path: 'www.google.com:443',
      timeout: 2000
    })

    const isHttps = await new Promise((resolve) => {
      req.on('response', (res) => {
        res.destroy()
        resolve(res.statusCode === 200)
      })
      req.on('error', () => resolve(false))
      req.end()
    })
    if (isHttps) return 'https'
  } catch { }

  // 默认返回http
  return 'http'
}

export async function getAccurateProxyType() {
  const proxyResult = await session.defaultSession.resolveProxy('https://www.google.com')
  const proxyConfig = proxyResult.split(';')[0].trim()

  if (proxyConfig === 'DIRECT') {
    return { type: 'direct', host: null, port: null }
  }

  const [proxyType, proxyHostPort] = proxyConfig.split(' ')
  const detectedType = await testProxyConnection(proxyHostPort)

  return {
    type: detectedType,
    host: proxyHostPort.split(':')[0],
    port: proxyHostPort.split(':')[1] || (detectedType === 'https' ? '443' : '80'),
    originalType: proxyType
  }
}