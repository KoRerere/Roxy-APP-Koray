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

export interface LoginCreateData {
  code: number;
  data: {
    token: string;
    type: number;
    user_name: string;
    user_id: number;
    role: string;
  };
  msg: string;
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

export interface PostBaseData {
  code: number;
  msg: string;
}

export interface SendEmailForgetVerifyCodeListParams {
  /**
   * 邮箱
   * @example "166533381@qq.com"
   */
  email: string;
}

export interface SendEmailForgetVerifyCodeListData {
  code: number;
  msg: string;
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

export interface ForgetPasswordListData {
  code: number;
  msg: string;
}

export interface SendEmailRegisterVerifyCodeListParams {
  /**
   * 邮箱
   * @example "166533381@qq.com"
   */
  email: string;
}

export interface SendEmailRegisterVerifyCodeListData {
  code: number;
  msg: string;
}

export interface UserChangeAccountCreatePayload {
  /** 真实姓名 */
  realName: string;
}

export interface UserChangeAccountCreateData {
  code: number;
  msg: string;
}

export interface UserChangePwdCreatePayload {
  /** 旧密码 */
  old_pwd: string;
  /** 新密码 */
  new_pwd: string;
}

export interface UserChangePwdCreateData {
  code: number;
  msg: string;
}

export interface UserSendEmailVerifyCodeListParams {
  /**
   * 新邮箱
   * @example "117363767@qq.com"
   */
  email: string;
}

export interface UserSendEmailVerifyCodeListData {
  code: number;
  msg: string;
}

export interface UserChangeEmailCreatePayload {
  /** 新邮箱 */
  email: string;
  /** 验证码 */
  code: string;
}

export interface UserChangeEmailCreateData {
  code: number;
  msg: string;
}

export interface UserGetUserInfoListData {
  code: number;
  data: {
    id: number;
    userName: string;
    role: string;
    mainId: number;
    realName: string;
    phone: string;
    email: string;
    maxWindowCount: number;
    useWindowCount: number;
    maxUserCount: number;
    useUserCount: number;
    maxOpenCount: number;
    createTime: string;
    updateTime: string;
    teamId: number;
    teamName: string;
    assignCnt: number;
    remainCnt: number;
    useOpenCount: number;
    totalAmount: number;
    leftAmount: number;
    host: string;
    sgHost: string;
    usHost: string;
    proxyHttpPort: number;
    proxyHttpsPort: number;
    proxySocks5Port: number;
    proxyUserName: string;
    proxyPassword: string;
    proxyTime: number;
    refreshUrl: string;
    sgRefreshUrl: string;
    usRefreshUrl: string;
    price: number;
    cityPrice: number;
    mobilePrice: number;
    dcPrice: number;
  };
  msg: string;
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

export interface UserGetAppUpgradeCreateData {
  downloadUrl: string;
  version: string;
  upgradeTitle: string;
  upgradeDesc: string;
  releaseTime: string;
  webDomain: string;
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

export interface UserGetCoreUpgradeCreateData {
  code: number;
  data: {
    rows: {
      coreVersion: string;
      version: string;
      downloadUrl: string;
    }[];
  };
  msg: string;
}

export interface UserGetUserConfigListData {
  code: number;
  data: {
    language: string;
    timezone: string;
    closeSoft: string;
    cacheDir: string;
    autoDelDays: string;
    autoDelSize: string;
    memoryLimit: string;
    ipBlackList: string[];
    apiToken: string;
  };
  msg: string;
}

export interface UserGetDefConfigListData {
  code: number;
  data: {
    language: string;
    timezone: string;
    closeSoft: string;
    cacheDir: string;
    autoDelDays: string;
    autoDelSize: string;
    memoryLimit: string;
    ipBlackList: string[];
  };
  msg: string;
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

export interface UserSetUserConfigCreateData {
  code: number;
  msg: string;
}

export interface UserGetUserApiListData {
  code: number;
  data: {
    apiKey: string;
    port: string;
    open: boolean;
  };
  msg: string;
}

export interface UserSetUserApiCreatePayload {
  /** api */
  apiKey: string;
  /** 端口 */
  port: string;
  /** 打开，关闭 */
  open: boolean;
}

export interface UserSetUserApiCreateData {
  code: number;
  msg: string;
}

export interface UserGetDictVersionListData {
  code: number;
  data: {
    dictVersion: string;
    os: string;
    proxyMethod: string;
    proxyType: string;
    proxyNetwork: string;
    billMethod: string;
    ipType: string;
    protocol: string;
    country: string;
    proxyProvider: string;
    proxyTime: string;
    checkChannel: string;
    windowType: string;
    language: string;
    displayLanguage: string;
    timeZone: string;
    resolution: string;
    disableSslList: string;
    hardwareConcurrent: string;
    deviceMemory: string;
    source: string;
    accessServer: string;
    rotateCountry: string;
    addType: string;
    exeType: string;
    frequency: string;
  };
  msg: string;
}

export interface UserGetSystemDictV2ListParams {
  /**
   * 字典类型
   * @example ["[\"proxyType\",\"addType\"]"]
   */
  type: string[];
}

export interface UserGetSystemDictV2ListData {
  code: number;
  data: {
    type: string;
    label: string;
    value: string;
  }[];
  msg: string;
}

export interface UserMdfTeamInfoCreatePayload {
  /** 团队名称 */
  name: string;
}

export interface UserMdfTeamInfoCreateData {
  code: number;
  msg: string;
}

export interface UserGetAnntListListData {
  code: number;
  data: {
    rows: {
      id?: number;
      announcement?: string;
      href?: string;
      createTime?: string;
      diff?: number;
    }[];
  };
  msg: string;
}

export interface UserGetNotifyListData {
  code: number;
  data: {
    id: number;
    type: string;
    notify: string;
    status: number;
    createTime: string;
  }[];
  msg: string;
}

export interface UserReadNotifyCreatePayload {
  /** 已读通知id，List */
  ids: number[];
}

export interface UserReadNotifyCreateData {
  code: number;
  msg: string;
}

export interface UserGetOssCredentialListData {
  code: number;
  data: {
    accessKeyId: string;
    accessKeySecret: string;
    expiration: string;
    securityToken: string;
    region: string;
    bucket: string;
  };
  msg: string;
}

export interface UserGetWindowInfoListParams {
  /**
   * 分页索引, int, 非必传, 默认1
   * @example 1
   */
  page_index?: number;
  /**
   * 分页条数, int, 非必传, 默认15
   * @example 15
   */
  page_size?: number;
  /**
   * 标签id,  int, 非必传
   * @example 2
   */
  labelId?: number;
  /**
   * 分组id, int, 非必传
   * @example 10
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
   * @example 1
   */
  sortMin?: number;
  /**
   * 最大序号, int, 非必传
   * @example 8
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
   * @example 10
   */
  moduleId?: number;
  /**
   * 是否有绑定代理IP管理, str, 非必传
   * @example "true"
   */
  isBind?: string;
  /**
   * 窗口id
   * @example 12
   */
  id?: number;
  /**
   * 窗口目录id
   * @example "dc1e73d4dd954a3a8ca087d53d2e18ce"
   */
  dirId?: string;
  /**
   * 窗口类型，枚举值：1：自建窗口，2：团队窗口，3：全部窗口,
   * @example 1
   */
  windowType?: number;
  /**
   * 排序类型，int, 枚举值，1：序号从大到小，2：序号从小到大，3：创建时间从大到小，4：创建时间从小到大，非必传,默认为 1
   * @example 1
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

export interface UserGetWindowInfoListData {
  code: number;
  data: {
    total: number;
    rows: {
      id?: number;
      dirId?: string;
      windowSortNum?: number;
      windowName?: string;
      groupId?: number;
      groupName?: string;
      platformUrl?: string;
      platformUserName?: string;
      platformPassword?: string;
      defaultOpenUrl?: string[];
      coreVersion?: string;
      os?: string;
      osVersion?: string;
      browserVersion?: string;
      userAgent?: string;
      cookie?: {
        name?: string;
        value?: string;
        domain?: string;
      }[];
      windowRemark?: string;
      isOften?: boolean;
      openStatus?: boolean;
      statusInfo?: {
        openUserId: number;
        openUserName: string;
        openTime: string;
      }[];
      labelId?: number;
      labelColor?: string;
      labelName?: string;
      labelIds?: number[];
      labelInfo?: {
        labelId: number;
        labelName: string;
        labelColor: string;
      }[];
      loginData?: string[];
      createTime?: string;
      updateTime?: string;
      userName?: string;
      realName?: string;
      role?: string;
      moduleId?: number;
      proxyMethod?: string;
      addType?: string;
      proxyType?: string;
      proxyCategory?: string;
      ipType?: string;
      proxyProvider?: string;
      protocol?: string;
      country?: string;
      state?: string;
      city?: string;
      host?: string;
      port?: string;
      proxyUserName?: string;
      proxyPassword?: string;
      proxyTime?: string;
      refreshUrl?: string;
      accessServer?: string;
      checkChannel?: string;
      extraChannel?: string;
      isExtraNewIp?: boolean;
      isRepectCheck?: boolean;
      extraUrl?: string;
      lastIp?: string;
      lastCountry?: string;
      isLanguageBaseIp?: boolean;
      isDisplayLanguageBaseIp?: boolean;
      isTimeZone?: boolean;
      position?: number;
      longitude?: string;
      latitude?: string;
      precisionPos?: string;
      forbidAudio?: boolean;
      forbidImage?: number;
      forbiddenPictureSize?: string;
      forbidMedia?: boolean;
      syncTab?: boolean;
      localState?: {
        os_crypt: {
          audit_enabled: boolean;
          encrypted_key: string;
        };
      };
      syncCookie?: boolean;
      openMult?: boolean;
      forbidTranslatePopup?: boolean;
      forbidSavePassword?: boolean;
      stopOpenNet?: boolean;
      stopOpenIP?: boolean;
      stopOpenPosition?: boolean;
      syncIndexedDb?: boolean;
      syncLocalStorage?: boolean;
      syncBookmark?: boolean;
      syncPassword?: boolean;
      syncHistory?: boolean;
      syncExtensions?: boolean;
      syncValue?: object;
      clearCacheFile?: boolean;
      clearCookie?: boolean;
      clearHistory?: boolean;
      isDisplayName?: boolean;
      randomFingerprint?: boolean;
      allowLoginChrome?: boolean;
      allowRunApplication?: boolean;
      useGpu?: boolean;
      webRTC?: number;
      openWidth?: string;
      openHeight?: string;
      resolutionType?: boolean;
      resolutionY?: string;
      fontType?: boolean;
      canvas?: boolean;
      webGLValue?: string;
      webGLRender?: string;
      webGpu?: string;
      webGpuVendor?: string;
      audioContext?: boolean;
      audioContextValue?: string;
      computerName?: string;
      macAddress?: string;
      speechVoices?: boolean;
      speechVoicesValue?: {
        enable: boolean;
        voices: {
          name: string;
          lang: string;
          isLocalService: boolean;
        }[];
      };
      doNotTrack?: boolean;
      clientRectsValue?: {
        enable: boolean;
        clientRectsNoiseFactorX: number;
        clientRectsNoiseFactorY: number;
      };
      deviceInfo?: boolean;
      deviceNameSwitch?: boolean;
      macInfo?: boolean;
      portScanProtect?: boolean;
      disableSsl?: boolean;
      disableSslList?: string[];
      enablePlugin?: boolean;
      enablePluginList?: {
        name: string;
        description: string;
        filename: string;
        mimeType: string;
        mimeDescription: string;
        suffixes: number | string;
      }[];
      mediaDevice?: boolean;
      mediaDeviceList?: {
        deviceType?: string;
        deviceId?: string;
        label?: string;
        groupId?: string;
      }[];
      hardwareConcurrent?: number;
      deviceMemory?: number;
      userAgentNew?: string;
      userAgentVersion?: string;
      platform?: string;
      navigatorPlatform?: string;
      pixelDepth?: number;
      colorDepth?: number;
      isBindRpa?: boolean;
      pluginVersion?: string;
      pluginRoute?: string;
    }[];
  };
}

export interface UserGetWindowInfoRecycleListParams {
  /**
   * 分页索引, int, 非必传, 默认1
   * @example 1
   */
  page_index?: number;
  /**
   * 分页条数, int, 非必传, 默认15
   * @example 15
   */
  page_size?: number;
  /**
   * 标签id,  int, 非必传
   * @example 2
   */
  labelId?: number;
  /**
   * 分组id, int, 非必传
   * @example 10
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
   * @example 1
   */
  sortMin?: number;
  /**
   * 最大序号, int, 非必传
   * @example 8
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
   * @example 1
   */
  windowType?: number;
  /**
   * 创建人id, int,非必传
   * @example 2
   */
  createBy?: number;
  /**
   * 操作人id, int,非必传
   * @example 3
   */
  operateBy?: number;
  /**
   * 排序类型，int, 枚举值，1.序号从大到小，2.序号从小到大，3.删除时间从大到小，4.删除时间从小到大，非必传,默认为 1
   * @example 1
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

export interface UserGetWindowInfoRecycleListData {
  code: number;
  data: {
    total: number;
    rows: {
      id?: number;
      windowSortNum?: number;
      windowName?: string;
      groupId?: number;
      groupName?: string;
      windowRemark?: string;
      labelId?: number;
      labelColor?: string;
      labelName?: string;
      labelIds?: number[];
      labelInfo?: {
        labelId: number;
        labelName: string;
        labelColor: string;
      }[];
      createUser?: string;
      operateUser?: string;
      deleteTime?: string;
      os?: string;
      platformUrl?: string;
      lastIp?: string;
      lastCountry?: string;
    }[];
  };
  msg: string;
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
    suffixes: number;
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

export interface UserAddWindowInfoCreateData {
  code: number;
  data: {
    createBy: number;
    windowUserId: number;
    windowId: number;
  };
  msg: string;
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
    suffixes: number;
  }[];
  hardwareConcurrent: number;
  deviceMemory: number;
}

export interface UserBatchWindowInfoCreateData {
  code: number;
  msg: string;
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

export interface UserImportWindowInfoCreateData {
  code: number;
  data: {
    createBy: number;
    windowUserId: number;
    windowId: number;
  };
  msg: string;
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
    suffixes: number;
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

export interface UserMdfWindowInfoSingleCreateData {
  code: number;
  msg: string;
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
    suffixes: number;
  }[];
  hardwareConcurrent: number;
  deviceMemory: number;
}

export interface UserMdfWindowInfoBatchCreateData {
  code: number;
  msg: string;
}

export interface UserModifyWindowReportTimeCreatePayload {
  /**  窗口Id */
  ids: number[];
}

export interface UserModifyWindowReportTimeCreateData {
  code: number;
  msg: string;
}

export interface UserMdfWindowInfoRandomCreatePayload {
  dirId: string;
}

export interface UserMdfWindowInfoRandomCreateData {
  code: number;
  msg: string;
}

export interface UserClearWindowCacheCreatePayload {
  /** 要清空的窗口id列表 */
  ids: number[];
}

export interface UserClearWindowCacheCreateData {
  code: number;
  msg: string;
}

export interface UserClearWindowCacheApiCreatePayload {
  /** 要清空的窗口dirId列表 */
  dirIds: number[];
}

export interface UserClearWindowCacheApiCreateData {
  code: number;
  msg: string;
}

export interface UserDelWindowInfoCreatePayload {
  /** 要删除的窗口id列表 */
  ids: number[];
}

export interface UserDelWindowInfoCreateData {
  code: number;
  msg: string;
}

export interface UserDelWindowInfoApiCreatePayload {
  /** 要删除的窗口dirIds列表 */
  dirIds: string[];
}

export interface UserDelWindowInfoApiCreateData {
  code: number;
  msg: string;
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

export interface UserMdfWindowSyncStatusCreateData {
  code: number;
  msg: string;
}

export type UserMdfWindowSyncV2CreatePayload = {
  id?: number;
  /** www.baidu.com','http:ip123.in/ip.json'], */
  defaultOpenUrl?: string[];
  loginData?: string[];
  syncValue?: object;
  openStatus?: boolean;
}[];

export interface UserMdfWindowSyncV2CreateData {
  code: number;
  msg: string;
}

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

export interface UserGetUaWebglListData {
  code: number;
  data: {
    userAgent: string;
    webGLRender: string;
    webGLManufacturer: string;
  };
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
   * @example 2
   */
  count: number;
}

export interface UserGetUaWebglV2ListData {
  code: number;
  data: {
    userAgent?: string;
    webGLRender?: string;
    webGLManufacturer?: string;
  }[];
  msg: string;
}

export interface UserGetDeviceNameListParams {
  /**
   * 操作系统，如 macOS,Windows
   * @example "Windows"
   */
  os: string;
}

export interface UserGetDeviceNameListData {
  code: number;
  data: {
    deviceName: string;
  };
  msg: string;
}

export interface UserGetDeviceNameV2ListParams {
  /**
   * 操作系统，如 macOS,Windows
   * @example "Windows"
   */
  os: string;
}

export interface UserGetDeviceNameV2ListData {
  code: number;
  data: {
    deviceName?: string;
  }[];
  msg: string;
}

export interface UserGetMacAddrV2ListParams {
  /**
   * 需要获取的数量
   * @example 2
   */
  count: number;
}

export interface UserGetMacAddrV2ListData {
  code: number;
  data: {
    macAddr?: string;
  }[];
  msg: string;
}

export interface UserGetGroupInfoListParams {
  /**
   * 分页索引
   * @example 1
   */
  page_index?: number;
  /**
   * 分页条数
   * @example 15
   */
  page_size?: number;
  /**
   * 分组名
   * @example "分组1"
   */
  name?: string;
}

export interface UserGetGroupInfoListData {
  code: number;
  data: {
    total: number;
    rows: {
      id?: number;
      name?: string;
      userName?: string;
      isBind?: boolean;
    }[];
  };
  msg: string;
}

export interface UserAddGroupInfoCreatePayload {
  /** 分组名 */
  name: string;
}

export interface UserAddGroupInfoCreateData {
  code: number;
  data: object;
  msg: string;
}

export interface UserMdfGroupInfoCreatePayload {
  /** 分组id */
  id: number;
  /** 分组名 */
  name: string;
}

export interface UserMdfGroupInfoCreateData {
  code: number;
  msg: string;
}

export interface UserDelGroupInfoCreatePayload {
  /** 要删除的分组id */
  ids: number[];
}

export interface UserDelGroupInfoCreateData {
  code: number;
  msg: string;
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

export interface UserGetLabelInfoListData {
  code: number;
  data: {
    total: number;
    rows: {
      id?: number;
      color?: string;
      name?: string;
      isBind?: boolean;
    }[];
  };
  msg: string;
}

export interface UserAddLabelInfoCreatePayload {
  /** 标签颜色 */
  color: string;
  /** 标签名称 */
  name: string;
}

export interface UserAddLabelInfoCreateData {
  code: number;
  data: object;
  msg: string;
}

export interface UserMdfLabelInfoCreatePayload {
  /** 标签id */
  id: number;
  /** 标签颜色 */
  color: string;
  /** 标签名称 */
  name: string;
}

export interface UserMdfLabelInfoCreateData {
  code: number;
  msg: string;
}

export interface UserDelLabelInfoCreatePayload {
  /** 要删除的标签id列表 */
  ids: number[];
}

export interface UserDelLabelInfoCreateData {
  code: number;
  msg: string;
}

export interface UserUploadChromePluginsCreatePayload {
  /** 插件下载地址 */
  url: string;
}

export type UserUploadChromePluginsCreateData = object;

export interface UserRecordPluginUploadListData {
  code: number;
  data: number;
  msg: string;
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

export interface UserUploadPluginInfoCreateData {
  code: number;
  data: {
    create_by: number;
    plugin_id: number;
  };
  msg: string;
}

export interface UserGetProxyModuleListParams {
  /**
   * 分页索引
   * @example 1
   */
  page_index: number;
  /**
   * 分页条数
   * @example 15
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
   * @example 1
   */
  sortType?: number;
}

export interface UserGetProxyModuleListData {
  code: number;
  data: {
    total: number;
    rows: {
      id?: number;
      protocol?: string;
      country?: string;
      host?: string;
      port?: string;
      proxyUserName?: string;
      proxyPassword?: string;
      refreshUrl?: string;
      /** ip123.in/ip.json， str */
      checkChannel?: string;
      lastCountry?: string;
      checkStatus?: boolean;
      remark?: string;
      isBind?: boolean;
      bindCount?: number;
      bindList?: number[];
    }[];
  };
  msg: string;
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

export type UserAddProxyModuleCreateData = object;

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

export type UserMdfProxyModuleCreateData = object;

export interface UserDelProxyModuleCreatePayload {
  /** 要删除的代理id列表 */
  ids: number[];
}

export type UserDelProxyModuleCreateData = object;

export interface UserUnbindProxyModuleCreatePayload {
  /** 需要解绑的ip列表 */
  ids: number[];
}

export type UserUnbindProxyModuleCreateData = object;

export interface UserCheckIpCreatePayload {
  /**
   * 代理id
   * ID 编号
   */
  id: string;
}

export interface UserCheckIpCreateData {
  code: number;
  msg: string;
  data: {
    lastIp: string;
    lastCountry: string;
    lastCountryEnName: string;
    lastCountryCnName: string;
  };
}

export interface UserGetUserListListParams {
  /**
   * 分页索引
   * @example 1
   */
  page_index?: number;
  /**
   * 分页条数
   * @example 15
   */
  page_size?: number;
  /**
   * 用户id
   * @example 2
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
   * @example 1
   */
  status?: number;
}

export interface UserGetUserListListData {
  code: number;
  data: {
    total: number;
    rows: {
      id?: number;
      userName?: string;
      role?: string;
      maxWindowCount?: number;
      useWindowCount?: number;
      status?: boolean;
      realName?: string;
      password?: string;
      staffIds?: number[];
      managerId?: number;
      grantGroupIds?: number[];
      avaWindowCount?: number;
      phone?: string;
      email?: string;
    }[];
  };
  msg: string;
}

export interface UserSelectStaffListData {
  code: number;
  data: {
    rows: {
      staffId: number;
      staffName: string;
    }[];
  };
  msg: string;
}

export interface UserSelectManagerListData {
  code: number;
  data: {
    rows: {
      managerId: number;
      managerName: string;
    }[];
  };
  msg: string;
}

export interface UserSelectGroupListData {
  code: number;
  data: {
    rows: {
      groupId: number;
      groupName: string;
      userName: string;
    }[];
  };
  msg: string;
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

export interface UserAddUserListCreateData {
  code: number;
  data: {
    create_by: number;
    group_user_id: number;
  };
  msg: string;
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

export interface UserMdfUserListCreateData {
  code: number;
  msg: string;
}

export interface UserDelUserListCreatePayload {
  /** 要删除的用户id */
  id: string;
}

export interface UserDelUserListCreateData {
  code: number;
  msg: string;
}

export interface UserGetPluginCategoryListData {
  code: number;
  data: {
    rows: {
      id: number;
      categoryName: string;
    }[];
  };
  msg: string;
}

export interface UserGetSystemPluginListParams {
  /**
   * 分页索引
   * @example 1
   */
  page_index?: number;
  /**
   * 分页条数
   * @example 15
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

export interface UserGetSystemPluginListData {
  code: number;
  data: {
    rows: {
      id: number;
      pluginDir: string;
      category: number;
      categoryName: string;
      pluginName: string;
      pluginIcon: string;
      pluginRoute: string;
      pluginVersion: string;
      pluginDesc: string;
      provider: string;
      supportCore: string;
      addStatus: boolean;
    }[];
  };
  msg: string;
}

export interface UserAddSystemPluginCreatePayload {
  /** 系统扩展id */
  id: number;
}

export interface UserAddSystemPluginCreateData {
  code: number;
  msg: string;
}

export interface UserGetPluginListListParams {
  /**
   * 分页索引
   * @example 1
   */
  page_index?: number;
  /**
   * 分页条数
   * @example 15
   */
  page_size?: number;
  /**
   * 扩展名称
   * @example "翻译助手"
   */
  pluginName?: string;
}

export interface UserGetPluginListListData {
  code: number;
  data: {
    total: number;
    rows: {
      id?: number;
      source?: string;
      pluginDir?: string;
      pluginName?: string;
      pluginIcon?: string;
      pluginRoute?: string;
      pluginVersion?: string;
      pluginDesc?: string;
      provider?: string;
      useStatus?: boolean;
    }[];
  };
  msg: string;
}

export interface UserDelPluginInfoCreatePayload {
  /** 要删除的插件id */
  id: number;
}

export interface UserDelPluginInfoCreateData {
  code: number;
  msg: string;
}

export interface UserMdfPluginStatusCreatePayload {
  /** ID */
  id: number;
  /** 是否启用，true:开启，false:关闭 */
  useStatus: boolean;
}

export interface UserMdfPluginStatusCreateData {
  code: number;
  msg: string;
}

export interface UserGetPlatformInfoListParams {
  /**
   * 业务平台
   * @example "amazon"
   */
  platformUrl?: string;
}

export interface UserGetPlatformInfoListData {
  code: number;
  data: {
    platformUrl: string[];
  };
  msg: string;
}

export interface UserAddPlatformInfoCreatePayload {
  /** 业务平台 */
  platformUrl: string;
}

export interface UserAddPlatformInfoCreateData {
  code: number;
  data: object;
  msg: string;
}

export interface UserDelPlatformInfoCreatePayload {
  /** 要删除的业务平台id列表 */
  ids: number[];
}

export interface UserDelPlatformInfoCreateData {
  code: number;
  msg: string;
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

export interface UserGetOperateLogListData {
  code: number;
  data: {
    total: number;
    rows: {
      id?: number;
      userName?: string;
      role?: string;
      operateType?: string;
      operateDetail?: string;
      operateTime?: string;
      status?: string;
      location?: string;
    }[];
  };
  msg: string;
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

export interface UserGetLoginLogListData {
  code: number;
  data: {
    total: number;
    rows: {
      id: number;
      userName: string;
      address: string;
      location: string;
      createTime: string;
    }[];
  };
  msg: string;
}

export interface UpdateWindowFilterNameCreatePayload {
  /** 传入字段 */
  filter_name_list: {
    /** 标签页名称 */
    filter_name?: string;
    /** 标签页查询条件 */
    filter_condition?: {
      platform: string;
    }[];
    /** 排序字段 */
    sort?: number;
  }[];
}

export interface UpdateWindowFilterNameCreateData {
  code: number;
  msg: string;
}

export interface DeleteWindowFilterNameCreatePayload {
  filter_name_list: {
    filter_name?: string;
    filter_condition?: {
      platform: string;
    }[];
    sort?: number;
  }[];
}

export interface DeleteWindowFilterNameCreateData {
  code: number;
  msg: string;
}

export interface AddWindowFilterNameCreatePayload {
  filter_name_list: {
    filter_name?: string;
    filter_condition?: {
      platform: string;
    }[];
  }[];
}

export interface AddWindowFilterNameCreateData {
  code: number;
  msg: string;
}

export interface GetWindowFilterNameListListData {
  code: number;
  data: {
    filter_name?: string;
    filter_condition?: {
      platform: string;
    }[];
    sort?: number;
  }[];
  msg: string;
}

export interface UpdateWindowTableRowsCreatePayload {
  table_rows: {
    name: string;
    sort: number;
    status: number;
  }[];
}

export interface UpdateWindowTableRowsCreateData {
  code: number;
  msg: string;
}

export interface SaveWindowTableSortOrderCreatePayload {
  table_sort: {
    name?: string;
    order?: string;
  }[];
}

export interface SaveWindowTableSortOrderCreateData {
  code: number;
  msg: string;
}
