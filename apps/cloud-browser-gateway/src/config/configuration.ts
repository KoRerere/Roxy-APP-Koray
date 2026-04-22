import path from 'node:path'

/**
 * 读取必填环境变量，缺失时抛出明确错误
 */
function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`缺少必填环境变量：${key}`)
  }
  return value
}

/**
 * 读取必填的整数型环境变量，非法值时抛出错误
 */
function requireEnvInt(key: string): number {
  const raw = requireEnv(key)
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed)) {
    throw new TypeError(`环境变量 ${key} 必须是合法整数，当前值：${raw}`)
  }
  return parsed
}

/**
 * 读取可选的正整数环境变量，缺失时返回 undefined
 */
function readOptionalPositiveIntEnv(key: string): number | undefined {
  const raw = process.env[key]
  if (raw === undefined || raw.trim() === '') {
    return undefined
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new TypeError(`环境变量 ${key} 必须是正整数，当前值：${raw}`)
  }

  return parsed
}

/**
 * 读取可选的正数浮点环境变量，缺失时返回 undefined
 */
function readOptionalPositiveFloatEnv(key: string): number | undefined {
  const raw = process.env[key]
  if (raw === undefined || raw.trim() === '') {
    return undefined
  }

  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new TypeError(`环境变量 ${key} 必须是正数，当前值：${raw}`)
  }

  return parsed
}

/**
 * 读取可选的百分比环境变量，要求取值范围为 0-100
 */
function readOptionalPercentageEnv(key: string): number | undefined {
  const raw = process.env[key]
  if (raw === undefined || raw.trim() === '') {
    return undefined
  }

  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new TypeError(`环境变量 ${key} 必须在 0 到 100 之间，当前值：${raw}`)
  }

  return parsed
}

/**
 * 应用全局配置
 * 所有配置项（除 REDIS_PASSWORD 外）均为必填，从环境变量加载
 */
export default function configuration() {
  const dataDir = requireEnv('DATA_DIR')
  return {
    port: requireEnvInt('PORT'),
    nodeEnv: requireEnv('NODE_ENV'),

    redis: {
      host: requireEnv('REDIS_HOST'),
      port: requireEnvInt('REDIS_PORT'),
      password: process.env.REDIS_PASSWORD || undefined,
    },

    docker: {
      /** Docker socket 路径（Linux: /var/run/docker.sock，Windows: //./pipe/docker_engine） */
      socketPath: requireEnv('DOCKER_SOCKET'),
    },

    neko: {
      /** neko 容器镜像名称 */
      image: requireEnv('NEKO_IMAGE'),
      /** 容器共享内存大小（如 2g） */
      shmSize: requireEnv('CONTAINER_SHM_SIZE'),
      /** 桌面分辨率（如 1920x1080@30） */
      screen: requireEnv('CONTAINER_SCREEN'),
      /** 容器内浏览器用户数据路径，用于 Volume 挂载 */
      browserDataPath: requireEnv('NEKO_BROWSER_DATA_PATH'),
      /** 容器内浏览器可执行文件路径 */
      browserBinaryPath: process.env.NEKO_BROWSER_BINARY_PATH || '/opt/roxychrome/RoxyChrome',
      /** WebRTC 音频 Opus 码率（bps），默认 96kbps */
      audioBitrate: readOptionalPositiveIntEnv('NEKO_AUDIO_BITRATE') ?? 96000,
    },

    /** 宿主机上浏览器数据持久化的根目录 */
    dataDir,

    /** 端口池范围配置 */
    ports: {
      httpStart: requireEnvInt('HTTP_PORT_RANGE_START'),
      httpEnd: requireEnvInt('HTTP_PORT_RANGE_END'),
      udpStart: requireEnvInt('UDP_PORT_RANGE_START'),
      udpEnd: requireEnvInt('UDP_PORT_RANGE_END'),
    },

    webrtc: {
    /** 服务器公网 IP，写入 ICE candidate 供 WebRTC 直连 */
      nat1to1: requireEnv('WEBRTC_NAT1TO1'),
    },

    container: {
      /** 用户断连后等待多久再停止容器（毫秒），期间重连可取消停止 */
      stopGracePeriod: requireEnvInt('CONTAINER_STOP_GRACE_PERIOD'),
      /** 单容器 CPU 核数上限，缺失时不限制 */
      cpuLimit: readOptionalPositiveFloatEnv('CONTAINER_CPU_LIMIT'),
      /** 启动新容器前允许的宿主机 CPU 使用率上限（百分比） */
      startCpuUsageLimit: readOptionalPercentageEnv('CONTAINER_START_CPU_USAGE_LIMIT') ?? 85,
      /** 启动前 CPU 采样窗口（毫秒） */
      startCpuSampleIntervalMs: readOptionalPositiveIntEnv('CONTAINER_START_CPU_SAMPLE_INTERVAL_MS') ?? 500,
    },

    /** 后端 API 基础地址 */
    apiBaseUrl: requireEnv('API_BASE_URL'),

    /** 用户访问云浏览器的公开入口地址 */
    publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://${process.env.WEBRTC_NAT1TO1 || '192.168.0.5'}`,

    /** 扩展存储根目录（默认 DATA_DIR/extensions） */
    extensionBaseDir: process.env.EXTENSION_BASE_DIR || path.resolve(dataDir, 'extensions'),

    /** 自定义前端页面 */
    customFrontendPage: process.env.CUSTOM_FRONTEND_PAGE || '',

    /** 浏览器主题色（system / light / dark） */
    browserColorScheme: process.env.BROWSER_COLOR_SCHEME || 'system',
  }
}

export type Configuration = ReturnType<typeof configuration>
