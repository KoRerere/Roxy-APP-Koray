/** 创建窗口默认参数 */
export const defaultBrowserCreateParams = {
  windowName: '', // 窗口名称，str，非必传
  groupId: '', // 分组id, int，非必传
  platformUrl: '', // 平台URL，str
  platformUserName: '', // 平台账号，str
  platformPassword: '', // 平台密码，str
  defaultOpenUrl: [], // 默认打开网址
  coreVersion: '125', // 内核版本，枚举值：125, 117，109, str类型
  os: 'Windows', // 操作系统, Windows,macOS,Linux,Android,IOS，必传，非空，默认选 Windows，枚举值通过字典获取
  osVersion: '11', // 操作系统版本，str, 非必传，枚举值通过字典获取, 其中Linux 和 macOS没有值
  browserVersion: '', // 浏览器版本，str，非必传，枚举值通过 user_get_browser_version 接口获取
  userAgent: '', // User Agent，必传，非空，通过 user_get_ua_webgl 接口获取值
  cookie: [], // cookie, List，非必传
  windowRemark: '', // 窗口备注，str，非必传
  efa: '',
  proxyMethod: 'custom', // 代理方式，custom：自定义，import：导入的IP，api：API接入
  proxyCategory: 'noproxy', // 代理类型，枚举值：noproxy, HTTP, HTTPS, SOCKS5
  ipType: '', // 网络协议，str, 枚举值：IPV4, IPV6, 非必传
  proxyProvider: '', // 代理服务商，str, 非必传
  protocol: '', // 代理协议，枚举值：NOPROXY, HTTP, HTTPS, SOCKS5, str, 必传，默认传 NOPROXY
  country: '', // 国家, str, 非必传
  state: '', // 【页面暂时不显示】，州, str, 非必传
  city: '', // 【页面暂时不显示】，城市, str, 非必传
  host: '', // 代理主机 str, 代理检测的时候会用到，非必传，对于代理方式为 购买的IP，且代理类型为动态IP的通过 公共.txt\user_get_user_info　接口获取，字段 proxyHost
  port: '', // 代理端口 str, 代理检测的时候会用到，非必传，对于代理方式为 购买的IP，且代理类型为动态IP的通过 公共.txt\user_get_user_info　接口获取，字段 proxyPort
  proxyUserName: '', // 代理账号 str, 代理检测的时候会用到，非必传，对于代理方式为 购买的IP，且代理类型为动态IP的通过 公共.txt\user_get_user_info　接口获取，字段 proxyUserName
  proxyPassword: '', // 代理密码 str, 代理检测的时候会用到，非必传，对于代理方式为 购买的IP，且代理类型为动态IP的通过 公共.txt\user_get_user_info　接口获取，字段 proxyPassword
  proxyTime: '', // ip时长 str,  代理检测的时候会用到，非必传，对于代理方式为 购买的IP，且代理类型为动态IP的通过 公共.txt\user_get_user_info　接口获取，字段 proxyTime
  refreshUrl: '', // 刷新URL str, 非必传
  accessServer: '', // 接入点
  checkChannel: '', // 查询渠道，默认:IP123，枚举值：IP123,  str, 非必传
  extraChannel: '', // 一期用不上，不用传，proxyMethod=2时，提取链接的服务商，ROLA
  isExtraNewIp: true, // 一期用不上，不用传，proxyMethod=2时，提取IP，每次打开都提取新IP，默认1, 枚举值：0和1
  isRepectCheck: false, // 一期用不上，不用传，proxyMethod=2时，提取IP校验重复，1 校验，0不校验。打开窗口时，将检测提取IP是否重复，重复则重新提取，最多重新提取5次,默认0
  extraUrl: '', // 一期用不上，不用传，proxyMethod=2时，提取IP链接，str
  lastIp: '', // 【页面暂时不显示】，关闭窗口时写入，给用户显示用
  lastCountry: '', // 【页面暂时不显示】，关闭窗口时写入，给用户显示用
  isLanguageBaseIp: true, // 语言，1:跟随IP匹配，0自定义，默认1，布尔值，必传
  language: '', // isLanguageBaseIp为0时选择的语言, 非必传
  isDisplayLanguageBaseIp: true, // 界面语言，1: 跟随IP匹配，0：自定义，默认1，布尔值，必传
  displayLanguage: '', // isDisplayLanguageBaseIp为0时选择的语言, 非必传
  isTimeZone: true, // 时区，1: 跟随IP匹配，0：自定义，默认1，布尔值，必传
  timeZone: '', // isTimeZone为0时选择的时区, 非必传
  position: 1, // 地理位置 0询问|1允许|2禁止，默认1，int, 必传
  isPositionBaseIp: true, // 基于IP生成对应的地理位置，不勾选可自定义，默认1，布尔值，必传
  longitude: '', // 经度 isPositionBaseIp为0时设置, 非必传
  latitude: '', // 纬度 isPositionBaseIp为0时设置, 非必传
  precisionPos: '', // 精度米 isPositionBaseIp为0时设置, 非必传
  forbidAudio: true, // 声音，开启：1，关闭：0，默认1，布尔值，必传
  forbidImage: true, // 图片，允许加载：0，禁止加载：1，自定义加载：2，默认0，int, 必传
  forbiddenPictureSize: '512', // 自定义加载图片尺寸，str, 非必传
  forbidMedia: true, // 视频，允许加载：1，禁止加载：0，默认1，布尔值，必传
  isDisplayName: false,
  syncTab: true, // 同步标签页，1：是，0：否，默认1，布尔值，必传
  syncCookie: true, // 同步Cookie，1：是，0：否，默认1，布尔值，必传
  openMult: true, // 多开设置，1：开启，0：关闭，默认0，布尔值，必传
  forbidSavePassword: false, // 弹出保存密码，1：是，0：否，默认1，布尔值，必传
  stopOpenNet: false, // 网络不通停止打开，1：是，0：否，默认1，布尔值，必传
  stopOpenIP: false, // IP发生变化停止打开，1：是，0：否，默认0，布尔值，必传
  stopOpenPosition: false, // IP对应国家/地区发生变化停止打开，1：是，0：否，默认0，布尔值，必传
  syncIndexedDb: false, // 同步IndexedDB，1：是，0：否，默认0，布尔值，必传
  syncLocalStorage: false, // 同步Local Storage，1：是，0：否，默认0，布尔值，必传
  syncBookmark: false, // 同步书签，1：是，0：否，默认0，布尔值，必传
  syncPassword: true, // 同步已保存的用户名密码，1：是，0：否，默认1，布尔值，必传
  syncHistory: false, // 同步历史记录，1：是，0：否，默认0，布尔值，必传
  syncExtensions: false, // 同步扩展应用数据，1：是，0：否，默认0，布尔值，必传
  clearCacheFile: false, // 启动浏览器前删除缓存文件，1：是，0：否，默认0，布尔值，必传
  clearCookie: false, // 启动浏览器前删除Cookie，1：是，0：否，默认0，布尔值，必传
  clearHistory: false, // 启动浏览器前删除历史记录，1：是，0：否，默认0，布尔值，必传
  randomFingerprint: false, // 启动浏览时随机指纹，1：是，0：否，默认0，布尔值，必传
  allowRunApplication: true, // 关闭浏览器后继续运行应用，1：是，0：否，默认0，布尔值，必传
  useGpu: true, // 使用硬件加速模式，1：是，0：否，默认1，布尔值，必传
  startupParam: '', // 启动参数， str 必传
  sandboxPermission: false, // 禁用沙盒，1：是，0：否，默认0，布尔值，必传
  webRTC: 2, // webrtc 0替换|1真实|2禁用，默认0，必传
  ignoreHttpsError: false, // 忽略https证书错误，1|0，默认0，布尔值，必传
  openWidth: '1000', // 窗口尺寸，宽度, 非必传
  openHeight: '1000', // 窗口尺寸，高度, 非必传
  resolutionType: false, // 分辨率， 0跟随电脑 | 1自定义，默认0，布尔值，必传
  resolutionX: '', // 自定义分辨率时，分辨率X值, 非必传
  resolutionY: '', // 自定义分辨率时，分辨率Y值, 非必传
  fontType: true, // 字体， 0系统默认|1随机匹配，默认1，布尔值，必传
  font: '', // 【页面不显示】,字体值，指纹会用到, 非必传
  canvas: true, // canvas 1随机｜0关闭，默认1，布尔值，必传
  canvasValue: '', // 【页面不显示】，canvas为随机时设置， 噪音值 10000 - 1000000，指纹会用到, 非必传
  webGL: true, // webGL图像，1随机｜0关闭，默认1，布尔值，必传
  webGLValue: '', // 【页面不显示】，webGL为随机时设置，随机噪音值 10000 - 1000000，指纹会用到, 非必传
  webGLMeta: true, // webgl元数据 1自定义｜0关闭，默认1，布尔值，必传
  webGLInfo: true,
  webGLManufacturer: '', // webGLMeta自定义时，webGL厂商值, 非必传
  webGLRender: '', // webGLMeta自定义时，webGL渲染值, 非必传
  webGpu: 'webgl', // webGpu基于webgl匹配、real 真实、block 禁止，默认值：webgl，必传
  audioContext: true, // audioContext值，1随机｜0关闭，默认1，布尔值，必传
  audioContextValue: '', // 【页面不显示】，audioContext为随机时，噪音值， 1 - 100 ，关闭时默认10，指纹会用到, 非必传
  speechVoices: true, // Speech Voices，1随机｜0关闭，默认1，布尔值，必传
  speechVoicesValue: {}, // 【页面不显示】，speechVoices为1时生成，指纹会用到，Json格式，必传
  doNotTrack: true, // doNotTrack 0关闭 | 1开启，默认1， 枚举值：0和1，布尔值，必传
  clientRects: true, // ClientRects，1随机｜0关闭，默认1， 枚举值：0和1，布尔值，必传
  clientRectsValue: {},
  deviceInfo: true, // 设备信息，1自定义｜0关闭，默认1， 枚举值：0和1，布尔值，必传
  deviceNameSwitch: true,
  deviceName: '', // 设备名称，deviceInfo为1时设置，非必传
  macInfo: true,
  macAddr: '', // mac地址，deviceInfo为1时设置，非必传
  portScanProtect: true, // 端口扫描保护 0关闭｜1开启，默认1， 枚举值：0和1，布尔值，必传
  portScanList: '', // 端口扫描保护开启时的白名单，逗号分隔，str, 非必传
  disableSsl: false, // ssl指纹设置，0关闭｜1开启，默认1， 枚举值：0和1，布尔值，必传
  disableSslList: [], // 序列化的ssl特性值，List格式，必传
  enablePlugin: false, // 自定义插件指纹，0关闭｜1开启，默认1， 枚举值：0和1，布尔值，必传
  enablePluginList: [], // enablePlugins为1时，序列化的插件值，List格式，必传
  mediaDevice: false, // 【页面不显示】，媒体设备，默认0，需要前端生成，布尔值，必传
  mediaDeviceList: [], // 【页面不显示】，媒体设备列表，指纹会用到，需要前端生成，List格式，必传
  hardwareConcurrent: '4', // 硬件并发数，默认4, 非必传
  deviceMemory: '8', // 设备内存，1，2，4，8，不要传入大于8的值，默认8, 非必传
}
