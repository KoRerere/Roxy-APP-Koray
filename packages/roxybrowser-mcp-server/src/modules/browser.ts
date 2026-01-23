import { request } from '../utils'
import { proxyList, proxyStore } from './proxy'
class CreateBrowser {
  name = 'roxy_create_browser'
  description = 'Create a browser with complete configuration control - for expert users needing full parameter access'
  inputSchema = {
    type: 'object',
    properties: {
      workspaceId: {
        type: 'number',
        description: 'Workspace ID (required)',
      },
      windowName: {
        type: 'string',
        description: 'Browser window name (optional)',
      },
      coreVersion: {
        type: 'string',
        enum: ['143', '142', '141', '140', '138', '137', '136', '135', '133', '130', '125', '117', '109'],
        description: 'Browser core version (optional, default: 143)',
      },
      os: {
        type: 'string',
        enum: ['Windows', 'macOS', 'Linux', 'IOS', 'Android'],
        description: 'Operating system (optional, default: Windows)',
      },
      osVersion: {
        type: 'string',
        description: `Windows: 11,10,8,7; macOS: 15.3.2,15.3.1,15.3,15.2,15.1,15.0.1,15.0,14.7.4,14.7.3,14.7.2,14.7.1,14.7,14.6.1,14.6,14.5,14.4.1,14.4,14.3.1,14.3,14.2.1,14.2,14.1,13.7.4,13.7.3,13.7.2,13.7.1,13.7; Linux: ALL; Android: 14,13,12,11,10,9; IOS: 18.2,18.1,18.0,17.0,16.6,16.5,16.4,16.3,16.2,16.1,16.0,15.7,15.6,15.5,15.4,15.3,15.2,15.1,15.0,14.7,14.6,14.5,14.4,14.3,14.2,14.1,14.0 (optional)`,
      },
      userAgent: {
        type: 'string',
        description: 'Custom user agent (optional)',
      },
      cookie: {
        type: 'array',
        description: 'Cookie list (optional)',
      },
      searchEngine: {
        type: 'string',
        enum: ['Google', 'Microsoft Bing', 'Yahoo', 'Yandex', 'DuckDuckGo'],
        description: 'Default search engine (optional)',
      },
      labelIds: {
        type: 'array',
        items: { type: 'number' },
        description: 'Label IDs to assign (optional)',
      },
      defaultOpenUrl: {
        type: 'array',
        items: { type: 'string' },
        description: 'URLs to open by default (optional)',
      },
      windowRemark: {
        type: 'string',
        description: 'Window remarks/notes (optional)',
      },
      projectId: {
        type: 'number',
        description: 'Project ID (optional)',
      },
      windowPlatformList: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            // 平台账号id，非必传，通过平台账号列表接口【roxy_list_accounts】获取，可以判定已在平台账号列表中的账号，有该参数时其他参数不需要传。
            id: { type: 'number', description: 'Platform account ID, which can be obtained from [roxy_list_accounts] (field: id). Used to bind an account that already exists in the platform account list. If this parameter is provided, other parameters do not need to be passed.' },
            platformUrl: { type: 'string', description: 'Platform URL' },
            platformUserName: { type: 'string', description: 'Platform username' },
            platformPassword: { type: 'string', description: 'Platform password' },
            platformEfa: { type: 'string', description: 'Platform EFA' },
            platformRemarks: { type: 'string', description: 'Platform remarks' },
          },
        },
        description: 'Platform account information (optional)',
      },
      proxyInfo: {
        type: 'object',
        description: 'Complete proxy configuration object (optional)',
        properties: {
          // 如果有 moduleId ，则其他参数不可传递 (moduleId 可通过 roxy_list_proxies 或 roxy_store_proxies 获取) 优先使用该参数来绑定代理IP
          moduleId: { type: 'number', description: `If moduleId is provided, no other parameters may be passed. (moduleId can be obtained via ${proxyList.name} or ${proxyStore.name}. field: id) Priority to use this parameter to bind proxy IP` },
          proxyMethod: { type: 'string', enum: ['custom', 'choose', 'api'] },
          proxyCategory: { type: 'string', enum: ['noproxy', 'HTTP', 'HTTPS', 'SOCKS5', 'SSH'] },
          ipType: { type: 'string', enum: ['IPV4', 'IPV6'] },
          protocol: { type: 'string', enum: ['HTTP', 'HTTPS', 'SOCKS5'] },
          host: { type: 'string' },
          port: { type: 'string' },
          proxyUserName: { type: 'string' },
          proxyPassword: { type: 'string' },
          refreshUrl: { type: 'string' },
          checkChannel: { type: 'string', enum: ['IPRust.io', 'IP-API', 'IP123.in'] },
        },
      },
      fingerInfo: {
        type: 'object',
        description: 'Complete fingerprint configuration (optional)',
        properties: {
          // Language and timezone
          isLanguageBaseIp: { type: 'boolean', description: 'Follow IP for browser language' },
          language: { type: 'string', description: 'Custom browser language' },
          isDisplayLanguageBaseIp: { type: 'boolean', description: 'Follow IP for display language' },
          displayLanguage: { type: 'string', description: 'Custom display language' },
          isTimeZone: { type: 'boolean', description: 'Follow IP for timezone' },
          timeZone: { type: 'string', description: 'Custom timezone' },

          // Geolocation
          position: { type: 'number', enum: [0, 1, 2], description: 'Geolocation prompt: 0=ask, 1=allow, 2=deny' },
          isPositionBaseIp: { type: 'boolean', description: 'Follow IP for geolocation' },
          longitude: { type: 'string', description: 'Custom longitude' },
          latitude: { type: 'string', description: 'Custom latitude' },
          precisionPos: { type: 'string', description: 'Precision in meters' },

          // Media settings
          forbidAudio: { type: 'boolean', description: 'Enable/disable sound' },
          forbidImage: { type: 'boolean', description: 'Enable/disable image loading' },
          forbidMedia: { type: 'boolean', description: 'Enable/disable video playback' },

          // Window settings
          openWidth: { type: 'string', description: 'Window width' },
          openHeight: { type: 'string', description: 'Window height' },
          openBookmarks: { type: 'boolean', description: 'Enable bookmarks' },
          positionSwitch: { type: 'boolean', description: 'Window position switch' },
          windowRatioPosition: { type: 'string', description: 'Window position ratio' },
          isDisplayName: { type: 'boolean', description: 'Show window name in title bar' },

          // Sync settings
          syncBookmark: { type: 'boolean', description: 'Sync bookmarks' },
          syncHistory: { type: 'boolean', description: 'Sync history' },
          syncTab: { type: 'boolean', description: 'Sync tabs' },
          syncCookie: { type: 'boolean', description: 'Sync cookies' },
          syncExtensions: { type: 'boolean', description: 'Sync extensions' },
          syncPassword: { type: 'boolean', description: 'Sync saved passwords' },
          syncIndexedDb: { type: 'boolean', description: 'Sync IndexedDB' },
          syncLocalStorage: { type: 'boolean', description: 'Sync LocalStorage' },

          // Cleanup settings
          clearCacheFile: { type: 'boolean', description: 'Clear cache files on startup' },
          clearCookie: { type: 'boolean', description: 'Clear cookies on startup' },
          clearLocalStorage: { type: 'boolean', description: 'Clear LocalStorage on startup' },

          // Advanced settings
          randomFingerprint: { type: 'boolean', description: 'Generate random fingerprint' },
          forbidSavePassword: { type: 'boolean', description: 'Disable password save prompts' },
          stopOpenNet: { type: 'boolean', description: 'Stop opening if network fails' },
          stopOpenIP: { type: 'boolean', description: 'Stop opening if IP changes' },
          stopOpenPosition: { type: 'boolean', description: 'Stop opening if IP location changes' },
          openWorkbench: { type: 'number', enum: [0, 1, 2], description: 'Open workbench: 0=close, 1=open, 2=follow app' },

          // Display settings
          resolutionType: { type: 'boolean', description: 'Custom resolution vs follow system' },
          resolutionX: { type: 'string', description: 'Custom resolution width' },
          resolutionY: { type: 'string', description: 'Custom resolution height' },
          fontType: { type: 'boolean', description: 'Random fonts vs system fonts' },

          // Browser fingerprint settings
          webRTC: { type: 'number', enum: [0, 1, 2], description: 'WebRTC: 0=replace, 1=real, 2=disable' },
          webGL: { type: 'boolean', description: 'WebGL: random vs real' },
          webGLInfo: { type: 'boolean', description: 'WebGL info: custom vs real' },
          webGLManufacturer: { type: 'string', description: 'Custom WebGL manufacturer' },
          webGLRender: { type: 'string', description: 'Custom WebGL renderer' },
          webGpu: { type: 'string', enum: ['webgl', 'real', 'block'], description: 'WebGPU setting' },
          canvas: { type: 'boolean', description: 'Canvas: random vs real' },
          audioContext: { type: 'boolean', description: 'AudioContext: random vs real' },
          speechVoices: { type: 'boolean', description: 'Speech Voices: random vs real' },
          doNotTrack: { type: 'boolean', description: 'Enable Do Not Track' },
          clientRects: { type: 'boolean', description: 'ClientRects: random vs real' },
          deviceInfo: { type: 'boolean', description: 'Media devices: random vs real' },
          deviceNameSwitch: { type: 'boolean', description: 'Device names: random vs real' },
          macInfo: { type: 'boolean', description: 'MAC address: custom vs real' },

          // Hardware settings
          hardwareConcurrent: { type: 'string', description: 'Hardware concurrency' },
          deviceMemory: { type: 'string', description: 'Device memory' },

          // Security settings
          disableSsl: { type: 'boolean', description: 'SSL fingerprint settings' },
          disableSslList: { type: 'array', items: { type: 'string' }, description: 'SSL feature list' },
          portScanProtect: { type: 'boolean', description: 'Port scan protection' },
          portScanList: { type: 'string', description: 'Port scan whitelist' },
          useGpu: { type: 'boolean', description: 'Use GPU acceleration' },
          sandboxPermission: { type: 'boolean', description: 'Disable sandbox' },
          startupParam: { type: 'string', description: 'Browser startup parameters (--headless=new startup headless)' },
        },
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
    const result = await request('/browser/create', {
      method: 'POST',
      body: JSON.stringify(params),
    })

    const data = result.data

    let text = ''
    if (result.code !== 0) {
      text = `❌ **Failed to create browser:**\n\n error message: ${result.msg}`
    }
    else {
      text = `✅ **Simple Browser Created**\n\n`
        + `**Browser ID:** \`${data.dirId}\`\n`
        + `*Use this browser ID with \`roxy_open_browser\` to start the browser and get CDP endpoints for automation.*`
    }

    return {
      content: [
        {
          type: 'text',
          text,
        },
      ],
    }
  }
}

export const createBrowser = new CreateBrowser()

class UpdateBrowser {
  name = 'roxy_update_browser'
  description = 'Update a browser with complete configuration control - for expert users needing full parameter access'
  inputSchema = {
    type: 'object',
    properties: {
      ...createBrowser.inputSchema.properties,
    },
    required: ['workspaceId', 'dirId'],
  }

  get toolSchema() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
    }
  }

  async handle(params: any) {
    const result = await request('/browser/mdf', {
      method: 'POST',
      body: JSON.stringify(params),
    })

    let text = ''
    if (result.code !== 0) {
      text = `❌ **Failed to update browser:**\n\n error message: ${result.msg}`
    }
    else {
      text = '✅ **Browser Updated Successfully**'
    }

    return {
      content: [
        {
          type: 'text',
          text,
        },
      ],
    }
  }
}

class OpenBrowser {
  name = 'roxy_open_browser'
  description = 'Open a browser and return its CDP WebSocket endpoint for automation'

  inputSchema = {
    type: 'object',
    properties: {
      workspaceId: {
        type: 'number',
        description: 'Workspace ID (required)',
      },
      dirId: {
        type: 'string',
        description: 'Browser directory ID to open (required)',
      },
      forceOpen: {
        type: 'boolean',
        // 即使浏览器已被其他用户打开，还是强制打开
        description: 'Force open browser even if it is already opened by other users (default: true)',
        default: true,
      },
      args: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional browser startup arguments (--headless=new startup headless)',
      },
    },
    required: ['workspaceId', 'dirId'],
  }

  get toolSchema() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
    }
  }

  async handle(params: any) {
    const result = await request('/browser/open', {
      method: 'POST',
      body: JSON.stringify(params),
    })

    const data = result.data

    let text = ''
    if (result.code !== 0) {
      text = `❌ **Failed to open browser:**\n\n error message: ${result.msg}`
    }
    else {
      text = `✅ **Successfully opened browser:**
          **Browser ${data.dirId || 'Unknown'}** (PID:${data.pid})
          - CDP WebSocket: \`${data.ws}\`
          - HTTP Endpoint: \`${data.http}\`
          - Core Version: ${data.coreVersion}`
    }

    return {
      content: [
        {
          type: 'text',
          text,
        },
      ],
    }
  }
}

export const openBrowser = new OpenBrowser()
export const updateBrowser = new UpdateBrowser()
