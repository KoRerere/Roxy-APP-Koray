export const browserCreateMapping = {
  workspaceId: 1, // 团队id，int类型，必传
  windowName: '窗口1', // 窗口名称, str类型，非必传
  coreVersion: '117', // 内核版本，枚举值：117，109, str类型，非必传，默认125
  os: 'Windows', // 操作系统, 枚举值：Windows、macOS、Linux、IOS、Android, str类型，非必传，默认Windows
  osVersion: '11', // 操作系统版本, Windows的枚举值：11、10、8、7; macOS和Linux的枚举值：ALL，Android的枚举值：13,12,11,10,9；IOS的枚举值：17.0,16.6,16.5,16.4,16.3,16.2,16.1,16.0,15.7,15.6,15.5,15.4,15.3,15.2,15.1,15.0,14.7,14.6,14.5,14.4,14.3,14.2,14.1,14.0；str类型，非必传，默认11
  cookie: [], // cookie, List类型，非必传
  windowPlatformList: [{
    platformUrl: 'https://www.tiktok.com/', //  业务平台URL，str类型，非必传
    platformUserName: 'Roxytest', // 平台账号，str类型，非必传
    platformPassword: '12345655', // 平台密码，str类型，非必传
    platformEfa: '2F3CD67B6D', // efa，str类型，非必传
    platformName: 'Roxytest', // 平台名称，str类型，非必传
    platformRemarks: 'Roxytest', // 平台备注，str类型，非必传
  }],
  defaultOpenUrl: ['https://www.facebook.com'], // 存储浏览器标签页，List类型，非必传
  windowRemark: '窗口1', // 窗口备注, str类型，非必传
  projectId: 1, // 项目ID 必传
  proxyInfo: {
    proxyMethod: 'custom', // 代理方式，枚举值：自定义：custom，str类型, 非必传，默认为custom
    proxyCategory: 'noproxy', // 代理类型，枚举值：noproxy, HTTP, HTTPS, SOCKS5，str类型，非必传，默认为noproxy
    ipType: 'IPV4', // 网络协议, 枚举值：IPV4, IPV6，str类型，非必传，默认为IPV4
    host: '122.11.11.11', // 代理主机，str类型，非必传
    port: '37746', // 代理端口，str类型，非必传
    proxyUserName: 'lumitest', // 代理账号，str类型，非必传
    proxyPassword: 'lumitest', // 代理密码，str类型，非必传
    refreshUrl: 'http://refresh-hk.lumibrowser.com', // 刷新URL，str类型，非必传
  },
  fingerInfo: {
    isLanguageBaseIp: true, // 浏览器语言类型，跟随IP匹配：true，自定义：false，布尔类型，非必传, 默认true
    language: 'en-US', // 浏览器语言类型为自定义时指定的语言值，str类型，非必传，见附录-语言列表
    isDisplayLanguageBaseIp: true, // 界面语言类型，跟随IP匹配：true，自定义：false，布尔类型，非必传, 默认true
    displayLanguage: 'en-US', // 界面语言类型为自定义时指定的语言值，str类型，非必传，见附录-界面语言列表
    isTimeZone: true, // 时区类型，跟随IP匹配：true，自定义：false，布尔类型，非必传, 默认true
    timeZone: 'GMT-12:00 Etc/GMT+12', // 时区类型为自定义时指定的时区值, str类型，非必传，见附录-时区列表
    position: 0, // 地理位置提示类型，询问: 0，允许：1，禁用：2，int类型, 非必传, 默认1
    isPositionBaseIp: true, // 地理位置类型，跟随IP匹配：true，自定义：false，布尔类型，非必传, 默认true
    longitude: '376', // 经度值，isPositionBaseIp为false时设置, str类型, 非必传
    latitude: '165', // 纬度值， isPositionBaseIp为false时设置, str类型, 非必传
    precisionPos: '600', // 精度值(米)， isPositionBaseIp为false时设置, str类型, 非必传
    forbidAudio: true, // 网页是否打开声音，开启：true，关闭：false，布尔类型，非必传, 默认true
    forbidImage: true, // 网页是否加载图片，加载：true，禁止：false，布尔类型，非必传, 默认true
    forbidMedia: true, // 网页是否播放视频，允许：true，禁止：false，布尔类型，非必传, 默认true
    isDisplayName: false, // 窗口名是否在标题栏显示，显示：true，不显示：false，布尔类型，非必传, 默认false
    syncTab: true, // 是否同步标签页，true：是，false：否，布尔类型，非必传, 默认true
    syncCookie: true, // 是否同步Cookie，true：是，false：否， 布尔类型，非必传, 默认true
    forbidSavePassword: true, // 网页是否弹出保存密码提示，true：是，false：否，布尔类型，非必传, 默认false
    stopOpenNet: true, // 网络不通是否停止打开窗口，true：是，false：否，布尔类型，非必传, 默认false
    stopOpenIP: true, // 出口IP发生变化是否停止打开窗口，true：是，false：否，布尔类型，非必传, 默认false
    stopOpenPosition: true, // 出口IP对应国家/地区发生变化是否停止打开窗口，true：是，false：否，布尔类型，非必传, 默认false
    syncIndexedDb: false, // 是否同步IndexedDB，true：是，false：否，布尔类型，非必传, 默认false
    syncLocalStorage: false, // 是否同步Local Storage，true：是，false：否，布尔类型，非必传, 默认false
    syncBookmark: false, // 是否同步书签，true：是，false：否，布尔类型，非必传, 默认false
    syncPassword: true, // 是否同步已保存的用户名密码，true：是，false：否，布尔类型，非必传, 默认true
    syncHistory: false, // 是否同步历史记录，true：是，false：否，布尔类型，非必传, 默认false
    syncExtensions: false, // 是否同步扩展应用数据，true：是，false：否，布尔类型，非必传, 默认false
    clearCacheFile: true, // 启动浏览器前是否删除缓存文件，true：是，false：否，布尔类型，非必传, 默认false
    clearCookie: true, // 启动浏览器前是否删除Cookie，true：是，false：否，布尔类型，非必传, 默认false
    clearLocalStorage: true, // 启动浏览器前删除Local Storage，true：是，false：否，布尔类型，非必传, 默认false
    clearHistory: true, // 启动浏览器前删除历史记录，true：是，false：否，布尔类型，非必传, 默认false
    randomFingerprint: true, // 启动浏览时是否随机生成指纹，true：是，false：否，布尔类型，非必传, 默认false
    useGpu: true, // 使用硬件加速模式，true：是，false：否，布尔类型，非必传, 默认true
    sandboxPermission: false, // 禁用沙盒，true：是，false：否，布尔类型，非必传, 默认false
    webGLMeta: true, // webgl元数据 1自定义｜0关闭，默认1，布尔值，必传, 传true和false
    webGLValue: '', // 【页面不显示】，webGL为随机时设置，随机噪音值 10000 - 1000000，指纹会用到, 非必传
    startupParam: '', // 浏览器启动参数, str类型，非必传
    webRTC: 0, // webrtc 替换: 0，真实：1，禁止：2，int类型, 非必传, 默认2
    ignoreHttpsError: true, // 是否忽略https证书错误，true：是，false：否，布尔类型，非必传, 默认false
    openWidth: '1000', // 窗口尺寸，宽度, str类型，非必传，默认 1000
    openHeight: '1000', // 窗口尺寸，高度, str类型，非必传，默认 1000
    resolutionType: true, // 分辨率，true: 自定义, false: 真实，布尔类型，非必传, 默认false
    resolutionX: '', // 自定义分辨率时，分辨率宽度值, str类型，见附录-分辨率列表，非必传
    resolutionY: '', // 自定义分辨率时，分辨率高度值, str类型，见附录-分辨率列表，非必传
    fontType: false, // 字体指纹，随机：true，跟随系统：false，布尔类型，非必传, 默认false
    canvas: true, // canvas，随机：true，真实：false，布尔类型，非必传, 默认true
    webGL: true, // webGL图像， 随机：true，真实：false，布尔类型，非必传, 默认true
    webGLInfo: 1, // webGLInfo开关，自定义：2，随机：1，真实：0，int类型，非必传, 默认1
    webGLManufacturer: '', // webGLInfo为自定义时指定的webGL厂商值, str类型，非必传
    webGLRender: '', // webGLInfo为自定义时指定的webGL渲染值, str类型，非必传
    webGpu: 'webgl', // webGpu，基于webgl匹配：webgl，真实：real，禁用：block，str类型，非必传，默认值：webgl
    audioContext: true, // audioContext值，随机：true，真实：false，布尔类型，非必传, 默认true
    speechVoices: true, // Speech Voices，随机：true，真实：false，布尔类型，非必传, 默认true
    doNotTrack: true, // doNotTrack，true：开启，false：关闭，布尔类型，非必传, 默认true
    clientRects: true, // ClientRects，随机：true，真实：false，布尔类型，非必传, 默认true
    deviceInfo: true, // 媒体设备，随机：true，真实：false，布尔类型，非必传, 默认true
    deviceNameSwitch: true, // 设备名称，随机：true，真实：false，布尔类型，非必传, 默认true
    macInfo: true, // MAC地址，自定义：true，真实：false，布尔类型，非必传, 默认true
    portScanProtect: true, // 端口扫描保护, false: 关闭, true: 开启，布尔类型，非必传, 默认true
    portScanList: '', // 端口扫描保护开启时的白名单，英文逗号分隔，str类型，非必传
    disableSsl: true, // ssl指纹设置, true: 开启, false: 关闭, 布尔类型，非必传, 默认false
    disableSslList: [], // ssl特性值列表，List格式类型，非必传
    enablePlugin: false, // 自定义插件指纹，启用：true，停用：false,默认false
    enablePluginList: [], // 启动插件列表，List格式类型，非必传
    hardwareConcurrent: '4', // 硬件并发数, str类型，非必传
    deviceMemory: '8', // 设备内存, str类型，非必传
  },
}

/** 模板 content 对外结构与创建窗口一致，含窗口名/账号/cookie，不含项目/标签/备注 */
export const browserTemplateMapping = {
  windowName: browserCreateMapping.windowName,
  os: browserCreateMapping.os,
  osVersion: browserCreateMapping.osVersion,
  coreType: 'Chrome',
  coreVersion: browserCreateMapping.coreVersion,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  searchEngine: 'Google',
  cookie: browserCreateMapping.cookie,
  windowPlatformList: browserCreateMapping.windowPlatformList,
  defaultOpenUrl: browserCreateMapping.defaultOpenUrl,
  proxyInfo: {
    ...browserCreateMapping.proxyInfo,
    moduleId: 0,
    checkChannel: 'IPRust.io',
  },
  fingerInfo: {
    ...browserCreateMapping.fingerInfo,
    forbiddenPictureSize: 0,
    openBookmarks: false,
    positionSwitch: true,
    windowRatioPosition: '0,0,tl',
    openWorkbench: 1,
    syncSessionStorage: false,
    ipChangeRemind: 2,
    enableGoogleLogin: 2,
    openBattery: false,
    openCharging: false,
    chargingTime: '',
    dischargingTime: '',
    level: '',
    openNetwork: false,
    networkType: 'wifi',
    networkSpeed: '4g',
    downloadSpeed: '',
    maxDownloadSpeed: '',
    latency: '',
    saveFlowMode: false,
    openBluetooth: false,
    bluetoothAdapter: false,
    blockDomainList: '',
    allowDomainList: '',
  },
}
