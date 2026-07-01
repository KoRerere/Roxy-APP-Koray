export const browserListMapping = {
  dirId: 'dc1e73d4dd954a', // 浏览器窗口id, str类型
  windowSortNum: 99, // 窗口序号, int类型
  windowName: '窗口1', // 窗口名称, str类型
  coreVersion: '117', // 内核版本，枚举值：117，109, str类型
  os: 'Windows', // 操作系统, 枚举值：Windows、macOS、Linux, str类型
  osVersion: '11', // 操作系统版本, 枚举值：Windows的枚举值：11、10、8、7; macOS和Linux的枚举值：ALL，str类型
  userAgent: 'Mozilla/5.0 (Windows NT 10.0)', // User Agent, str类型
  cookie: [
    {
      name: '1',
      value: '2',
      domain: '3',
    },
  ], // cookie, List类型
  searchEngine: 'Google',
  windowPlatformList: [{
    platformUrl: 'https://www.tiktok.com/', // 业务平台URL，str类型
    platformUserName: 'Roxytest', // 平台账号，str类型
    platformPassword: 'Roxytest', // 平台密码，str类型
    platformEfa: '2F3CD67B6D', // efa，str类型
    platformName: 'Roxytest', // 平台名称，str类型
    platformRemarks: 'Roxytest', // 平台备注，str类型
  }],
  defaultOpenUrl: ['https://www.facebook.com'], // 存储浏览器标签页，List类型
  windowRemark: '窗口1', // 窗口备注, str类型
  projectId: 1, // 项目ID, int类型
  openStatus: false, // 团队内是否已打开, 枚举值：true: 已打开，false: 未打开，布尔类型
  statusInfo: [
    {
      openUserName: 'test', // 打开人用户名，str类型
      openTime: '2024-01-09 12:12:12', // 打开时间，str类型
    },
    {
      openUserName: 'lumitest',
      openTime: '2024-01-10 12:12:12',
    },
  ], // 窗口打开时的详细信息，List类型
  createTime: '2023-12-04 21:55:58', // 窗口创建时间, str类型
  updateTime: '2023-12-04 21:56:01', // 窗口修改时间, str类型
  userName: 'lumitest', // 窗口归属人用户名,即用户账号, str类型
  proxyInfo: {
    proxyMethod: 'custom', // 代理方式，枚举值：手动填写：custom，选择代理资源：choose，API接入：api，str类型
    proxyCategory: 'noproxy', // 代理类型，枚举值：noproxy, HTTP, HTTPS, SOCKS5，str类型
    ipType: 'IPV4', // 网络协议, 枚举值：IPV4, IPV6，str类型
    protocol: 'SOCKS5', // 代理协议，枚举值：HTTP, HTTPS, SOCKS5，str类型
    host: '122.11.11.11', // 代理主机，str类型
    port: '37746', // 代理端口，str类型
    proxyUserName: 'lumitest', // 代理账号，str类型
    proxyPassword: 'lumitest', // 代理密码，str类型
    refreshUrl: 'http://refresh-hk.roxybrowser.com', // 刷新URL，str类型
    lastIp: '119.1.2.3', // 出口IP，str类型
    lastCountry: 'CN', // 出口国家，str类型
  },
  fingerInfo: {
    isLanguageBaseIp: true, // 浏览器语言类型，跟随IP匹配：true，自定义：false，布尔类型
    language: 'en-US', // 浏览器语言类型为自定义时指定的语言值，str类型，见附录-语言列表
    isDisplayLanguageBaseIp: true, // 界面语言类型，跟随IP匹配：true，自定义：false，布尔类型
    displayLanguage: 'en-US', // 界面语言类型为自定义时指定的语言值，str类型，见附录-界面语言列表
    isTimeZone: true, // 时区类型，跟随IP匹配：true，自定义：false，布尔类型
    timeZone: 'GMT-12:00 Etc/GMT+12', // 时区类型为自定义时指定的时区值, str类型，见附录-时区列表
    position: 0, // 地理位置提示类型，询问: 0，允许：1，禁用：2，int类型
    isPositionBaseIp: true, // 地理位置类型，跟随IP匹配：true，自定义：false，布尔类型
    longitude: '376', // 经度值，isPositionBaseIp为false时设置的值, str类型
    latitude: '165', // 纬度值， isPositionBaseIp为false时设置的值, str类型
    precisionPos: '600', // 精度值(米)， isPositionBaseIp为false时设置的值, str类型
    forbidAudio: true, // 网页是否打开声音，开启：true，关闭：false，布尔类型
    forbidImage: true, // 网页是否加载图片，加载：true，禁止：false，布尔类型
    forbidMedia: true, // 网页是否播放视频，允许：true，禁止：false，布尔类型
    isDisplayName: false, // 窗口名是否在标题栏显示，显示：true，不显示：false，布尔类型，非必传, 默认false
    syncTab: true, // 是否同步标签页，true：是，false：否，布尔类型
    syncCookie: true, // 是否同步Cookie，true：是，false：否， 布尔类型
    forbidSavePassword: true, // 网页是否弹出保存密码提示，true：是，false：否，布尔类型
    stopOpenNet: true, // 网络不通是否停止打开窗口，true：是，false：否，布尔类型
    stopOpenIP: true, // 出口IP发生变化是否停止打开窗口，true：是，false：否，布尔类型
    stopOpenPosition: true, // 出口IP对应国家/地区发生变化是否停止打开窗口，true：是，false：否，布尔类型
    syncIndexedDb: true, // 是否同步IndexedDB，true：是，false：否，布尔类型
    syncLocalStorage: true, // 是否同步Local Storage，true：是，false：否，布尔类型
    syncBookmark: true, // 是否同步书签，true：是，false：否，布尔类型
    syncPassword: true, // 是否同步已保存的用户名密码，true：是，false：否，布尔类型
    syncHistory: true, // 是否同步历史记录，true：是，false：否，布尔类型
    syncExtensions: true, // 是否同步扩展应用数据，true：是，false：否，布尔类型
    clearCacheFile: true, // 启动浏览器前是否删除缓存文件，true：是，false：否，布尔类型
    clearCookie: true, // 启动浏览器前是否删除Cookie，true：是，false：否，布尔类型
    clearLocalStorage: true, // 启动浏览器前删除Local Storage，true：是，false：否，布尔类型
    clearHistory: true, // 启动浏览器前删除历史记录，true：是，false：否，布尔类型
    randomFingerprint: true, // 启动浏览时是否随机生成指纹，true：是，false：否，布尔类型
    useGpu: true, // 使用硬件加速模式，true：是，false：否，布尔类型
    sandboxPermission: false, // 禁用沙盒，true：是，false：否，布尔类型
    startupParam: '', // 浏览器启动参数, str类型
    webRTC: 0, // webrtc 替换: 0，真实：1，禁止：2，int类型
    ignoreHttpsError: true, // 是否忽略https证书错误，true：是，false：否，布尔类型
    openWidth: '1280', // 窗口尺寸，宽度, str类型
    openHeight: '720', // 窗口尺寸，高度, str类型
    resolutionType: true, // 分辨率，true: 自定义, false: 真实，布尔类型
    resolutionX: '', // 自定义分辨率时，分辨率宽度值, str类型，见附录-分辨率列表
    resolutionY: '', // 自定义分辨率时，分辨率高度值, str类型，见附录-分辨率列表
    fontType: true, // 字体指纹，随机：true，跟随系统：false，布尔类型
    canvas: true, // canvas，随机：true，真实：false，布尔类型
    webGL: true, // webGL图像， 随机：true，真实：false，布尔类型
    webGLInfo: 1, // webGLInfo开关，自定义：2，随机：1，真实：0，int类型，非必传, 默认1
    webGLManufacturer: '', // webGLInfo为自定义时指定的webGL厂商值, str类型
    webGLRender: '', // webGLInfo为自定义时指定的webGL渲染值, str类型
    webGpu: 'webgl', // webGpu，基于webgl匹配：webgl，真实：real，禁用：block，str类型
    audioContext: true, // audioContext值，随机：true，真实：false，布尔类型
    speechVoices: true, // Speech Voices，随机：true，真实：false，布尔类型
    doNotTrack: true, // doNotTrack，true：开启，false：关闭，布尔类型
    clientRects: true, // ClientRects，随机：true，真实：false，布尔类型
    deviceInfo: true, // 媒体设备，随机：true，真实：false，布尔类型
    deviceNameSwitch: true, // 设备名称，随机：true，真实：false，布尔类型
    macInfo: true, // MAC地址，自定义：true，真实：false，布尔类型
    portScanProtect: true, // 端口扫描保护, false: 关闭, true: 开启，布尔类型
    portScanList: '', // 端口扫描保护开启时的白名单，英文逗号分隔，str类型
    disableSsl: true, // ssl指纹设置, false: 关闭, true: 开启，布尔类型
    disableSslList: [], // ssl特性值列表，List格式类型
    hardwareConcurrent: '4', // 硬件并发数, str类型
    deviceMemory: '8', // 设备内存, str类型
  },
}

export const browserListMappingV2 = {
  dirId: 'dc1e73d4dd954a', // 浏览器窗口id, str类型
  windowSortNum: 99, // 窗口序号, int类型
  windowName: 'Roxytest', // 窗口名称, str类型
  coreVersion: '117', // 内核版本，枚举值：117，109, str类型
  os: 'Windows', // 操作系统, 枚举值：Windows、macOS、Linux, str类型
  osVersion: '11', // 操作系统版本, 枚举值：Windows的枚举值：11、10、8、7; macOS和Linux的枚举值：ALL，str类型
  userAgent: 'Mozilla/5.0 (Windows NT 10.0)', // User Agent, str类型
  cookie: [
    {
      name: '1',
      value: '2',
      domain: '3',
    },
  ], // cookie, List类型
  searchEngine: 'Google',
  windowPlatformList: [{
    platformUrl: 'https://www.tiktok.com/', // 业务平台URL，str类型
    platformUserName: 'Roxytest', // 平台账号，str类型
    platformPassword: 'Roxytest', // 平台密码，str类型
    platformEfa: '2F3CD67B6D', // efa，str类型
    platformRemarks: 'Roxytest', // 平台备注，str类型
  }],
  defaultOpenUrl: ['https://www.facebook.com'], // 存储浏览器标签页，List类型
  windowRemark: 'Roxytest', // 窗口备注, str类型
  projectId: 4, // 项目ID, int类型
  projectName: 'Roxytest', // 项目名称, str类型
  openStatus: false, // 团队内是否已打开, 枚举值：true: 已打开，false: 未打开，布尔类型
  statusInfo: [
    {
      openTime: '2024-01-09 12:12:12', // 打开时间，str类型
      openUserName: 'test', // 打开人用户名，str类型
    },
  ], // 窗口打开时的详细信息，List类型
  createTime: '2023-12-04 21:55:58', // 窗口创建时间, str类型
  updateTime: '2023-12-04 21:56:01', // 窗口修改时间, str类型
  userName: 'roxytest', // 窗口归属人用户名,即用户账号, str类型
  openTime: '2024-12-05 10:57:43', // 窗口最后打开时间, str类型
  closeTime: '2024-12-05 10:40:54', // 窗口最后关闭时间, str类型
  proxyInfo: {
    proxyMethod: 'custom', // 代理方式，枚举值：手动填写：custom，选择代理资源：choose，API接入：api，str类型
    proxyCategory: 'noproxy', // 代理类型，枚举值：noproxy, HTTP, HTTPS, SOCKS5, SSH, str类型
    ipType: 'IPV4', // 网络协议, 枚举值：IPV4, IPV6，str类型
    protocol: 'SOCKS5', // 代理协议，枚举值：HTTP, HTTPS, SOCKS5，str类型
    host: '122.11.11.11', // 代理主机，str类型
    port: '37746', // 代理端口，str类型
    proxyUserName: 'roxytest', // 代理账号，str类型
    proxyPassword: 'roxytest', // 代理密码，str类型
    refreshUrl: 'http://refresh-hk.roxybrowser.com', // 刷新URL，str类型
    lastIp: '119.1.2.3', // 出口IP，str类型
    lastCountry: 'CN', // 出口国家，str类型
    checkChannel: 'http://iprust.io/ip.json', // IP查询渠道，str类型
  },
  isOften: false, // 是否收藏，true：是，false：否，布尔类型
  labelInfo: [
    {
      labelId: 859, // 标签ID，int类型
      labelName: 'Roxytest', // 标签名称，str类型
      labelColor: '#FC9D12', // 标签颜色，str类型
    },
  ], // 标签详细信息，List类型
}

export const browserListMappingV3 = {
  dirId: 'dc1e73d4dd954a', // 浏览器窗口id, str类型
  windowSortNum: 99, // 窗口序号, int类型
  windowName: 'Roxytest', // 窗口名称, str类型
  coreVersion: '117', // 内核版本，枚举值：135，133，130，125，117，109, str类型
  os: 'Windows', // 操作系统, 枚举值：Windows、macOS、Android、IOS, str类型
  osVersion: '11', // 操作系统版本, 枚举值：Windows的枚举值：11、10、8、7; macOS的枚举值: 15.3.2,15.3.1,15.3,15.2,15.1,15.0.1,15.0,14.7.4,14.7.3,14.7.2,14.7.1,14.7,14.6.1,14.6,14.5,14.4.1,14.4,14.3.1,14.3,14.2.1,14.2,14.1,13.7.4,13.7.3,13.7.2,13.7.1,13.7; Android的枚举值：14、13、12、11、10、9; IOS的枚举值：18.2、18.1、18.0、17.0、16.6、16.5、16.4、16.3、16.2、16.1、16.0、15.7、15.6、15.5、15.4、15.3、15.2、15.1、15.0、14.7、14.6、14.5、14.4、14.3、14.2、14.1、14.0; str类型
  coreType: 'Chrome', // 内核类型 Chrome or Firefox
  windowRemark: 'Roxytest', // 窗口备注, str类型
  createTime: '2023-12-04 21:55:58', // 窗口创建时间, str类型
  updateTime: '2023-12-04 21:56:01', // 窗口修改时间, str类型
  userName: 'roxytest', // 窗口归属人用户名,即用户账号, str类型
  workspaceName: 'Roxytest', // 团队名称, str类型
}
