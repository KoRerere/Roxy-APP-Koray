/* eslint-disable */
/* tslint:disable */
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export interface LoginCreatePayload {
  /** 用户名 */
  user_name: string;
  /** 密码 */
  password: string;
}

export interface PostBasePayload {
  /** 用户名 */
  user_name: string;
  /** 密码 */
  password: string;
  /** 邮箱 */
  email: string;
  /** 验证码 */
  ver_code: string;
}

export interface SendEmailForgetVerifyCodeListParams {
  /**
   * 邮箱
   * @example "166533381@qq.com"
   */
  email: string;
}

export interface ForgetPasswordListParams {
  /**
   * 邮箱
   * @example "166533381@qq.com"
   */
  email: string;
  /**
   * 验证码
   * @example "142661"
   */
  ver_code: string;
  /**
   * 新密码
   * @example "ddkuueeu"
   */
  new_pwd: string;
}

export interface SendEmailRegisterVerifyCodeListParams {
  /**
   * 邮箱
   * @example "166533381@qq.com"
   */
  email: string;
}

export interface UserChangeAccountCreatePayload {
  /** 真实姓名 */
  realName: string;
}

export interface UserChangePwdCreatePayload {
  /** 旧密码 */
  old_pwd: string;
  /** 新密码 */
  new_pwd: string;
}

export interface UserSendEmailVerifyCodeListParams {
  /**
   * 新邮箱
   * @example "117363767@qq.com"
   */
  email: string;
}

export interface UserChangeEmailCreatePayload {
  /** 新邮箱 */
  email: string;
  /** 验证码 */
  code: string;
}

export interface UserGetAppUpgradeCreatePayload {
  /**
   * 操作系统
   * 如 macOS,Windows，str，必传
   */
  os: string;
  /**
   * cpu架构
   * mac专用：interl/apple，str，非必传
   */
  cpu?: string;
  /**
   *  操作系统位数
   * 32或64，str，非必传
   */
  osBit?: string;
}

export interface UserGetCoreUpgradeCreatePayload {
  /**
   * 操作系统
   * 如 macOS,Windows，str，必传
   */
  os: string;
  /**
   * 操作系统版本
   * 11，10，8，7
   */
  osVersion: string;
  /**
   * 操作系统位数
   * 32或64，str，非必传
   */
  osBit?: string;
  /**
   * cpu架构
   * mac专用：intel/apple，str，非必传
   */
  cpu?: string;
}

export interface UserSetUserConfigCreatePayload {
  /** 语言 */
  language: string;
  /** 时区 */
  timezone: string;
  /**
   * 软件关闭时
   * 枚举：pop: 弹出提示，min: 最小化至托盘，exit: 退出软件
   */
  closeSoft: string;
  /** 件下载目录 */
  uploadDir: string;
  /** 文件缓存目录 */
  cacheDir: string;
  /**
   * 缓存删除条件
   * 5天前的
   */
  autoDelDays: string;
  /**
   * 缓存删除条件
   * 2GB以上的
   */
  autoDelSize: string;
  /**
   * 性能监控
   * 内存使用率%95以上时停止打开窗口
   */
  memoryLimit: string;
  /** 通过本地网络打开的网站列表 */
  ipBlackList: string[];
  /** api token */
  apiToken: string;
}

export interface UserSetUserApiCreatePayload {
  /** api */
  apiKey: string;
  /** 端口 */
  port: string;
  /** 打开，关闭 */
  open: boolean;
}

export interface UserGetSystemDictV2ListParams {
  /**
   * 字典类型
   * @example ["[\"proxyType\",\"addType\"]"]
   */
  type: string[];
}

export interface UserMdfTeamInfoCreatePayload {
  /** 团队名称 */
  name: string;
}

export interface UserReadNotifyCreatePayload {
  /** 已读通知id，List */
  ids: number[];
}

export interface UserGetWindowInfoListParams {
  /**
   * 分页索引, int, 非必传, 默认1
   * @example "1"
   */
  page_index?: number;
  /**
   * 分页条数, int, 非必传, 默认15
   * @example "15"
   */
  page_size?: number;
  /**
   * 标签id,  int, 非必传
   * @example "2"
   */
  labelId?: number;
  /**
   * 分组id, int, 非必传
   * @example "10"
   */
  groupId?: number;
  /**
   * 窗口名称, str, 非必传
   * @example "窗口1"
   */
  windowName?: string;
  /**
   * 指定序号串, 多个序号使用英文逗号分隔, str,非必传
   * @example "1,4,5,8"
   */
  sortNums?: string;
  /**
   * 最小序号, int, 非必传
   * @example "1"
   */
  sortMin?: number;
  /**
   * 最大序号, int, 非必传
   * @example "8"
   */
  sortMax?: number;
  /**
   * 窗口备注, str, 非必传
   * @example "窗口1"
   */
  windowRemark?: string;
  /**
   * 代理, str, 非必传
   * @example "12.33.12.11"
   */
  host?: string;
  /**
   * 已打开, str, 非必传
   * @example "true"
   */
  openStatus?: string;
  /**
   * 常用, str, 非必传
   * @example "true"
   */
  isOften?: string;
  /**
   * 窗口id列表, str, 非必传
   * @example "10,11"
   */
  windowIds?: string;
  /**
   * 员工账号, str, 非必传
   * @example "fbtest"
   */
  userName?: string;
  /**
   * 绑定了某个代理IP的所有窗口, int, 非必传
   * @example "10"
   */
  moduleId?: number;
  /**
   * 是否有绑定代理IP管理, str, 非必传
   * @example "true"
   */
  isBind?: string;
  /**
   * 窗口id
   * @example "12"
   */
  id?: number;
  /**
   * 窗口目录id
   * @example "dc1e73d4dd954a3a8ca087d53d2e18ce"
   */
  dirId?: string;
  /**
   * 窗口类型，枚举值：1：自建窗口，2：团队窗口，3：全部窗口,
   * @example "1"
   */
  windowType?: number;
  /**
   * 排序类型，int, 枚举值，1：序号从大到小，2：序号从小到大，3：创建时间从大到小，4：创建时间从小到大，非必传,默认为 1
   * @example "1"
   */
  sortType?: number;
  /**
   * 业务平台URL，非必传，str
   * @example "http://dww.com"
   */
  platformUrl?: string;
  /**
   * 操作系统, Windows,macOS,Linux,Android,IOS, str, 非必传
   * @example "Windows"
   */
  os?: string;
  /**
   * 代理协议，枚举值: HTTP, HTTPS, SOCKS5, str, 非必传
   * @example "SOCKS5"
   */
  protocol?: string;
  /**
   * 创建时间开始, str, 非必传
   * @example "2024-05-22"
   */
  startDate?: string;
  /**
   * 创建时间结束, str, 非必传
   * @example "2024-05-24"
   */
  endDate?: string;
  /**
   * 指定标签id串, 多个使用英文逗号分隔, str, 非必传
   * @example "10,20,33"
   */
  labelIds?: string;
  /**
   * 指定分组id串, 多个使用英文逗号分隔, str, 非必传
   * @example "12,45,22"
   */
  groupIds?: string;
  /**
   * 是否有绑定rpa, true:有绑定，false:没有绑定 str, 非必传
   * @example "true"
   */
  isBindRpa?: string;
}

export interface UserGetWindowInfoRecycleListParams {
  /**
   * 分页索引, int, 非必传, 默认1
   * @example "1"
   */
  page_index?: number;
  /**
   * 分页条数, int, 非必传, 默认15
   * @example "15"
   */
  page_size?: number;
  /**
   * 标签id,  int, 非必传
   * @example " 2"
   */
  labelId?: number;
  /**
   * 分组id, int, 非必传
   * @example "10"
   */
  groupId?: number;
  /**
   * 窗口名称, str, 非必传
   * @example " 窗口1"
   */
  windowName?: string;
  /**
   * 指定序号串, 多个序号使用英文逗号分隔, str, 非必传
   * @example "1,4,5,8"
   */
  sortNums?: string;
  /**
   * 最小序号, int, 非必传
   * @example "1"
   */
  sortMin?: number;
  /**
   * 最大序号, int, 非必传
   * @example "8"
   */
  sortMax?: number;
  /**
   * 窗口备注, str, 非必传
   * @example "窗口1"
   */
  windowRemark?: string;
  /**
   * 代理, str, 非必传
   * @example "12.33.12.11"
   */
  host?: string;
  /**
   * 窗口类型，枚举值：1.自建窗口，2.团队窗口，3.全部窗口,
   * @example "1"
   */
  windowType?: number;
  /**
   * 创建人id, int,非必传
   * @example "2"
   */
  createBy?: number;
  /**
   * 操作人id, int,非必传
   * @example "3"
   */
  operateBy?: number;
  /**
   * 排序类型，int, 枚举值，1.序号从大到小，2.序号从小到大，3.删除时间从大到小，4.删除时间从小到大，非必传,默认为 1
   * @example "1"
   */
  sortType?: number;
  /**
   * 业务平台URL，非必传，str
   * @example "http://dww.com"
   */
  platformUrl?: string;
  /**
   * 操作系统, Windows,macOS,Linux,Android,IOS, str, 非必传
   * @example "Windows"
   */
  os?: string;
  /**
   * 代理协议，枚举值: HTTP, HTTPS, SOCKS5, str, 非必传
   * @example "SOCKS5"
   */
  protocol?: string;
  /**
   * 创建时间开始, str, 非必传
   * @example "2024-05-22"
   */
  startDate?: string;
  /**
   * 创建时间结束, str, 非必传
   * @example "2024-05-24"
   */
  endDate?: string;
  /**
   * 指定标签id串, 多个使用英文逗号分隔, str, 非必传
   * @example "10,20,33"
   */
  labelIds?: string;
  /**
   * 指定分组id串, 多个使用英文逗号分隔, str, 非必传
   * @example "12,45,22"
   */
  groupIds?: string;
}

export interface UserAddWindowInfoCreatePayload {
  windowName: string;
  groupId: number;
  platformUrl: string;
  platformUserName: string;
  platformPassword: string;
  defaultOpenUrl: string[];
  coreVersion: string;
  os: string;
  osVersion: string;
  browserVersion: string;
  userAgent: string;
  cookie: {
    name?: string;
    value?: string;
    domain?: string;
  }[];
  windowRemark: string;
  efa: string;
  moduleId: number;
  proxyMethod: string;
  proxyCategory: string;
  ipType: string;
  proxyProvider: string;
  protocol: string;
  country: string;
  state: string;
  city: string;
  host: string;
  port: string;
  proxyUserName: string;
  proxyPassword: string;
  proxyTime: string;
  refreshUrl: string;
  accessServer: string;
  checkChannel: string;
  extraChannel: string;
  isExtraNewIp: boolean;
  isRepectCheck: boolean;
  extraUrl: string;
  lastIp: string;
  lastCountry: string;
  isLanguageBaseIp: boolean;
  language: string;
  isDisplayLanguageBaseIp: boolean;
  displayLanguage: string;
  isTimeZone: boolean;
  timeZone: string;
  position: number;
  isPositionBaseIp: boolean;
  longitude: string;
  latitude: string;
  precisionPos: string;
  forbidAudio: boolean;
  forbidImage: number;
  forbiddenPictureSize: string;
  forbidMedia: boolean;
  syncTab: boolean;
  syncCookie: boolean;
  openMult: boolean;
  forbidSavePassword: boolean;
  stopOpenNet: boolean;
  stopOpenIP: boolean;
  stopOpenPosition: boolean;
  isDisplayName: boolean;
  syncIndexedDb: boolean;
  syncLocalStorage: boolean;
  syncBookmark: boolean;
  syncPassword: boolean;
  syncHistory: boolean;
  syncExtensions: boolean;
  clearCacheFile: boolean;
  clearCookie: boolean;
  clearHistory: boolean;
  randomFingerprint: boolean;
  allowRunApplication: boolean;
  useGpu: boolean;
  webRTC: number;
  openWidth: string;
  openHeight: string;
  resolutionType: boolean;
  resolutionX: string;
  resolutionY: string;
  fontType: boolean;
  font: string;
  canvas: boolean;
  canvasValue: string;
  webGL: boolean;
  webGLValue: string;
  webGLMeta: boolean;
  webGLInfo: boolean;
  webGLManufacturer: string;
  webGLRender: string;
  webGpu: string;
  audioContext: boolean;
  audioContextValue: string;
  speechVoices: boolean;
  speechVoicesValue: {
    enable: boolean;
    voices: {
      name: string;
      lang: string;
      isLocalService: boolean;
    }[];
  };
  doNotTrack: boolean;
  clientRects: boolean;
  clientRectsValue: {
    enable: boolean;
    clientRectsNoiseFactorX: number;
    clientRectsNoiseFactorY: number;
  };
  deviceInfo: boolean;
  deviceNameSwitch: boolean;
  deviceName: string;
  macInfo: boolean;
  macAddr: string;
  portScanProtect: boolean;
  /** 沙盒权限 默认 是关闭 */
  sandboxPermission: boolean;
  /**  启动参数 */
  "startupParam ": string;
  portScanList: string;
  disableSsl: boolean;
  disableSslList: string[];
  enablePlugin: boolean;
  enablePluginList: {
    name: string;
    description: string;
    filename: string;
    mimeType: string;
    mimeDescription: string;
    suffixes: number | string;
  }[];
  mediaDevice: boolean;
  mediaDeviceList: {
    deviceType?: string;
    deviceId?: string;
    label?: string;
    groupId?: string;
  }[];
  hardwareConcurrent: number;
  deviceMemory: number;
}

export interface UserBatchWindowInfoCreatePayload {
  createCount: number;
  windowNamePrefix: string;
  groupId: number;
  platformUrl: string;
  defaultOpenUrl: string[];
  efa: string;
  os: string;
  osVersion: string;
  cookie: {
    name?: string;
    value?: string;
    domain?: string;
  }[];
  moduleIds: {
    moduleId: number;
    count: number;
  }[];
  proxyMethod: string;
  proxyCategory: string;
  ipType: string;
  proxyProvider: string;
  protocol: string;
  country: string;
  state: string;
  city: string;
  host: string;
  port: string;
  proxyUserName: string;
  proxyPassword: string;
  proxyTime: string;
  refreshUrl: string;
  accessServer: string;
  checkChannel: string;
  extraChannel: string;
  isExtraNewIp: boolean;
  isRepectCheck: boolean;
  extraUrl: string;
  lastIp: string;
  lastCountry: string;
  fingerDetail: {
    userAgent?: string;
    font?: string;
    canvasValue?: string;
    webGLValue?: string;
    webGLManufacturer?: string;
    webGLRender?: string;
    audioContextValue?: string;
    speechVoicesValue?: object;
    clientRectsValue?: object;
    mediaDevice?: boolean;
    mediaDeviceList?: string[];
    deviceName?: string;
    macAddr?: string;
  }[];
  isLanguageBaseIp: boolean;
  language: string;
  isDisplayLanguageBaseIp: boolean;
  displayLanguage: string;
  isTimeZone: boolean;
  timeZone: string;
  position: number;
  isPositionBaseIp: boolean;
  longitude: string;
  latitude: string;
  precisionPos: string;
  forbidAudio: boolean;
  forbidImage: number;
  forbiddenPictureSize: string;
  forbidMedia: boolean;
  syncTab: boolean;
  syncCookie: boolean;
  openMult: boolean;
  forbidSavePassword: boolean;
  stopOpenNet: boolean;
  stopOpenIP: boolean;
  stopOpenPosition: boolean;
  syncIndexedDb: boolean;
  syncLocalStorage: boolean;
  syncBookmark: boolean;
  syncPassword: boolean;
  syncHistory: boolean;
  syncExtensions: boolean;
  clearCacheFile: boolean;
  clearCookie: boolean;
  clearHistory: boolean;
  randomFingerprint: boolean;
  isDisplayName: boolean;
  allowRunApplication: boolean;
  useGpu: boolean;
  webRTC: number;
  openWidth: string;
  openHeight: string;
  resolutionType: boolean;
  resolutionX: string;
  resolutionY: string;
  fontType: boolean;
  canvas: boolean;
  webGL: boolean;
  webGLMeta: boolean;
  webGLInfo: boolean;
  webGpu: string;
  audioContext: boolean;
  speechVoices: boolean;
  doNotTrack: boolean;
  clientRects: boolean;
  deviceInfo: boolean;
  deviceNameSwitch: boolean;
  macInfo: boolean;
  portScanProtect: boolean;
  portScanList: string;
  disableSsl: boolean;
  disableSslList: string[];
  enablePlugin: boolean;
  enablePluginList: {
    name: string;
    description: string;
    filename: string;
    mimeType: string;
    mimeDescription: string;
    suffixes: number | string;
  }[];
  hardwareConcurrent: number;
  deviceMemory: number;
}

export interface UserImportWindowInfoCreatePayload {
  fileName: string;
  excelData: {
    rowNum?: number;
    windowName?: string;
    groupName?: string;
    platformUrl?: string;
    platformUserName?: string;
    platformPassword?: string;
    efa?: string;
    path?: string;
    domain?: string;
  }[];
  defaultOpenUrl: string;
  proxyMethod: string;
  proxyInfo: string;
  windowRemark: string;
  userAgent: string;
  windowSize: string;
}

export interface UserMdfWindowInfoSingleCreatePayload {
  id: number;
  dirId: string;
  windowName: string;
  groupId: number;
  platformUrl: string;
  platformUserName: string;
  platformPassword: string;
  defaultOpenUrl: string[];
  coreVersion: string;
  os: string;
  osVersion: string;
  browserVersion: string;
  userAgent: string;
  cookie: {
    name?: string;
    value?: string;
    domain?: string;
  }[];
  efa: string;
  windowRemark: string;
  labelId: number;
  labelIds: number[];
  isOften: boolean;
  loginData: string[];
  isDelete: boolean;
  moduleId: number;
  proxyMethod: string;
  proxyCategory: string;
  ipType: string;
  proxyProvider: string;
  protocol: string;
  country: string;
  state: string;
  city: string;
  host: string;
  port: string;
  proxyUserName: string;
  proxyPassword: string;
  proxyTime: string;
  refreshUrl: string;
  accessServer: string;
  checkChannel: string;
  lastIp: string;
  lastCountry: string;
  isDisplayName: boolean;
  extraChannel: string;
  isExtraNewIp: boolean;
  isRepectCheck: boolean;
  extraUrl: string;
  isLanguageBaseIp: boolean;
  language: string;
  isDisplayLanguageBaseIp: boolean;
  displayLanguage: string;
  isTimeZone: boolean;
  timeZone: string;
  position: number;
  isPositionBaseIp: boolean;
  longitude: string;
  latitude: string;
  precisionPos: string;
  forbidAudio: boolean;
  forbidImage: number;
  forbiddenPictureSize: string;
  forbidMedia: boolean;
  syncTab: boolean;
  syncCookie: boolean;
  openMult: boolean;
  forbidSavePassword: boolean;
  stopOpenNet: boolean;
  stopOpenIP: boolean;
  stopOpenPosition: boolean;
  syncIndexedDb: boolean;
  syncLocalStorage: boolean;
  syncBookmark: boolean;
  syncPassword: boolean;
  syncHistory: boolean;
  syncExtensions: boolean;
  syncValue: object;
  clearCacheFile: boolean;
  clearCookie: boolean;
  clearHistory: boolean;
  randomFingerprint: boolean;
  allowRunApplication: boolean;
  useGpu: boolean;
  webRTC: number;
  openWidth: string;
  openHeight: string;
  resolutionType: boolean;
  resolutionX: string;
  resolutionY: string;
  fontType: boolean;
  font: string;
  canvas: boolean;
  canvasValue: string;
  webGL: boolean;
  webGLValue: string;
  webGLMeta: boolean;
  webGLInfo: boolean;
  webGLManufacturer: string;
  webGLRender: string;
  webGpu: string;
  audioContext: boolean;
  audioContextValue: string;
  speechVoices: boolean;
  speechVoicesValue: {
    enable: boolean;
    voices: {
      name: string;
      lang: string;
      isLocalService: boolean;
    }[];
  };
  doNotTrack: boolean;
  clientRects: boolean;
  clientRectsValue: {
    enable: boolean;
    clientRectsNoiseFactorX: number;
    clientRectsNoiseFactorY: number;
  };
  deviceInfo: boolean;
  deviceNameSwitch: boolean;
  deviceName: string;
  macInfo: boolean;
  macAddr: string;
  portScanProtect: boolean;
  portScanList: string;
  disableSsl: boolean;
  disableSslList: string[];
  enablePlugin: boolean;
  enablePluginList: {
    name: string;
    description: string;
    filename: string;
    mimeType: string;
    mimeDescription: string;
    suffixes: number | string;
  }[];
  mediaDevice: boolean;
  mediaDeviceList: {
    deviceType?: string;
    deviceId?: string;
    label?: string;
    groupId?: string;
  }[];
  hardwareConcurrent: number;
  deviceMemory: number;
}

export interface UserMdfWindowInfoBatchCreatePayload {
  ids: number[];
  windowName: string;
  groupId: number;
  platformUrl: string;
  defaultOpenUrl: string[];
  coreVersion: string;
  os: string;
  osVersion: string;
  efa: string;
  windowRemark: string;
  labelIds: number[];
  isOften: boolean;
  isDelete: boolean;
  moduleIds: {
    moduleId: number;
    count: number;
  }[];
  proxyMethod: string;
  proxyCategory: string;
  ipType: string;
  proxyProvider: string;
  protocol: string;
  country: string;
  state: string;
  city: string;
  host: string;
  port: string;
  proxyUserName: string;
  proxyPassword: string;
  proxyTime: string;
  refreshUrl: string;
  accessServer: string;
  checkChannel: string;
  extraChannel: string;
  isExtraNewIp: boolean;
  isRepectCheck: boolean;
  extraUrl: string;
  lastIp: string;
  lastCountry: string;
  fingerDetail: {
    userAgent?: string;
    font?: string;
    canvasValue?: string;
    webGLValue?: string;
    webGLManufacturer?: string;
    webGLRender?: string;
    audioContextValue?: string;
    speechVoicesValue?: object;
    clientRectsValue?: object;
    mediaDevice?: boolean;
    mediaDeviceList?: string[];
    deviceName?: string;
    macAddr?: string;
  }[];
  isLanguageBaseIp: boolean;
  language: string;
  isDisplayLanguageBaseIp: boolean;
  displayLanguage: string;
  isTimeZone: boolean;
  timeZone: string;
  position: number;
  isPositionBaseIp: boolean;
  longitude: string;
  latitude: string;
  precisionPos: string;
  forbidAudio: boolean;
  forbidImage: number;
  forbiddenPictureSize: string;
  forbidMedia: boolean;
  syncTab: boolean;
  syncCookie: boolean;
  openMult: boolean;
  forbidSavePassword: boolean;
  stopOpenNet: boolean;
  stopOpenIP: boolean;
  stopOpenPosition: boolean;
  syncIndexedDb: boolean;
  syncLocalStorage: boolean;
  syncBookmark: boolean;
  syncPassword: boolean;
  syncHistory: boolean;
  syncExtensions: boolean;
  syncValue: object;
  clearCacheFile: boolean;
  clearCookie: boolean;
  clearHistory: boolean;
  randomFingerprint: boolean;
  allowRunApplication: boolean;
  useGpu: boolean;
  isDisplayName: boolean;
  webRTC: number;
  openWidth: string;
  openHeight: string;
  resolutionType: boolean;
  resolutionX: string;
  resolutionY: string;
  fontType: boolean;
  canvas: boolean;
  webGL: boolean;
  webGLMeta: boolean;
  webGLInfo: boolean;
  webGpu: string;
  audioContext: boolean;
  speechVoices: boolean;
  doNotTrack: boolean;
  clientRects: boolean;
  deviceInfo: boolean;
  deviceNameSwitch: boolean;
  macInfo: boolean;
  portScanProtect: boolean;
  portScanList: string;
  disableSsl: boolean;
  disableSslList: string[];
  enablePlugin: boolean;
  enablePluginList: {
    name: string;
    description: string;
    filename: string;
    mimeType: string;
    mimeDescription: string;
    suffixes: number | string;
  }[];
  hardwareConcurrent: number;
  deviceMemory: number;
}

export interface UserModifyWindowReportTimeCreatePayload {
  /**  窗口Id */
  ids: number[];
}

export interface UserMdfWindowInfoRandomCreatePayload {
  dirId: string;
}

export interface UserClearWindowCacheCreatePayload {
  /** 要清空的窗口id列表 */
  ids: number[];
}

export interface UserClearWindowCacheApiCreatePayload {
  /** 要清空的窗口dirId列表 */
  dirIds: number[];
}

export interface UserDelWindowInfoCreatePayload {
  /** 要删除的窗口id列表 */
  ids: number[];
}

export interface UserDelWindowInfoApiCreatePayload {
  /** 要删除的窗口dirIds列表 */
  dirIds: string[];
}

export interface UserMdfWindowSyncStatusCreatePayload {
  statusReport: {
    /** 窗口ID */
    id?: number;
    /** 窗口打开状态 */
    openStatus?: boolean;
    /** 状态详细信息 */
    statusInfo?: {
      /** 打开时间 */
      openTime: string;
    };
  }[];
}

export type UserMdfWindowSyncV2CreatePayload = {
  id?: number;
  /** www.baidu.com','http:ip123.in/ip.json'], */
  defaultOpenUrl?: string[];
  loginData?: string[];
  syncValue?: object;
  openStatus?: boolean;
}[];

export interface UserGetUaWebglListParams {
  /** @example "Windows" */
  os?: string;
  /** @example "11" */
  osVersion?: string;
  /** @example "118" */
  browserVersion?: string;
  /** @example "false" */
  coreVersionstring?: string;
  /** @example "Google Inc. (Intel)" */
  webGLManufacturer?: string;
}

export interface UserGetUaWebglV2ListParams {
  /**
   * 操作系统，枚举值：Windows,macOS,Linux,Android,IOS
   * @example "Windows"
   */
  os: string;
  /**
   *  操作系统版本
   * @example "11"
   */
  osVersion?: string;
  /**
   * 浏览器版本
   * @example "118"
   */
  browserVersion?: string;
  /**
   * 内核版本
   * @example "117"
   */
  coreVersion: string;
  /**
   * WebGL厂商
   * @example "Google Inc. (Intel)"
   */
  webGLManufacturer?: string;
  /**
   * 需要获取的数量
   * @example "2"
   */
  count: number;
}

export interface UserGetDeviceNameListParams {
  /**
   * 操作系统，如 macOS,Windows
   * @example "Windows"
   */
  os: string;
}

export interface UserGetDeviceNameV2ListParams {
  /**
   * 操作系统，如 macOS,Windows
   * @example "Windows"
   */
  os: string;
}

export interface UserGetMacAddrV2ListParams {
  /**
   * 需要获取的数量
   * @example "2"
   */
  count: number;
}

export interface UserGetGroupInfoListParams {
  /**
   * 分页索引
   * @example "1"
   */
  page_index?: number;
  /**
   * 分页条数
   * @example "15"
   */
  page_size?: number;
  /**
   * 分组名
   * @example "分组1"
   */
  name?: string;
}

export interface UserAddGroupInfoCreatePayload {
  /** 分组名 */
  name: string;
}

export interface UserMdfGroupInfoCreatePayload {
  /** 分组id */
  id: number;
  /** 分组名 */
  name: string;
}

export interface UserDelGroupInfoCreatePayload {
  /** 要删除的分组id */
  ids: number[];
}

export interface UserGetLabelInfoListParams {
  /**
   * 分页索引, int, 非必传, 默认1
   * @example "1"
   */
  page_index: string;
  /**
   * 分页条数, int, 非必传, 默认15
   * @example "15"
   */
  page_size: string;
  /**
   * 标签名称
   * @example "face"
   */
  name?: string;
}

export interface UserAddLabelInfoCreatePayload {
  /** 标签颜色 */
  color: string;
  /** 标签名称 */
  name: string;
}

export interface UserMdfLabelInfoCreatePayload {
  /** 标签id */
  id: number;
  /** 标签颜色 */
  color: string;
  /** 标签名称 */
  name: string;
}

export interface UserDelLabelInfoCreatePayload {
  /** 要删除的标签id列表 */
  ids: number[];
}

export interface UserUploadChromePluginsCreatePayload {
  /** 插件下载地址 */
  url: string;
}

export interface UserUploadPluginInfoCreatePayload {
  /** 来源，枚举：local:本地扩展, store:Chrome商店 */
  source: string;
  /** 插件目录 */
  pluginDir: string;
  /** 插件名称 */
  pluginName: string;
  /** 插件icon地址 */
  pluginIcon: string;
  /** 插件下载地址 */
  pluginRoute: string;
  /** 扩展版本 */
  pluginVersion: string;
  /** 插件描述 */
  pluginDesc: string;
  /** 提供方 */
  provider?: string;
}

export interface UserGetProxyModuleListParams {
  /**
   * 分页索引
   * @example "1"
   */
  page_index: number;
  /**
   * 分页条数
   * @example "15"
   */
  page_size: number;
  /**
   * 国家
   * @example "us"
   */
  country?: string;
  /**
   * 代理协议，枚举值：HTTP, HTTPS, SOCKS5
   * @example "SOCKS5"
   */
  protocol?: string;
  /**
   * 代理IP
   * @example "13.21.211.11"
   */
  host?: string;
  /**
   * 排序类型，1：代理ID从大到小，2：代理ID从小到大
   * @example "1"
   */
  sortType?: number;
}

export interface UserAddProxyModuleCreatePayload {
  /** 网络协议 */
  ipType: string;
  /** 代理协议 */
  protocol: string;
  /** 代理主机 */
  host: string;
  /** 代理端口 */
  port: string;
  /** 代理账号 */
  proxyUserName?: string;
  /** 代理密码 */
  proxyPassword?: string;
  /** 刷新URL */
  refreshUrl?: string;
  /** 查询渠道 */
  checkChannel?: string;
  /**  出口IP */
  lastIp?: string;
  /** 出口国家 */
  lastCountry?: string;
  /** 检测时间 */
  checkTime?: string;
  /** 检测状态 */
  checkStatus?: boolean;
}

export interface UserMdfProxyModuleCreatePayload {
  /** 代理id */
  id: number;
  /** 网络协议 */
  ipType?: string;
  /** 代理协议 */
  protocol?: string;
  /** 代理主机  */
  host?: string;
  /** 代理端口 */
  port?: string;
  /** 代理账号 */
  proxyUserName?: string;
  /** 代理密码 */
  proxyPassword?: string;
  /** 刷新URL */
  refreshUrl?: string;
  /** 查询渠道 */
  checkChannel?: string;
  /** 出口IP */
  lastIp?: string;
  /** 出口国家 */
  lastCountry?: string;
  /** 检测时间 */
  checkTime?: string;
  /** 检测状态 */
  checkStatus?: boolean;
}

export interface UserDelProxyModuleCreatePayload {
  /** 要删除的代理id列表 */
  ids: number[];
}

export interface UserUnbindProxyModuleCreatePayload {
  /** 需要解绑的ip列表 */
  ids: number[];
}

export interface UserCheckIpCreatePayload {
  /**
   * 代理id
   * ID 编号
   */
  id: string;
}

export interface UserGetUserListListParams {
  /**
   * 分页索引
   * @example "1"
   */
  page_index?: number;
  /**
   * 分页条数
   * @example "15"
   */
  page_size?: number;
  /**
   * 用户id
   * @example "2"
   */
  id?: number;
  /**
   * 枚举值：main:主账号, admin:管理员, manager:经理, staff:成员
   * @example "main"
   */
  role?: string;
  /**
   * 用户名
   * @example "fbtest"
   */
  userName?: string;
  /**
   * 账号状态，1: 开启，2: 关闭
   * @example "1"
   */
  status?: number;
}

export interface UserAddUserListCreatePayload {
  /** 姓名 */
  realName: string;
  /** 用户名 */
  userName: string;
  /** 登录密码 */
  password: string;
  /** 【注意是页面选择的角色，不是用户本身的角色】, 枚举值：main:主账号, admin:管理员, manager:经理, staff:成员 */
  role: string;
  /** 成员列表, 只有 经理 才有 */
  staffIds?: number[];
  /** 所属经理，只有 员工 才有 */
  managerId?: number;
  /** 授权分组id列表 */
  grantGroupIds?: number[];
  /** 可创建窗口数 */
  maxWindowCount?: number;
  /** 手机号 */
  phone?: string;
  /** 邮箱 */
  email?: string;
}

export interface UserMdfUserListCreatePayload {
  /** 用户id */
  id: number;
  /** 姓名 */
  realName: string;
  /** 用户名 */
  userName: string;
  /** 登录密码 */
  password: string;
  /** 【注意是页面选择的角色，不是用户本身的角色】, 枚举值：main:主账号, admin:管理员, manager:经理, staff:成员 */
  role: string;
  /** 管理成员, 只有 经理 才有, 非必传 */
  staffIds?: number[];
  /** 所属经理, 只有 员工 才有 */
  managerId?: number;
  /** 权分组id列表，只有 经理和员工 才有 */
  grantGroupIds?: number[];
  /**  可创建窗口数 */
  maxWindowCount?: number;
  /** 手机号 */
  phone?: string;
  /** 邮箱 */
  email?: string;
  /** 态，枚举值：true：生效，false：失效, true/false */
  status?: boolean;
}

export interface UserDelUserListCreatePayload {
  /** 要删除的用户id */
  id: string;
}

export interface UserGetSystemPluginListParams {
  /**
   * 分页索引
   * @example "1"
   */
  page_index?: number;
  /**
   * 分页条数
   * @example "15"
   */
  page_size?: number;
  /**
   * 扩展分类: 可选值："hot","tool","fanyi","yingxiao","amazon","shopee","sumaitong","whatsapp","dzsw","guanggao","qukuailian","other"
   * @example "tool"
   */
  category?: string;
  /**
   * 扩展名称
   * @example "翻译助手"
   */
  pluginName?: string;
}

export interface UserAddSystemPluginCreatePayload {
  /** 系统扩展id */
  id: number;
}

export interface UserGetPluginListListParams {
  /**
   * 分页索引
   * @example "1"
   */
  page_index?: number;
  /**
   * 分页条数
   * @example "15"
   */
  page_size?: number;
  /**
   * 扩展名称
   * @example "翻译助手"
   */
  pluginName?: string;
}

export interface UserDelPluginInfoCreatePayload {
  /** 要删除的插件id */
  id: number;
}

export interface UserMdfPluginStatusCreatePayload {
  /** ID */
  id: number;
  /** 是否启用，true:开启，false:关闭 */
  useStatus: boolean;
}

export interface UserGetPlatformInfoListParams {
  /**
   * 业务平台
   * @example "amazon"
   */
  platformUrl?: string;
}

export interface UserAddPlatformInfoCreatePayload {
  /** 业务平台 */
  platformUrl: string;
}

export interface UserDelPlatformInfoCreatePayload {
  /** 要删除的业务平台id列表 */
  ids: number[];
}

export interface UserGetOperateLogListParams {
  /**
   * token必填
   * @example "6hLvXa548lFZivFw1701699537353"
   */
  token: string;
  /**
   * 用户名
   * @example "xxx"
   */
  userName?: string;
  /**
   * 开始时间
   * @example "xxx"
   */
  startDate?: string;
  /**
   * 结束时间
   * @example "xxx"
   */
  endDate?: string;
}

export interface UserGetLoginLogListParams {
  /**
   * token必填
   * @example "6hLvXa548lFZivFw1701699537353"
   */
  token: string;
  /**
   * 用户名
   * @example "xxx"
   */
  userName?: string;
  /**
   * 开始时间
   * @example "xxx"
   */
  startDate?: string;
  /**
   * 结束时间
   * @example "xxx"
   */
  endDate?: string;
}
