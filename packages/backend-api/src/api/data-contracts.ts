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

export interface UserGetWorkspaceListApiListParams {
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
   * 工作空间ID
   * @example 1
   */
  workspaceId?: number;
}

export interface UserGetWorkspaceListApiListData {
  code: number;
  data: {
    /** 总条数 */
    total: number;
    rows: {
      /** 工作空间ID */
      id?: number;
      /** 用户ID */
      userId?: number;
      /** 工作空间名称 */
      workspaceName?: string;
      project_details?: {
        /** 项目ID */
        projectId: number;
        /** 项目名称 */
        projectName: string;
      }[];
    }[];
  };
  msg: string;
}

export interface UserGetPlatformInfoV2ListParams {
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
   * 平台URL
   * @example "https://www.facebook.com/"
   */
  platformUrl?: string;
  /**
   * 平台名字
   * @example "xxxx"
   */
  platformName?: string;
  /**
   * 平台账号
   * @example "xxxx"
   */
  platformUserName?: string;
  /**
   * 排序名称
   * @example "create_time"
   */
  order_name?: string;
  /**
   * 排序类型
   * @example "desc"
   */
  order_type?: string;
}

export interface UserGetPlatformInfoV2ListData {
  code: number;
  data: {
    total: number;
    rows: {
      /** 平台ID */
      id?: number;
      /** 用户ID */
      userId?: number;
      /** 平台url */
      platformUrl?: string;
      /** 平台icon */
      platformIcon?: string;
      /** 平台账户 */
      platformUserName?: string;
      /** 平台密码 */
      platformPassword?: string;
      /** 平台2FA密钥 */
      platformEfa?: string;
      /** 平台cookies */
      platformCookies?: string;
      /** 平台名字 */
      platformName?: string;
      /** 平台备注 */
      platformRemarks?: string;
      /** 创建时间 */
      createTime?: string;
      /** 修改时间 */
      updateTime?: string;
      /** 关联窗口ID */
      window_info?: string;
    }[];
  };
  msg: string;
}

export interface UserGetWindowInfoV2ListParams {
  /**
   * 分页索引, int, 非必传, 默认1
   * @example 1
   */
  page_index: number;
  /**
   * 分页条数, int, 非必传, 默认15
   * @example 15
   */
  page_size: number;
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
   * 窗口状态, str, 非必传,ture:打开,false:关闭
   * @example "true"
   */
  openStatus?: string;
  /**
   * 窗口收藏, str, 非必传
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
   * 窗口目录ids
   * @example "dc1e73d4dd954a3a8ca087d53d2e18ce,dc1e73d4dd954a3a8ca087d53d2e18ce"
   */
  dirIds?: string;
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
   * 标签id列表, 多个使用英文逗号分隔, str, 非必传 (多选)
   * @example "10,20,33"
   */
  labelIds?: string;
  /**
   * 分组id列表, 多个使用英文逗号分隔, str, 非必传(多选)
   * @example "12,45,22"
   */
  groupIds?: string;
  /**
   * 是否有绑定rpa, true:有绑定，false:没有绑定 str, 非必传
   * @example "true"
   */
  isBindRpa?: string;
  /**
   * 账号平台（多选）,传数字ID
   * @example "1,2,3"
   */
  platformUrlIds?: string;
  /**
   * 操作系统（多选）,传字符串
   * @example "Windows,macOS"
   */
  osList?: string;
  /**
   * 代理测试状态,0:没有测试，1:测试成功，2:检测失败
   * @example 0
   */
  proxyTestStatus?: number;
  /**
   * 排序字段
   * @example "name"
   */
  orderName?: string;
  /**
   * 排序类型  desc:降序   asc:升序
   * @example "desc"
   */
  orderType?: string;
  /**
   * 代理协议列表
   * @example ["HTTP, SOCKS5"]
   */
  proxyProtocoList?: string[];
  /**
   * 关联代理
   * @example "11,12"
   */
  proxyIds?: string;
  /**
   * 是否删除，绑定回收站功能，1.删除，0.不删除
   * @example 0
   */
  isDelete: number;
  /** 项目ID，默认不传查询所有 */
  "projectIds "?: string[];
}

export interface UserGetWindowInfoV2ListData {
  code: number;
  data: {
    total: number;
    rows: {
      /** 窗口id, int */
      id?: number;
      /** 【页面不显示】，窗口目录id */
      dirId?: string;
      /** 窗口序号,int */
      windowSortNum?: number;
      /** 项目ID,int */
      projectId?: string;
      /** oss存放路径 */
      ossDirPath?: string;
      /** 项目名称,str */
      projectName?: string;
      /** 窗口名称, str */
      windowName?: string;
      /** id, int */
      groupId?: number;
      /** 分组名称, str */
      groupName?: string;
      /** 业务平台URL，str */
      platformUrl?: string;
      /** 平台账号，str */
      platformUserName?: string;
      /** 平台密码，str */
      platformPassword?: string;
      defaultOpenUrl?: string[];
      /** 内核版本，枚举值：117，109, str类型 */
      coreVersion?: string;
      /** 操作系统, Windows,macOS,Linux,Android,IOS */
      os?: string;
      /** 操作系统版本 */
      osVersion?: string;
      /** 浏览器版本 */
      browserVersion?: string;
      /** User Agent */
      userAgent?: string;
      cookie?: {
        name?: string;
        value?: string;
        domain?: string;
      }[];
      /** 窗口备注, str */
      windowRemark?: string;
      /** 是否常用 */
      isOften?: boolean;
      /** 是否已打开 */
      openStatus?: boolean;
      statusInfo?: {
        openUserId: number;
        openUserName: string;
        openTime: string;
      }[];
      /** 【页面暂时不显示】，标签id */
      labelId?: number;
      /** 【页面暂时不显示】，标签颜色 */
      labelColor?: string;
      /** 【页面暂时不显示】，标签名称 */
      labelName?: string;
      labelIds?: number[];
      labelInfo?: {
        labelId: number;
        labelName: string;
        labelColor: string;
      }[];
      /** 【页面不显示】，用来存储网站的登录信息，网站会自动填充密码，List格式 */
      loginData?: string[];
      /** 窗口创建时间, str */
      createTime?: string;
      /** 窗口修改时间, str */
      updateTime?: string;
      /** 窗口打开时间, str */
      openTime?: string;
      /** 窗口关闭时间, str */
      closeTime?: string;
      /** 窗口归属人用户名,即用户账号, str */
      userName?: string;
      /** 窗口归属人用户姓名, str */
      realName?: string;
      /** 窗口归属人所属角色，枚举值：main:主账号, admin:管理员, manager:经理, staff:成员, str */
      role?: string;
      /** 窗口绑定的代理IP的id */
      moduleId?: number;
      /** 代理方式，custom：自定义，import：导入的IP，api：API接入， 【取字典】 */
      proxyMethod?: string;
      /** 添加类型，str, 枚举值：add：新增IP，choose: 已添加IP【取字典】 */
      addType?: string;
      /** 代理名称 */
      moduleName?: string;
      /** 代理类型，str, 枚举值：static：静态IP，rotate: 动态IP， 【取字典】 */
      proxyType?: string;
      /** 代理网络，str, 枚举值：resi：住宅IP，mobile: 手机IP，dc: 机房IP，ipv6: IPv6， 【取字典】 */
      proxyNetwork?: string;
      /** 计费方式，str,枚举值：month:包月，bandwidth:流量, 【取字典】 */
      billMethod?: string;
      /** 代理类型，枚举值：noproxy, HTTP, HTTPS, SOCKS5 */
      proxyCategory?: string;
      /** 网络协议，str, 枚举值：IPV4, IPV6 */
      ipType?: string;
      /** 代理服务商，str */
      proxyProvider?: string;
      /** 代理协议，枚举值：NOPROXY, HTTP, HTTPS, SOCKS5 */
      protocol?: string;
      /** 国家 */
      country?: string;
      /** 【页面暂时不显示】，州 */
      state?: string;
      /** 【页面暂时不显示】，城市 */
      city?: string;
      /** 代理主机 */
      host?: string;
      /** 代理端口 */
      port?: string;
      /** 代理账号 */
      proxyUserName?: string;
      /** 代理密码 */
      proxyPassword?: string;
      /** ip时长 */
      proxyTime?: string;
      /** 刷新URL */
      refreshUrl?: string;
      /** 接入点，【取字典】 */
      accessServer?: string;
      /** 查询渠道 */
      checkChannel?: string;
      /** 一期用不上，proxyMethod=api时，提取链接的服务商，ROLA */
      extraChannel?: string;
      /** 一期用不上，proxyMethod=api时，提取IP，每次打开都提取新IP，默认1, 枚举值：0和1 */
      isExtraNewIp?: boolean;
      /** 一期用不上，proxyMethod=api时，提取IP校验重复，1 校验，0不校验。打开窗口时，将检测提取IP是否重复，重复则重新提取，最多重新提取5次,默认0 */
      isRepectCheck?: boolean;
      /** 一期用不上，proxyMethod=api时，提取IP链接，str */
      extraUrl?: string;
      /** 【页面暂时不显示】，关闭窗口时写入，给用户显示用 */
      lastIp?: string;
      /** 【页面暂时不显示】，关闭窗口时写入，给用户显示用 */
      lastCountry?: string;
      /** 语言，1:跟随IP匹配，0自定义，默认1 */
      isLanguageBaseIp?: boolean;
      /** isLanguageBaseIp为0时选择的语言 */
      language?: string;
      /** 界面语言，1: 跟随IP匹配，0：自定义，默认1 */
      isDisplayLanguageBaseIp?: boolean;
      /** isDisplayLanguageBaseIp为0时选择的语言 */
      displayLanguage?: string;
      /** 时区，1: 跟随IP匹配，0：自定义，默认1 */
      isTimeZone?: boolean;
      /** isTimeZone为0时选择的时区 */
      timeZone?: string;
      /** 地理位置 0询问|1允许|2禁止，默认0 */
      position?: number;
      /** 基于IP生成对应的地理位置，不勾选可自定义，默认1，1：跟随IP匹配，0：自定义 */
      isPositionBaseIp?: boolean;
      /** 经度 isPositionBaseIp为0时设置，选择自定义的时候设置 */
      longitude?: string;
      /** 纬度 isPositionBaseIp为0时设置，选择自定义的时候设置 */
      latitude?: string;
      /** 精度米 isPositionBaseIp为0时设置，选择自定义的时候设置 */
      precisionPos?: string;
      /** 声音，开启：1，关闭：0，默认1 */
      forbidAudio?: boolean;
      /** 图片，允许加载：1，禁止加载：0，默认1 */
      forbidImage?: number;
      /** 自定义加载图片尺寸，str */
      forbiddenPictureSize?: string;
      /** 视频，允许加载：1，禁止加载：0，默认1 */
      forbidMedia?: boolean;
      /** 同步标签页，1：是，0：否，默认1 */
      syncTab?: boolean;
      localState?: {
        os_crypt: {
          audit_enabled: boolean;
          encrypted_key: string;
        };
      };
      /** 同步Cookie，1：是，0：否，默认1, 传true和false */
      syncCookie?: boolean;
      /** 多开设置，1：开启，0：关闭，默认0 */
      openMult?: boolean;
      /** 弹出谷歌翻译，1：是，0：否，默认0 */
      forbidTranslatePopup?: boolean;
      /** 弹出保存密码，1：是，0：否，默认1 */
      forbidSavePassword?: boolean;
      /** 网络不通停止打开，1：是，0：否，默认1 */
      stopOpenNet?: boolean;
      /** IP发生变化停止打开，1：是，0：否，默认0 */
      stopOpenIP?: boolean;
      /** IP对应国家/地区发生变化停止打开，1：是，0：否，默认0 */
      stopOpenPosition?: boolean;
      /** 同步IndexedDB，1：是，0：否，默认0 */
      syncIndexedDb?: boolean;
      /** 同步Local Storage，1：是，0：否，默认0 */
      syncLocalStorage?: boolean;
      /** 同步书签，1：是，0：否，默认0 */
      syncBookmark?: boolean;
      /** 同步已保存的用户名密码，1：是，0：否，默认1 */
      syncPassword?: boolean;
      /** 同步历史记录，1：是，0：否，默认0 */
      syncHistory?: boolean;
      /** 同步扩展应用数据，1：是，0：否，默认0 */
      syncExtensions?: boolean;
      /** 【页面不显示】，同步扩展应用数据时会用到，Json格式 */
      syncValue?: object;
      /** 启动浏览器前删除缓存文件，1：是，0：否，默认0 */
      clearCacheFile?: boolean;
      /** 启动浏览器前删除Cookie，1：是，0：否，默认0 */
      clearCookie?: boolean;
      /** 启动浏览器前删除历史记录，1：是，0：否，默认0 */
      clearHistory?: boolean;
      /** 窗口名是否在标题栏显示，显示：true，不显示：false，布尔类型，非必传, 默认false */
      isDisplayName?: boolean;
      /** 启动浏览时随机指纹，1：是，0：否，默认0 */
      randomFingerprint?: boolean;
      /** 允许登录Chrome，1：是，0：否，默认0 */
      allowLoginChrome?: boolean;
      /** 关闭浏览器后继续运行应用，1：是，0：否，默认0 */
      allowRunApplication?: boolean;
      /** 使用硬件加速模式，1：是，0：否，默认1 */
      useGpu?: boolean;
      /** webrtc 0替换|1真实|2禁用，默认0 */
      webRTC?: number;
      /** 忽略https证书错误，1|0，默认0 */
      ignoreHttpsError?: boolean;
      /** 窗口尺寸，宽度 */
      openWidth?: string;
      /** 窗口尺寸，高度 */
      openHeight?: string;
      /** 分辨率， 0跟随电脑 | 1自定义，默认0 */
      resolutionType?: boolean;
      /** 自定义分辨率时，分辨率X值 */
      resolutionX?: string;
      /** 自定义分辨率时，分辨率Y值 */
      resolutionY?: string;
      /** 字体， 0系统默认|1随机匹配，默认1 */
      fontType?: boolean;
      /** 【页面不显示】,字体值，指纹会用到 */
      font?: string;
      /** canvas 1随机｜0关闭，默认1 */
      canvas?: boolean;
      /** 【页面不显示】，canvas为随机时设置， 噪音值 10000 - 1000000，指纹会用到 */
      canvasValue?: string;
      /** webGL图像，1随机｜0关闭，默认1 */
      webGL?: boolean;
      /** 【页面不显示】，webGL为随机时设置，随机噪音值 10000 - 1000000，指纹会用到 */
      webGLValue?: string;
      /** webgl元数据 1自定义｜0关闭，默认1 */
      webGLMeta?: boolean;
      /** webGLInfo开关，真实1，自定义0，默认0,true:真实，false:自定义 */
      webGLInfo?: boolean;
      /** webGLMeta自定义时，webGL厂商值 */
      webGLManufacturer?: string;
      /** webGLMeta自定义时，webGL渲染值 */
      webGLRender?: string;
      /** webGpu基于webgl匹配、real 真实、block 禁止，默认值：webgl */
      webGpu?: string;
      /** 【页面不显示】，指纹会用到 */
      webGpuVendor?: string;
      /** audioContext值，1随机｜0关闭，默认1 */
      audioContext?: boolean;
      /** 【页面不显示】，audioContext为随机时，噪音值， 1 - 100 ，关闭时默认10，指纹会用到 */
      audioContextValue?: string;
      /** windows 版本转换替代字段，默认值：空字符串 */
      platformVersion?: string;
      /** 电脑名称，默认值：空字符串 */
      computerName?: string;
      /** MAC地址，默认值：空字符串 */
      macAddress?: string;
      /** Speech Voices，1随机｜0关闭，默认1 */
      speechVoices?: boolean;
      speechVoicesValue?: {
        enable: boolean;
        voices: {
          name: string;
          lang: string;
          isLocalService: boolean;
        }[];
      };
      /** doNotTrack 0关闭 | 1开启，默认1， 枚举值：0和1 */
      doNotTrack?: boolean;
      /** ClientRects，1随机｜0关闭，默认1， 枚举值：0和1 */
      clientRects?: boolean;
      clientRectsValue?: {
        enable: boolean;
        clientRectsNoiseFactorX: number;
        clientRectsNoiseFactorY: number;
      };
      /** 设备信息，1自定义｜0关闭，默认1， 枚举值：0和1 */
      deviceInfo?: boolean;
      /** 设备名称开关，真实1，自定义0，默认0,true:真实，false:自定义 */
      deviceNameSwitch?: boolean;
      /** 设备名称，deviceInfo为1时设置 */
      deviceName?: string;
      /** mac地址开关，真实1，自定义0，默认0，,true:真实，false:自定义 */
      macInfo?: boolean;
      /** mac地址，deviceInfo为1时设置 */
      macAddr?: string;
      /** 端口扫描保护 0关闭｜1开启，默认1， 枚举值：0和1 */
      portScanProtect?: boolean;
      /** 端口扫描保护开启时的白名单，逗号分隔，str */
      portScanList?: string;
      /** ssl指纹设置，0关闭｜1开启，默认1， 枚举值：0和1 */
      disableSsl?: boolean;
      /** 序列化的ssl特性值，List格式 */
      disableSslList?: string[];
      /** 自定义插件指纹，0关闭｜1开启，默认1， 枚举值：0和1 */
      enablePlugin?: boolean;
      enablePluginList?: {
        name: string;
        description: string;
        filename: string;
        mimeType: string;
        mimeDescription: string;
        suffixes: number;
      }[];
      /** 【页面不显示】，媒体设备，默认0，指纹会用到 */
      mediaDevice?: boolean;
      mediaDeviceList?: {
        deviceType?: string;
        deviceId?: string;
        label?: string;
        groupId?: string;
      }[];
      /** 硬件并发数，默认4 */
      hardwareConcurrent?: number;
      /** 设备内存，1，2，4，8，不要传入大于8的值，默认8 */
      deviceMemory?: number;
      /** 【页面不显示】，user agent，指纹会用到 */
      userAgentNew?: string;
      /** 【页面不显示】，user agent版本号，指纹会用到 */
      userAgentVersion?: string;
      /** 【页面不显示】，平台，指纹会用到 */
      platform?: string;
      /** 【页面不显示】，导航平台，指纹会用到 */
      navigatorPlatform?: string;
      /** 【页面不显示】，像素，指纹会用到 */
      pixelDepth?: number;
      /** 【页面不显示】，颜色，指纹会用到 */
      colorDepth?: number;
      /** 是否有绑定rpa,true:有绑定，false:没有绑定 str */
      isBindRpa?: boolean;
      usePlugin?: {
        pluginDir?: string;
        pluginVersion?: string;
        pluginRoute?: string;
      }[];
      /** 代理测试状态,0:没有测试，1:测试成功，2:检测失败 */
      checkStatus?: number;
      /** 新业务平台列表 */
      platformUrlList?: string[];
      /** 工作空间ID */
      workspaceId?: number;
      windowPlatformList?: {
        platformUrl?: string;
        platformIcon?: string;
        platformUserName?: string;
        platformPassword?: string;
        platformEfa?: string;
        platformcookies?: string;
        platformName?: string;
        platformRemarks?: string;
      }[];
      usePluginList?: {
        pluginDir: string;
        pluginVersion: string;
        fixedPlugin: string;
      }[];
      usePluginDirVersion?: {
        gmbmikajjgmnabiglmofipeabaddhgne?: string;
        fnfdomooadjpfohbepiaonnbdmkdjiog?: string;
        ndigigcelppbfkojeoejcailklonljah?: string;
        mopnmbcafieddcagagdcbnhejhlodfdd?: string;
        "7d790cbed6930120d15e00bcb1284c6a"?: string;
        ljdobmomdgdljniojadhoplhkpialdid?: string;
        "7c1590125f8da994f96918b2bcf03d12"?: string;
      }[];
      /** 今日打开窗口次数 */
      todayOpenCount?: number;
    }[];
  };
  msg: string;
}

export interface UserDelWindowInfoApiV2CreatePayload {
  /** 要删除的窗口dirIds列表 */
  dirIds: string[];
}

export interface UserDelWindowInfoApiV2CreateData {
  code: number;
  msg: string;
}

export interface UserMdfWindowInfoRandomV2CreatePayload {
  dirId: string;
}

export interface UserMdfWindowInfoRandomV2CreateData {
  code: number;
  msg: string;
}

export interface UserClearWindowCacheApiV2CreatePayload {
  /** 要清空的窗口dirId列表 */
  dirIds: number[];
}

export interface UserClearWindowCacheApiV2CreateData {
  code: number;
  msg: string;
}

export interface UserAddWindowInfoV2CreatePayload {
  /**
   * 窗口名称，str，非必传
   * 窗口名称，str，非必传
   */
  windowName: string;
  /**
   * 分组id, int，非必传
   * 分组id, int，非必传
   */
  groupId: number;
  /**
   * 业务平台URL，str
   * 业务平台URL，str
   */
  platformUrl: string;
  /**
   * 平台账号，str
   * 平台账号，str
   */
  platformUserName: string;
  /**
   * 平台密码，str
   * 平台密码，str
   */
  platformPassword: string;
  /** 默认打开URL */
  defaultOpenUrl: string[];
  /**
   * 内核版本，枚举值：117，109, str类型
   * 内核版本，枚举值：117，109, str类型
   */
  coreVersion: string;
  /**
   * 操作系统, Windows,macOS,Linux,Android,IOS，必传，非空，默认选 Windows， 【取字典】
   * 操作系统, Windows,macOS,Linux,Android,IOS，必传，非空，默认选 Windows， 【取字典】
   */
  os: string;
  /**
   * 操作系统版本，str, 非必传, 通过 user_get_os_version 接口获取
   * 操作系统版本，str, 非必传, 通过 user_get_os_version 接口获取
   */
  osVersion: string;
  /**
   * 浏览器版本，str，非必传，枚举值通过 user_get_browser_version 接口获取
   * 浏览器版本，str，非必传，枚举值通过 user_get_browser_version 接口获取
   */
  browserVersion: string;
  /**
   * User Agent，必传，非空，通过 user_get_ua_webgl 接口获取值
   * User Agent，必传，非空，通过 user_get_ua_webgl 接口获取值
   */
  userAgent: string;
  /** cookie */
  cookie: {
    name?: string;
    value?: string;
    domain?: string;
  }[];
  /**
   * 窗口备注，str，非必传
   * 窗口备注，str，非必传
   */
  windowRemark: string;
  /**
   * efa，str，非必传
   * efa，str，非必传
   */
  efa: string;
  /**
   * 仅在代理方式为【购买的IP】，且代理类型为【静态IP】 或 代理方式为自定义 的时候有值，值为用户选择的 代理IP的id，int，非必传
   * 仅在代理方式为【购买的IP】，且代理类型为【静态IP】 或 代理方式为自定义 的时候有值，值为用户选择的 代理IP的id，int，非必传
   */
  moduleId: number;
  /**
   * 代理方式，custom：自定义，import：导入的IP，api：API接入，【取字典】
   * 代理方式，custom：自定义，import：导入的IP，api：API接入，【取字典】
   */
  proxyMethod: string;
  /**
   * 代理类型，枚举值：noproxy, HTTP, HTTPS, SOCKS5，【取字典】
   * 代理类型，枚举值：noproxy, HTTP, HTTPS, SOCKS5，【取字典】
   */
  proxyCategory: string;
  /**
   * 网络协议，str, 枚举值：IPV4, IPV6, 非必传， 【取字典】
   * 网络协议，str, 枚举值：IPV4, IPV6, 非必传， 【取字典】
   */
  ipType: string;
  /**
   * 代理服务商，str, 非必传， 【取字典】
   * 代理服务商，str, 非必传， 【取字典】
   */
  proxyProvider: string;
  /**
   * 代理协议，枚举值：HTTP, HTTPS, SOCKS5, str, 必传，默认传 SOCKS5， 【取字典】
   * 暂时用不到
   */
  protocol: string;
  /**
   * 国家, str, 非必传， 【取字典】
   * 国家, str, 非必传， 【取字典】
   */
  country: string;
  /**
   * 【页面暂时不显示】，州, str, 非必传
   * 【页面暂时不显示】，州, str, 非必传
   */
  state: string;
  /**
   * 【页面暂时不显示】，城市, str, 非必传
   * 【页面暂时不显示】，城市, str, 非必传
   */
  city: string;
  /**
   * 代理主机 str, 代理检测的时候会用到，非必传，对于代理方式为 购买的IP，且代理类型为动态IP的 通过 user_get_proxy_account_info 接口获取，字段 host
   * 代理主机 str, 代理检测的时候会用到，非必传，对于代理方式为 购买的IP，且代理类型为动态IP的 通过 user_get_proxy_account_info 接口获取，字段 host
   */
  host: string;
  /**
   * 代理端口 str, 代理检测的时候会用到，非必传，对于代理方式为 购买的IP，且代理类型为动态IP的 通过 user_get_proxy_account_info 接口获取，字段 port
   * 代理端口 str, 代理检测的时候会用到，非必传，对于代理方式为 购买的IP，且代理类型为动态IP的 通过 user_get_proxy_account_info 接口获取，字段 port
   */
  port: string;
  /**
   * 代理账号 str, 代理检测的时候会用到，非必传，对于代理方式为 购买的IP，且代理类型为动态IP的 通过 user_get_proxy_account_info 接口获取，字段 proxyUserName
   * 代理账号 str, 代理检测的时候会用到，非必传，对于代理方式为 购买的IP，且代理类型为动态IP的 通过 user_get_proxy_account_info 接口获取，字段 proxyUserName
   */
  proxyUserName: string;
  /**
   * 代理密码 str, 代理检测的时候会用到，非必传，对于代理方式为 购买的IP，且代理类型为动态IP的 通过 user_get_proxy_account_info 接口获取，字段 proxyPassword
   * 代理密码 str, 代理检测的时候会用到，非必传，对于代理方式为 购买的IP，且代理类型为动态IP的 通过 user_get_proxy_account_info 接口获取，字段 proxyPassword
   */
  proxyPassword: string;
  /**
   * ip时长 str,  代理检测的时候会用到，非必传，对于代理方式为 购买的IP，且代理类型为动态IP的 通过 user_get_proxy_account_info 接口获取，字段 proxyTime， 【取字典】
   * ip时长 str,  代理检测的时候会用到，非必传，对于代理方式为 购买的IP，且代理类型为动态IP的 通过 user_get_proxy_account_info 接口获取，字段 proxyTime， 【取字典】
   */
  proxyTime: string;
  /**
   * 刷新URL， str, 代理刷新的时候会用到，非必传，对于代理方式为 购买的IP，且代理类型为动态IP的 通过 user_get_proxy_account_info 接口获取，字段 refreshUrl
   * 刷新URL， str, 代理刷新的时候会用到，非必传，对于代理方式为 购买的IP，且代理类型为动态IP的 通过 user_get_proxy_account_info 接口获取，字段 refreshUrl
   */
  refreshUrl: string;
  /**
   * 接入点, str, 非必传，【取字典】
   * 接入点, str, 非必传，【取字典】
   */
  accessServer: string;
  /**
   * 查询渠道，默认:IP123，枚举值：IP123,  str, 非必传， 【取字典】
   * 查询渠道，默认:IP123，枚举值：IP123,  str, 非必传， 【取字典】
   */
  checkChannel: string;
  /**
   * 一期用不上，不用传，proxyMethod=api时，提取链接的服务商，ROLA
   * 一期用不上，不用传，proxyMethod=api时，提取链接的服务商，ROLA
   */
  extraChannel: string;
  /**
   * 一期用不上，不用传，proxyMethod=api时，提取IP，每次打开都提取新IP，默认1, 枚举值：0和1, 传true和false
   * 一期用不上，不用传，proxyMethod=api时，提取IP，每次打开都提取新IP，默认1, 枚举值：0和1, 传true和false
   */
  isExtraNewIp: boolean;
  /**
   * 一期用不上，不用传，proxyMethod=api时，提取IP校验重复，1 校验，0不校验。打开窗口时，将检测提取IP是否重复，重复则重新提取，最多重新提取5次,默认0, 传true和false
   * 一期用不上，不用传，proxyMethod=api时，提取IP校验重复，1 校验，0不校验。打开窗口时，将检测提取IP是否重复，重复则重新提取，最多重新提取5次,默认0, 传true和false
   */
  isRepectCheck: boolean;
  /**
   * 一期用不上，不用传，proxyMethod=api时，提取IP链接，str
   * 一期用不上，不用传，proxyMethod=api时，提取IP链接，str
   */
  extraUrl: string;
  /**
   * 【页面暂时不显示】，关闭窗口时写入，给用户显示用
   * 【页面暂时不显示】，关闭窗口时写入，给用户显示用
   */
  lastIp: string;
  /**
   * 【页面暂时不显示】，关闭窗口时写入，给用户显示用
   * 【页面暂时不显示】，关闭窗口时写入，给用户显示用
   */
  lastCountry: string;
  /**
   * 语言，1:跟随IP匹配，0自定义，默认1，布尔值，必传, 传true和false
   * 界面语言，1:跟随IP匹配，0自定义，默认1，布尔值，必传, 传true和false
   */
  isLanguageBaseIp: boolean;
  /**
   * isLanguageBaseIp为0时选择的语言, 非必传， 【取字典】
   * isLanguageBaseIp为0时选择的语言, 非必传， 【取字典】
   */
  language: string;
  /**
   * 界面语言，1: 跟随IP匹配，0：自定义，默认1，布尔值，必传, 传true和false
   * 界面语言，1: 跟随IP匹配，0：自定义，默认1，布尔值，必传, 传true和false
   */
  isDisplayLanguageBaseIp: boolean;
  /**
   * isDisplayLanguageBaseIp为0时选择的语言, 非必传， 【取字典】
   * isDisplayLanguageBaseIp为0时选择的语言, 非必传， 【取字典】
   */
  displayLanguage: string;
  /**
   * 时区，1: 跟随IP匹配，0：自定义，默认1，布尔值，必传, 传true和false
   * 时区，1: 跟随IP匹配，0：自定义，默认1，布尔值，必传, 传true和false
   */
  isTimeZone: boolean;
  /**
   * isTimeZone为0时选择的时区, 非必传， 【取字典】
   * isTimeZone为0时选择的时区, 非必传， 【取字典】
   */
  timeZone: string;
  /**
   * 地理位置 0询问|1允许|2禁止，默认0，int, 必传
   * 地理位置 0询问|1允许|2禁止，默认0，int, 必传
   */
  position: number;
  /**
   * 基于IP生成对应的地理位置，不勾选可自定义，默认1，1：跟随IP匹配，0：自定义, 传true和false
   * 基于IP生成对应的地理位置，不勾选可自定义，默认1，1：跟随IP匹配，0：自定义, 传true和false
   */
  isPositionBaseIp: boolean;
  /**
   * 经度 isPositionBaseIp为0时设置, 非必传
   * 经度 isPositionBaseIp为0时设置, 非必传
   */
  longitude: string;
  /**
   * 纬度 isPositionBaseIp为0时设置, 非必传
   * 纬度 isPositionBaseIp为0时设置, 非必传
   */
  latitude: string;
  /**
   * 精度米 isPositionBaseIp为0时设置, 非必传
   * 精度米 isPositionBaseIp为0时设置, 非必传
   */
  precisionPos: string;
  /**
   * 声音，开启：1，关闭：0，默认1，布尔值，必传, 传true和false
   * 声音，开启：1，关闭：0，默认1，布尔值，必传, 传true和false
   */
  forbidAudio: boolean;
  /**
   * 图片，允许加载：1，禁止加载：0，默认1，int, 必传
   * 图片，允许加载：1，禁止加载：0，默认1，int, 必传
   */
  forbidImage: number;
  /**
   * 自定义加载图片尺寸，str, 非必传
   * 自定义加载图片尺寸，str, 非必传
   */
  forbiddenPictureSize: string;
  /**
   * 视频，允许加载：1，禁止加载：0，默认1，布尔值，必传, 传true和false
   * 视频，允许加载：1，禁止加载：0，默认1，布尔值，必传, 传true和false
   */
  forbidMedia: boolean;
  /**
   * 同步标签页，1：是，0：否，默认1，布尔值，必传, 传true和false
   * 同步标签页，1：是，0：否，默认1，布尔值，必传, 传true和false
   */
  syncTab: boolean;
  /**
   * 同步Cookie，1：是，0：否，默认1，布尔值，必传, 传true和false
   * 同步Cookie，1：是，0：否，默认1，布尔值，必传, 传true和false
   */
  syncCookie: boolean;
  /**
   * 多开设置，1：开启，0：关闭，默认0，布尔值，必传, 传true和false
   * 多开设置，1：开启，0：关闭，默认0，布尔值，必传, 传true和false
   */
  openMult: boolean;
  /**
   * 弹出保存密码，1：是，0：否，默认1，布尔值，必传, 传true和false
   * 弹出保存密码，1：是，0：否，默认1，布尔值，必传, 传true和false
   */
  forbidSavePassword: boolean;
  /**
   * 网络不通停止打开，1：是，0：否，默认1，布尔值，必传, 传true和false
   * 网络不通停止打开，1：是，0：否，默认1，布尔值，必传, 传true和false
   */
  stopOpenNet: boolean;
  /**
   * IP发生变化停止打开，1：是，0：否，默认0，布尔值，必传, 传true和false
   * IP发生变化停止打开，1：是，0：否，默认0，布尔值，必传, 传true和false
   */
  stopOpenIP: boolean;
  /**
   * IP对应国家/地区发生变化停止打开，1：是，0：否，默认0，布尔值，必传, 传true和false
   * IP对应国家/地区发生变化停止打开，1：是，0：否，默认0，布尔值，必传, 传true和false
   */
  stopOpenPosition: boolean;
  /**
   * 窗口名是否在标题栏显示，显示：true，不显示：false，布尔类型，非必传, 默认false
   * 窗口名是否在标题栏显示，显示：true，不显示：false，布尔类型，非必传, 默认false
   */
  isDisplayName: boolean;
  /**
   * 同步IndexedDB，1：是，0：否，默认0，布尔值，必传, 传true和false
   * 同步IndexedDB，1：是，0：否，默认0，布尔值，必传, 传true和false
   */
  syncIndexedDb: boolean;
  /**
   * 同步Local Storage，1：是，0：否，默认0，布尔值，必传, 传true和false
   * 同步Local Storage，1：是，0：否，默认0，布尔值，必传, 传true和false
   */
  syncLocalStorage: boolean;
  /**
   * 同步书签，1：是，0：否，默认0，布尔值，必传, 传true和false
   * 同步书签，1：是，0：否，默认0，布尔值，必传, 传true和false
   */
  syncBookmark: boolean;
  /**
   * 同步已保存的用户名密码，1：是，0：否，默认1，布尔值，必传, 传true和false
   * 同步已保存的用户名密码，1：是，0：否，默认1，布尔值，必传, 传true和false
   */
  syncPassword: boolean;
  /**
   * 同步历史记录，1：是，0：否，默认0，布尔值，必传, 传true和false
   * 同步历史记录，1：是，0：否，默认0，布尔值，必传, 传true和false
   */
  syncHistory: boolean;
  /**
   * 同步扩展应用数据，1：是，0：否，默认0，布尔值，必传, 传true和false
   * 同步扩展应用数据，1：是，0：否，默认0，布尔值，必传, 传true和false
   */
  syncExtensions: boolean;
  /**
   * 启动浏览器前删除缓存文件，1：是，0：否，默认0，布尔值，必传, 传true和false
   * 启动浏览器前删除缓存文件，1：是，0：否，默认0，布尔值，必传, 传true和false
   */
  clearCacheFile: boolean;
  /**
   * 启动浏览器前删除Cookie，1：是，0：否，默认0，布尔值，必传, 传true和false
   * 启动浏览器前删除Cookie，1：是，0：否，默认0，布尔值，必传, 传true和false
   */
  clearCookie: boolean;
  /**
   * 启动浏览器前删除历史记录，1：是，0：否，默认0，布尔值，必传, 传true和false
   * 启动浏览器前删除历史记录，1：是，0：否，默认0，布尔值，必传, 传true和false
   */
  clearHistory: boolean;
  /**
   * 启动浏览时随机指纹，1：是，0：否，默认0，布尔值，必传, 传true和false
   * 启动浏览时随机指纹，1：是，0：否，默认0，布尔值，必传, 传true和false
   */
  randomFingerprint: boolean;
  /**
   * 关闭浏览器后继续运行应用，1：是，0：否，默认0，布尔值，必传, 传true和false
   * 关闭浏览器后继续运行应用，1：是，0：否，默认0，布尔值，必传, 传true和false
   */
  allowRunApplication: boolean;
  /**
   * 使用硬件加速模式，1：是，0：否，默认1，布尔值，必传, 传true和false
   * 使用硬件加速模式，1：是，0：否，默认1，布尔值，必传, 传true和false
   */
  useGpu: boolean;
  /**
   * webrtc 0替换|1真实|2禁用，默认0，必传
   * webrtc 0替换|1真实|2禁用，默认0，必传
   */
  webRTC: number;
  /**
   * 忽略https证书错误，1|0，默认0，布尔值，必传, 传true和false
   * 忽略https证书错误，1|0，默认0，布尔值，必传, 传true和false
   */
  ignoreHttpsError: boolean;
  /**
   * 窗口尺寸，宽度, 非必传
   * 窗口尺寸，宽度, 非必传
   */
  openWidth: string;
  /**
   * 窗口尺寸，高度, 非必传
   * 窗口尺寸，高度, 非必传
   */
  openHeight: string;
  /**
   * 分辨率， 0跟随电脑 | 1自定义，默认0，布尔值，必传, 传true和false
   * 分辨率， 0跟随电脑 | 1自定义，默认0，布尔值，必传, 传true和false
   */
  resolutionType: boolean;
  /**
   * 自定义分辨率时，分辨率X值, 非必传， 【取字典】
   * 自定义分辨率时，分辨率X值, 非必传， 【取字典】
   */
  resolutionX: string;
  /**
   * 自定义分辨率时，分辨率Y值, 非必传， 【取字典】
   * 自定义分辨率时，分辨率Y值, 非必传， 【取字典】
   */
  resolutionY: string;
  /**
   * 字体， 0系统默认|1随机匹配，默认1，布尔值，必传, 传true和false
   * 字体， 0系统默认|1随机匹配，默认1，布尔值，必传, 传true和false
   */
  fontType: boolean;
  /**
   * 【页面不显示】,字体值，指纹会用到, 非必传
   * 【页面不显示】,字体值，指纹会用到, 非必传
   */
  font: string;
  /**
   * canvas 1随机｜0关闭，默认1，布尔值，必传, 传true和false
   * canvas 1随机｜0关闭，默认1，布尔值，必传, 传true和false
   */
  canvas: boolean;
  /**
   * 【页面不显示】，canvas为随机时设置， 噪音值 10000 - 1000000，指纹会用到, 非必传
   * 【页面不显示】，canvas为随机时设置， 噪音值 10000 - 1000000，指纹会用到, 非必传
   */
  canvasValue: string;
  /**
   * 取 1000-99999 之间的随机整数
   * 【页面不显示】，canvas为随机时设置，取 1000-99999 之间的随机整数，指纹会用到, 非必传
   */
  canvasValueV2: string;
  /**
   * webGL图像，1随机｜0关闭，默认1，布尔值，必传, 传true和false
   * webGL图像，1随机｜0关闭，默认1，布尔值，必传, 传true和false
   */
  webGL: boolean;
  /**
   * 【页面不显示】，webGL为随机时设置，随机噪音值 10000 - 1000000，指纹会用到, 非必传
   * 【页面不显示】，webGL为随机时设置，随机噪音值 10000 - 1000000，指纹会用到, 非必传
   */
  webGLValue: string;
  /**
   * webgl元数据 1自定义｜0关闭，默认1，布尔值，必传, 传true和false
   * webgl元数据 1自定义｜0关闭，默认1，布尔值，必传, 传true和false
   */
  webGLMeta: boolean;
  /**
   * webGLInfo开关，真实1，自定义0，默认0, 必传, 传true和false
   * webGLInfo开关，真实1，自定义0，默认0, 必传, 传true和false
   */
  webGLInfo: boolean;
  /**
   * webGLMeta自定义时，webGL厂商值, 非必传
   * webGLMeta自定义时，webGL厂商值, 非必传
   */
  webGLManufacturer: string;
  /**
   * webGLMeta自定义时，webGL渲染值, 非必传
   * webGLMeta自定义时，webGL渲染值, 非必传
   */
  webGLRender: string;
  /**
   * webGpu基于webgl匹配、real 真实、block 禁止，默认值：webgl，必传
   * webGpu基于webgl匹配、real 真实、block 禁止，默认值：webgl，必传
   */
  webGpu: string;
  /**
   * audioContext值，1随机｜0关闭，默认1，布尔值，必传, 传true和false
   * audioContext值，1随机｜0关闭，默认1，布尔值，必传, 传true和false
   */
  audioContext: boolean;
  /**
   * 【页面不显示】，audioContext为随机时，噪音值， 1 - 100 ，关闭时默认10，指纹会用到, 非必传
   * 【页面不显示】，audioContext为随机时，噪音值， 1 - 100 ，关闭时默认10，指纹会用到, 非必传
   */
  audioContextValue: string;
  /**
   * Speech Voices，1随机｜0关闭，默认1，布尔值，必传, 传true和false
   * Speech Voices，1随机｜0关闭，默认1，布尔值，必传, 传true和false
   */
  speechVoices: boolean;
  speechVoicesValue: {
    enable: boolean;
    voices: {
      name: string;
      lang: string;
      isLocalService: boolean;
    }[];
  };
  /**
   * doNotTrack 0关闭 | 1开启，默认1， 枚举值：0和1，布尔值，必传, 传true和false
   * doNotTrack 0关闭 | 1开启，默认1， 枚举值：0和1，布尔值，必传, 传true和false
   */
  doNotTrack: boolean;
  /**
   * ClientRects，1随机｜0关闭，默认1， 枚举值：0和1，布尔值，必传, 传true和false
   * ClientRects，1随机｜0关闭，默认1， 枚举值：0和1，布尔值，必传, 传true和false
   */
  clientRects: boolean;
  clientRectsValue: {
    enable: boolean;
    clientRectsNoiseFactorX: number;
    clientRectsNoiseFactorY: number;
  };
  /**
   * 媒体设备，1自定义｜0关闭，默认1， 枚举值：0和1，布尔值，必传, 传true和false
   * 媒体设备，1自定义｜0关闭，默认1， 枚举值：0和1，布尔值，必传, 传true和false
   */
  deviceInfo: boolean;
  /**
   * 设备名称开关，真实true，自定义false，默认false, 必传, 传true和false
   * 设备名称开关，真实true，自定义false，默认false, 必传, 传true和false
   */
  deviceNameSwitch: boolean;
  /**
   * 设备名称，deviceNameSwitch为false时设置，非必传，通过接口 user_get_device_name 获取
   * 设备名称，deviceNameSwitch为false时设置，非必传，通过接口 user_get_device_name 获取
   */
  deviceName: string;
  /**
   * mac地址开关，真实true，自定义false，默认false, 必传, 传true和false
   * mac地址开关，真实true，自定义false，默认false, 必传, 传true和false
   */
  macInfo: boolean;
  /**
   * mac地址，deviceInfo为1时设置，非必传，通过接口 user_get_mac_addr 获取
   * mac地址，deviceInfo为1时设置，非必传，通过接口 user_get_mac_addr 获取
   */
  macAddr: string;
  /**
   * 端口扫描保护 0关闭｜1开启，默认1， 枚举值：0和1，布尔值，必传, 传true和false
   * 端口扫描保护 0关闭｜1开启，默认1， 枚举值：0和1，布尔值，必传, 传true和false
   */
  portScanProtect: boolean;
  /**
   * 端口扫描保护开启时的白名单，逗号分隔，str, 非必传
   * 端口扫描保护开启时的白名单，逗号分隔，str, 非必传
   */
  portScanList: string;
  /**
   * ssl指纹设置，0关闭｜1开启，默认1， 枚举值：0和1，布尔值，必传, 传true和false
   * ssl指纹设置，0关闭｜1开启，默认1， 枚举值：0和1，布尔值，必传, 传true和false
   */
  disableSsl: boolean;
  /**
   * 序列化的ssl特性值，List格式，必传， 【取字典】
   * 序列化的ssl特性值，List格式，必传， 【取字典】
   */
  disableSslList: string[];
  /**
   * 自定义插件指纹，0关闭｜1开启，默认1， 枚举值：0和1，布尔值，必传, 传true和false
   * 自定义插件指纹，0关闭｜1开启，默认1， 枚举值：0和1，布尔值，必传, 传true和false
   */
  enablePlugin: boolean;
  enablePluginList: {
    name: string;
    description: string;
    filename: string;
    mimeType: string;
    mimeDescription: string;
    suffixes: number;
  }[];
  /**
   * 【页面不显示】，媒体设备，默认0，需要前端生成，布尔值，必传, 传true和false
   * 【页面不显示】，媒体设备，默认0，需要前端生成，布尔值，必传, 传true和false
   */
  mediaDevice: boolean;
  mediaDeviceList: {
    deviceType?: string;
    deviceId?: string;
    label?: string;
    groupId?: string;
  }[];
  /**
   * 硬件并发数，默认4, 非必传， 【取字典】
   * 硬件并发数，默认4, 非必传， 【取字典】
   */
  hardwareConcurrent: number;
  /**
   * 设备内存，1，2，4，8，不要传入大于8的值，默认8, 非必传， 【取字典】
   * 设备内存，1，2，4，8，不要传入大于8的值，默认8, 非必传， 【取字典】
   */
  deviceMemory: number;
  /** 平台ID列表 */
  platformUrlIds: number[];
  /** 沙盒启禁参数 */
  sandboxPermission: boolean;
  /** 启动参数 */
  startupParam: string;
  /**
   * 单个窗口的平台信息
   * [
   *       {
   *         "platformUrl": "https://www.test.com/",
   *         "platformIcon": "https://lumibrowser.oss-cn-shenzhen.aliyuncs.com/public/static/platform_icon/Facebook.png",
   *         "platformUserName": "fhr66",
   *         "platformPassword": "12345655",
   *         "platformEfa": "111111111155",
   *         "platformcookies": "test",
   *         "platformName": "测试名字66",
   *         "platformRemarks": "平台备注55"
   *       }
   *     ]
   */
  windowPlatformList: string[];
  /**
   * 代理测试状态
   * 代理测试状态,0:没有测试，1:测试成功，2:检测失败
   */
  checkStatus: number;
}

export interface UserAddWindowInfoV2CreateData {
  code: number;
  data: {
    createBy: number;
    windowUserId: number;
    windowId: number;
  };
  msg: string;
}

export interface UserMdfWindowInfoSingleV2CreatePayload {
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
  canvasValueV2?: string;
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
  deviceMemory?: number;
  /**
   * 单个窗口的平台信息
   * [       {         "platformUrl": "https://www.test.com/",         "platformIcon": "https://lumibrowser.oss-cn-shenzhen.aliyuncs.com/public/static/platform_icon/Facebook.png",         "platformUserName": "fhr66",         "platformPassword": "12345655",         "platformEfa": "111111111155",         "platformcookies": "test",         "platformName": "测试名字66",         "platformRemarks": "平台备注55"       }     ]
   */
  windowPlatformList?: string[];
  /** 平台ID列表 */
  platformUrlIds?: number[];
  /**
   * 代理检测状态
   * 代理测试状态,0:没有测试，1:测试成功，2:检测失败
   */
  checkStatus?: number;
}

export interface UserMdfWindowInfoSingleV2CreateData {
  code: number;
  msg: string;
}

export interface UserGetLabelInfoApiListParams {
  /**
   * 空间ID必填
   * @example 1
   */
  workspaceId: number;
}

export interface UserGetLabelInfoApiListData {
  code: number;
  data: {
    /** 标签ID */
    id?: number;
    /** 标签颜色 */
    color?: string;
    /** 标签名称 */
    name?: string;
  }[];
  msg: string;
}

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
    is_migrate: boolean;
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

export interface ForgetPasswordCreatePayload {
  /** 邮箱, str, 必传 */
  email: string;
  /** 验证码, str, 必传 */
  ver_code: string;
  /** 新密码 */
  new_pwd: string;
}

export interface ForgetPasswordCreateData {
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
  ver_code: string;
}

export interface UserChangeEmailCreateData {
  code: number;
  msg: string;
}

export interface UserGetUserInfoListData {
  code: number;
  data: {
    /** 用户ID */
    id: number;
    /** 用户名 */
    userName: string;
    /** 真实姓名 */
    realName: string;
    /** 手机号 */
    phone: string;
    /** 邮箱 */
    email: string;
    /** 用户身份：创始用户:old,特邀用户:invited,普通用户:new */
    userIdentity: string;
    /** 名下用户：true:有,false：没有 */
    underName: boolean;
    /** 推荐用户：true:是,false：不是 */
    recommendUser: boolean;
    /** 头像 */
    avatar: string;
    /** 头像颜色 */
    avatarColor: string;
    /** 最大打开数量 */
    maxOpenCount: number;
    /** 创建时间 */
    createTime: string;
    /** 修改时间 */
    updateTime: string;
    /** 已打开次数 */
    useOpenCount: number;
    /** 工作空间ID */
    workspaceId: number;
    /** 用户身份,老用户:old 新用户:new 特邀用户:invited 邀请用户:inviteLink */
    identity: string;
    /** 最大窗口数量 */
    maxWindowCount: number;
    /** 已使用窗口数量 */
    useWindowCount: number;
    /** 已使用空间数量 */
    useWorkspaceCount: number;
    /** 获取用户总空间数量 */
    maxWorkspaceCount: number;
    /** 邀请链接 */
    inviteLink: string;
    /** 首次创建空间提示 */
    firstCreateTip: boolean;
    clientId: string;
  };
  msg: string;
}

export interface UserGetAppUpgradeCreatePayload {
  /**
   * 操作系统
   * 如 "win32", "darwin"，str，必传
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
  code: number;
  data: {
    /** 下载地址 */
    downloadUrl: string;
    /** 版本号，我们自己定义的版本号，用来和客户端的比对 */
    version: string;
    /** 升级标题 */
    upgradeTitle: string;
    /** 升级描述 */
    upgradeDesc: string;
    upgradeContent: {
      new_function: string;
      optimize: string;
      resolve_bug: string;
    };
    /** 发布时间 */
    releaseTime: string;
    upgradeContentEn: {
      new_function: string;
      optimize: string;
      resolve_bug: string;
    };
    /** 根据用户的IP切换对应的域名，如果是国内就用深圳，国外就是香港 */
    webDomain: string;
    /** 判断是否强制，true强制，false不强制 */
    forceUpgrade: boolean;
  };
  msg: string;
}

export interface UserGetCoreUpgradeCreatePayload {
  /**
   * 操作系统
   * 如 "win32", "darwin"，str，必传
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
      coreVersion?: string;
      version?: string;
      downloadUrl?: string;
      upgradeTitle?: string;
      upgradeDesc?: string;
      releaseTime?: string;
      upgradeContent?: string;
      upgradeContentEn?: string;
      upgradeContentRu?: string;
    }[];
  };
  msg: string;
}

export interface UserGetUserConfigListData {
  code: number;
  data: {
    /** 语言 */
    language: string;
    /** 时区 */
    timeZone: string;
    /** 软件关闭时，枚举：pop: 弹出提示，min: 最小化至托盘，exit: 退出软件 */
    closeSoft: string;
    /** 文件下载目录 */
    uploadDir: string;
    /** 文件缓存目录 */
    cacheDir: string;
    /** 缓存删除条件，5天前的 */
    autoDelDays: string;
    /** 缓存删除条件，2GB以上的 */
    autoDelSize: string;
    /** 性能监控，内存使用率%95以上时停止打开窗口 */
    memoryLimit: string;
    /** app 风格 0:系统 ,1:亮色,2:暗色 */
    appearance: number;
    /** 系统代理开关，true,false,默认true */
    systemProxySwitch: boolean;
    /** v2ray开关，true,false,默认true */
    v2raySwitch: boolean;
    /** ip检测 */
    ipChecker: string;
    /** 偏好设置 */
    preferenceSettings: object;
    /** 快捷键设置 */
    keySettings: object;
    /** 同步设置 */
    syncSettings: object;
    ipBlackList: string[];
    blockDomainList: string[];
    uaModeSwitch: number;
  };
  msg: string;
}

export interface UserGetDefConfigListData {
  code: number;
  data: {
    /** 语言 */
    language: string;
    /** 时区 */
    timeZone: string;
    /** 软件关闭时，枚举：pop: 弹出提示，min: 最小化至托盘，exit: 退出软件 */
    closeSoft: string;
    /** 文件下载目录 */
    uploadDir: string;
    /** 文件缓存目录 */
    cacheDir: string;
    /** 缓存删除条件，5天前的 */
    autoDelDays: string;
    /** 缓存删除条件，2GB以上的 */
    autoDelSize: string;
    /** 性能监控，内存使用率%95以上时停止打开窗口 */
    memoryLimit: string;
    /** 系统代理开关，true,false,默认true */
    systemProxySwitch: boolean;
    /** v2ray开关，true,false,默认true */
    v2raySwitch: boolean;
    /** ip检测 */
    ipChecker: string;
    /** 偏好设置 */
    preferenceSettings: object;
    /** 快捷键设置 */
    keySettings: object;
    /** 同步设置 */
    syncSettings: object;
    ipBlackList: string[];
    blockDomainList: string[];
  };
  msg: string;
}

export interface UserSetUserConfigCreatePayload {
  language?: string;
  timeZone?: string;
  closeSoft?: string;
  uploadDir?: string;
  cacheDir?: string;
  autoDelDays?: string;
  autoDelSize?: string;
  memoryLimit?: string;
  appearance?: number;
  systemProxySwitch?: boolean;
  v2raySwitch?: boolean;
  ipChecker?: string;
  /** 偏好设置 */
  preferenceSettings?: object;
  /** 快捷键设置 */
  keySettings?: object;
  /** 同步设置 */
  syncSettings?: object;
  ipBlackList?: string[];
  apiToken?: string;
}

export interface UserSetUserConfigCreateData {
  code: number;
  msg: string;
}

export interface UserGetUserApiListData {
  code: number;
  data: {
    apiKey: string;
    port: number;
    open: boolean;
    apiRate: number;
  };
  msg: string;
}

export interface UserSetUserApiCreatePayload {
  /** api */
  apiKey: string;
  /** 端口 */
  port: number;
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

export interface UserGetSystemDictV2CreatePayload {
  /** 字典类型，str, 必传 */
  type: string[];
}

export interface UserGetSystemDictV2CreateData {
  code: number;
  data: {
    type: string;
    label: string;
    value: string;
  }[];
  msg: string;
}

export interface UserGetAnntListListData {
  code: number;
  data: {
    rows: {
      /** 公告ID */
      id?: number;
      /** 语言 */
      language?: string;
      /** 原公告内容 */
      announcement?: string;
      /** 公告链接 */
      href?: string;
      /** 公告发布时间 */
      createTime?: string;
      /** 颜色提示：success(绿色), warning（警告）, error（错误）, info（信息） */
      colorTips?: string;
    }[];
  };
  msg: string;
}

export interface UserGetNotifyListData {
  code: number;
  data: {
    id?: number;
    type?: string;
    notify?: string;
    status?: number;
    /**
     * 用户身份：创始用户:old,特邀用户:invited,普通用户:new
     * 用户身份：创始用户:old,特邀用户:invited,普通用户:new
     */
    userIdentity?: string;
    /**
     * 名下用户：true:有,false：没有
     * 名下用户：true:有,false：没有
     */
    underName?: boolean;
    /**
     * 推荐用户：true:是,false：不是
     * 推荐用户：true:是,false：不是
     */
    recommendUser?: boolean;
    createTime?: string;
    messageModule?: string;
    userName?: string;
    avatar?: string;
    avatarColor?: string;
    paramData?: {
      data: string;
      workspaceName: string;
      workspacePicture: string;
      endTime: string;
    };
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

export interface LoginGoogleV2CreatePayload {
  /** 传入谷歌登录token */
  googleToken: string;
}

export interface LoginGoogleV2CreateData {
  code: number;
  data: {
    /** 登录token */
    token: string;
    /** 用户类型 */
    type: number;
    /** 用户邮箱 */
    user_name: string;
    /** 用户ID */
    user_id: number;
    /** 账号类型 */
    role: string;
    /** 是否迁移 */
    is_migrate: boolean;
    /** 工作空间ID */
    workspaceId: number;
  };
  msg: string;
}

export interface UserGetOssCredentialV2ListData {
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

export interface UserUploadAvatarCreatePayload {
  avatar: string;
}

export interface UserUploadAvatarCreateData {
  code: number;
  msg: string;
}

export interface UserChangeUsernameCreatePayload {
  /** 用户名 */
  userName: string;
}

export interface UserChangeUsernameCreateData {
  code: number;
  msg: string;
}

export interface GetCheckBindEmailVerCodeListParams {
  /** 邮箱 */
  email: string;
  /** 验证码 */
  ver_code: string;
}

export interface GetCheckBindEmailVerCodeListData {
  code: number;
  /** 验证码是成功 */
  data: boolean;
  msg: string;
}

export interface UserMigrateDataListData {
  code: number;
  msg: string;
}

export interface GetAppUpgradeCreatePayload {
  /**
   * 操作系统
   * 如 "win32", "darwin"，str，必传
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

export interface GetAppUpgradeCreateData {
  code: number;
  data: {
    /** 下载地址 */
    downloadUrl: string;
    /** 版本号，我们自己定义的版本号，用来和客户端的比对 */
    version: string;
    /** 升级标题 */
    upgradeTitle: string;
    /** 升级描述 */
    upgradeDesc: string;
    upgradeContent: {
      new_function: string;
      optimize: string;
      resolve_bug: string;
    };
    /** 发布时间 */
    releaseTime: string;
    upgradeContentEn: {
      new_function: string;
      optimize: string;
      resolve_bug: string;
    };
    /** 根据用户的IP切换对应的域名，如果是国内就用深圳，国外就是香港 */
    webDomain: string;
  };
  msg: string;
}

export interface SaveChannelSourcesPeopleListParams {
  /** 渠道来源 */
  channelSource: string;
}

export interface SaveChannelSourcesPeopleListData {
  code: number;
  msg: string;
}

export interface UserGetInviteUserListV2ListParams {
  /**
   * 来源，邀请码，A1,B,C,D
   * @example ""
   */
  source?: string;
  /**
   * 开始时间
   * @example 1741104000
   */
  start_time?: number;
  /**
   * 结束时间
   * @example 1741104000
   */
  end_time?: number;
  /**
   * 分页索引, int, 非必传, 默认1
   * @example 1
   */
  page_index: number;
  /**
   * 分页条数, int, 非必传, 默认15
   * @example 15
   */
  page_size: number;
}

export interface UserGetInviteUserListV2ListData {
  code: number;
  data: {
    total: number;
    rows: {
      /** 邮箱 */
      email?: string;
      /** 创建时间 */
      createTime?: string;
      /** 推广者返利(%) */
      youGet?: number;
      /** 用户折扣(%)(%) */
      theyGet?: number;
      /** 邀请来源：inviteCode：邀请码，inviteLink：邀请链接 */
      source?: string;
    }[];
  };
  msg: string;
}

export interface UserGetInviteCodeListData {
  code: number;
  data: {
    /** 邀请码 */
    invite_code: string;
    /** 截止时间 */
    expire_time: number;
  };
  msg: string;
}

export interface UserGetInviteLinkListData {
  code: number;
  data: {
    /** 邀请链接 */
    invite_link: string;
  };
  msg: string;
}

export interface UserWriteInviteCodeCreatePayload {
  /** 邀请码 */
  inviteCode: string;
}

export interface UserWriteInviteCodeCreateData {
  code: number;
  msg: string;
}

export interface UserGetBannerPictureListListParams {
  /** 链接类型 */
  linkType?: string;
}

export interface UserGetBannerPictureListListData {
  code: number;
  data: {
    language: string;
    images: {
      size: string;
      image: string;
    }[];
  }[];
  msg: string;
}

export interface GetCoreUpgradeCreatePayload {
  /**
   * 操作系统
   * 如 "win32", "darwin"，str，必传
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

export interface GetCoreUpgradeCreateData {
  code: number;
  data: {
    rows: {
      coreVersion?: string;
      version?: string;
      downloadUrl?: string;
      upgradeTitle?: string;
      upgradeDesc?: string;
      releaseTime?: string;
      upgradeContent?: string;
      upgradeContentEn?: string;
      upgradeContentRu?: string;
    }[];
  };
  msg: string;
}

export interface UserSettingPasswordCreatePayload {
  /** 邮箱 */
  email: string;
  /** 验证码 */
  ver_code: string;
  /** 密码 */
  password: string;
}

export interface UserSettingPasswordCreateData {
  code: number;
  msg: string;
}

export interface UserSettingPasswordVerifyCodeListParams {
  /**
   * 邮箱
   * @example "166533381@qq.com"
   */
  email: string;
}

export interface UserSettingPasswordVerifyCodeListData {
  code: number;
  msg: string;
}

export interface LoginGithubCreatePayload {
  /** 传入github登录token */
  githubToken: string;
}

export interface LoginGithubCreateData {
  code: number;
  data: {
    /** 登录token */
    token: string;
    /** 用户类型 */
    type: number;
    /** 用户邮箱 */
    user_name: string;
    /** 用户ID */
    user_id: number;
    /** 账号类型 */
    role: string;
    /** 是否迁移 */
    is_migrate: boolean;
    /** 工作空间ID */
    workspaceId: number;
  };
  msg: string;
}

export interface UserGetLoginInfoListData {
  code: number;
  data: {
    /** 用户id */
    id?: number;
    /** 用户IP地址 */
    address?: string;
    /** 平台 */
    platform?: string;
    /** 设备名称 */
    deviceName?: string;
    /** 设备ID */
    deviceId?: string;
    /** 位置 */
    location?: string;
    /** 登录时间 */
    createTime?: string;
  }[];
  msg: string;
}

export interface CheckOtherDeviceLoginListParams {
  /** 用户名或者邮箱 */
  user_name?: string;
  /** 密码 */
  password?: string;
  /**
   * 登录类型
   * @example "login/google/github"
   */
  login_type: string;
  /**
   * 登录token：google/github token
   * @example ""
   */
  login_token?: string;
}

export interface CheckOtherDeviceLoginListData {
  code: number;
  data: {
    /** True ：有其他设备登录， False：无其他设备登录 */
    has_other_login: boolean;
  };
  msg: string;
}

export interface UserGetPromotionInfoListData {
  code: number;
  data: {
    /** 可提现金额 */
    withdrawAmount: number;
    /** 用户推广点击链接次数 */
    promotionClickCount: number;
    /** 当天推广点击链接次数 */
    todayPromotionClickCount: number;
    /** 已注册的用户数量 */
    registeredUserNum: number;
    /** 当天注册的用户数量 */
    todayRegisteredUserNum: number;
    /** 已下单购买成功的用户数量 */
    purchaseUserNum: number;
    /** 当天下单购买成功的用户数量 */
    todayPurchaseUserNum: number;
    /** 用户总收益 */
    totalIncome: number;
    /** 当天收益 */
    todayIncome: number;
    /** 推荐用户的总交易额 */
    purchaseUserTotalAmount: number;
    /** 待收益金额 */
    pendingAmount: number;
    promotionLinkList: {
      promotionLink?: string;
      linkType?: string;
      linkStatus?: number;
      promotionDiscount?: number;
      userDiscount?: number;
    }[];
  };
  msg: string;
}

export interface UserGetRewardRecordListListParams {
  /**
   * 来源
   * @example "A,B,C,D"
   */
  source?: string;
  /**
   * 支付开始时间
   * @example 1741104000
   */
  start_time?: number;
  /**
   * 支付结束时间
   * @example 1741104000
   */
  end_time?: number;
  /**
   * 充值状态
   * @example "active,pending"
   */
  reward_status?: string;
  /**
   * 分页索引, int, 非必传, 默认1
   * @example 1
   */
  page_index: number;
  /**
   * 分页条数, int, 非必传, 默认15
   * @example 15
   */
  page_size: number;
}

export interface UserGetRewardRecordListListData {
  code: number;
  data: {
    total: number;
    rows: {
      /** 邮箱 */
      email?: string;
      /** 来源 A1,B,C,D */
      source?: string;
      /** 支付金额 */
      payAmount?: number;
      /** 奖励百分比（%） */
      rewardRatio?: number;
      /** 奖励金额 */
      reward?: number;
      /** 状态：审核中：auditing,审核成功： approved, 审核失败：rejected */
      rewardStatus?: string;
      /** 支付时间 */
      payTime?: number;
    }[];
  };
  msg: string;
}

export interface UserGetWithdrawRecordListListParams {
  /**
   * 提款方式：Balance，USDT
   * @example "Balance"
   */
  withdraw_type?: string;
  /**
   * 提款开始时间
   * @example "1741104000"
   */
  start_time?: string;
  /**
   * 提款结束时间
   * @example "1741104000"
   */
  end_time?: string;
  /**
   * 提款状态：Success,Pending，Fail
   * @example "Success"
   */
  withdraw_status?: string;
  /**
   * 分页索引, int, 非必传, 默认1
   * @example 1
   */
  page_index: number;
  /**
   * 分页条数, int, 非必传, 默认15
   * @example 15
   */
  page_size: number;
}

export interface UserGetWithdrawRecordListListData {
  code: number;
  data: {
    total: number;
    rows: {
      /** 提款方式 */
      withdrawType?: string;
      /** 提款金额（美元） */
      withdrawAmount?: number;
      /** 状态：active,pending，fail */
      rewardStatus?: string;
      /** 提款时间 */
      withdrawTime?: string;
    }[];
  };
  msg: string;
}

export interface UserWithdrawCreatePayload {
  /** 提现金额 */
  amount: number;
  /** 提现方式：Balance，USDT */
  withdraw_method: string;
  /** 提现地址：USDT才有，余额可以不用传 */
  withdraw_address?: string;
  /** 提现验证码：USDT才有，余额可以不用传 */
  ver_code?: string;
}

export interface UserWithdrawCreateData {
  code: number;
  msg: string;
}

export interface SavePromotionLinkClickCountListParams {
  /** 链接码 */
  code: string;
}

export interface SavePromotionLinkClickCountListData {
  code: number;
  msg: string;
}

export interface UserWithdrawVerifyCodeListData {
  code: number;
  msg: string;
}

export interface UserVerifyEmailCreatePayload {
  /** 来源 new,old */
  source: string;
  /** 来源是new的才需要 */
  email?: string;
}

export interface UserVerifyEmailCreateData {
  code: number;
  msg: string;
}

export interface UserGetCheckOldEmailVerCodeListParams {
  /** 密码 */
  password?: string;
  /** 验证码 */
  ver_code?: string;
}

export interface UserGetCheckOldEmailVerCodeListData {
  code: number;
  /** 验证码是成功 */
  data: boolean;
  msg: string;
}

export interface UserGetBannerPictureListV2ListParams {
  /** 链接类型：Link_C、Link_B、Link_A、Link_S */
  linkType?: string;
}

export interface UserGetBannerPictureListV2ListData {
  code: number;
  data: {
    language: string;
    images: {
      size: string;
      image: string;
    }[];
  }[];
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

export interface UserClearWindowCacheCreatePayload {
  /** 要清空的窗口id列表 */
  ids: number[];
}

export interface UserClearWindowCacheCreateData {
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
      bindWindowIds: number[];
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

export interface UserUpdateWindowFilterNameCreatePayload {
  /** 旧的标签页名称 */
  old_filter_name: string;
  /** 新的标签页名称 */
  new_filter_name: string;
  /** 排序 */
  sort: number;
  filter_condition: {
    /** 操作系统 */
    osList?: string;
    /** 窗口名 */
    windowName?: string;
    /** 备注内容 */
    windowRemark?: string;
    /** 序号 */
    sortNum?: string;
    /** 平台 */
    platformIds?: string;
    /** 窗口状态 "true"：打开,"false":关闭 */
    openStatus?: string;
    /** 开始时间 */
    startDate?: string;
    /** 结束时间 */
    endDate?: string;
  };
  filter_rule?: {
    /**
     * 名称
     * 名称
     */
    name?: string;
    /**
     * 排序
     * 排序
     */
    sort?: number;
    /**
     * 状态
     * 状态
     */
    status?: number;
  }[];
}

export interface UserUpdateWindowFilterNameCreateData {
  code: number;
  msg: string;
}

export interface UserDeleteWindowFilterNameCreatePayload {
  /** 标签名 */
  filter_name: string;
}

export interface UserDeleteWindowFilterNameCreateData {
  code: number;
  msg: string;
}

export interface UserAddWindowFilterNameCreatePayload {
  /** 标签名 */
  filter_name: string;
  filter_condition: {
    /** 操作系统 */
    osList?: string;
    /** 窗口名 */
    windowName?: string;
    /** 备注内容 */
    windowRemark?: string;
    /** 序号 */
    sortNum?: string;
    /** 平台 */
    platformIds?: string;
    /** 窗口状态 "true"：打开,"false":关闭 */
    openStatus?: string;
    /** 开始时间 */
    startDate?: string;
    /** 结束时间 */
    endDate?: string;
  };
  filter_rule: {
    /** 名称 */
    name?: string;
    /** 排序 */
    sort?: number;
    /** 状态 */
    status?: number;
  }[];
}

export interface UserAddWindowFilterNameCreateData {
  code: number;
  msg: string;
}

export interface UserGetWindowFilterNameListListData {
  code: number;
  data: {
    /** 标签名 */
    filter_name: string;
    /** 查询条件 */
    filter_condition: {
      osList: string;
      windowName: string;
      windowRemark: string;
      sortNum: string;
      platformIds: string;
      openStatus?: string;
      startDate?: string;
      endDate?: string;
    };
    /** 排序规则 */
    filter_rule: {
      /** 名称 */
      name: string;
      /** 排序 */
      sort: number;
      /** 状态 */
      status: number;
    }[];
    /** 排序 */
    sort: number;
  }[];
  msg: string;
}

export interface UserSaveWindowTableSortOrderCreatePayload {
  /** 名称 */
  orderName: string;
  /** 判断降序还是升序 */
  orderType: string;
}

export interface UserSaveWindowTableSortOrderCreateData {
  code: number;
  msg: string;
}

export interface UserGetWindowTableSortOrderListData {
  code: number;
  data: {
    orderName: string;
    orderType: string;
  };
  msg: string;
}

export interface UserBatchWindowInfoV2CreatePayload {
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
    canvasValuev2?: string;
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
  /** 代理详细信息 */
  proxyInfoList: string[];
}

export interface UserBatchWindowInfoV2CreateData {
  code: number;
  msg: string;
}

export interface UserGetWindowRowsSortListData {
  code: number;
  data: {
    name: string;
    sort: string;
    status: number;
  }[];
  msg: string;
}

export interface UserImportWindowInfoV2CreatePayload {
  /** 文件名，str，必传 */
  fileName: string;
  /** excel数据 */
  excelData: {
    /** 行号，int，必传 */
    rowNum?: number;
    /** 窗口名称，str，必传 */
    windowName?: string;
    /** 分组名称, str，非必传 */
    groupName?: string;
    /** 账号平台，str，非必传 */
    platformUrl?: string;
    /** 用户名，str，非必传 */
    platformUserName?: string;
    /** 密码，str，非必传 */
    platformPassword?: string;
    /** 2fa，str，非必传 */
    efa?: string;
    cookie?: {
      name?: string;
      path?: string;
      domain?: string;
    }[];
    defaultOpenUrl?: string;
    /** 代理类型，枚举值:直连模式、socks5、http、https, str，非必传 */
    proxyMethod?: string;
    /** 代理信息，格式: 192.168.0.1: 8800:user:password，非必传 */
    proxyInfo?: string;
    /** 刷新URL， str, 非必传 */
    refreshUrl?: string;
    /** 窗口备注，str，非必传 */
    windowRemark?: string;
    /** User Agent，str, 非必传 */
    userAgent?: string;
    /** 窗口尺寸，格式：数字*数字，str, 非必传 */
    windowSize?: string;
  }[];
  fingerDetail: {
    /** 【页面不显示】,字体值，指纹会用到, 非必传 */
    font?: string;
    /** 【页面不显示】，canvas为随机时设置， 噪音值 10000 - 1000000，指纹会用到, 非必传 */
    canvasValue?: string;
    /** 取 1000-99999 之间的随机整数 */
    canvasValueV2?: string;
    /** 【页面不显示】，webGL为随机时设置，随机噪音值 10000 - 1000000，指纹会用到, 非必传 */
    webGLValue?: string;
    /** webGLMeta自定义时，webGL厂商值, 非必传 */
    webGLManufacturer?: string;
    /** webGLMeta自定义时，webGL渲染值, 非必传 */
    webGLRender?: string;
    /** 【页面不显示】，audioContext为随机时，噪音值， 1 - 100 ，关闭时默认10，指纹会用到, 非必传 */
    audioContextValue?: string;
    /** 【页面不显示】，speechVoices为1时生成，指纹会用到，Json格式，非必传 */
    speechVoicesValue?: object;
    /** 【页面不显示】，speechVoices为1时生成，指纹会用到，Json格式，非必传 */
    clientRectsValue?: object;
    /** 【页面不显示】，媒体设备，默认0，需要前端生成，布尔值，非必传, 传true和false */
    mediaDevice?: boolean;
    /** 【页面不显示】，媒体设备列表，指纹会用到，List格式，非必传 */
    mediaDeviceList?: string[];
    /** 设备名称，deviceInfo为1时设置，非必传，通过接口 user_get_device_name 获取 */
    deviceName?: string;
    /** mac地址，deviceInfo为1时设置，非必传，通过接口 user_get_mac_addr 获取 */
    macAddr?: string;
  }[];
  /** 语言，1:跟随IP匹配，0自定义，默认1，布尔值，必传, 传true和false */
  isLanguageBaseIp: boolean;
  /** isLanguageBaseIp为0时选择的语言, 非必传， 【取字典】 */
  language: string;
  /** 界面语言，1: 跟随IP匹配，0：自定义，默认1，布尔值，必传, 传true和false */
  isDisplayLanguageBaseIp: boolean;
  /** isDisplayLanguageBaseIp为0时选择的语言, 非必传， 【取字典】 */
  displayLanguage: string;
  /** 时区，1: 跟随IP匹配，0：自定义，默认1，布尔值，必传, 传true和false */
  isTimeZone: boolean;
  /** isTimeZone为0时选择的时区, 非必传， 【取字典】 */
  timeZone: string;
  /** 地理位置 0询问|1允许|2禁止，默认0，int, 必传 */
  position: number;
  /** 基于IP生成对应的地理位置，不勾选可自定义，默认1，1：跟随IP匹配，0：自定义, 传true和false */
  isPositionBaseIp: boolean;
  /** user_get_ua_webgl	经度 isPositionBaseIp为0时设置, 非必传 */
  longitude: string;
  /** 纬度 isPositionBaseIp为0时设置, 非必传 */
  latitude: string;
  /** 精度米 isPositionBaseIp为0时设置, 非必传 */
  precisionPos: string;
  /** # 声音，开启：1，关闭：0，默认1，布尔值，必传, 传true和false */
  forbidAudio: boolean;
  /** 图片，允许加载：1，禁止加载：0，默认1，int, 必传 */
  forbidImage: number;
  /** 自定义加载图片尺寸，str, 非必传 */
  forbiddenPictureSize: string;
  /** 视频，允许加载：1，禁止加载：0，默认1，布尔值，必传, 传true和false */
  forbidMedia: boolean;
  /** 同步标签页，1：是，0：否，默认1，布尔值，必传, 传true和false */
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
  allowRunApplication: boolean;
  useGpu: boolean;
  webRTC: number;
  isDisplayName: boolean;
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

export interface UserImportWindowInfoV2CreateData {
  code: number;
  data: {
    createBy: number;
    windowUserId: number;
    windowId: number;
  };
  msg: string;
}

export interface UserUpdateWindowFilterSortCreatePayload {
  sort_data: {
    name?: string;
    sort?: number;
  }[];
}

export interface UserUpdateWindowFilterSortCreateData {
  code: number;
  msg: string;
}

export interface UserMdfWindowInfoBatchV2CreatePayload {
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
    canvasValueV2?: string;
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

export interface UserMdfWindowInfoBatchV2CreateData {
  code: number;
  msg: string;
}

export interface UserGetWindowTemplateListListData {
  code: number;
  data: {
    /** 模板ID */
    id: number;
    /** 模板名称 */
    templateName: string;
    /** 模板内容 */
    content: string;
    /** 用户ID */
    userId: number;
  }[];
  msg: string;
}

export interface UserAddWindowTemplateInfoCreatePayload {
  /** 模板名称 */
  templateName: string;
  /** 模板内容 */
  content?: string;
}

export interface UserAddWindowTemplateInfoCreateData {
  code: number;
  msg: string;
}

export interface UserMdfWindowTemplateInfoCreatePayload {
  /** 模板ID */
  id: number;
  /** 模板名称 */
  templateName: string;
  /** 模板内容 */
  content?: string;
}

export interface UserMdfWindowTemplateInfoCreateData {
  code: number;
  msg: string;
}

export interface UserDeleteWindowTemplateInfoCreatePayload {
  /** 要删除的模板id列表 */
  id: number;
}

export interface UserDeleteWindowTemplateInfoCreateData {
  code: number;
  msg: string;
}

export interface UserGetWindowInfoListListParams {
  /**
   * 分页索引, int, 非必传, 默认1
   * @example 1
   */
  page_index: number;
  /**
   * 分页条数, int, 非必传, 默认15
   * @example 15
   */
  page_size: number;
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
   * 窗口备注, str, 非必传
   * @example "窗口1"
   */
  windowRemark?: string;
  /**
   * 窗口状态, str, 非必传,ture:打开,false:关闭
   * @example "true"
   */
  openStatus?: string;
  /**
   * 窗口收藏, str, 非必传
   * @example "true"
   */
  isOften?: string;
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
   * 标签id列表, 多个使用英文逗号分隔, str, 非必传 (多选)
   * @example "10,20,33"
   */
  labelIds?: string;
  /**
   * 账号平台（多选）,传数字ID
   * @example "1,2,3"
   */
  platformUrlIds?: string;
  /**
   * 操作系统（多选）,传字符串
   * @example "Windows,macOS"
   */
  osList?: string;
  /**
   * 排序字段
   * @example "name"
   */
  orderName?: string;
  /**
   * 排序类型  desc:降序   asc:升序
   * @example "desc"
   */
  orderType?: string;
  /**
   * 是否删除，绑定回收站功能，1.删除，0.不删除
   * @example 0
   */
  isDelete: number;
  /** 项目ID，默认不传查询所有 */
  "projectIds "?: string[];
  /**
   * 修改时间开始, str, 非必传
   * @example "2024-05-24"
   */
  startUpdateDate?: string;
  /**
   * 修改结束开始, str, 非必传
   * @example "2024-05-24"
   */
  endUpdateDate?: string;
}

export interface UserGetWindowInfoListListData {
  code: number;
  data: {
    total: number;
    rows: {
      id?: number;
      dirId?: string;
      windowSortNum?: number;
      windowName?: string;
      platformUrl?: string;
      platformIds?: string[];
      collectUserList?: string;
      windowPlatformList?: string[];
      platformUserName?: string;
      platformPassword?: string;
      projectName?: string;
      projectId?: number;
      coreVersion?: string;
      os?: string;
      osVersion?: string;
      windowRemark?: string;
      isOften?: boolean;
      openStatus?: boolean;
      statusInfo?: string[];
      labelId?: number;
      labelColor?: string;
      labelName?: string;
      labelIds?: string[];
      moduleId?: number;
      proxyMethod?: string;
      moduleName?: string;
      proxyNetwork?: string;
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
      checkChannel?: string;
      extraChannel?: string;
      lastIp?: string;
      lastCountry?: string;
      lastCity?: string;
      checkTime?: string;
      checkStatus?: number;
      openLimitStatus?: boolean;
      labelInfo?: string[];
      platformUrlList?: string[];
      maxWindowSort?: number;
    }[];
  };
  msg: string;
}

export interface UserGetWindowStatusInfoCreatePayload {
  /** 窗口ID */
  ids: number[];
}

export interface UserGetWindowStatusInfoCreateData {
  code: number;
  data: {
    sortNum?: number;
    /**
     * 窗口ID
     * 窗口ID
     */
    id: number;
    /**
     * 窗口状态1：已打开 0：未打开
     * 窗口状态1：已打开 0：未打开
     */
    openStatus: number;
    /**
     * 状态信息
     * 状态信息
     */
    statusInfo: {
      openUserId?: number;
      openUserName?: string;
    }[];
  }[];
  msg: string;
}

export interface UserAnalysisWindowInfoCreatePayload {
  /** 文件名，str，必传 */
  fileName: string;
  /** excel数据 */
  excelData: {
    /** 行号，int，必传 */
    rowNum?: number;
    /** 窗口名称，str，必传 */
    windowName?: string;
    /** 分组名称, str，非必传 */
    groupName?: string;
    /** 账号平台，str，非必传 */
    platformUrl?: string;
    /** 用户名，str，非必传 */
    platformUserName?: string;
    /** 密码，str，非必传 */
    platformPassword?: string;
    /** 2fa，str，非必传 */
    efa?: string;
    cookie?: {
      name?: string;
      path?: string;
      domain?: string;
    }[];
    defaultOpenUrl?: string;
    /** 代理类型，枚举值:直连模式、socks5、http、https, str，非必传 */
    proxyMethod?: string;
    /** 代理信息，格式: 192.168.0.1: 8800:user:password，非必传 */
    proxyInfo?: string;
    /** 刷新URL， str, 非必传 */
    refreshUrl?: string;
    /** 窗口备注，str，非必传 */
    windowRemark?: string;
    /** User Agent，str, 非必传 */
    userAgent?: string;
    /** 窗口尺寸，格式：数字*数字，str, 非必传 */
    windowSize?: string;
  }[];
  fingerDetail: {
    /** 【页面不显示】,字体值，指纹会用到, 非必传 */
    font?: string;
    /** 【页面不显示】，canvas为随机时设置， 噪音值 10000 - 1000000，指纹会用到, 非必传 */
    canvasValue?: string;
    /** 取 1000-99999 之间的随机整数 */
    canvasValueV2?: string;
    /** 【页面不显示】，webGL为随机时设置，随机噪音值 10000 - 1000000，指纹会用到, 非必传 */
    webGLValue?: string;
    /** webGLMeta自定义时，webGL厂商值, 非必传 */
    webGLManufacturer?: string;
    /** webGLMeta自定义时，webGL渲染值, 非必传 */
    webGLRender?: string;
    /** 【页面不显示】，audioContext为随机时，噪音值， 1 - 100 ，关闭时默认10，指纹会用到, 非必传 */
    audioContextValue?: string;
    /** 【页面不显示】，speechVoices为1时生成，指纹会用到，Json格式，非必传 */
    speechVoicesValue?: object;
    /** 【页面不显示】，speechVoices为1时生成，指纹会用到，Json格式，非必传 */
    clientRectsValue?: object;
    /** 【页面不显示】，媒体设备，默认0，需要前端生成，布尔值，非必传, 传true和false */
    mediaDevice?: boolean;
    /** 【页面不显示】，媒体设备列表，指纹会用到，List格式，非必传 */
    mediaDeviceList?: string[];
    /** 设备名称，deviceInfo为1时设置，非必传，通过接口 user_get_device_name 获取 */
    deviceName?: string;
    /** mac地址，deviceInfo为1时设置，非必传，通过接口 user_get_mac_addr 获取 */
    macAddr?: string;
  }[];
  /** 语言，1:跟随IP匹配，0自定义，默认1，布尔值，必传, 传true和false */
  isLanguageBaseIp: boolean;
  /** isLanguageBaseIp为0时选择的语言, 非必传， 【取字典】 */
  language: string;
  /** 界面语言，1: 跟随IP匹配，0：自定义，默认1，布尔值，必传, 传true和false */
  isDisplayLanguageBaseIp: boolean;
  /** isDisplayLanguageBaseIp为0时选择的语言, 非必传， 【取字典】 */
  displayLanguage: string;
  /** 时区，1: 跟随IP匹配，0：自定义，默认1，布尔值，必传, 传true和false */
  isTimeZone: boolean;
  /** isTimeZone为0时选择的时区, 非必传， 【取字典】 */
  timeZone: string;
  /** 地理位置 0询问|1允许|2禁止，默认0，int, 必传 */
  position: number;
  /** 基于IP生成对应的地理位置，不勾选可自定义，默认1，1：跟随IP匹配，0：自定义, 传true和false */
  isPositionBaseIp: boolean;
  /** user_get_ua_webgl	经度 isPositionBaseIp为0时设置, 非必传 */
  longitude: string;
  /** 纬度 isPositionBaseIp为0时设置, 非必传 */
  latitude: string;
  /** 精度米 isPositionBaseIp为0时设置, 非必传 */
  precisionPos: string;
  /** # 声音，开启：1，关闭：0，默认1，布尔值，必传, 传true和false */
  forbidAudio: boolean;
  /** 图片，允许加载：1，禁止加载：0，默认1，int, 必传 */
  forbidImage: number;
  /** 自定义加载图片尺寸，str, 非必传 */
  forbiddenPictureSize: string;
  /** 视频，允许加载：1，禁止加载：0，默认1，布尔值，必传, 传true和false */
  forbidMedia: boolean;
  /** 同步标签页，1：是，0：否，默认1，布尔值，必传, 传true和false */
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
  allowRunApplication: boolean;
  useGpu: boolean;
  webRTC: number;
  isDisplayName: boolean;
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

export interface UserAnalysisWindowInfoCreateData {
  /** 状态码, int */
  code: number;
  /** 返回结果, str */
  msg: string;
}

export interface UserGetBrowserVersionInfoListParams {
  /** @example "Windows" */
  os: string;
  /** @example "11" */
  osVersion: string;
}

export interface UserGetBrowserVersionInfoListData {
  code: number;
  data: {
    /** 浏览器版本 */
    browserVersion: string;
  }[];
  msg: string;
}

export interface UserSaveWindowRowsSortCreatePayload {
  window_rows: {
    name: string;
    sort: string;
    status: number;
  }[];
}

export interface UserSaveWindowRowsSortCreateData {
  code: number;
  msg: string;
}

export interface UserCreateWindowInspectListData {
  /** 407:超出总额度,408:超出空间最大额度 */
  code: number;
  msg: string;
}

export interface UserCheckWindowTotalCountListData {
  code: number;
  data: number;
  msg: string;
}

export interface UserDelWindowInfoRecycleCreatePayload {
  /** 要删除的窗口id列表 */
  ids: number[];
}

export interface UserDelWindowInfoRecycleCreateData {
  code: number;
  msg: string;
}

export interface UserGetSearchEnginesListData {
  code: number;
  data: {
    icon: string;
    code: string;
    url: string;
    sort: number;
  }[];
  msg: string;
}

export interface UserTransferWindowVerifyCodeListData {
  code: number;
  msg: string;
}

export interface UserTransferWindowCreatePayload {
  windowIds: number[];
  /**
   * 目标空间ID
   * 目标空间ID
   */
  targetWorkspaceId: number;
  /** 是否删除,true：删除, false: 不删除 */
  isDelete: boolean;
  /**
   * 邮箱验证码（如果当前是自己空间转自己空间可以不用传入）
   * 邮箱验证码（如果当前是自己空间转自己空间可以不用传入）
   */
  emailCode: string;
  transferParam: string[];
}

export interface UserTransferWindowCreateData {
  code: number;
  msg: string;
}

export interface UserGetTransferWorkspaceListListParams {
  /** 转移空间编号(当等于1查询的时候在传) */
  transferWorkspaceNo?: string;
  /**
   * 窗口id列表，用于校验窗口数量是否超出
   * @example "1,2,3"
   */
  windowIds: string;
}

export interface UserGetTransferWorkspaceListListData {
  code: number;
  data: {
    /** 空间ID */
    workspaceId?: number;
    /** 是否为自己空间（判断发邮箱依据），true：自己的，false：别人的 */
    isWorkspace?: boolean;
    /** 窗口任务编号,只有类型为2才有值 */
    windowTransferNo?: string;
    /** 空间编号 */
    workspaceNo?: string;
    /** 空间名称 */
    workspaceName?: string;
    /** 空间图标 */
    workspacePicture?: string;
    /** 窗口数量是否充足  true:充足, flase: 超出 */
    isWindowCountEnough?: boolean;
    /** 类型：1：自己的空间 ，2：已转移的空间   0 ：默认没有 */
    type?: number;
  }[];
  msg: string;
}

export interface UserGetTransferReceiveWindowListListParams {
  /**
   * 分页索引, int, 非必传, 默认1
   * @example 1
   */
  page_index: number;
  /**
   * 分页条数, int, 非必传, 默认15
   * @example 15
   */
  page_size: number;
  /**
   * 窗口任务编号,编号有则接收方，否则就是转移方
   * @example "transfer_15708_20251104"
   */
  windowTransferNo?: string;
}

export interface UserGetTransferReceiveWindowListListData {
  code: number;
  data: {
    total: number;
    rows: {
      windowSortNum?: number;
      windowName?: string;
      platformUrl?: string;
      platformIds?: string[];
      windowPlatformList?: string[];
      platformUserName?: string;
      platformPassword?: string;
      coreVersion?: string;
      os?: string;
      osVersion?: string;
      windowRemark?: string;
      moduleId?: number;
      proxyMethod?: string;
      moduleName?: string;
      proxyNetwork?: string;
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
      checkChannel?: string;
      extraChannel?: string;
      lastIp?: string;
      lastCountry?: string;
      lastCity?: string;
      checkTime?: string;
      checkStatus?: number;
      platformUrlList?: string[];
      maxWindowSort?: number;
      /** 空间名称 */
      workspaceName?: string;
      /** 空间编号 */
      workspaceNo?: string;
      /** 空间图片 */
      workspacePicture?: string;
    }[];
  };
  msg: string;
}

export interface UserAgreeTransferWindowCreatePayload {
  /** 窗口任务编号 */
  windowTransferNo: string;
  /** 总条数 */
  total: number;
}

export interface UserAgreeTransferWindowCreateData {
  code: number;
  msg: string;
}

export interface UserRejectTransferWindowCreatePayload {
  /** 窗口任务编号 */
  windowTransferNo: string;
}

export interface UserRejectTransferWindowCreateData {
  code: number;
  msg: string;
}

export interface UserClearTransferWorkspaceCreatePayload {
  /** 窗口任务编号 */
  windowTransferNo: string[];
}

export interface UserClearTransferWorkspaceCreateData {
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
    rows: {
      id?: number;
      /** 业务平台icon */
      platformIcon?: string;
      /** url */
      platformUrl?: string;
    }[];
  };
  msg: string;
}

export interface UserAddPlatformInfoCreatePayload {
  /** 业务平台图片，默认空，用户填的传空字符串就行 */
  platformIcon: string;
  /** 平台URL */
  platformUrl: string;
  /** 平台账号 */
  platformUserName: string;
  /** 平台密码 */
  platformPassword: string;
  /** 2FA密钥 */
  platformEfa: string;
  /** 平台cookeies */
  platformCookies: string;
  /** 平台名称 */
  platformName: string;
  /** 平台备注 */
  platformRemarks: string;
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

export type UserMdfPlatformInfoCreatePayload = {
  /** 平台ID */
  id?: number;
  /** 业务平台图片，默认空，用户填的传空字符串就行 */
  platformIcon?: string;
  /** 平台URL */
  platformUrl?: string;
  /** 平台账号 */
  platformUserName?: string;
  /** 平台密码 */
  platformPassword?: string;
  /** 2FA密钥 */
  platformEfa?: string;
  /** 平台cookeies */
  platformCookies?: string;
  /** 平台名称 */
  platformName?: string;
  /** 平台备注 */
  platformRemarks?: string;
}[];

export interface UserMdfPlatformInfoCreateData {
  code: number;
  msg: string;
}

export interface UserUpdatePlatformTableRowsCreatePayload {
  table_rows: {
    /** 名称 */
    name: string;
    /** 排序 */
    sort: number;
    /** 状态 */
    status: number;
  }[];
}

export interface UserUpdatePlatformTableRowsCreateData {
  code: number;
  msg: string;
}

export interface UserSavePlatformTableSortOrderCreatePayload {
  table_sort: {
    /** 名称 */
    name?: string;
    /** 判断降序还是升序 */
    order?: string;
  }[];
}

export interface UserSavePlatformTableSortOrderCreateData {
  code: number;
  msg: string;
}

export interface UserGetPlatformTableRowsListData {
  code: number;
  data: {
    /** 名称 */
    name?: string;
    /** 排序 */
    sort?: number;
    /** 状态 */
    status?: number;
  }[];
  msg: string;
}

export interface UserGetPlatformTableSortOrderListData {
  code: number;
  data: {
    /** 排序名称 */
    order_name?: string;
    /** 排序类型 */
    order_type?: string;
  }[];
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
   * 代理IP（代理链接）
   * @example "13.21.211.11"
   */
  host?: string;
  /**
   * 排序类型，1：代理ID从大到小，2：代理ID从小到大（老版本用的，新版本可以不用）
   * @example 1
   */
  sortType?: number;
  /**
   * 排序字段
   * @example "createTime"
   */
  order_name?: string;
  /**
   * 排序规则
   * @example "desc"
   */
  order_type?: string;
  /**
   * 代理国家
   * @example "BR"
   */
  lastCountry?: string;
  /**
   * 窗口ID
   * @example "11,22"
   */
  windowId?: string;
  /**
   * 代理检测状态，0：未检测，1：检测成功，2：检测失败
   * @example 0
   */
  checkStatus?: number;
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
   * 代理备注
   * @example "xxx"
   */
  remark?: string;
  /**
   * ID 编号
   * @example "1,2"
   */
  id?: string;
}

export interface UserGetProxyModuleListData {
  code: number;
  data: {
    total: number;
    rows: {
      /** 代理id，int */
      id: number;
      /** 代理协议，枚举值：HTTP, HTTPS, SOCKS5， 【取字典】 */
      protocol?: string;
      /** 国家，str */
      country?: string;
      /** 代理主机，str */
      host?: string;
      /** 代理端口，str */
      port?: string;
      /** 代理账号，str */
      proxyUserName?: string;
      /** 代理密码，str */
      proxyPassword?: string;
      /** 刷新URL, str */
      refreshUrl?: string;
      /** 查询渠道，默认:http: //ip123.in/ip.json， str */
      checkChannel?: string;
      /** 出口IP */
      lastIp?: string;
      /** 出口国家 */
      lastCountry?: string;
      /** 出口州/省 */
      lastState?: string;
      /** 出口城市 */
      lastCity?: string;
      /** 最近一次检测状态，true:正常，false: 错误 */
      checkStatus?: boolean;
      /** 最近一次检测检测时间，str */
      checkTime?: string;
      /** # 备注 */
      remark?: string;
      /** 是否有绑定窗口, 布尔值 */
      isBind?: boolean;
      /** 绑定的窗口数量 */
      bindCount?: number;
      bindList?: number[];
      /** 编辑时间 */
      updateTime?: string;
      /** 创建时间 */
      createTime?: string;
      /** IP类型 */
      ipType?: string;
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
  /** 备注 */
  remark?: string;
}

export type UserAddProxyModuleCreateData = object;

export type UserMdfProxyModuleCreatePayload = {
  /** 代理ID */
  id: number;
  /** 代理协议，枚举值：HTTP, HTTPS, SOCKS5， 【取字典】, 非必传 */
  protocol?: string;
  /** 城市 */
  country?: string;
  /** 代理主机 str, 非必传 */
  host?: string;
  /** 代理端口 str, 非必传 */
  port?: string;
  /** 代理账号 str, 非必传 */
  proxyUserName?: string;
  /** 代理密码 str, 非必传 */
  proxyPassword?: string;
  /** 刷新URL str, 非必传 */
  refreshUrl?: string;
  /** 查询渠道，默认:http://ip123.in/ip.json, str, 非必传 */
  checkChannel?: string;
  /** 出口IP，给用户显示用, 非必传 */
  lastIp?: string;
  /** 出口国家，给用户显示用, 非必传 */
  lastCountry?: string;
  /** // 出口城市 */
  lastCity?: string;
  /** 检测状态, 非必传 */
  checkStatus?: boolean;
  /** # 检测时间, 非必传 */
  checkTime?: string;
  /** 网络协议，str, 枚举值：IPV4, IPV6, 非必传 */
  ipType?: string;
  /** 备注 */
  remark?: string;
  /** 是否绑定 */
  isBind?: boolean;
  /** 绑定窗口数量 */
  bindCount?: number;
  /** 绑定的窗口ID */
  bindList?: number[];
  /** 是否加载 */
  loading?: boolean;
}[];

export interface UserMdfProxyModuleCreateData {
  /** 状态码, int */
  code: number;
  /** 返回结果, str */
  msg: string;
}

export interface UserGetProxyTableSortOrderListData {
  code: number;
  data: {
    /** 排序名称 */
    order_name?: string;
    /** 排序规则 */
    order_type?: string;
  }[];
  msg: string;
}

export interface UserSaveProxyTableSortOrderCreatePayload {
  table_sort: {
    /** 名称 */
    name?: string;
    /** 判断降序还是升序 */
    order?: string;
  }[];
}

export interface UserSaveProxyTableSortOrderCreateData {
  code: number;
  msg: string;
}

export interface UserUpdateProxyTableRowsCreatePayload {
  table_rows: {
    /** 名称 */
    name: string;
    /** 排序 */
    sort: number;
    /** 状态 */
    status: number;
  }[];
}

export interface UserUpdateProxyTableRowsCreateData {
  code: number;
  msg: string;
}

export interface UserGetProxyTableRowsListData {
  code: number;
  data: {
    /** 名称 */
    name?: string;
    /** 排序 */
    sort?: number;
    /** 状态 */
    status?: number;
  }[];
  msg: string;
}

export interface UserGetProxyRecommendInfoListData {
  code: number;
  data: {
    rows: {
      /** ID */
      id?: number;
      /** 代理标题 */
      proxyTitle?: string;
      /** 代理Icon */
      proxyIcon?: string;
      /** 代理描述 */
      proxyDesc?: string;
      /** 代理跳转地址 */
      proxyJumpAddress?: string;
      /** 代理访问地址 */
      proxyVisitAddress?: string;
      /** 代理状态 */
      proxyStatus?: number;
      /** 创建时间 */
      createTime?: string;
      /** 修改时间 */
      updateTime?: string;
    }[];
  };
  msg: string;
}

export interface UserDelProxyModuleV2CreatePayload {
  /**
   * 要删除的代理id列表
   * 要删除的代理id列表
   */
  ids: number[];
}

export interface UserDelProxyModuleV2CreateData {
  /** 状态码, int */
  code: number;
  /** 返回结果, str */
  msg: string;
}

export interface UserGetTimezoneByCoordinatesInfoListParams {
  /**
   * 纬度
   * @example "40.7128"
   */
  latitude?: string;
  /**
   * 经度
   * @example "-74.0060"
   */
  longitude?: string;
}

export interface UserGetTimezoneByCoordinatesInfoListData {
  code: number;
  data: {
    /** 时区 */
    timezone: string;
  };
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
   * @example 9999
   */
  page_size?: number;
  /**
   * 扩展分类: 可选值："hot","tool","fanyi","yingxiao","amazon","shopee","sumaitong","whatsapp","dzsw","guanggao","qukuailian","other"
   * @example "tool"
   */
  category?: string;
  /**
   * 扩展名称
   * @example "常用工具"
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
  data: {
    create_by: number;
    plugin_id: number;
  };
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
  /**
   * 启用状态，开启：true, 关闭： false
   * @example "true"
   */
  status?: boolean;
}

export interface UserGetPluginListListData {
  code: number;
  data: {
    total: number;
    rows: {
      /** 插件id */
      id?: number;
      /** 插件来源，枚举：sys: 系统内置,local:本地扩展, store:Chrome商店, 必传 */
      source?: string;
      /** 插件dir */
      pluginDir?: string;
      /** 插件名称 */
      pluginName?: string;
      /** 插件icon地址，oss下载路径 */
      pluginIcon?: string;
      /** 插件下载地址，oss下载路径 */
      pluginRoute?: string;
      /** 扩展版本, str, 必传 */
      pluginVersion?: string;
      /** 扩展版本, str, 必传 */
      pluginDesc?: string;
      /** 提供方 */
      provider?: string;
      /** 开启：true, 关闭： false */
      useStatus?: boolean;
      /** 是否有权限删除 */
      canDelete?: boolean;
      /** 上传者 */
      uploader?: string;
      /** 最后更新时间 */
      lateUpdateTime?: string;
      /** 插件更新状态，0:没有更新，1:有更新 */
      pluginUpdateState?: number;
      /** 插件最新版本，通过检测得到 */
      pluginNewVersion?: string;
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

export interface UserCheckAllPluginsVersionListParams {
  /** 插件目录ID */
  pluginDir: string;
}

export interface UserCheckAllPluginsVersionListData {
  code: number;
  msg: string;
}

export interface UserUpgradePluginsCreatePayload {
  /** 插件目录ID */
  pluginDir: string;
  /** 插件名称 */
  pluginName: string;
}

export interface UserUpgradePluginsCreateData {
  code: number;
  msg: string;
}

export interface UserUploadChromePluginsV2CreatePayload {
  /** 插件下载地址 */
  url: string;
}

export type UserUploadChromePluginsV2CreateData = object;

export interface UserBatchDelPluginInfoCreatePayload {
  /** 插件id列表 */
  ids: number[];
}

export interface UserBatchDelPluginInfoCreateData {
  code: number;
  msg: string;
}

export interface UserGetPluginWindowListParams {
  /**
   * 插件ID
   * @example 1
   */
  pluginId: number;
}

export interface UserGetPluginWindowListData {
  code: number;
  data: {
    rows: {
      /** 项目ID */
      id?: number;
      /** 项目名称 */
      projectName?: string;
      /** 插件ID */
      pluginIds?: string;
      /** 项目安装状态 */
      plugin_install_status?: number;
    }[];
  };
  msg: string;
}

export interface UserAddPluginToWindowCreatePayload {
  /** 安装类型 0:全部安装，1:部分安装 */
  installType: number;
  /** 插件ID */
  pluginId: number;
  /** 项目ID */
  projectId: number[];
  /** 插件安装状态 */
  installStatus: number[];
}

export interface UserAddPluginToWindowCreateData {
  code: number;
  msg: string;
}

export interface UserRecordPluginUploadV2ListData {
  code: number;
  data: number;
  msg: string;
}

export interface UserGetPluginInfoByIdListParams {
  /**
   * 分页索引
   * @example 1
   */
  pluginId: number;
}

export interface UserGetPluginInfoByIdListData {
  code: number;
  data: {
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
      userId?: number;
      pluginSwitchType?: number;
      installType?: string;
      pluginUpdateState?: number;
      pluginNewVersion?: string;
      useStatus?: boolean;
      createTime?: string;
      lateUpdateTime?: string;
    }[];
  };
  msg: string;
}

export interface UserFixedPluginToWindowCreatePayload {
  /** 插件ID */
  id: number;
  /**
   * 插件是否固定
   * 固定插件  值：customize  自定义   pin 固定  unpin 不固定
   */
  fixedPlugin: string;
}

export interface UserFixedPluginToWindowCreateData {
  code: number;
  msg: string;
}

export interface UserGetMemberInfoByWorkspaceListParams {
  /**
   *  Viewer(查看者,枚举：0)  Editor(编辑者,枚举：1) Manager(管理者,枚举：2)，不传查询所有
   * @example 1
   */
  role?: number;
}

export interface UserGetMemberInfoByWorkspaceListData {
  code: number;
  data: {
    rows: {
      /** 用户ID */
      user_id: number;
      /** 权限 */
      role: number;
      /** 激活状态 0:没有激活,1:激活 */
      status: number;
      /** 用户邮箱 */
      email?: string;
      /** 项目信息 */
      project_info: {
        /** 项目ID */
        project_id: number;
        /** 项目名称 */
        projectName: string;
      }[];
      /** 用户名 */
      userName?: string;
      /** 用户头像 */
      avatar: string;
    }[];
  };
  msg: string;
}

export interface UserMdfTeamInfoV2CreatePayload {
  /** 用户ID */
  userId: number;
  /** 权限 */
  role: number;
  /** 项目ID列表 */
  projectIds: number[];
}

export interface UserMdfTeamInfoV2CreateData {
  code: number;
  msg: string;
}

export interface UserDelTeamInfoCreatePayload {
  /** 用户ID */
  userId: number;
  /** 权限 */
  role: number;
  /** 项目ID列表 */
  projectIds: number[];
}

export interface UserDelTeamInfoCreateData {
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
  /**
   * 操作模块
   * @example "Accounts"
   */
  operateModule: string;
  /**
   * 用户ID列表
   * @example "1,2,3"
   */
  userNameIds?: string;
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
      operateModule?: string;
      workspaceId?: number;
      countryCode?: string;
      status?: boolean;
      location?: string;
      country?: string;
      code?: string;
      email?: string;
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

export interface UserGetWorkspaceListListData {
  code: number;
  data: {
    rows: {
      /**
       * ID
       * ID
       */
      id?: number;
      /**
       * 创建人ID
       * 创建人ID
       */
      userId?: number;
      /**
       * 工作空间名称
       * 工作空间名称
       */
      workspaceName?: string;
      /**
       * 总窗口数量
       * 总窗口数量
       */
      totalWindowCount?: number;
      /**
       * 总成员数量
       * 总成员数量
       */
      totalMemberCount?: number;
      /**
       * 工作空间图片
       * 工作空间图片
       */
      workspacePicture?: string;
      /**
       * 是否默认工作空间，1：是 0：不是，默认不是
       * 是否默认工作空间，1：是 0：不是，默认不是
       */
      workspaceDefault?: number;
      /**
       * 工作空间状态，1：启用 0：停用
       * 工作空间状态，1：启用 0：停用
       */
      workspaceStatus?: number;
      /**
       * 创建时间
       * 创建时间
       */
      createTime?: string;
      /**
       * 修改时间
       * 修改时间
       */
      updateTime?: string;
      /**
       * 权限
       * 权限
       */
      role?: number;
      /**
       * 总窗口数量
       * 总窗口数量
       */
      maxWindowCount?: number;
      /**
       * 窗口使用数量
       * 窗口使用数量
       */
      useWindowCount?: number;
      /** 窗口编号 */
      workspaceNo?: number;
    }[];
  };
  msg: string;
}

export interface UserAddWorkspaceInfoCreatePayload {
  /** 工作空间名称 */
  workspaceName: string;
  /** 工作空间图片 */
  workspacePicture: string;
  /** 可创建最大窗口数量 */
  maxWindowCount: number;
}

export interface UserAddWorkspaceInfoCreateData {
  code: number;
  data: object;
  msg: string;
}

export interface UserMdfWorkspaceInfoCreatePayload {
  /** 工作空间ID */
  id: number;
  /** 工作空间名称 */
  workspaceName: string;
  /** 工作空间图片 */
  workspacePicture: string;
  /** 可创建最大的窗口数量 */
  maxWindowCount: number;
}

export interface UserMdfWorkspaceInfoCreateData {
  code: number;
  msg: string;
}

export interface UserDelWorkspaceInfoCreatePayload {
  /** 工作空间ID */
  workspaceId: number;
}

export interface UserDelWorkspaceInfoCreateData {
  code: number;
  msg: string;
}

export interface UserLeaveWorkspaceListParams {
  /** 空间ID */
  workspaceId?: number;
}

export interface UserLeaveWorkspaceListData {
  code: number;
  msg: string;
}

export interface UserMdfWorkspaceTipInfoListData {
  code: number;
  msg: string;
}

export interface UserAddProjectInfoCreatePayload {
  /** 项目名称 */
  projectName: string;
}

export interface UserAddProjectInfoCreateData {
  code: number;
  data: {
    projectId: number;
  };
  msg: string;
}

export interface UserMdfProjectInfoCreatePayload {
  /** 项目ID */
  id: number;
  /** 项目名称 */
  projectName?: string;
  /** pin状态 */
  pinStatus?: number;
}

export interface UserMdfProjectInfoCreateData {
  code: number;
  msg: string;
}

export interface UserGetProjectInfoByWorkspaceListParams {
  /**
   * 1:查询不包括默认项目数据，2:查询包括默认项目数据
   * @example 1
   */
  default?: number;
  /**
   * 项目id
   * @example 1
   */
  projectId?: number;
  /** @example 1 */
  page_index?: number;
  /** @example 10 */
  page_size?: number;
}

export interface UserGetProjectInfoByWorkspaceListData {
  code: number;
  data: {
    rows: {
      pinStatus?: number;
      /** 1 默认项目 0 非默认项目 */
      projectDefault?: number;
      /** 1 转移项目 0 非转移项目 */
      isTransfer?: number;
      /**
       * 项目ID
       * 项目ID
       */
      project_id?: number;
      user_info?: {
        /**
         * 权限
         * role 权限： Viewer(查看者,枚举：0)  Editor(编辑者,枚举：1)  Manager(管理者,枚举：2) Owner(拥有者,枚举：3)
         */
        role: number;
        /**
         * 用户ID
         * 用户ID
         */
        userId: number;
        /**
         * 用户名
         * 用户名
         */
        userName: string;
        /**
         * 邮箱
         * 邮箱
         */
        email: string;
      }[];
      /**
       * 项目名称
       * 项目名称
       */
      projectName?: string;
      topTime?: string;
    }[];
  };
  msg: string;
}

export interface UserGetMemberInfoByProjectIdListParams {
  /**
   * 项目ID
   * @example 1
   */
  projectId: number;
}

export interface UserGetMemberInfoByProjectIdListData {
  code: number;
  data: {
    rows: {
      /**
       * 权限
       * 权限
       */
      role?: number;
      /**
       * 用户名字
       * 用户名字
       */
      userName?: string;
      /**
       * 用户邮箱
       * 用户邮箱
       */
      email?: string;
      /**
       * 用户头像
       * 用户头像
       */
      avatar?: string;
      userId?: number;
      avatarColor?: string;
    }[];
  };
  msg: string;
}

export interface UserInviteCreatePayload {
  /** 用户邮箱 */
  email: string;
  /**
   * 权限
   * Viewer(查看者,枚举：0)  Editor(编辑者,枚举：1) Manager(管理者,枚举：2)
   */
  role: number;
  /** 项目ID */
  projectIds: number[];
}

export interface UserInviteCreateData {
  code: number;
  msg: string;
}

export interface UserAddUserByProjectInfoCreatePayload {
  /** 加密数据 */
  data: string;
}

export interface UserAddUserByProjectInfoCreateData {
  code: number;
  msg: string;
}

export interface UserDelProjectInfoCreatePayload {
  /** 项目ID */
  projectId: number;
}

export interface UserDelProjectInfoCreateData {
  code: number;
  msg: string;
}

export interface UserGetTopProjectInfoListData {
  code: number;
  data: {
    rows: {
      /** 项目ID */
      project_id?: number;
      /** 用户信息 */
      user_info?: string[];
      /** 项目名字 */
      projectName?: string;
      /** 置顶时间 */
      topTime?: string;
      /** 置顶状态 */
      pinStatus?: number;
    }[];
  };
  msg: string;
}

export type UserShowInvitationLinkStatusCreatePayload = object;

export interface UserShowInvitationLinkStatusCreateData {
  code: number;
  /** 已失效 */
  data: string;
  msg: string;
}

export interface UserGetDurationDiscountsListData {
  code: number;
  data: {
    /**
     * 每个月折扣比例
     * 每个月折扣比例
     */
    "1": number;
    "3": number;
    "6": number;
    "12": number;
  };
  msg: string;
}

export interface UserGetWindowPricingRulesListListData {
  code: number;
  data: {
    rows: {
      apiRate: number;
      logDays: number;
      /** 最大窗口数量 */
      maxWindows: number;
      /** 最小窗口数量 */
      minWindows: number;
      /** 订阅级别 */
      subLevel: string;
      /** 窗口单个价格 */
      windowPrice: number;
    }[];
  };
  msg: string;
}

export interface UserPaySettlementCreatePayload {
  /**
   * 购买数量
   * 购买、订阅才有购买数量详细信息{"profile":100,"workspace":1,"staff":2}
   */
  purchaseMember?: object;
  /**
   * 购买类型(wallet/workspace/staff/profile/workspace_staff)
   * 购买、订阅才有
   */
  purchaseType?: string;
  /**
   * 订阅等级(Basic/Pro/Business/Enterprise)
   * 订阅才有
   */
  subLevel?: string;
  /**
   * 购买月数(1/3/6/12)
   * 续费、订阅才有
   */
  subscriptionMonths?: number;
  /**
   * 是否自动购买和续费,
   * 续费、订阅才有
   */
  isAuto?: boolean;
  /**
   * 订单号
   * 续费才有
   */
  orderNo?: string;
  /**
   * 支付方式: Balance,Alipay,USDT,Wechat,Card
   * 都有
   */
  payType: string;
  /**
   * 订单类型(续费/订阅/购买/充值/提现/退款/兑换/赠送:renew/subscribe/purchase/recharge/withdraw/refund/exchange/gift)
   * 都有
   */
  orderType: string;
  /**
   * 子订单类型upgrade:升级, purchase：购买
   * 订阅才有
   */
  subOrderType?: string;
}

export interface UserPaySettlementCreateData {
  code: number;
  data: {
    /**
     * 订单号
     * 订单号
     */
    order_no: string;
    /**
     * 支付方式
     * 支付方式
     */
    pay_type: string;
    /**
     * 支付地址
     * 支付地址
     */
    pay_url: string;
    /**
     * usdt支付id
     * usdt支付id
     */
    pay_id: string;
    /**
     * 订单金额
     * 订单金额
     */
    order_amount: string;
    /**
     * 支付结束时间
     * 支付结束时间
     */
    end_time: string;
    /**
     * 实际支付金额
     * 实际支付金额
     */
    real_amount: string;
    /** 类型 */
    subOrderType: string;
  };
  msg: string;
}

export interface UserGetPurchaseRecordsInfoListParams {
  /**
   * 分页索引, int, 非必传, 默认1
   * @example 1
   */
  page_index: number;
  /**
   * 分页条数, int, 非必传, 默认15
   * @example 15
   */
  page_size: number;
  /** 订单类型 */
  orderType?: string;
  /** 开始时间 */
  startDate?: string;
  /** 结束时间 */
  endDate?: string;
  /** 是否自动续费 */
  isAuto?: string;
  /** 主订单号 */
  mainOrderNo?: string;
}

export interface UserGetPurchaseRecordsInfoListData {
  code: number;
  data: {
    total: number;
    rows: {
      /** 订单号 */
      orderNo?: string;
      /** 订单类型 */
      orderType?: string;
      /** 实际金额(美元) */
      actualAmount?: number;
      /** 支付状态 TRADE_SUCCESS: 支付成功,TRADE_CLOSED：交易关闭,WAIT_BUYER_PAY：待支付,TRADE_FAIL：自动扣款失败' */
      payStatus?: string;
      detail?: {
        /** 天数 */
        day: number;
        /** # 普通订阅、升级、主动续订、延长套餐、购买空间成员数量、降级 # subscribe, upgrade, auto, extend , workspace_member, downgrade */
        subType: string;
        /** 老窗口数量 */
        oldWindowCount: number;
        /** 购买类型 */
        purchaseType: string;
        /** 成员数量 */
        staff: number;
        /** 现有窗口数量 */
        windowCount: number;
        /** 工作时间 */
        workspace: number;
      };
      /** 订单创建时间 */
      createTime?: string;
    }[];
  };
  msg: string;
}

export interface UserGetUserPayInfoListData {
  code: number;
  data: {
    /**
     * 用户折扣
     * 用户折扣
     */
    discount: number;
    /**
     * 用户身份,老用户:old 新用户:new 特邀用户:invited 邀请用户:inviteLink
     * 用户身份,老用户:old 新用户:new 特邀用户:invited 邀请用户:inviteLink
     */
    identity: string;
    /**
     * 已用空间数量
     * 已用空间数量
     */
    useWorkspaceCount: number;
    /**
     * 已用窗口数量
     * 已用窗口数量
     */
    useWindowCount: number;
    /**
     * 已用成员数量
     * 已用成员数量
     */
    useMemberCount: number;
    /**
     * 最大窗口数量
     * 最大窗口数量
     */
    maxWindowCount: number;
    /**
     * 订阅等级(Free/Expired/Trail/Basic/Pro/Business/Enterprise)
     * 订阅等级(Free/Expired/Trail/Basic/Pro/Business/Enterprise)
     */
    subLevel: string;
    /**
     * 订阅到期时间
     * 订阅到期时间
     */
    subEndDate: number;
    /**
     * 最大成员数量
     * 最大成员数量
     */
    maxMemberCount: number;
    /**
     * 最大空间数量
     * 最大空间数量
     */
    maxWorkspaceCount: number;
    /**
     * 免费项目数量
     * 免费项目数量
     */
    freeProjectCount: number;
    /**
     * 已使用项目数量
     * 已使用项目数量
     */
    useProjectCount: number;
    /**
     * 余额
     * 余额
     */
    balance: number;
    /**
     * 自动续费折扣
     * 自动续费折扣
     */
    autoRenewDiscount: number;
    /**
     * 7天是否试用，0：未试用 1：已试用 2：试用中
     * 7天是否试用，0：未试用 1：已试用 2：试用中
     */
    isTrial: number;
    /**
     * '是否自动购买和续费,1:自动 0:人工',
     * '是否自动购买和续费,1:自动 0:人工',
     */
    isAuto: number;
    /**
     * 实际金额
     * 实际金额
     */
    realAmount: string;
    /**
     * 订单号
     * 订单号
     */
    orderNo: string;
    /**
     * 成员价格(美元)
     * 成员价格(美元)
     */
    staffSinglePrice: number;
    /**
     * 空间价格(美元)
     * 空间价格(美元)
     */
    workspaceSinglePrice: number;
    /**
     * 单个价格(美元)
     * 单个价格(美元)
     */
    singlePrice: number;
    /**
     * 原始金额(美元)
     * 原始金额(美元)
     */
    originalAmount: number;
    /**
     * 钱包优惠余额
     * 钱包优惠余额
     */
    walletDiscount: number;
    /**
     * 订阅到期
     * 订阅到期
     */
    showSubExpiredDlg: boolean;
    /**
     * 付费墙显示
     * 付费墙显示
     */
    showPayWallDlg: boolean;
    /**
     * 自动续费降级接口状态判断 true:已降级，false：未降级
     * 自动续费降级接口状态判断 true:已降级，false：未降级
     */
    autoRenewDowngrade: boolean;
    /**
     * 购买窗口数量
     * 购买窗口数量
     */
    purchaseWindowCount: number;
    /**
     * "免费窗口数量"
     * "免费窗口数量"
     */
    freeWindowCount: number;
    /**
     * 今日已创建次数
     * 今日已创建次数
     */
    createWindowTimes: number;
    /**
     * /今日总共可创建次数
     * /今日总共可创建次数
     */
    totalCreateWindowTimes: number;
    /**
     * 今日打开次数
     * 今日打开次数
     */
    openWindowTimes: number;
    /**
     * 今日总共可打开次数
     * 今日总共可打开次数
     */
    totalOpenWindowTimes: number;
    /**
     * GIft显示,false: 不显示，true:显示
     * GIft显示,false: 不显示，true:显示
     */
    showGiftDlg: boolean;
    /** 服务器当前时间 */
    subCurrentDate: number;
  };
  msg: string;
}

export interface UserRechargeSettlementCreatePayload {
  /** 支付方式: Balance,Alipay,USDT,Wechat,Card */
  payType: string;
  /** 充值金额 */
  rechargeAmount: number;
}

export interface UserRechargeSettlementCreateData {
  code: number;
  data: {
    endTime: string;
    orderAmount: number;
    orderNo: string;
    payId: string;
    payType: string;
    payUrl: string;
    realAmount: number;
  };
  msg: string;
}

export type UserSevenDayTrialCreatePayload = object;

export interface UserSevenDayTrialCreateData {
  code: number;
  msg: string;
}

export interface UserGetSupportPayTypeListParams {
  /** @example "2.85" */
  amount: string;
}

export interface UserGetSupportPayTypeListData {
  code: number;
  data: {
    "2.85": string[];
  };
  msg: string;
}

export interface UserQueryOrderStatusListParams {
  /**
   * 订单号
   * @example "1740982093313502130869"
   */
  orderNo: string;
}

export interface UserQueryOrderStatusListData {
  code: number;
  /** 支付状态 TRADE_SUCCESS: 支付成功,TRADE_CLOSED：交易关闭,WAIT_BUYER_PAY：待支付,TRADE_FAIL：自动扣款失败 */
  data: string;
  msg: string;
}

export interface UserGetPayLinkListParams {
  /** @example "174116208471299315708" */
  orderNo: string;
}

export interface UserGetPayLinkListData {
  code: number;
  /** 订单支付链接 */
  data: {
    payUrl: string;
  };
  msg: string;
}

export interface UserCalculatePriceDifferenceListParams {
  /**
   * 窗口数量
   * @example 100
   */
  purchaseMember: number;
  /**
   * 来源 自动续费：AutoRenew，固定套餐：Fixed
   * @example "AutoRenew"
   */
  source: string;
}

export interface UserCalculatePriceDifferenceListData {
  code: number;
  /** 差价金额(美元) */
  data: number;
  msg: string;
}

export interface UserManageSubscriptionListParams {
  /**
   * 订单号
   * @example "174157725142891219538"
   */
  orderNo: string;
}

export interface UserManageSubscriptionListData {
  code: number;
  /** 订阅地址 */
  data: string;
  msg: string;
}

export interface UserUpdatePayTipsListParams {
  /** @example "Wall/Expired" */
  source: string;
}

export interface UserUpdatePayTipsListData {
  code: number;
  msg: string;
}

export interface UserCalculateWindowMonthsPriceListParams {
  /** @example 100 */
  windowCount: number;
}

export interface UserCalculateWindowMonthsPriceListData {
  code: number;
  /** 金额(美元) */
  data: number;
  msg: string;
}

export interface UserCancelSubscriptionListParams {
  /**
   * 订单号
   * @example "174157725142891219538"
   */
  orderNo: string;
}

export interface UserCancelSubscriptionListData {
  code: number;
  /** 订阅地址 */
  data: string;
  msg: string;
}

export interface UserDowngradeSubscriptionListParams {
  /**
   * 窗口数量
   * @example 0
   */
  purchaseMember: number;
}

export interface UserDowngradeSubscriptionListData {
  code: number;
  /** 订阅地址 */
  data: string;
  msg: string;
}

export interface UserAutoRenewUpgradeListParams {
  /**
   * 窗口数量
   * @example 100
   */
  purchaseMember: number;
}

export interface UserAutoRenewUpgradeListData {
  code: number;
  /** 差价金额(美元) */
  data: number;
  msg: string;
}

export interface UserGetDowngradeSubscriptionInfoListData {
  code: number;
  data: {
    /** 金额 */
    amount: number;
    /** 窗口数 */
    windowCount: number;
    /** 扣费时间 */
    windowStartDate: number;
  };
  msg: string;
}

export interface UserUpdateGiftTipsListData {
  code: number;
  msg: string;
}
