import { session } from "electron"
import { promisify } from 'util'
import * as net from 'net'
import * as http from 'http'
import * as dns from 'dns'

// 定义代理类型接口
interface ProxyInfo {
  type: 'direct' | 'http' | 'https' | 'socks5' | 'socks4';
  host: string | null;
  port: string | null;
  originalType?: string;
}

// 定义超时设置
const CONNECTION_TIMEOUT = 2000;

// DNS查询优化
const dnsLookup = promisify(dns.lookup);

/**
 * 解析代理字符串为主机和端口
 */
function parseProxyHostPort(proxyHostPort: string): [string, number] {
  if (!proxyHostPort) {
    return ['', 80];
  }

  const [host, portStr] = proxyHostPort.includes(':') ?
    proxyHostPort.split(':') :
    [proxyHostPort, '80'];

  const port = parseInt(portStr, 10);
  return [host, isNaN(port) ? 80 : port];
}

/**
 * 测试 SOCKS5 连接
 */
async function testSocks5Connection(host: string, port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    try {
      // 创建客户端选项，增加超时设置
      const sock = net.createConnection({
        host,
        port,
        timeout: CONNECTION_TIMEOUT
      });

      // 处理连接成功
      sock.on('connect', () => {
        // SOCKS5握手数据包：版本5，1种认证方法，无认证(0x00)
        sock.write(Buffer.from([0x05, 0x01, 0x00]));

        // 设置数据接收处理
        sock.once('data', (data) => {
          sock.destroy();
          resolve(data.length > 0 && data[0] === 0x05);
        });
      });

      // 错误处理
      sock.on('error', () => {
        sock.destroy();
        resolve(false);
      });

      // 超时处理
      sock.setTimeout(CONNECTION_TIMEOUT, () => {
        sock.destroy();
        resolve(false);
      });
    } catch (err) {
      console.error('SOCKS5 连接测试失败:', err);
      resolve(false);
    }
  });
}

/**
 * 测试 HTTPS 代理连接
 */
async function testHttpsConnection(host: string, port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    try {
      const req = http.request({
        host,
        port,
        method: 'CONNECT',
        path: 'www.google.com:443',
        timeout: CONNECTION_TIMEOUT,
        headers: {
          'Host': 'www.google.com:443',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      // 连接成功
      req.on('connect', (_, socket) => {
        socket.destroy();
        resolve(true);
      });

      // 响应处理
      req.on('response', (res) => {
        res.destroy();
        // 检查状态码是否为 200 表示成功
        resolve(res.statusCode === 200);
      });

      // 错误处理
      req.on('error', () => {
        resolve(false);
      });

      // 发送请求
      req.end();
    } catch (err) {
      console.error('HTTPS 连接测试失败:', err);
      resolve(false);
    }
  });
}

/**
 * 测试 HTTP 代理连接
 */
async function testHttpConnection(host: string, port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    try {
      const req = http.request({
        host,
        port,
        method: 'GET',
        path: 'http://www.google.com/',
        timeout: CONNECTION_TIMEOUT,
        headers: {
          'Host': 'www.google.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      req.on('response', (res) => {
        res.destroy();
        resolve(true);
      });

      req.on('error', () => {
        resolve(false);
      });

      req.end();
    } catch {
      resolve(false);
    }
  });
}

/**
 * 测试代理连接并确定类型
 */
async function testProxyConnection(proxyHostPort: string): Promise<'socks5' | 'https' | 'http' | 'socks4'> {
  const [host, port] = parseProxyHostPort(proxyHostPort);

  // 测试主机名是否有效
  try {
    await dnsLookup(host);
  } catch (e) {
    console.warn(`无法解析代理主机名: ${host}`, e);
    return 'http'; // 默认值
  }

  // 并行测试所有代理类型以提高性能
  const [isSocks5, isHttps, isHttp] = await Promise.all([
    testSocks5Connection(host, port),
    testHttpsConnection(host, port),
    testHttpConnection(host, port)
  ]);

  // 按优先级返回类型
  if (isSocks5) return 'socks5';
  if (isHttps) return 'https';
  if (isHttp) return 'http';

  // 尝试 SOCKS4 检测 (简化)
  const isSocks4 = await new Promise<boolean>((resolve) => {
    try {
      const sock = net.createConnection({
        host,
        port,
        timeout: CONNECTION_TIMEOUT
      });

      sock.on('connect', () => {
        // SOCKS4 请求格式: VN(1), CD(1), DSTPORT(2), DSTIP(4), NULL(1)
        const buffer = Buffer.alloc(9);
        buffer[0] = 0x04; // SOCKS4
        buffer[1] = 0x01; // CONNECT
        sock.write(buffer);

        sock.once('data', (data) => {
          sock.destroy();
          resolve(data.length >= 2 && data[1] === 0x5A); // 成功响应
        });
      });

      sock.on('error', () => {
        sock.destroy();
        resolve(false);
      });

      sock.setTimeout(CONNECTION_TIMEOUT, () => {
        sock.destroy();
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });

  if (isSocks4) return 'socks4';

  // 默认
  return 'http';
}

/**
 * 获取准确的代理类型和详细信息
 */
export async function getAccurateProxyType(): Promise<ProxyInfo> {
  try {
    // 使用 Google 和备用域名进行测试
    const proxyResult = await session.defaultSession.resolveProxy('https://www.google.com');

    // 解析代理配置
    const proxyConfigs = proxyResult.split(';').map(config => config.trim())
      .filter(config => config && config !== 'DIRECT');

    // 没有代理配置时返回直连
    if (proxyConfigs.length === 0) {
      return { type: 'direct', host: null, port: null };
    }

    // 使用第一个非直连配置
    const proxyConfig = proxyConfigs[0];
    const [proxyType, proxyHostPort] = proxyConfig.split(/\s+/);

    if (!proxyHostPort) {
      return { type: 'direct', host: null, port: null };
    }

    // 检测实际类型
    const detectedType = await testProxyConnection(proxyHostPort);
    const [host, port] = parseProxyHostPort(proxyHostPort);

    // 返回详细信息
    return {
      type: detectedType,
      host,
      port: port.toString(),
      originalType: proxyType
    };
  } catch (error) {
    console.error('获取代理信息时出错:', error);
    return { type: 'direct', host: null, port: null };
  }
}

// 缓存代理检测结果
let cachedProxyInfo: ProxyInfo | null = null;
let cacheTime = 0;
const CACHE_DURATION = 60 * 1000; // 1分钟缓存

/**
 * 获取代理类型（带缓存）
 */
export async function getCachedProxyType(): Promise<ProxyInfo> {
  const now = Date.now();

  // 如果缓存存在且未过期，返回缓存结果
  if (cachedProxyInfo && (now - cacheTime) < CACHE_DURATION) {
    return cachedProxyInfo;
  }

  // 获取新结果并缓存
  const proxyInfo = await getAccurateProxyType();
  cachedProxyInfo = proxyInfo;
  cacheTime = now;

  return proxyInfo;
}