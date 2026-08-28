/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export type BatchResponse = SimpleResponse & {
  /** 批量操作结果明细 */
  data?: {
    /** 成功数量 */
    successCount?: number;
    /** 失败数量 */
    failCount?: number;
    /** 成功项明细 */
    successDetails?: {
      /** 本地 ID */
      id?: string;
      msg?: string;
    }[];
    /** 失败项明细 */
    failDetails?: {
      /** 本地 ID */
      id?: string;
      /** 错误码 */
      code?: number;
      /** 错误信息 */
      msg?: string;
    }[];
  };
};

export type MemberResponse = SimpleResponse & {
  data?: Member;
};

export type MemberListResponse = SimpleResponse & {
  data?: Member[];
};

export interface Member {
  /**
   * 本地成员 ID
   * @format int64
   */
  id?: number;
  /**
   * 用户 ID
   * @format int64
   */
  userId?: number;
  nickname?: string;
  account?: string;
  role?: MemberRoleEnum;
  status?: number;
  createdAt?: number;
  updatedAt?: number;
}

export type TeamInfoResponse = SimpleResponse & {
  data?: {
    /** @format int64 */
    id?: number;
    workspaceId?: string;
    name?: string;
    email?: string;
    status?: number;
    createdAt?: number;
    updatedAt?: number;
  };
};

export type NetConfigResponse = SimpleResponse & {
  data?: {
    blackList?: string[];
    whiteList?: string[];
  };
};

export type ShellResponse = SimpleResponse & {
  data?: {
    output?: string;
    exitCode?: number;
  };
};

export type ADBResponse = SimpleResponse & {
  data?: {
    id?: string;
    /** 0-关闭 1-开启 */
    adbStatus?: number;
    adbPort?: number;
  }[];
};

export type GPSResponse = SimpleResponse & {
  data?: {
    id?: string;
    /** @format double */
    longitude?: number;
    /** @format double */
    latitude?: number;
  }[];
};

export type ClonePhonesResponse = SimpleResponse & {
  data?: {
    successDetails?: {
      id?: string;
      serialName?: string;
      msg?: string;
    }[];
  };
};

export type StatusPhonesResponse = SimpleResponse & {
  data?: {
    id?: string;
    /** 0-运行 1-启动中 2-关机 3-过期 */
    status?: number;
  }[];
};

export type StartPhonesResponse = SimpleResponse & {
  data?: {
    totalAmount?: number;
    successAmount?: number;
    failAmount?: number;
    failDetails?: {
      code?: number;
      id?: string;
      msg?: string;
    }[];
    successDetails?: {
      /** 上游环境 ID */
      id?: string;
      /** 本地白标 ID */
      phoneId?: number;
      /** 播放地址（已改写为本服务白标 URL） */
      url?: string;
      msg?: string;
    }[];
  };
};

export type CreatePhonesResponse = SimpleResponse & {
  data?: {
    successDetails?: {
      /** 本地白标 ID */
      id?: string;
      /** 上游环境 ID */
      geelarkEnvId?: string;
      serialName?: string;
      msg?: string;
    }[];
  };
};

export type DetailPhonesResponse = SimpleResponse & {
  data?: Phone[];
};

export type ListPhonesResponse = SimpleResponse & {
  data?: {
    items?: Phone[];
    page?: number;
    pageSize?: number;
    total?: number;
  };
};

export type TaskResultResponse = SimpleResponse & {
  data?: {
    taskId?: string;
    /** 0-进行中 1-成功 2-失败 */
    status?: number;
    /** 结果详情 */
    result?: string;
    /** 结果文件下载链接 */
    url?: string;
  };
};

export type TaskResponse = SimpleResponse & {
  data?: {
    /** 异步任务 ID */
    taskId?: string;
  };
};

export interface SimpleResponse {
  success?: boolean;
  code?: number;
  msg?: string;
  traceId?: string;
  detail?: string;
  error?: string;
  isPartial?: boolean;
}

export interface Proxy {
  /** 代理类型 socks5/http/https */
  type?: string;
  /** 代理服务器地址 */
  server?: string;
  /** 端口 */
  port?: number;
  /** 用户名 */
  username?: string;
  /** 密码 */
  password?: string;
}

/** 设备信息 */
export interface EquipmentInfo {
  /** 蓝牙 MAC */
  bluetoothMac?: string;
  /** IMEI */
  imei?: string;
  /** WiFi MAC */
  mac?: string;
  /** 手机号 */
  phoneNumber?: string;
  /** 设备品牌 */
  deviceBrand?: string;
  /** 设备型号 */
  deviceModel?: string;
  /** 设备名称 */
  deviceName?: string;
  /** Android 版本 */
  osVersion?: string;
  /** 网络类型 0-WiFi 1-移动网络 */
  netType?: number;
  /** 国家 */
  countryName?: string;
  /** 语言 */
  language?: string;
  /** 时区 */
  timeZone?: string;
  city?: string;
  province?: string;
  /** WiFi BSSID */
  wifiBssid?: string;
  /** 是否启用 SIM 卡 1=启用 */
  enableSim?: number;
}

export interface Tag {
  /** 标签 ID */
  id?: string;
  /** 标签名称 */
  name?: string;
  /** 标签颜色 */
  color?: string;
  /** 标签备注 */
  remark?: string;
}

export interface Group {
  /** 分组 ID */
  id?: string;
  /** 分组名称 */
  name?: string;
  /** 分组备注 */
  remark?: string;
}

/** 云手机对象 */
export interface Phone {
  /** 本地白标 ID */
  id?: string;
  /** 上游序号 */
  serialNo?: string;
  /** 上游名称 */
  serialName?: string;
  /** 本地备注名（自定义） */
  name?: string;
  /** 本地自定义编号 */
  custno?: string;
  group?: Group;
  /** 本地分组 ID */
  groupId?: number;
  remark?: string;
  /** 0-运行 1-启动中 2-关机 3-过期 */
  status?: number;
  /** 0-按量 1-包月 */
  chargeMode?: number;
  /** 创建时间（秒级时间戳） */
  createTime?: number;
  /** 创建时间（毫秒级） */
  createTimeMs?: number;
  /** 是否绑定包月 */
  hasBind?: boolean;
  /** 包月过期时间 */
  monthlyExpire?: number;
  /** RPA 是否运行：1=运行，0=不运行 */
  rpaStatus?: number;
  /** 设备信息 */
  equipmentInfo?: EquipmentInfo;
  proxy?: Proxy;
  tags?: Tag[];
  /** 是否在回收站 */
  deleted?: boolean;
  /** 操作系统版本 */
  osVersion?: string;
  /** 区域 */
  region?: string;
  /** 国家 */
  country?: string;
}

export interface MemberAddRequest {
  /** 成员账号 */
  account: string;
  nickname?: string;
  /** @default "member" */
  role?: MemberAddRequestRoleEnum;
}

export interface UploadFileRequest {
  id: string;
  /** 文件可下载 URL */
  fileUrl: string;
}

export interface HideAccessibilityRequest {
  ids: string[];
  pkgName: string[];
}

export interface Contact {
  email1?: string;
  email2?: string;
  fax?: string;
  firstName?: string;
  lastName?: string;
  mobile?: string;
  work?: string;
}

export interface ImportContactsRequest {
  id: string;
  contacts: Contact[];
}

export interface TransferPhoneRequest {
  /** 目标账号 */
  account: string;
  ids: string[];
  transferOption?: {
    name?: boolean;
    proxy?: boolean;
    tag?: boolean;
    remark?: boolean;
    files?: boolean;
  };
}

export interface NetConfigSetRequest {
  blackList: string[];
}

export interface NetSetRequest {
  id: string;
  /** 0-Wi-Fi 1-移动网络 */
  netType: number;
}

export interface MoveGroupRequest {
  envIds: string[];
  groupId: string;
}

export interface ShellRequest {
  id: string;
  cmd: string;
}

export interface ADBSetRequest {
  ids: string[];
  open: boolean;
}

export interface RootSetRequest {
  ids: string[];
  open: boolean;
}

export interface GPSSetRequest {
  list: {
    id: string;
    /** @format double */
    longitude: number;
    /** @format double */
    latitude: number;
  }[];
}

export interface TaskIDRequest {
  taskId: string;
}

export interface ScreenshotRequest {
  id: string;
}

export interface NewOneRequest {
  /** 本地 ID */
  id: string;
  changeBrandModel?: boolean;
  keepNetType?: boolean;
  keepPhoneNumber?: boolean;
  keepRegion?: boolean;
  keepLanguage?: boolean;
  mobileType?: string;
}

export interface ClonePhoneRequest {
  /** 本地 ID */
  envId: string;
  /** 克隆数量 */
  amount: number;
  groupId?: string;
  cloneName?: boolean;
  cloneRemark?: boolean;
  cloneTag?: boolean;
  cloneProxy?: boolean;
  cloneNetType?: boolean;
}

export interface UpdatePhoneRequest {
  /** 本地 ID */
  id: string;
  name?: string;
  remark?: string;
  /** 分组 ID */
  groupID?: string;
  tagIDs?: string[];
  proxyConfig?: string;
  proxyQueryChannel?: number;
  proxyId?: string;
  chargeMode?: number;
  phoneNumber?: string;
}

export interface IDsRequest {
  /** 本地白标 ID 列表 */
  ids: string[];
}

export interface EnvRowRequest {
  /** 环境名称（必填） */
  profileName: string;
  /** 代理信息（host:port:user:pass） */
  proxyInformation?: string;
  /** 代理更新 URL */
  refreshUrl?: string;
  proxyQueryChannel?: number;
  proxyNumber?: number;
  dynamicProxy?: string;
  dynamicProxyLocation?: string;
  mobileRegion?: string;
  mobileProvince?: string;
  mobileCity?: string;
  mobileLanguage?: string;
  /** 分组名称 */
  profileGroup?: string;
  profileTags?: string[];
  profileNote?: string;
  surfaceBrandName?: string;
  surfaceModelName?: string;
  isTeamBrand?: boolean;
  /** 0-Wi-Fi 1-移动网络 */
  netType?: number;
  phoneNumber?: string;
  phoneName?: string;
}

export interface CreatePhonesRequest {
  /** 机型标识（上游机型） */
  mobileType: string;
  /** 0-按量 1-包月 */
  chargeMode?: number;
  /** 机房区域 */
  region?: string;
  data: EnvRowRequest[];
}

export interface ListPhonesRequest {
  /** @default 1 */
  page?: number;
  /** @default 10 */
  pageSize?: number;
  /** 本地 ID 列表 */
  ids?: string[];
  /** 按名称精确查询 */
  serialName?: string;
  remark?: string;
  groupName?: string;
  tags?: string[];
  /** 0-按量 1-包月 */
  chargeMode?: number;
  openStatus?: number;
  proxyIds?: string[];
  serialNos?: string[];
}

export type UserAllRatingsResponse = BaseResponse & {
  data?: UserRatingRecord[];
};

export type UserRatingDetailResponse = BaseResponse & {
  data?: UserRatingRecord | null;
};

export interface UserRatingRecord {
  /** 评价 ID */
  id?: number;
  userId?: number;
  /** 评分 1-5 */
  ratingStar?: number;
  ratingContent?: string;
  /** 评价时模式：1=通用 2=电商 */
  sceneMask?: number;
  createTime?: string;
  updateTime?: string;
  images?: RatingImageItem[];
}

export interface RatingImageItem {
  /** 图片记录 ID */
  id?: number;
  /** 图片完整 URL */
  imageUrl?: string;
}

export interface UserAppRatingSubmitRequest {
  /**
   * 星级评分，必填
   * @min 1
   * @max 5
   */
  ratingStar: number;
  /**
   * 评价内容，可选，新版 >= 3.9.0 支持
   * @maxLength 500
   */
  ratingContent?: string;
  /**
   * 图片完整 URL 列表（前端直传 OSS 后），最多 6 张
   * @maxItems 6
   */
  images?: string[];
}

export interface BaseResponse {
  /** 0=成功，101=参数错误，403=权限错误，500=服务器错误 */
  code: number;
  msg: string;
  data?: null;
}

export interface KycWorkspaceStatusResult {
  /** 空间是否已解锁：仅当 Owner 个人实名或企业实名已通过（与当前登录用户本人 KYC 无关） */
  unlocked: boolean;
}

/** KYC 状态聚合结果（personal/enterprise 为当前用户；unlocked 看空间 Owner） */
export interface KycStatusResult {
  /** 当前用户个人认证状态与提交资料 */
  personal?: KycStatusItem;
  /** 当前用户个人认证状态与提交资料 */
  enterprise?: KycStatusItem;
  /** 当前 header 工作空间是否已解锁：仅当该空间 Owner 个人实名或企业实名已通过（与当前用户本人 KYC 无关） */
  unlocked?: boolean;
}

/** 个人或企业认证状态项（均按用户）。企业字段仅 authType=enterprise 时有值；个人字段仅 personal 时有值。有记录时返回当时提交字段及脱敏字段。 */
export interface KycStatusItem {
  /** 0未认证 1审核中 2已通过 3已拒绝 */
  status?: KycStatusItemStatusEnum;
  /** 记录 ID，未提交时为 null */
  recordId?: number | null;
  /** 失败码 */
  failCode?: string;
  /** 失败原因 */
  failReason?: string;
  /** 认证类型 */
  authType?: KycStatusItemAuthTypeEnum;
  /** 提交时间，格式 YYYY-MM-DD HH:MM:SS */
  createTime?: string;
  /** 审核完成时间，未完成时为空串 */
  reviewedAt?: string;
  /** 真实姓名（个人） */
  realName?: string;
  /** 身份证号（个人） */
  idNumber?: string;
  /** 身份证人像面（个人） */
  idFrontUrl?: string;
  /** 身份证国徽面（个人） */
  idBackUrl?: string;
  /** 用户绑定手机号（个人，来自用户资料，非 KYC 表单字段） */
  phone?: string;
  /** 脱敏姓名，如 高*锐 */
  realNameMasked?: string;
  /** 脱敏身份证号 */
  idNumberMasked?: string;
  /** 脱敏手机号 */
  phoneMasked?: string;
  /** 企业名称（企业） */
  companyName?: string;
  /** 统一社会信用代码（企业） */
  creditCode?: string;
  /** 法人姓名（企业） */
  legalName?: string;
  /** 法人身份证号（企业） */
  legalIdNumber?: string;
  /** 营业执照（企业） */
  licenseUrl?: string;
  /** 脱敏企业名称 */
  companyNameMasked?: string;
  /** 脱敏统一社会信用代码 */
  creditCodeMasked?: string;
  /** 脱敏法人姓名 */
  legalNameMasked?: string;
  /** 脱敏法人身份证号 */
  legalIdNumberMasked?: string;
}

export interface KycSubmitResult {
  /** KYC 记录 ID */
  recordId?: number;
  /** 认证状态：0未认证 1审核中 2已通过 3已拒绝 */
  status?: KycSubmitResultStatusEnum;
}

export interface KycEnterpriseSubmitRequest {
  /**
   * 企业名称
   * @minLength 1
   * @maxLength 128
   */
  companyName: string;
  /**
   * 统一社会信用代码
   * @minLength 15
   * @maxLength 18
   * @pattern ^[0-9A-Z]{18}$
   */
  creditCode: string;
  /**
   * 法人姓名
   * @minLength 1
   * @maxLength 64
   */
  legalName: string;
  /**
   * 法人身份证号
   * @minLength 15
   * @maxLength 18
   * @pattern ^\d{17}[\dXx]$
   */
  legalIdNumber: string;
  /**
   * 营业执照 OSS 路径或 URL
   * @maxLength 2000
   */
  licenseUrl: string;
  /**
   * 是否同意协议，须为 true
   * @default true
   */
  agreed?: boolean;
}

export interface KycPersonalSubmitRequest {
  /**
   * 真实姓名
   * @minLength 1
   * @maxLength 64
   */
  realName: string;
  /**
   * 身份证号
   * @minLength 15
   * @maxLength 18
   * @pattern ^\d{17}[\dXx]$
   */
  idNumber: string;
  /**
   * 身份证人像面 OSS 路径或 URL
   * @maxLength 2000
   */
  idFrontUrl: string;
  /**
   * 身份证国徽面 OSS 路径或 URL
   * @maxLength 2000
   */
  idBackUrl: string;
  /**
   * 是否同意协议，须为 true
   * @default true
   */
  agreed?: boolean;
}

export interface ApiResponse {
  success?: boolean;
  code?: number;
  msg?: string;
  /** 链路追踪 ID */
  traceId?: string;
  detail?: string;
  /** 错误详情（失败时） */
  error?: string;
  /** 批量操作部分成功 */
  isPartial?: boolean;
  /** 业务数据（透传上游结构） */
  data?: object;
}

export enum MemberRoleEnum {
  Owner = "owner",
  Admin = "admin",
  Member = "member",
}

/** @default "member" */
export enum MemberAddRequestRoleEnum {
  Owner = "owner",
  Admin = "admin",
  Member = "member",
}

/** 0未认证 1审核中 2已通过 3已拒绝 */
export enum KycStatusItemStatusEnum {
  Value0 = 0,
  Value1 = 1,
  Value2 = 2,
  Value3 = 3,
}

/** 认证类型 */
export enum KycStatusItemAuthTypeEnum {
  Personal = "personal",
  Enterprise = "enterprise",
}

/** 认证状态：0未认证 1审核中 2已通过 3已拒绝 */
export enum KycSubmitResultStatusEnum {
  Value0 = 0,
  Value1 = 1,
  Value2 = 2,
  Value3 = 3,
}

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
      id?: string;
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
  page_index?: number;
  /**
   * 分页条数
   * @example 15
   */
  page_size?: number;
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
  /**
   * 关联邮箱
   * @example "xxx"
   */
  platformEmail?: string;
  /** @example "platform" */
  queryKey?: string;
  /** @example "tk" */
  queryValue?: string;
}

export interface UserGetPlatformInfoV2ListData {
  code: number;
  data: {
    total: number;
    rows: {
      id?: number;
      userId?: number;
      platformUrl?: string;
      platformEmail?: string;
      platformIcon?: string;
      platformUserName?: string;
      platformPassword?: string;
      platformEfa?: string;
      platformCookies?: string;
      platformName?: string;
      platformRemarks?: string;
      createTime?: string;
      updateTime?: string;
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
      /**
       * 窗口id, int
       * 窗口id, int
       */
      id?: number;
      /**
       * 【页面不显示】，窗口目录id
       * 【页面不显示】，窗口目录id
       */
      dirId?: string;
      /**
       * 窗口序号,int
       * 窗口序号,int
       */
      windowSortNum?: number;
      /**
       * 项目ID,int
       * 项目ID,int
       */
      projectId?: string;
      /**
       * oss存放路径
       * oss存放路径
       */
      ossDirPath?: string;
      /**
       * 项目名称,str
       * 项目名称,str
       */
      projectName?: string;
      /**
       * 窗口名称, str
       * 窗口名称, str
       */
      windowName?: string;
      /**
       * id, int
       * id, int
       */
      groupId?: number;
      /**
       * 分组名称, str
       * 分组名称, str
       */
      groupName?: string;
      /**
       * 业务平台URL，str
       * 业务平台URL，str
       */
      platformUrl?: string;
      /**
       * 平台账号，str
       * 平台账号，str
       */
      platformUserName?: string;
      /**
       * 平台密码，str
       * 平台密码，str
       */
      platformPassword?: string;
      /**
       * 浏览器内核类型，Chrome/Firefox
       * 浏览器内核类型，Chrome/Firefox
       */
      coreType?: string;
      defaultOpenUrl?: string[];
      /**
       * 内核版本，枚举值：117，109, str类型
       * 内核版本，枚举值：117，109, str类型
       */
      coreVersion?: string;
      /**
       * 操作系统, Windows,macOS,Linux,Android,IOS
       * 操作系统, Windows,macOS,Linux,Android,IOS
       */
      os?: string;
      /**
       * 操作系统版本
       * 操作系统版本
       */
      osVersion?: string;
      /**
       * 浏览器版本
       * 浏览器版本
       */
      browserVersion?: string;
      /**
       * User Agent
       * User Agent
       */
      userAgent?: string;
      cookie?: {
        name?: string;
        value?: string;
        domain?: string;
      }[];
      /**
       * 窗口备注, str
       * 窗口备注, str
       */
      windowRemark?: string;
      /**
       * 是否常用
       * 是否常用
       */
      isOften?: boolean;
      /**
       * 是否已打开
       * 是否已打开
       */
      openStatus?: boolean;
      statusInfo?: {
        openUserId: number;
        openUserName: string;
        openTime: string;
      }[];
      /**
       * 【页面暂时不显示】，标签id
       * 【页面暂时不显示】，标签id
       */
      labelId?: number;
      /**
       * 【页面暂时不显示】，标签颜色
       * 【页面暂时不显示】，标签颜色
       */
      labelColor?: string;
      /**
       * 【页面暂时不显示】，标签名称
       * 【页面暂时不显示】，标签名称
       */
      labelName?: string;
      labelIds?: number[];
      labelInfo?: {
        labelId: number;
        labelName: string;
        labelColor: string;
      }[];
      /**
       * 【页面不显示】，用来存储网站的登录信息，网站会自动填充密码，List格式
       * 【页面不显示】，用来存储网站的登录信息，网站会自动填充密码，List格式
       */
      loginData?: string[];
      /**
       * 窗口创建时间, str
       * 窗口创建时间, str
       */
      createTime?: string;
      /**
       * 窗口修改时间, str
       * 窗口修改时间, str
       */
      updateTime?: string;
      /**
       * 窗口打开时间, str
       * 窗口打开时间, str
       */
      openTime?: string;
      /**
       * 窗口关闭时间, str
       * 窗口关闭时间, str
       */
      closeTime?: string;
      /**
       * 窗口归属人用户名,即用户账号, str
       * 窗口归属人用户名,即用户账号, str
       */
      userName?: string;
      /**
       * 窗口归属人用户姓名, str
       * 窗口归属人用户姓名, str
       */
      realName?: string;
      /**
       * 窗口归属人所属角色，枚举值：main:主账号, admin:管理员, manager:经理, staff:成员, str
       * 窗口归属人所属角色，枚举值：main:主账号, admin:管理员, manager:经理, staff:成员, str
       */
      role?: string;
      /**
       * 窗口绑定的代理IP的id
       * 窗口绑定的代理IP的id
       */
      moduleId?: number;
      /**
       * 代理方式，custom：自定义，import：导入的IP，api：API接入， 【取字典】
       * 代理方式，custom：自定义，import：导入的IP，api：API接入， 【取字典】
       */
      proxyMethod?: string;
      /**
       * 添加类型，str, 枚举值：add：新增IP，choose: 已添加IP【取字典】
       * 添加类型，str, 枚举值：add：新增IP，choose: 已添加IP【取字典】
       */
      addType?: string;
      /**
       * 代理名称
       * 代理名称
       */
      moduleName?: string;
      /**
       * 代理类型，str, 枚举值：static：静态IP，rotate: 动态IP， 【取字典】
       * 代理类型，str, 枚举值：static：静态IP，rotate: 动态IP， 【取字典】
       */
      proxyType?: string;
      /**
       * 代理网络，str, 枚举值：resi：住宅IP，mobile: 手机IP，dc: 机房IP，ipv6: IPv6， 【取字典】
       * 代理网络，str, 枚举值：resi：住宅IP，mobile: 手机IP，dc: 机房IP，ipv6: IPv6， 【取字典】
       */
      proxyNetwork?: string;
      /**
       * 计费方式，str,枚举值：month:包月，bandwidth:流量, 【取字典】
       * 计费方式，str,枚举值：month:包月，bandwidth:流量, 【取字典】
       */
      billMethod?: string;
      /**
       * 代理类型，枚举值：noproxy, HTTP, HTTPS, SOCKS5
       * 代理类型，枚举值：noproxy, HTTP, HTTPS, SOCKS5
       */
      proxyCategory?: string;
      /**
       * 网络协议，str, 枚举值：IPV4, IPV6
       * 网络协议，str, 枚举值：IPV4, IPV6
       */
      ipType?: string;
      /**
       * 代理服务商，str
       * 代理服务商，str
       */
      proxyProvider?: string;
      /**
       * 代理协议，枚举值：NOPROXY, HTTP, HTTPS, SOCKS5
       * 代理协议，枚举值：NOPROXY, HTTP, HTTPS, SOCKS5
       */
      protocol?: string;
      /**
       * 国家
       * 国家
       */
      country?: string;
      /**
       * 【页面暂时不显示】，州
       * 【页面暂时不显示】，州
       */
      state?: string;
      /**
       * 【页面暂时不显示】，城市
       * 【页面暂时不显示】，城市
       */
      city?: string;
      /**
       * 代理主机
       * 代理主机
       */
      host?: string;
      /**
       * 代理端口
       * 代理端口
       */
      port?: string;
      /**
       * 代理账号
       * 代理账号
       */
      proxyUserName?: string;
      /**
       * 代理密码
       * 代理密码
       */
      proxyPassword?: string;
      /**
       * ip时长
       * ip时长
       */
      proxyTime?: string;
      /**
       * 刷新URL
       * 刷新URL
       */
      refreshUrl?: string;
      /**
       * 接入点，【取字典】
       * 接入点，【取字典】
       */
      accessServer?: string;
      /**
       * 查询渠道
       * 查询渠道
       */
      checkChannel?: string;
      /**
       * 一期用不上，proxyMethod=api时，提取链接的服务商，ROLA
       * 一期用不上，proxyMethod=api时，提取链接的服务商，ROLA
       */
      extraChannel?: string;
      /**
       * 一期用不上，proxyMethod=api时，提取IP，每次打开都提取新IP，默认1, 枚举值：0和1
       * 一期用不上，proxyMethod=api时，提取IP，每次打开都提取新IP，默认1, 枚举值：0和1
       */
      isExtraNewIp?: boolean;
      /**
       * 一期用不上，proxyMethod=api时，提取IP校验重复，1 校验，0不校验。打开窗口时，将检测提取IP是否重复，重复则重新提取，最多重新提取5次,默认0
       * 一期用不上，proxyMethod=api时，提取IP校验重复，1 校验，0不校验。打开窗口时，将检测提取IP是否重复，重复则重新提取，最多重新提取5次,默认0
       */
      isRepectCheck?: boolean;
      /**
       * 一期用不上，proxyMethod=api时，提取IP链接，str
       * 一期用不上，proxyMethod=api时，提取IP链接，str
       */
      extraUrl?: string;
      /**
       * 【页面暂时不显示】，关闭窗口时写入，给用户显示用
       * 【页面暂时不显示】，关闭窗口时写入，给用户显示用
       */
      lastIp?: string;
      /**
       * 【页面暂时不显示】，关闭窗口时写入，给用户显示用
       * 【页面暂时不显示】，关闭窗口时写入，给用户显示用
       */
      lastCountry?: string;
      /**
       * 语言，1:跟随IP匹配，0自定义，默认1
       * 语言，1:跟随IP匹配，0自定义，默认1
       */
      isLanguageBaseIp?: boolean;
      /**
       * isLanguageBaseIp为0时选择的语言
       * isLanguageBaseIp为0时选择的语言
       */
      language?: string;
      /**
       * 界面语言，1: 跟随IP匹配，0：自定义，默认1
       * 界面语言，1: 跟随IP匹配，0：自定义，默认1
       */
      isDisplayLanguageBaseIp?: boolean;
      /**
       * isDisplayLanguageBaseIp为0时选择的语言
       * isDisplayLanguageBaseIp为0时选择的语言
       */
      displayLanguage?: string;
      /**
       * 时区，1: 跟随IP匹配，0：自定义，默认1
       * 时区，1: 跟随IP匹配，0：自定义，默认1
       */
      isTimeZone?: boolean;
      /**
       * isTimeZone为0时选择的时区
       * isTimeZone为0时选择的时区
       */
      timeZone?: string;
      /**
       * 地理位置 0询问|1允许|2禁止，默认0
       * 地理位置 0询问|1允许|2禁止，默认0
       */
      position?: number;
      /**
       * 基于IP生成对应的地理位置，不勾选可自定义，默认1，1：跟随IP匹配，0：自定义
       * 基于IP生成对应的地理位置，不勾选可自定义，默认1，1：跟随IP匹配，0：自定义
       */
      isPositionBaseIp?: boolean;
      /**
       * 经度 isPositionBaseIp为0时设置，选择自定义的时候设置
       * 经度 isPositionBaseIp为0时设置，选择自定义的时候设置
       */
      longitude?: string;
      /**
       * 纬度 isPositionBaseIp为0时设置，选择自定义的时候设置
       * 纬度 isPositionBaseIp为0时设置，选择自定义的时候设置
       */
      latitude?: string;
      /**
       * 精度米 isPositionBaseIp为0时设置，选择自定义的时候设置
       * 精度米 isPositionBaseIp为0时设置，选择自定义的时候设置
       */
      precisionPos?: string;
      /**
       * 声音，开启：1，关闭：0，默认1
       * 声音，开启：1，关闭：0，默认1
       */
      forbidAudio?: boolean;
      /**
       * 图片，允许加载：1，禁止加载：0，默认1
       * 图片，允许加载：1，禁止加载：0，默认1
       */
      forbidImage?: number;
      /**
       * 自定义加载图片尺寸，str
       * 自定义加载图片尺寸，str
       */
      forbiddenPictureSize?: string;
      /**
       * 视频，允许加载：1，禁止加载：0，默认1
       * 视频，允许加载：1，禁止加载：0，默认1
       */
      forbidMedia?: boolean;
      /**
       * 同步标签页，1：是，0：否，默认1
       * 同步标签页，1：是，0：否，默认1
       */
      syncTab?: boolean;
      localState?: {
        os_crypt: {
          audit_enabled: boolean;
          encrypted_key: string;
        };
      };
      /**
       * 同步Cookie，1：是，0：否，默认1, 传true和false
       * 同步Cookie，1：是，0：否，默认1, 传true和false
       */
      syncCookie?: boolean;
      /**
       * 多开设置，1：开启，0：关闭，默认0
       * 多开设置，1：开启，0：关闭，默认0
       */
      openMult?: boolean;
      /**
       * 弹出谷歌翻译，1：是，0：否，默认0
       * 弹出谷歌翻译，1：是，0：否，默认0
       */
      forbidTranslatePopup?: boolean;
      /**
       * 弹出保存密码，1：是，0：否，默认1
       * 弹出保存密码，1：是，0：否，默认1
       */
      forbidSavePassword?: boolean;
      /**
       * 网络不通停止打开，1：是，0：否，默认1
       * 网络不通停止打开，1：是，0：否，默认1
       */
      stopOpenNet?: boolean;
      /**
       * IP发生变化停止打开，1：是，0：否，默认0
       * IP发生变化停止打开，1：是，0：否，默认0
       */
      stopOpenIP?: boolean;
      /**
       * IP对应国家/地区发生变化停止打开，1：是，0：否，默认0
       * IP对应国家/地区发生变化停止打开，1：是，0：否，默认0
       */
      stopOpenPosition?: boolean;
      /**
       * 同步IndexedDB，1：是，0：否，默认0
       * 同步IndexedDB，1：是，0：否，默认0
       */
      syncIndexedDb?: boolean;
      /**
       * 同步Local Storage，1：是，0：否，默认0
       * 同步Local Storage，1：是，0：否，默认0
       */
      syncLocalStorage?: boolean;
      /**
       * 同步书签，1：是，0：否，默认0
       * 同步书签，1：是，0：否，默认0
       */
      syncBookmark?: boolean;
      /**
       * 同步已保存的用户名密码，1：是，0：否，默认1
       * 同步已保存的用户名密码，1：是，0：否，默认1
       */
      syncPassword?: boolean;
      /**
       * 同步历史记录，1：是，0：否，默认0
       * 同步历史记录，1：是，0：否，默认0
       */
      syncHistory?: boolean;
      /**
       * 同步扩展应用数据，1：是，0：否，默认0
       * 同步扩展应用数据，1：是，0：否，默认0
       */
      syncExtensions?: boolean;
      /**
       * 【页面不显示】，同步扩展应用数据时会用到，Json格式
       * 【页面不显示】，同步扩展应用数据时会用到，Json格式
       */
      syncValue?: object;
      /**
       * 启动浏览器前删除缓存文件，1：是，0：否，默认0
       * 启动浏览器前删除缓存文件，1：是，0：否，默认0
       */
      clearCacheFile?: boolean;
      /**
       * 启动浏览器前删除Cookie，1：是，0：否，默认0
       * 启动浏览器前删除Cookie，1：是，0：否，默认0
       */
      clearCookie?: boolean;
      /**
       * 启动浏览器前删除历史记录，1：是，0：否，默认0
       * 启动浏览器前删除历史记录，1：是，0：否，默认0
       */
      clearHistory?: boolean;
      /**
       * 窗口名是否在标题栏显示，显示：true，不显示：false，布尔类型，非必传, 默认false
       * 窗口名是否在标题栏显示，显示：true，不显示：false，布尔类型，非必传, 默认false
       */
      isDisplayName?: boolean;
      /**
       * 启动浏览时随机指纹，1：是，0：否，默认0
       * 启动浏览时随机指纹，1：是，0：否，默认0
       */
      randomFingerprint?: boolean;
      /**
       * 允许登录Chrome，1：是，0：否，默认0
       * 允许登录Chrome，1：是，0：否，默认0
       */
      allowLoginChrome?: boolean;
      /**
       * 关闭浏览器后继续运行应用，1：是，0：否，默认0
       * 关闭浏览器后继续运行应用，1：是，0：否，默认0
       */
      allowRunApplication?: boolean;
      /**
       * 使用硬件加速模式，1：是，0：否，默认1
       * 使用硬件加速模式，1：是，0：否，默认1
       */
      useGpu?: boolean;
      /**
       * webrtc 0替换|1真实|2禁用，默认0
       * webrtc 0替换|1真实|2禁用，默认0
       */
      webRTC?: number;
      /**
       * 忽略https证书错误，1|0，默认0
       * 忽略https证书错误，1|0，默认0
       */
      ignoreHttpsError?: boolean;
      /**
       * 窗口尺寸，宽度
       * 窗口尺寸，宽度
       */
      openWidth?: string;
      /**
       * 窗口尺寸，高度
       * 窗口尺寸，高度
       */
      openHeight?: string;
      /**
       * 分辨率， 0跟随电脑 | 1自定义，默认0
       * 分辨率， 0跟随电脑 | 1自定义，默认0
       */
      resolutionType?: boolean;
      /**
       * 自定义分辨率时，分辨率X值
       * 自定义分辨率时，分辨率X值
       */
      resolutionX?: string;
      /**
       * 自定义分辨率时，分辨率Y值
       * 自定义分辨率时，分辨率Y值
       */
      resolutionY?: string;
      /**
       * 字体， 0系统默认|1随机匹配，默认1
       * 字体， 0系统默认|1随机匹配，默认1
       */
      fontType?: boolean;
      /**
       * 【页面不显示】,字体值，指纹会用到
       * 【页面不显示】,字体值，指纹会用到
       */
      font?: string;
      /**
       * canvas 1随机｜0关闭，默认1
       * canvas 1随机｜0关闭，默认1
       */
      canvas?: boolean;
      /**
       * 【页面不显示】，canvas为随机时设置， 噪音值 10000 - 1000000，指纹会用到
       * 【页面不显示】，canvas为随机时设置， 噪音值 10000 - 1000000，指纹会用到
       */
      canvasValue?: string;
      /**
       * webGL图像，1随机｜0关闭，默认1
       * webGL图像，1随机｜0关闭，默认1
       */
      webGL?: boolean;
      /**
       * 【页面不显示】，webGL为随机时设置，随机噪音值 10000 - 1000000，指纹会用到
       * 【页面不显示】，webGL为随机时设置，随机噪音值 10000 - 1000000，指纹会用到
       */
      webGLValue?: string;
      /**
       * webgl元数据 1自定义｜0关闭，默认1
       * webgl元数据 1自定义｜0关闭，默认1
       */
      webGLMeta?: boolean;
      /**
       * webGLInfo开关，真实1，自定义0，默认0,true:真实，false:自定义
       * webGLInfo开关，真实1，自定义0，默认0,true:真实，false:自定义
       */
      webGLInfo?: boolean;
      /**
       * webGLMeta自定义时，webGL厂商值
       * webGLMeta自定义时，webGL厂商值
       */
      webGLManufacturer?: string;
      /**
       * webGLMeta自定义时，webGL渲染值
       * webGLMeta自定义时，webGL渲染值
       */
      webGLRender?: string;
      /**
       * webGpu基于webgl匹配、real 真实、block 禁止，默认值：webgl
       * webGpu基于webgl匹配、real 真实、block 禁止，默认值：webgl
       */
      webGpu?: string;
      /**
       * 【页面不显示】，指纹会用到
       * 【页面不显示】，指纹会用到
       */
      webGpuVendor?: string;
      /**
       * audioContext值，1随机｜0关闭，默认1
       * audioContext值，1随机｜0关闭，默认1
       */
      audioContext?: boolean;
      /**
       * 【页面不显示】，audioContext为随机时，噪音值， 1 - 100 ，关闭时默认10，指纹会用到
       * 【页面不显示】，audioContext为随机时，噪音值， 1 - 100 ，关闭时默认10，指纹会用到
       */
      audioContextValue?: string;
      /**
       * windows 版本转换替代字段，默认值：空字符串
       * windows 版本转换替代字段，默认值：空字符串
       */
      platformVersion?: string;
      /**
       * 电脑名称，默认值：空字符串
       * 电脑名称，默认值：空字符串
       */
      computerName?: string;
      /**
       * MAC地址，默认值：空字符串
       * MAC地址，默认值：空字符串
       */
      macAddress?: string;
      /**
       * Speech Voices，1随机｜0关闭，默认1
       * Speech Voices，1随机｜0关闭，默认1
       */
      speechVoices?: boolean;
      speechVoicesValue?: {
        enable: boolean;
        voices: {
          name: string;
          lang: string;
          isLocalService: boolean;
        }[];
      };
      /**
       * doNotTrack 0关闭 | 1开启，默认1， 枚举值：0和1
       * doNotTrack 0关闭 | 1开启，默认1， 枚举值：0和1
       */
      doNotTrack?: boolean;
      /**
       * ClientRects，1随机｜0关闭，默认1， 枚举值：0和1
       * ClientRects，1随机｜0关闭，默认1， 枚举值：0和1
       */
      clientRects?: boolean;
      clientRectsValue?: {
        enable: boolean;
        clientRectsNoiseFactorX: number;
        clientRectsNoiseFactorY: number;
      };
      /**
       * 设备信息，1自定义｜0关闭，默认1， 枚举值：0和1
       * 设备信息，1自定义｜0关闭，默认1， 枚举值：0和1
       */
      deviceInfo?: boolean;
      /**
       * 设备名称开关，真实1，自定义0，默认0,true:真实，false:自定义
       * 设备名称开关，真实1，自定义0，默认0,true:真实，false:自定义
       */
      deviceNameSwitch?: boolean;
      /**
       * 设备名称，deviceInfo为1时设置
       * 设备名称，deviceInfo为1时设置
       */
      deviceName?: string;
      /**
       * mac地址开关，真实1，自定义0，默认0，,true:真实，false:自定义
       * mac地址开关，真实1，自定义0，默认0，,true:真实，false:自定义
       */
      macInfo?: boolean;
      /**
       * mac地址，deviceInfo为1时设置
       * mac地址，deviceInfo为1时设置
       */
      macAddr?: string;
      /**
       * 端口扫描保护 0关闭｜1开启，默认1， 枚举值：0和1
       * 端口扫描保护 0关闭｜1开启，默认1， 枚举值：0和1
       */
      portScanProtect?: boolean;
      /**
       * 端口扫描保护开启时的白名单，逗号分隔，str
       * 端口扫描保护开启时的白名单，逗号分隔，str
       */
      portScanList?: string;
      /**
       * ssl指纹设置，0关闭｜1开启，默认1， 枚举值：0和1
       * ssl指纹设置，0关闭｜1开启，默认1， 枚举值：0和1
       */
      disableSsl?: boolean;
      /**
       * 序列化的ssl特性值，List格式
       * 序列化的ssl特性值，List格式
       */
      disableSslList?: string[];
      /**
       * 自定义插件指纹，0关闭｜1开启，默认1， 枚举值：0和1
       * 自定义插件指纹，0关闭｜1开启，默认1， 枚举值：0和1
       */
      enablePlugin?: boolean;
      enablePluginList?: {
        name: string;
        description: string;
        filename: string;
        mimeType: string;
        mimeDescription: string;
        suffixes: number;
      }[];
      /**
       * 【页面不显示】，媒体设备，默认0，指纹会用到
       * 【页面不显示】，媒体设备，默认0，指纹会用到
       */
      mediaDevice?: boolean;
      mediaDeviceList?: {
        deviceType?: string;
        deviceId?: string;
        label?: string;
        groupId?: string;
      }[];
      /**
       * 硬件并发数，默认4
       * 硬件并发数，默认4
       */
      hardwareConcurrent?: number;
      /**
       * 设备内存，1，2，4，8，不要传入大于8的值，默认8
       * 设备内存，1，2，4，8，不要传入大于8的值，默认8
       */
      deviceMemory?: number;
      /**
       * 【页面不显示】，user agent，指纹会用到
       * 【页面不显示】，user agent，指纹会用到
       */
      userAgentNew?: string;
      /**
       * 【页面不显示】，user agent版本号，指纹会用到
       * 【页面不显示】，user agent版本号，指纹会用到
       */
      userAgentVersion?: string;
      /**
       * 【页面不显示】，平台，指纹会用到
       * 【页面不显示】，平台，指纹会用到
       */
      platform?: string;
      /**
       * 【页面不显示】，导航平台，指纹会用到
       * 【页面不显示】，导航平台，指纹会用到
       */
      navigatorPlatform?: string;
      /**
       * 【页面不显示】，像素，指纹会用到
       * 【页面不显示】，像素，指纹会用到
       */
      pixelDepth?: number;
      /**
       * 【页面不显示】，颜色，指纹会用到
       * 【页面不显示】，颜色，指纹会用到
       */
      colorDepth?: number;
      /**
       * 是否有绑定rpa,true:有绑定，false:没有绑定 str
       * 是否有绑定rpa,true:有绑定，false:没有绑定 str
       */
      isBindRpa?: boolean;
      usePlugin?: {
        pluginDir?: string;
        pluginVersion?: string;
        pluginRoute?: string;
      }[];
      /**
       * 代理测试状态,0:没有测试，1:测试成功，2:检测失败
       * 代理测试状态,0:没有测试，1:测试成功，2:检测失败
       */
      checkStatus?: number;
      /**
       * 新业务平台列表
       * 新业务平台列表
       */
      platformUrlList?: string[];
      /**
       * 工作空间ID
       * 工作空间ID
       */
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
      /**
       * 电池模拟
       * 电池模拟
       */
      openBattery?: boolean;
      /**
       * 模拟充电状态
       * 模拟充电状态
       */
      openCharging?: boolean;
      /**
       * 充电时长（秒）
       * 充电时长（秒）
       */
      chargingTime?: string;
      /**
       * 放电时长（秒）
       * 放电时长（秒）
       */
      dischargingTime?: string;
      /**
       * 电量（%）0-1
       * 电量（%）0-1
       */
      level?: string;
      /**
       * 网络模拟
       * 网络模拟
       */
      openNetwork?: boolean;
      /** 网络类型 */
      networkType?: string;
      /**
       * 网络速度 slow-2g/2g/3g/4g
       * 网络速度 slow-2g/2g/3g/4g
       */
      networkSpeed?: string;
      /**
       * 下载速度（Mbps）
       * 下载速度（Mbps）
       */
      downloadSpeed?: string;
      /**
       * 最大下载速度（Mbps)
       * 最大下载速度（Mbps)
       */
      maxDownloadSpeed?: string;
      /**
       * 延迟（ms）
       * 延迟（ms）
       */
      latency?: number;
      /**
       * 省流模式
       * 省流模式
       */
      saveFlowMode?: boolean;
      /**
       * 打开蓝牙
       * 打开蓝牙
       */
      openBluetooth?: boolean;
      /**
       * 蓝牙适配器
       * 蓝牙适配器
       */
      bluetoothAdapter?: boolean;
      /**
       * 今日打开窗口次数
       * 今日打开窗口次数
       */
      todayOpenCount?: number;
      isDirect?: boolean;
    }[];
  };
  msg: string;
}

export interface UserAddWindowInfoV2CreatePayload {
  /** 窗口名称，str，非必传 */
  windowName: string;
  /** 分组id, int，非必传 */
  groupId: number;
  /** 业务平台URL，str */
  platformUrl: string;
  /** 平台账号，str */
  platformUserName: string;
  /** 平台密码，str */
  platformPassword: string;
  defaultOpenUrl: string[];
  /** 内核版本，枚举值：117，109, str类型 */
  coreVersion: string;
  /** 操作系统, Windows,macOS,Linux,Android,IOS，必传，非空，默认选 Windows， 【取字典】 */
  os: string;
  /** 操作系统版本，str, 非必传, 通过 user_get_os_version 接口获取 */
  osVersion: string;
  /** 浏览器版本，str，非必传，枚举值通过 user_get_browser_version 接口获取 */
  browserVersion: string;
  /** User Agent，必传，非空，通过 user_get_ua_webgl 接口获取值 */
  userAgent: string;
  cookie: {
    name?: string;
    value?: string;
    domain?: string;
  }[];
  /** 窗口备注，str，非必传 */
  windowRemark: string;
  /** efa，str，非必传 */
  efa: string;
  /** 仅在代理方式为【购买的IP】，且代理类型为【静态IP】 或 代理方式为自定义 的时候有值，值为用户选择的 代理IP的id，int，非必传 */
  moduleId: number;
  /** 代理方式，custom：自定义，import：导入的IP，api：API接入，【取字典】 */
  proxyMethod: string;
  /** 代理类型，枚举值：noproxy, HTTP, HTTPS, SOCKS5，【取字典】 */
  proxyCategory: string;
  /** 网络协议，str, 枚举值：IPV4, IPV6, 非必传， 【取字典】 */
  ipType: string;
  /** 代理服务商，str, 非必传， 【取字典】 */
  proxyProvider: string;
  /** 代理协议，枚举值：HTTP, HTTPS, SOCKS5, str, 必传，默认传 SOCKS5， 【取字典】 */
  protocol: string;
  /** 国家, str, 非必传， 【取字典】 */
  country: string;
  /** 【页面暂时不显示】，州, str, 非必传 */
  state: string;
  /** 【页面暂时不显示】，城市, str, 非必传 */
  city: string;
  /** 代理主机 str, 代理检测的时候会用到，非必传，对于代理方式为 购买的IP，且代理类型为动态IP的 通过 user_get_proxy_account_info 接口获取，字段 host */
  host: string;
  /** 代理端口 str, 代理检测的时候会用到，非必传，对于代理方式为 购买的IP，且代理类型为动态IP的 通过 user_get_proxy_account_info 接口获取，字段 port */
  port: string;
  /** 代理账号 str, 代理检测的时候会用到，非必传，对于代理方式为 购买的IP，且代理类型为动态IP的 通过 user_get_proxy_account_info 接口获取，字段 proxyUserName */
  proxyUserName: string;
  /** 代理密码 str, 代理检测的时候会用到，非必传，对于代理方式为 购买的IP，且代理类型为动态IP的 通过 user_get_proxy_account_info 接口获取，字段 proxyPassword */
  proxyPassword: string;
  /** ip时长 str,  代理检测的时候会用到，非必传，对于代理方式为 购买的IP，且代理类型为动态IP的 通过 user_get_proxy_account_info 接口获取，字段 proxyTime， 【取字典】 */
  proxyTime: string;
  /** 刷新URL， str, 代理刷新的时候会用到，非必传，对于代理方式为 购买的IP，且代理类型为动态IP的 通过 user_get_proxy_account_info 接口获取，字段 refreshUrl */
  refreshUrl: string;
  /** 接入点, str, 非必传，【取字典】 */
  accessServer: string;
  /** 查询渠道，默认:IP123，枚举值：IP123,  str, 非必传， 【取字典】 */
  checkChannel: string;
  /** 一期用不上，不用传，proxyMethod=api时，提取链接的服务商，ROLA */
  extraChannel: string;
  /** 一期用不上，不用传，proxyMethod=api时，提取IP，每次打开都提取新IP，默认1, 枚举值：0和1, 传true和false */
  isExtraNewIp: boolean;
  /** 一期用不上，不用传，proxyMethod=api时，提取IP校验重复，1 校验，0不校验。打开窗口时，将检测提取IP是否重复，重复则重新提取，最多重新提取5次,默认0, 传true和false */
  isRepectCheck: boolean;
  /** 一期用不上，不用传，proxyMethod=api时，提取IP链接，str */
  extraUrl: string;
  /** 【页面暂时不显示】，关闭窗口时写入，给用户显示用 */
  lastIp: string;
  /** 【页面暂时不显示】，关闭窗口时写入，给用户显示用 */
  lastCountry: string;
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
  /** 经度 isPositionBaseIp为0时设置, 非必传 */
  longitude: string;
  /** 纬度 isPositionBaseIp为0时设置, 非必传 */
  latitude: string;
  /** 精度米 isPositionBaseIp为0时设置, 非必传 */
  precisionPos: string;
  /** 声音，开启：1，关闭：0，默认1，布尔值，必传, 传true和false */
  forbidAudio: boolean;
  /** 图片，允许加载：1，禁止加载：0，默认1，int, 必传 */
  forbidImage: number;
  /** 自定义加载图片尺寸，str, 非必传 */
  forbiddenPictureSize: string;
  /** 视频，允许加载：1，禁止加载：0，默认1，布尔值，必传, 传true和false */
  forbidMedia: boolean;
  /** 同步标签页，1：是，0：否，默认1，布尔值，必传, 传true和false */
  syncTab: boolean;
  /** 同步Cookie，1：是，0：否，默认1，布尔值，必传, 传true和false */
  syncCookie: boolean;
  /** 多开设置，1：开启，0：关闭，默认0，布尔值，必传, 传true和false */
  openMult: boolean;
  /** 弹出保存密码，1：是，0：否，默认1，布尔值，必传, 传true和false */
  forbidSavePassword: boolean;
  /** 网络不通停止打开，1：是，0：否，默认1，布尔值，必传, 传true和false */
  stopOpenNet: boolean;
  /** IP发生变化停止打开，1：是，0：否，默认0，布尔值，必传, 传true和false */
  stopOpenIP: boolean;
  /** IP对应国家/地区发生变化停止打开，1：是，0：否，默认0，布尔值，必传, 传true和false */
  stopOpenPosition: boolean;
  /** 窗口名是否在标题栏显示，显示：true，不显示：false，布尔类型，非必传, 默认false */
  isDisplayName: boolean;
  /** 同步IndexedDB，1：是，0：否，默认0，布尔值，必传, 传true和false */
  syncIndexedDb: boolean;
  /** 同步Local Storage，1：是，0：否，默认0，布尔值，必传, 传true和false */
  syncLocalStorage: boolean;
  /** 同步书签，1：是，0：否，默认0，布尔值，必传, 传true和false */
  syncBookmark: boolean;
  /** 同步已保存的用户名密码，1：是，0：否，默认1，布尔值，必传, 传true和false */
  syncPassword: boolean;
  /** 同步历史记录，1：是，0：否，默认0，布尔值，必传, 传true和false */
  syncHistory: boolean;
  /** 同步扩展应用数据，1：是，0：否，默认0，布尔值，必传, 传true和false */
  syncExtensions: boolean;
  /** 启动浏览器前删除缓存文件，1：是，0：否，默认0，布尔值，必传, 传true和false */
  clearCacheFile: boolean;
  /** 启动浏览器前删除Cookie，1：是，0：否，默认0，布尔值，必传, 传true和false */
  clearCookie: boolean;
  /** 启动浏览器前删除历史记录，1：是，0：否，默认0，布尔值，必传, 传true和false */
  clearHistory: boolean;
  /** 启动浏览时随机指纹，1：是，0：否，默认0，布尔值，必传, 传true和false */
  randomFingerprint: boolean;
  /** 关闭浏览器后继续运行应用，1：是，0：否，默认0，布尔值，必传, 传true和false */
  allowRunApplication: boolean;
  /** 使用硬件加速模式，1：是，0：否，默认1，布尔值，必传, 传true和false */
  useGpu: boolean;
  /** webrtc 0替换|1真实|2禁用，默认0，必传 */
  webRTC: number;
  /** 忽略https证书错误，1|0，默认0，布尔值，必传, 传true和false */
  ignoreHttpsError: boolean;
  /** 窗口尺寸，宽度, 非必传 */
  openWidth: string;
  /** 窗口尺寸，高度, 非必传 */
  openHeight: string;
  /** 分辨率， 0跟随电脑 | 1自定义，默认0，布尔值，必传, 传true和false */
  resolutionType: boolean;
  /** 自定义分辨率时，分辨率X值, 非必传， 【取字典】 */
  resolutionX: string;
  /** 自定义分辨率时，分辨率Y值, 非必传， 【取字典】 */
  resolutionY: string;
  /** 字体， 0系统默认|1随机匹配，默认1，布尔值，必传, 传true和false */
  fontType: boolean;
  /** 【页面不显示】,字体值，指纹会用到, 非必传 */
  font: string;
  /** canvas 1随机｜0关闭，默认1，布尔值，必传, 传true和false */
  canvas: boolean;
  /** 【页面不显示】，canvas为随机时设置， 噪音值 10000 - 1000000，指纹会用到, 非必传 */
  canvasValue: string;
  /** 【页面不显示】，canvas为随机时设置，取 1000-99999 之间的随机整数，指纹会用到, 非必传 */
  canvasValueV2: string;
  /** webGL图像，1随机｜0关闭，默认1，布尔值，必传, 传true和false */
  webGL: boolean;
  /** 【页面不显示】，webGL为随机时设置，随机噪音值 10000 - 1000000，指纹会用到, 非必传 */
  webGLValue: string;
  /** webgl元数据 1自定义｜0关闭，默认1，布尔值，必传, 传true和false */
  webGLMeta: boolean;
  /** webGLInfo开关，真实1，自定义0，默认0, 必传, 传true和false */
  webGLInfo: boolean;
  /** webGLMeta自定义时，webGL厂商值, 非必传 */
  webGLManufacturer: string;
  /** webGLMeta自定义时，webGL渲染值, 非必传 */
  webGLRender: string;
  /** webGpu基于webgl匹配、real 真实、block 禁止，默认值：webgl，必传 */
  webGpu: string;
  /** audioContext值，1随机｜0关闭，默认1，布尔值，必传, 传true和false */
  audioContext: boolean;
  /** 【页面不显示】，audioContext为随机时，噪音值， 1 - 100 ，关闭时默认10，指纹会用到, 非必传 */
  audioContextValue: string;
  /** Speech Voices，1随机｜0关闭，默认1，布尔值，必传, 传true和false */
  speechVoices: boolean;
  speechVoicesValue: {
    enable: boolean;
    voices: {
      name: string;
      lang: string;
      isLocalService: boolean;
    }[];
  };
  /** doNotTrack 0关闭 | 1开启，默认1， 枚举值：0和1，布尔值，必传, 传true和false */
  doNotTrack: boolean;
  /** ClientRects，1随机｜0关闭，默认1， 枚举值：0和1，布尔值，必传, 传true和false */
  clientRects: boolean;
  clientRectsValue: {
    enable: boolean;
    clientRectsNoiseFactorX: number;
    clientRectsNoiseFactorY: number;
  };
  /** 媒体设备，1自定义｜0关闭，默认1， 枚举值：0和1，布尔值，必传, 传true和false */
  deviceInfo: boolean;
  /** 设备名称开关，真实true，自定义false，默认false, 必传, 传true和false */
  deviceNameSwitch: boolean;
  /** 设备名称，deviceNameSwitch为false时设置，非必传，通过接口 user_get_device_name 获取 */
  deviceName: string;
  /** mac地址开关，真实true，自定义false，默认false, 必传, 传true和false */
  macInfo: boolean;
  /** mac地址，deviceInfo为1时设置，非必传，通过接口 user_get_mac_addr 获取 */
  macAddr: string;
  /** 端口扫描保护 0关闭｜1开启，默认1， 枚举值：0和1，布尔值，必传, 传true和false */
  portScanProtect: boolean;
  /** 端口扫描保护开启时的白名单，逗号分隔，str, 非必传 */
  portScanList: string;
  /** ssl指纹设置，0关闭｜1开启，默认1， 枚举值：0和1，布尔值，必传, 传true和false */
  disableSsl: boolean;
  /** 序列化的ssl特性值，List格式，必传， 【取字典】 */
  disableSslList: string[];
  /** 自定义插件指纹，0关闭｜1开启，默认1， 枚举值：0和1，布尔值，必传, 传true和false */
  enablePlugin: boolean;
  enablePluginList: {
    name: string;
    description: string;
    filename: string;
    mimeType: string;
    mimeDescription: string;
    suffixes: number;
  }[];
  /** 【页面不显示】，媒体设备，默认0，需要前端生成，布尔值，必传, 传true和false */
  mediaDevice: boolean;
  mediaDeviceList: {
    deviceType?: string;
    deviceId?: string;
    label?: string;
    groupId?: string;
  }[];
  /** 硬件并发数，默认4, 非必传， 【取字典】 */
  hardwareConcurrent: number;
  /** 设备内存，1，2，4，8，不要传入大于8的值，默认8, 非必传， 【取字典】 */
  deviceMemory: number;
  /** 浏览器内核类型，Chrome/Firefox */
  coreType: string;
  /** 保持使用最新版本内核 */
  useLatestCore: boolean;
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
  /** 浏览器内核类型，Chrome/Firefox */
  coreType?: string;
  /** 保持使用最新版本内核 */
  useLatestCore: boolean;
}

export interface UserMdfWindowInfoSingleV2CreateData {
  code: number;
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
    /** 旧字段，是否迁移数据 */
    is_migrate: boolean;
    workspaceId: number;
    /** 420状态会有这个字段 */
    recover_type?: string;
    /** 420状态会有这个字段 */
    recover_email?: string;
  };
  msg: string;
}

export interface UserLogoutListData {
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

export interface LoginFacebookCreatePayload {
  /** 传入Facebook登录token */
  facebookToken: string;
}

export interface LoginFacebookCreateData {
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
    /** 是否绑定邮箱, true:绑定,false:未绑定 */
    isBindEmail: boolean;
  };
  msg: string;
}

export interface LoginVkCreatePayload {
  /** 传入vk登录token */
  vkToken: string;
  /** 随机字符串，由 a-z, A-Z, 0-9, _ or -, 长度为 43 ~ 128之间 */
  code_verifier: string;
  device_id: string;
  state: string;
}

export interface LoginVkCreateData {
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

/**
 * OAuth 回调域名：com=国际站，cn=国内站
 * @default "com"
 */
export enum LoginLinuxDoCreatePayloadOauthHostEnum {
  Com = "com",
  Cn = "cn",
}

export interface LoginLinuxDoCreatePayload {
  /** Linux Do OAuth authorization code */
  linuxDoToken: string;
  /**
   * OAuth 回调域名：com=国际站，cn=国内站
   * @default "com"
   */
  oauthHost?: LoginLinuxDoCreatePayloadOauthHostEnum;
  /** Mixpanel distinctId */
  distinctId?: string;
}

export interface LoginLinuxDoCreateData {
  code: number;
  data: {
    /** 登录token */
    token: string;
    /** 用户类型 */
    type: number;
    /** 用户名/邮箱 */
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

export type LoginLinuxDoCreateError = {
  code: number;
  msg: string;
};

export interface PostBasePayload {
  /** 用户名 */
  user_name: string;
  /** 密码 */
  password: string;
  /** 邮箱 */
  email: string;
  /** 验证码 */
  ver_code: string;
  /** 邀请码 */
  inviteCode?: string;
}

export interface PostBaseData {
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

export interface UserChangeAccountCreatePayload {
  /** 真实姓名 */
  realName: string;
}

export interface UserChangeAccountCreateData {
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
    id: number;
    userName: string;
    realName: string;
    phone: string;
    email: string;
    userIdentity: string;
    underName: boolean;
    recommendUser: boolean;
    avatar: string;
    avatarColor: string;
    maxOpenCount: number;
    createTime: string;
    updateTime: string;
    useOpenCount: number;
    workspaceId: number;
    identity: string;
    maxWindowCount: number;
    useWindowCount: number;
    useWorkspaceCount: number;
    maxWorkspaceCount: number;
    inviteLink: string;
    firstCreateTip: boolean;
    clientId: string;
    setPasswordStatus: boolean;
    isBindEmail: boolean;
    workspaceType: number;
    role: number;
    onboardingTaskStatus: {
      createProfileStatus: boolean;
      promotionLinkRevampReminderStatus: boolean;
      batchOpenWindowNoPromptStatus: boolean;
      createProxyStatus: boolean;
      inviteMemberStatus: boolean;
      firstRegisterGuideStatus: boolean;
      hideSidebarEntryStatus: boolean;
      contextMenuGuideStatus: boolean;
      saveFilterGuideStatus: boolean;
      createProfileVideoEntryStatus: boolean;
      createProfileTourGuideStatus: boolean;
      createProxyVideoEntryStatus: boolean;
      ratingStatus: boolean;
      autoRatingStatus: boolean;
      externalRatingStatus: boolean;
      firstOpenWindowStatus: boolean;
      onboardingTaskStatus: boolean;
      firstWebRegisterGuideStatus: boolean;
      newSpaceCreateTeamStatus: boolean;
    };
    userBadgeList: {
      des?: string;
      icon?: string;
    }[];
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
    /**
     * 下载地址
     * 下载地址
     */
    downloadUrl: string;
    /** 判断是否强制，true强制，false不强制 */
    forceUpgrade: boolean;
    /**
     * 版本号，我们自己定义的版本号，用来和客户端的比对
     * 版本号，我们自己定义的版本号，用来和客户端的比对
     */
    version: string;
    /**
     * 升级标题
     * 升级标题
     */
    upgradeTitle: string;
    /**
     * 升级描述
     * 升级描述
     */
    upgradeDesc: string;
    /** 新版升级内容描述 */
    upgradeContent: {
      new_function: string;
      optimize: string;
      resolve_bug: string;
    };
    upgradeContentEn: {
      new_function: string;
      optimize: string;
      resolve_bug: string;
    };
    /**
     * 发布时间
     * 发布时间
     */
    releaseTime: string;
    /**
     * 根据用户的IP切换对应的域名，如果是国内就用深圳，国外就是香港
     * 根据用户的IP切换对应的域名，如果是国内就用深圳，国外就是香港
     */
    webDomain: string;
    newFeatureTips: string[];
  };
  msg: string;
}

export interface UserGetCoreUpgradeCreatePayload {
  os: string;
  osVersion: string;
  osBit: string;
  cpu: string;
  /** 浏览器内核类型，Chrome/Firefox狐 */
  coreType: string;
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

export interface GetCoreUpgradeCreatePayload {
  os: string;
  osVersion: string;
  osBit: string;
  cpu: string;
  /** 浏览器内核类型，Chrome/Firefox */
  coreType: string;
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

export interface UserGetUserConfigListData {
  code: number;
  data: {
    /** 语言 */
    language: string;
    autoRestoreWindow: boolean;
    batchOpenLayout: string;
    autoDetectProxy: boolean;
    windowNameSwitch: boolean;
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
    /** 深色模式：auto | light | dark，默认值：system */
    colorScheme: string;
    ipBlackList: string[];
    blockDomainList: string[];
    uaModeSwitch: number;
    /** 谷歌登录开关，true,false,默认false */
    googleLoginEnable: boolean;
    /** 窗口IP变化提醒，true,false,默认false */
    ipChangeModal: boolean;
    /** 默认搜索引擎 */
    searchEngine: string;
    /** 列表备注详情切换 */
    remarkDisplayStatus: boolean;
    /** 磁盘限制，默认8 */
    diskLimit: number;
    /** 自动清除缓存,0:关闭, 1:开启, 默认0 */
    autoClearCache: boolean;
    /** 自动缓存清除时间,默认30 */
    clearCachePeriod: number;
    /** 缓存清除类型，默认partial */
    clearCacheType: string;
    /** 是否第一次切换主题 */
    isFirstSwitchTheme: boolean;
    cloudBrowserActivateInfo: {
      dirId: string;
      remainingUsageMs: number;
    };
    /** 任务栏图标显示 windowSortNum（窗口编号） windowName（窗口名字） */
    taskbarIconDisplay: string;
    /** 任务栏标签显示  tabTitle（当前标签页名称） windowName（窗口名字） */
    taskbarTabDisplay: string;
    /** 'prompt' | 'continue' | 'abort'，默认是 prompt */
    restoreWindowNetworkChange: string;
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
  language: string;
  autoDetectProxy: boolean;
  timeZone: string;
  closeSoft: string;
  uploadDir: string;
  cacheDir: string;
  autoDelDays: string;
  autoDelSize: string;
  memoryLimit: string;
  appearance: number;
  systemProxySwitch: boolean;
  v2raySwitch: boolean;
  ipChecker: string;
  ipBlackList: string[];
  apiToken: string;
  isFirstSwitchTheme: boolean;
  batchOpenLayout: string;
  taskbarIconDisplay: string;
  taskbarTabDisplay: string;
  restoreWindowNetworkChange: string;
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
      /** 公告类型 0普通的 1 定制 */
      announceType?: number;
    }[];
  };
  msg: string;
}

export interface UserGetNotifyListParams {
  /**
   * 默认1
   * @example "1"
   */
  page_index?: string;
  /**
   * 默认15
   * @example "15"
   */
  page_size?: string;
}

export interface UserGetNotifyListData {
  code: number;
  data: {
    id?: number;
    type?: string;
    notifyCategory?: string;
    notify?: string;
    /** 0未读 1已读 */
    status?: number;
    /** 用户身份：创始用户:old,特邀用户:invited,普通用户:new */
    userIdentity?: string;
    /** 名下用户：true:有,false：没有 */
    underName?: boolean;
    /** 推荐用户：true:是,false：不是 */
    recommendUser?: boolean;
    createTime?: string;
    messageModule?: string;
    userName?: string;
    /** 窗口转移编号 */
    windowTransferNo?: string;
    /** 系统通知类型判断，1：系统通知， 0：用户通知 */
    sysType?: number;
    avatar?: string;
    avatarColor?: string;
    paramData?: {
      data: string;
      workspaceId: number;
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

export interface UserMigrateDataListData {
  code: number;
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

export interface SavePromotionLinkClickCountListParams {
  /** 链接码 */
  code: string;
}

export interface SavePromotionLinkClickCountListData {
  code: number;
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

export interface CheckOtherDeviceLoginListParams {
  /** 用户名或者邮箱 */
  user_name?: string;
  /** 密码 */
  password?: string;
  /**
   * 登录类型
   * @example "login/google/github"
   */
  login_type?: string;
  /**
   * 登录token：google/github token
   * @example ""
   */
  login_token?: string;
  /** 手机号 */
  phone?: string;
  /** 手机验证码 */
  verCode?: string;
}

export interface CheckOtherDeviceLoginListData {
  code: number;
  data: {
    /** True ：有其他设备登录， False：无其他设备登录 */
    has_other_login: boolean;
  };
  msg: string;
}

export interface CheckEmailRegisteredListParams {
  /** 邮箱 */
  email: string;
}

export interface CheckEmailRegisteredListData {
  code: number;
  data: {
    /** true:已注册，false:未注册 */
    is_registered: boolean;
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
      phone?: string;
      /** 创建时间 */
      createTime?: number;
      /** 推广者返利(%) */
      youGet?: number;
      /** 积分返利(%) */
      pointsYouGet?: number;
      /** 代理返利(%) */
      proxyYouGet?: number;
      /** 用户折扣(%) */
      theyGet?: number;
      /** 邀请来源：inviteCode：邀请码，inviteLink：邀请链接 */
      source?: string;
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
      /** 手机号 */
      phone?: string;
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
      /** 0：推广奖励数据 1：活动奖励数据（给什么展示什么） */
      dataType?: number;
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
      /** 提款方式Wallet，Card */
      withdrawType?: string;
      /** 提款地址 */
      withdrawAdd?: string;
      /** 提款金额（美元） */
      withdrawAmount?: number;
      /** 状态：Success,Pending，Fail */
      withdrawStatus?: string;
      /** 提款时间 */
      createTime?: number;
    }[];
  };
  msg: string;
}

export interface UserGetPromotionInfoListData {
  code: number;
  data: {
    withdrawAmount: number;
    promotionClickCount: number;
    todayPromotionClickCount: number;
    registeredUserNum: number;
    todayRegisteredUserNum: number;
    purchaseUserNum: number;
    todayPurchaseUserNum: number;
    totalIncome: number;
    purchaseUserTotalAmount: number;
    pendingAmount: number;
    businessManagerQrCode: {
      Telegram: string;
      Wechat: string;
    };
    promotionLinkList: {
      isModify?: number;
      nextModifyTime?: number;
      linkStatus?: number;
      linkType?: string;
      promotionDiscount?: number;
      pointsPromotionDiscount?: number;
      proxyPromotionDiscount?: number;
      promotionLink?: string;
      purchaseTotalAmount?: number;
      userDiscount?: number;
      promotionCode?: string;
      isShow?: number;
      completed_count?: number;
      total_count?: number;
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

export interface UserWithdrawVerifyCodeListParams {
  /** 提现金额 */
  amount?: string;
}

export interface UserWithdrawVerifyCodeListData {
  code: number;
  msg: string;
}

export interface UserGetBannerPictureListV2ListParams {
  /** 链接类型：Link_C、Link_B、Link_A、Link_S */
  linkType?: string;
}

export interface UserGetBannerPictureListV2ListData {
  code: number;
  data: {
    image_1x: string;
    image_2x: string;
    size: string;
  }[];
  msg: string;
}

/** Google / Github / Facebook / VK / LINUXDO */
export enum DataBindTypeEnum {
  Google = "Google",
  Github = "Github",
  Facebook = "Facebook",
  VK = "VK",
  LINUXDO = "LINUXDO",
}

export interface UserBindEmailListListData {
  code: number;
  data: {
    /** Google / Github / Facebook / VK / LINUXDO */
    bindType: DataBindTypeEnum;
    thirdEmail: string;
    thirdId: string;
    thirdUserName: string;
  }[];
  msg: string;
}

export interface UserBindEmailCreatePayload {
  /** 绑定的邮箱 */
  email: string;
  /** 绑定类型: Google/Github/Facebook/VK */
  bind_type: string;
  /** 验证码 */
  ver_code: number;
}

export interface UserBindEmailCreateData {
  code: number;
  msg: string;
}

/**
 * 绑定类型
 * Google / Github / Facebook / VK / LINUXDO
 */
export enum UserUnbindEmailCreatePayloadBindTypeEnum {
  Google = "Google",
  Github = "Github",
  Facebook = "Facebook",
  VK = "VK",
  LINUXDO = "LINUXDO",
}

export interface UserUnbindEmailCreatePayload {
  /**
   * 绑定类型
   * Google / Github / Facebook / VK / LINUXDO
   */
  bind_type: UserUnbindEmailCreatePayloadBindTypeEnum;
}

export interface UserUnbindEmailCreateData {
  code: number;
  msg: string;
}

export interface UserBindEmailVerifyCodeListParams {
  /**
   * 邮箱
   * @example "166533381@qq.com"
   */
  email: string;
}

export interface UserBindEmailVerifyCodeListData {
  code: number;
  msg: string;
}

export interface UserSettingAccountPasswordCreatePayload {
  /** 邮箱 */
  email: string;
  /** 验证码 */
  ver_code: string;
  /** 密码 */
  password: string;
}

export interface UserSettingAccountPasswordCreateData {
  code: number;
  msg: string;
}

export interface UserSendAccountPasswordVerifyCodeListParams {
  /**
   * 新邮箱
   * @example "117363767@qq.com"
   */
  email: string;
}

export interface UserSendAccountPasswordVerifyCodeListData {
  code: number;
  msg: string;
}

export interface UserModifyRemarkDisplayStatusCreatePayload {
  /** 备注显示状态：true: 显示，false：不显示 */
  remarkDisplayStatus: boolean;
}

export interface UserModifyRemarkDisplayStatusCreateData {
  code: number;
  msg: string;
}

export interface UserSendValidatorVerifyCodeListData {
  code: number;
  msg: string;
}

export interface UserVerifyValidatorVerifyCodeListParams {
  /** @example "123123" */
  ver_code?: string;
}

export interface UserVerifyValidatorVerifyCodeListData {
  code: number;
  msg: string;
}

export interface GetValidatorTokenInfoListParams {
  /**
   * 临时token
   * @example "0oPwO4vway3Vty0D1750430479980"
   */
  temp_token?: string;
}

export interface GetValidatorTokenInfoListData {
  code: number;
  data: {
    google_keyuri: string;
    secret: string;
  };
  msg: string;
}

export interface GetPersonalVerifyValidatorCodeListParams {
  /**
   * 验证码
   * @example "123456"
   */
  code: string;
  temp_token?: string;
  /**
   * 验证码校验类型
   * @example ""login_2fa", "login_recover_code", "update_2fa_info", "add_2fa_info""
   */
  type: string;
}

export interface GetPersonalVerifyValidatorCodeListData {
  code: number;
  msg: string;
}

export interface SendValidatorEmailVerifyCodeListParams {
  email?: string;
  /** @example "add" */
  type?: string;
  temp_token?: string;
}

export interface SendValidatorEmailVerifyCodeListData {
  code: number;
  msg: string;
}

export interface GenerateValidatorRecoverCodeListParams {
  /**
   * 类型：修改还是新增:"modify", "add"
   * @example "modify"
   */
  type: string;
  temp_token?: string;
}

export interface GenerateValidatorRecoverCodeListData {
  code: number;
  data: string[];
  msg: string;
}

export interface ValidatorBindCreatePayload {
  /**
   * 恢复方式：恢复邮箱/代码
   * 恢复方式：恢复邮箱/代码
   */
  recover_type: string;
  /**
   * 恢复邮箱
   * 恢复邮箱
   */
  recover_email?: string;
  /**
   * 恢复邮箱验证码
   * 恢复邮箱验证码
   */
  ver_code?: string;
  temp_token?: string;
}

export interface ValidatorBindCreateData {
  code: number;
  msg: string;
}

export interface UserCloseValidatorCreatePayload {
  /** 2fa码 */
  code: string;
}

export interface UserCloseValidatorCreateData {
  code: number;
  msg: string;
}

export interface UserGetValidatorBindInfoListData {
  code: number;
  data: {
    /** 绑定状态：0，未绑定，1绑定，2，异常 */
    validatorIsBind: number;
    /** APP状态 */
    validatorAPP: number;
    /** 恢复邮箱状态 */
    recoverEmail: number;
    /** 恢复代码状态 */
    recoverCode: number;
  };
  msg: string;
}

export interface UserGetValidatorInfoListParams {
  /**
   * code码
   * @example "123456"
   */
  code?: string;
}

export interface UserGetValidatorInfoListData {
  code: number;
  data: {
    /** 恢复邮箱 */
    recoverEmail: string;
    /** 恢复代码 */
    recoverCode: string[];
  };
  msg: string;
}

export interface UserUpdateValidatorTokenCreatePayload {
  code: string;
}

export interface UserUpdateValidatorTokenCreateData {
  code: number;
  msg: string;
}

export interface CheckRecoverCodeCreatePayload {
  /** 临时token */
  temp_token: string;
  /** 恢复代码 */
  recover_code: string;
}

export interface CheckRecoverCodeCreateData {
  code: number;
  data: string;
  msg: string;
}

export interface CheckEmailPasswordCreatePayload {
  /** 临时token */
  temp_token: string;
  /** 邮箱 */
  email: string;
  /** 密码 */
  password: string;
}

export interface CheckEmailPasswordCreateData {
  code: number;
  data: {
    is_migrate: boolean;
    role: string;
    token: string;
    type: number;
    user_id: number;
    user_name: string;
    workspaceId: number;
  };
  msg: string;
}

export interface VerifyValidatorEmailVerifyCodeCreatePayload {
  /** 临时token */
  temp_token: string;
  /** 验证码 */
  ver_code: string;
}

export interface VerifyValidatorEmailVerifyCodeCreateData {
  code: number;
  data: string;
  msg: string;
}

export interface Get2FaLoginInfoListParams {
  /**
   * 临时token
   * @example "oQNTHk45wom22tT71750668640993"
   */
  temp_token: string;
  /**
   * 登录验证的类型
   * @example "recover_code，recover_email, 2fa_code"
   */
  type?: string;
}

export interface Get2FaLoginInfoListData {
  code: number;
  data: {
    is_migrate: boolean;
    role: string;
    token: string;
    type: number;
    user_id: number;
    user_name: string;
    workspaceId: number;
  };
  msg: string;
}

export interface CheckEmailOr2FaVerifyListParams {
  /**
   * 邮箱
   * @example "1876019890@qq.com"
   */
  email: string;
}

export interface CheckEmailOr2FaVerifyListData {
  code: number;
  data: {
    /** 验证方式，2fa/邮箱 */
    verify_type: string;
    /** 恢复方式，代码/邮箱 */
    recover_type: string;
  };
  msg: string;
}

export interface UserGetPromotionInfoByTypeListParams {
  /** @example "Link_A" */
  linkType?: string;
}

export interface UserGetPromotionInfoByTypeListData {
  code: number;
  data: {
    awardsReviewed: number;
    /** 待收益金额 */
    pendingAmount: number;
    /** 用户推广点击链接次数 */
    promotionClickCount: number;
    /** 已下单购买成功的用户数量 */
    purchaseUserNum: number;
    /** 推荐用户的总交易额 */
    purchaseUserTotalAmount: number;
    /** 已注册的用户数量 */
    registeredUserNum: number;
  };
  msg: string;
}

export interface UserGetGuideVideosByTypeListParams {
  /**
   * 不传查询全部
   * create_profile: 创建窗口
   * bind_proxy: 绑定代理
   * invite_user_register: 邀请用户注册
   * context_menu: 右键菜单
   * manage_and_classify: 管理与分类（标签/项目等）
   * advanced_filter: 高级筛选器
   * account_management: 账号管理
   * plugin_management: 插件管理
   * synchronizer: 同步器
   * team_management: 团队管理
   * 查询类型 多个用，隔开
   * @example "create_profile,bind_proxy"
   */
  type?: string;
}

export interface UserGetGuideVideosByTypeListData {
  code: number;
  data: {
    create_profile: {
      videoUrl: string;
      coverImage: string;
      externalLink: string;
    };
    bind_proxy: {
      videoUrl: string;
      coverImage: string;
      externalLink: string;
    };
    invite_user_register: {
      videoUrl: string;
      coverImage: string;
      externalLink: string;
    };
    context_menu: {
      videoUrl: string;
      coverImage: string;
      externalLink: string;
    };
    manage_and_classify: {
      videoUrl: string;
      coverImage: string;
      externalLink: string;
    };
    advanced_filter: {
      videoUrl: string;
      coverImage: string;
      externalLink: string;
    };
    proxy_management: {
      videoUrl: string;
      coverImage: string;
      externalLink: string;
    };
    account_management: {
      videoUrl: string;
      coverImage: string;
      externalLink: string;
    };
    plugin_management: {
      videoUrl: string;
      coverImage: string;
      externalLink: string;
    };
    synchronizer: {
      videoUrl: string;
      coverImage: string;
      externalLink: string;
    };
    team_management: {
      videoUrl: string;
      coverImage: string;
      externalLink: string;
    };
  };
  msg: string;
}

export interface UserUpdateDeviceNameCreatePayload {
  /** 设备mac地址 */
  deviceMac: string;
  /** 设备名称 */
  deviceName: string;
}

export interface UserUpdateDeviceNameCreateData {
  code: number;
  msg: string;
}

export interface UserUpdateOnboardingTaskStatusCreatePayload {
  /** 首次注册指引弹窗：False未完成 True已完成 */
  firstRegisterGuideStatus?: boolean;
  /** 隐藏侧边栏入口：False未完成 True已完成 */
  hideSidebarEntryStatus?: boolean;
  /** 右键操作点击指引：False未完成 True已完成 */
  contextMenuGuideStatus?: boolean;
  /** 保存筛选条件：False未完成 True已完成 */
  saveFilterGuideStatus?: boolean;
  /** 创建窗口视频入口：False未完成 True已完成 */
  createProfileVideoEntryStatus?: boolean;
  /** 创建窗口步骤指引：False未完成 True已完成 */
  createProfileTourGuideStatus?: boolean;
  /** 创建代理视频入口：False未完成 True已完成 */
  createProxyVideoEntryStatus?: boolean;
  autoRatingStatus?: boolean;
  ratingStatus?: boolean;
  externalRatingStatus?: boolean;
  firstOpenWindowStatus?: boolean;
  firstWebRegisterGuideStatus?: boolean;
  batchOpenWindowNoPromptStatus?: boolean;
  newSpaceCreateTeamStatus?: boolean;
}

export interface UserUpdateOnboardingTaskStatusCreateData {
  code: number;
  msg: string;
}

export interface GetFaqHelpListData {
  code: number;
  data: {
    rows: {
      title: string;
      detail: string[];
    }[];
    qq_qrcode: string;
    wx_qrcode: string;
    tg_qrcode: string;
  };
  msg: string;
}

export interface UserIsNaifeiUserListData {
  code: number;
  data: {
    is_naifei_user: boolean;
  };
  msg: string;
}

export interface GetBlackFridayTimeListData {
  code: number;
  data: {
    start_timestamp: number;
    end_timestamp: number;
    discountPercentage: number;
  };
  msg: string;
}

export interface UserSubmitSurveyAnswerCreatePayload {
  source: string[];
  plan: string[];
  feature: string[];
  about: string[];
}

export type UserSubmitSurveyAnswerCreateData = object;

export interface SendPhoneVerCodeCreatePayload {
  phone: string;
  source?: string;
}

export interface SendPhoneVerCodeCreateData {
  code: number;
  data: {
    isRegistered: boolean;
  };
  msg: string;
}

export interface LoginPhoneCreatePayload {
  phone: string;
  verCode: string;
  inviteCode?: string;
}

export interface LoginPhoneCreateData {
  code: number;
  data: {
    is_migrate: boolean;
    role: string;
    token: string;
    type: number;
    user_id: number;
    user_name: string;
    workspaceId: number;
  };
  msg: string;
}

export interface UserBindPhoneCreatePayload {
  phone: string;
  verCode: string;
}

export interface UserBindPhoneCreateData {
  code: number;
  msg: string;
}

export type UserSetPromotionLinkShowCreatePayload = object;

export interface UserSetPromotionLinkShowCreateData {
  code: number;
  msg: string;
}

export interface GetPromotionLinkDiscountAndUsernameListData {
  code: number;
  data: {
    /** TRUE 展示 false 不展示 */
    isShow: boolean;
    /** 用户消费折扣 */
    userDiscount: number;
    /** 用户名 */
    userName: string;
  };
  msg: string;
}

export interface UserGetLlmInfoListData {
  code: number;
  data: {
    chatLimit: number;
    apikey: string;
    available: boolean;
    balance: string;
    totalBalance: string;
    provider: string;
    model: string;
    baseUrl: string;
  };
  msg: string;
}

export interface UserGetPromptTemplateListListData {
  code: number;
  data: {
    /** 创建时间 */
    createTime?: string;
    /** ID */
    id?: number;
    /** 提示模板内容 */
    promptTemplateContent?: string;
    /** 深色ICON */
    promptTemplateIconDark?: string;
    /** 亮色ICON */
    promptTemplateIconLight?: string;
    /** 提示模板标题 */
    promptTemplateTitle?: string;
    /** 状态：1启用，0：停用 */
    status?: number;
    /** 修改时间 */
    updateTime?: string;
  }[];
  msg: string;
}

export interface UserSaveLlmDataCreatePayload {
  content: string;
  /** 回复内容（阿里云地址） */
  resultUrl: string;
  /** 对话id */
  conversationId: string;
  /** 输入token */
  inputToken: number;
  /** 输出token */
  outputToken: number;
}

export interface UserSaveLlmDataCreateData {
  code: number;
  msg: string;
}

export interface UserGetUninstallReasonQuestionListListData {
  code: number;
  data: {
    code: string;
    id: number;
    sortNum: number;
    title: string;
  }[];
  msg: string;
}

export interface UserAddUninstallReasonAnswerCreatePayload {
  selectedReasonIds: number[];
  /** 其他原因详细说明 */
  otherReasonText: string;
  selectedReasons: string[];
}

export interface UserAddUninstallReasonAnswerCreateData {
  code: number;
  msg: string;
}

export interface UserRegisterGiftConfigListData {
  code: number;
  data: {
    enable: boolean;
    create_count: number;
    static: {
      enable: boolean;
      ispCount: number;
      ispCountry: string;
      dcCount: number;
      dcCountry: string;
      day: number;
      imgUrl: string;
      windowCount: number;
    };
    dynamic: {
      windowCount: number;
      enable: boolean;
      count: number;
      value: number;
      day: number;
      imgUrl: string;
    };
    discount: {
      windowCount: number;
      enable: boolean;
      value: number;
      imgUrl: string;
    };
  };
  msg: string;
}

export type UserRegGiftCreatePayload = object;

export interface UserRegGiftCreateData {
  code: number;
  msg: string;
}

export interface GetSpringFestivalTimeListData {
  code: number;
  data: {
    start_timestamp: number;
    end_timestamp: number;
    amount: number;
    staff: {
      count: number;
      enable: boolean;
    };
    profile: {
      enable: boolean;
      expireDays: number;
    };
  };
  msg: string;
}

export interface UserGetCheckPhoneVerCodeCreatePayload {
  verCode: string;
}

export interface UserGetCheckPhoneVerCodeCreateData {
  code: number;
  msg: string;
}

export interface GetActivityDiscountListData {
  code: number;
  data: {
    start_timestamp: number;
    end_timestamp: number;
    discountPercentage: number;
    type: number;
  };
  msg: string;
}

export type UserCalcLlmTokenCostCreatePayload = object;

export interface UserCalcLlmTokenCostCreateData {
  code: number;
  data: {
    cost: string;
    balance: string;
    totalBalance: string;
    available: boolean;
  };
  msg: string;
}

export interface UserGetInviteNotifyListData {
  code: number;
  data: {
    id: number;
    paramData: {
      data: string;
      workspaceName: string;
      workspaceId: number;
      workspacePicture: string;
      endTime: string;
      identityType: string;
    };
  };
  msg: string;
}

export type UserAppRatingData = BaseResponse;

export type UserSentryClientCreatePayload = object;

export interface UserSentryClientCreateData {
  code: number;
  msg: string;
}

export interface UserGetPhoneListData {
  code: number;
  data: {
    phone: string;
  };
  msg: string;
}

export interface GetEasterPromoTimeListData {
  code: number;
  data: {
    /** 0 无活动 */
    type: number;
    start_timestamp: number;
    end_timestamp: number;
    server_utc_timestamp: number;
    /** 窗口空间成员折扣 */
    discount: number;
    /** 代理折扣 */
    proxyDiscount: number;
  };
  msg: string;
}

export interface UserSetRoxyClawCreatePayload {
  tg_bot_token: string;
  tg_allowed_chat_ids: string;
  lark_app_id: string;
  lark_app_secret: string;
  lark_allowed_chat_ids: string;
  enabled: number;
  lark_environment: string;
  slack_bot_token: string;
  slack_signing_secret: string;
  slack_app_token: string;
  slack_allowed_user_ids: string;
  slack_allowed_channel_ids: string;
  discord_bot_token: string;
  discord_allowed_user_ids: string;
}

export interface UserSetRoxyClawCreateData {
  code: number;
  msg: string;
}

export interface GetMayFreedomSeasonPromoTimeListData {
  code: number;
  data: {
    start_timestamp: number;
    end_timestamp: number;
    server_utc_timestamp: number;
    type: number;
    discount: number;
    gift_members: number;
  };
  msg: string;
}

export interface UserMayFreedomResultListData {
  code: number;
  data: boolean;
  msg: string;
}

export interface GetEcommerceWhitelistDomainsListData {
  code: number;
  data: string[];
  msg: string;
}

export interface UserGetRpaScriptLibraryListListData {
  code: number;
  data: {
    rows: {
      category?: string;
      categoryKey?: string;
      categorySortNum?: number;
      description?: string;
      iconUrl?: string;
      id?: number;
      name?: string;
      scriptOssUrl?: string;
      title?: string;
    }[];
  };
  msg: string;
}

export interface UninstallReasonReportCreatePayload {
  /** 平台类型 */
  r_os: string;
  /** 语言 */
  language: string;
  /** 用户ID */
  userId: number;
  /** app版本号 */
  appVersion: string;
  /** 其他原因 */
  otherReasonText: string;
  selectedReasonIds: number[];
}

export interface UninstallReasonReportCreateData {
  code: number;
  msg: string;
}

export interface UserGetInfluencerRankingListData {
  code: number;
  data: {
    /** 推广金额 */
    bonusText?: string;
    /** 推广人数 */
    inviteText?: number;
    /** 排名 */
    rank?: number;
    /** 用户名 */
    username?: string;
  }[];
  msg: string;
}

export interface UserGetPromotionLinkListListData {
  code: number;
  data: {
    linkType: string;
    promotionCode: string;
  }[];
  msg: string;
}

export interface UserReportAppEventCreatePayload {
  eventName: string;
  eventProperties: object;
}

export interface UserReportAppEventCreateData {
  code: number;
  msg: string;
}

export type CheckPhoneRegisteredListPayload = object;

export interface CheckPhoneRegisteredListParams {
  /** @example "18229955380" */
  phone?: string;
}

export type CheckPhoneRegisteredListData = object;

export interface GetJuneRechargePromoTimeListData {
  code: number;
  data: {
    start_timestamp: number;
    end_timestamp: number;
    server_utc_timestamp: number;
    type: number;
    min_amount: number;
    recharge_benefits: {
      amount: number;
      discount: number;
    }[];
  };
  msg: string;
}

export interface UserModifyPromotionLinkCreatePayload {
  promotionCode: string;
  newPromotionCode: string;
}

export interface UserModifyPromotionLinkCreateData {
  code: number;
  msg: string;
}

export interface AppUpdateDetailParams {
  /**
   * 操作系统：win32 / darwin / linux
   * @example "win32"
   */
  os: string;
  /**
   * Windows/Linux 必填：32 或 64
   * @example "64"
   */
  osBit?: string;
  /**
   * macOS 必填：intel / apple / arm64（arm64 归一为 apple）
   * @example "apple"
   */
  cpu?: string;
  /**
   * 清单文件名：Windows=latest.yml，macOS=latest-mac.yml，Linux=latest-linux.yml（须与 os 匹配）
   * @example "latest.yml"
   */
  ymlFile: string;
}

/** YAML 文本：version / files[].url(预签名) / path(预签名) / sha512 / releaseDate */
export type AppUpdateDetailData = string;

export type AppUpdateDetailError =
  | {
      code?: number;
      msg?: string;
      data?: string;
    }
  | {
      code?: number;
      msg?: string;
    };

export interface GetCoreDownloadUrlsCreatePayload {
  os: string;
  osVersion: string;
  osBit: string;
  cpu: string;
  /** 浏览器内核类型，Chrome/Firefox */
  coreType: string;
  /** coreVersion列表 */
  coreVersions: string[];
}

export interface GetCoreDownloadUrlsCreateData {
  code: number;
  data: {
    rows: {
      coreVersion?: string;
      downloadUrl?: string;
    }[];
  };
  msg: string;
}

export interface UserGetAppFeatureTipsCreatePayload {
  /** 操作系统,如 "win32", "darwin"，"linux",str，必传 */
  os: string;
  /** cpu架构,darwin专用：interl/apple，str，darwin时必传 */
  osBit: string;
  /** 操作系统位数,win32/linux专用，32或64，str，win32/linux时必传 */
  cpu: string;
}

export interface UserGetAppFeatureTipsCreateData {
  code: number;
  data: {
    newFeatureTips?: {
      "zh-CN": {
        content?: string;
        id?: number;
      }[];
      en: {
        content?: string;
        id?: number;
      }[];
      ru: {
        content?: string;
        id?: number;
      }[];
    };
    version: null;
  };
  msg: string;
}

export type UserGetMessageTipsCreatePayload = object;

export interface UserGetMessageTipsCreateData {
  code: number;
  data: {
    /** 数据格式同原newFeatureTips */
    messageTips?: {
      "zh-CN": {
        content?: string;
        id?: number;
      }[];
      en: {
        content?: string;
        id?: number;
      }[];
      ru: {
        content?: string;
        id?: number;
      }[];
    };
    version: null;
  };
  msg: string;
}

export interface UserGetNewUserBenefitConfigListData {
  /** 接口返回码，0 通常表示成功 */
  code: number;
  /** 接口业务数据主体 */
  data: {
    /** 活动开始时间，13位毫秒时间戳 */
    start_timestamp: number;
    /** 活动结束时间，13位毫秒时间戳 */
    end_timestamp: number;
    /** 服务器当前 UTC 时间，13位毫秒时间戳，用于和活动时间做比较 */
    server_utc_timestamp: number;
    /** 当前用户是否满足领取/参与该新用户福利的资格 */
    eligible: boolean;
    /** 当前活动是否处于开启状态 */
    promoActive: boolean;
    /** 当前是否仍在“注册后可参与”的有效时间窗口内 */
    withinRegisterWindow: boolean;
    /** 注册福利资格失效时间，13位毫秒时间戳，超过该时间可能无法再参与 */
    registerExpireTimestamp: number;
    /** 用户当前福利使用情况 */
    usage: {
      /** 数据中心代理福利是否已经使用过，false 表示未使用 */
      datacenter: boolean;
      /** 住宅代理福利是否已经使用过，false 表示未使用 */
      residential: boolean;
      /** 窗口期/套餐赠送福利是否已经使用过，false 表示未使用 */
      window: boolean;
    };
    /** 用户当前各类福利是否还有剩余额度/可用资格 */
    remaining: {
      /** 数据中心代理福利是否仍可使用，true 表示还有 */
      datacenter: boolean;
      /** 住宅代理福利是否仍可使用，true 表示还有 */
      residential: boolean;
      /** 窗口期/赠送月数福利是否仍可使用，true 表示还有 */
      window: boolean;
    };
    /** 数据中心代理的新用户优惠价格 */
    datacenterPrice: number;
    /** 住宅代理的新用户优惠价格 */
    residentialPrice: number;
    /** 支持住宅代理新用户福利的国家/地区列表 */
    residentialCountries: string[];
    /** 住宅代理中“自有资源”支持的国家/地区列表 */
    residentialOwnCountries: string[];
    /** 不同购买时长对应赠送月数的映射关系 */
    windowGiftMonths: {
      /** 购买 3 个月，赠送 1 个月 */
      "3": number;
      /** 购买 6 个月，赠送 2 个月 */
      "6": number;
      /** 购买 12 个月，赠送 4 个月 */
      "12": number;
    };
  };
  /** 接口返回消息，描述本次请求结果 */
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
   * @example ["1,2,3"]
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
  /**
   * 查询key: ["name_remark","name", "remark", "account", "tag","proxy", "project_name", "sortNum"，"os","osVersion"]
   * @example "name"
   */
  queryKey?: string;
  /**
   * 查询的值
   * @example "1111"
   */
  queryValue?: string;
  /**
   * 平台URL 多个使用英文逗号分隔, str, 非必传 (多选)
   * @example "facebook"
   */
  platformUrls?: string;
  /**
   * 窗口可用状态 true 可用 false 不可用 非必传
   * @example "true"
   */
  enableStatus?: string;
  projectIds?: string;
  /**
   * 是否电商专用窗口：1是 0否 不传查询全部
   * @example 1
   */
  isEcommerce?: number;
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
      statusInfo?: {
        openUserId?: number;
        openUserName?: string;
        openTime?: string;
      }[];
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
      /** 浏览器内核类型，Chrome/Firefox */
      coreType?: string;
      openLimitStatus?: boolean;
      labelInfo?: string[];
      platformUrlList?: string[];
      maxWindowSort?: number;
      buyProxyType?: number;
      openTime?: string;
      isTemporary?: boolean;
      isTransfer?: boolean;
      transferUserAvatar?: string;
      transferUserName?: string;
      workspaceName?: string;
      isDirect?: boolean;
      /** 保持使用最新版本内核 */
      useLatestCore: boolean;
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
    dirId: string;
    sortNum: number;
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
  /** 浏览器内核类型，Chrome/Firefox */
  coreType: string;
}

export interface UserBatchWindowInfoV2CreateData {
  code: number;
  data: {
    count: number;
    windowIds: number[];
  };
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
  /** 浏览器内核类型，Chrome/Firefox */
  coreType: string;
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
  /** 浏览器内核类型，Chrome/Firefox */
  coreType: string;
}

export interface UserAnalysisWindowInfoCreateData {
  /** 状态码, int */
  code: number;
  /** 返回结果, str */
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
  /** 浏览器内核类型，Chrome/Firefox */
  coreType: string;
}

export interface UserMdfWindowInfoBatchV2CreateData {
  code: number;
  msg: string;
}

export interface UserMdfWindowDataBatchCreatePayload {
  requestType: string;
  /** 代理选择/代理添加/删除代理/添加平台账号/选择平台账号/编辑cookie： proxy_select/proxy_add/proxy_delete/platform_add/platform_select/cookie_edit */
  type: string;
  ids: string[];
  paramList?: {
    platformUrlIds: number[];
    /** 添加账号平台 */
    windowPlatformList: string[];
    /** 选择代理 */
    moduleId: number;
    /** 编辑cookie */
    cookie: string[];
    loading: boolean;
    checkStatus: number;
    error: string;
    lastIp: string;
    lastCity: string;
    lastCountry: string;
    timezone: string;
    checkTime: string;
    proxyRules: string;
    ipType: string;
    protocol: string;
    proxyCategory: string;
    host: string;
    port: number;
    proxyUserName: string;
    proxyPassword: string;
    refreshUrl: string;
    checkChannel: string;
    id: number;
    dirId: string;
    proxyMethod: string;
  };
  proxyList?: {
    moduleId?: number;
    proxyMethod?: string;
    checkStatus?: number;
    lastIp?: string;
    lastCity?: string;
    lastCountry?: string;
    timezone?: string;
    checkTime?: string;
    host?: string;
    port?: string;
    proxyUserName?: string;
    proxyPassword?: string;
    proxyRules?: string;
    ipType?: string;
    proxyCategory?: string;
    refreshUrl?: string;
    checkChannel?: string;
    protocol?: string;
  }[];
}

export interface UserMdfWindowDataBatchCreateData {
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
  /** 窗口打开时长，单位为秒 */
  useDuration?: number;
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
  /**
   * 浏览器内核类型，Chrome/Firefox
   * @example "Chrome"
   */
  coreType: CoreTypeEnum;
}

/**
 * 浏览器内核类型，Chrome/Firefox
 * @example "Chrome"
 */
export enum CoreTypeEnum {
  Chrome = "Chrome",
  Firefox = "Firefox",
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

/**
 * 浏览器内核类型，Chrome/Firefox
 * @example "Chrome"
 */
export enum UserGetUaWebglV2ListParams1CoreTypeEnum {
  Chrome = "Chrome",
  Firefox = "Firefox",
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

export interface UserGetDeviceNameV2ListParams {
  /**
   * 操作系统，如 macOS,Windows
   * @example "Windows"
   */
  os: string;
  count?: number;
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

export interface UserGetWindowRowsSortListData {
  code: number;
  data: {
    name: string;
    sort: string;
    status: number;
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

export interface UserTransferWindowVerifyCodeListParams {
  /**
   * 代理商投送时传参
   * @example "1095641967@qq.com"
   */
  targetEmail?: string;
  /** 普通投送时传参 */
  targetWorkspaceId?: string;
}

export interface UserTransferWindowVerifyCodeListData {
  code: number;
  msg: string;
}

export interface UserTransferWindowCreatePayload {
  windowIds: number[];
  /** 目标空间ID */
  targetWorkspaceId: number;
  /** 是否删除,true：删除, false: 不删除 */
  isDelete: boolean;
  /** 邮箱验证码（如果当前是自己空间转自己空间可以不用传入） */
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
    /** 空间编号 */
    workspaceNo?: string;
    /** 空间名称 */
    workspaceName?: string;
    /** 空间图标 */
    workspacePicture?: string;
    /** 工作空间图片URL */
    workspacePictureUrl?: string;
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

export interface UserClearTransferWorkspaceCreatePayload {
  /** 窗口ID */
  workspaceIds: string[];
}

export interface UserClearTransferWorkspaceCreateData {
  code: number;
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

export interface UserTransferWindowByWorkspaceIdCreatePayload {
  windowIds: number[];
  /** 转移的空间ID */
  workspaceId: number;
}

export interface UserTransferWindowByWorkspaceIdCreateData {
  code: number;
  msg: string;
}

export interface UserGetWindowPlatformAccountListListData {
  code: number;
  data: {
    rows: {
      platformUrl?: string;
    }[];
    total: number;
  };
  msg: string;
}

export interface UserAgentTransferWindowCreatePayload {
  windowIds: number[];
  expireDays: number;
  emailCode: string;
  /** 目标空间ID */
  targetEmail: string;
  transferParam: string[];
}

export interface UserAgentTransferWindowCreateData {
  code: number;
  msg: string;
}

export interface UserGetAgentTransferWindowStatusListData {
  code: number;
  data: boolean;
  msg: string;
}

export interface UserGetTransferRecordListListParams {
  /** @example "1" */
  page_index?: string;
  /** @example "10" */
  page_size?: string;
  /**
   * Transfer, Receive, 或空（全部）
   * @example "Receive"
   */
  type?: string;
}

export interface UserGetTransferRecordListListData {
  code: number;
  data: {
    rows: {
      id?: number;
      transferNo?: string;
      type?: string;
      transferor?: string;
      receiver?: string;
      detail?: string;
      windowCount?: number;
      status?: string;
      createTime?: string;
    }[];
    total: number;
  };
  msg: string;
}

export interface UserGetTransferTaskDetailsListParams {
  /** @example "999" */
  transferTaskId?: string;
  /** @example "1" */
  page_index?: string;
  /** @example "10" */
  page_size?: string;
}

export interface UserGetTransferTaskDetailsListData {
  code: number;
  data: {
    rows: {
      id: number;
      transferTaskId: number;
      lastCountry: string;
      lastCity: string;
      lastIp: string;
      port: string;
      proxyUserName: string;
      proxyPassword: string;
      checkTime: string;
      coreVersion: string;
      os: string;
      osVersion: string;
      remark: string;
      windowPlatformList: {
        platformUrl: string;
        platformUserName: string;
        platformPassword: string;
        platformEfa: string;
        platformIconDark: string;
        platformIcon: string;
      }[];
      name: string;
      createTime: string;
      updateTime: string;
    }[];
    total: number;
  };
  msg: string;
}

export interface UserGetAgentDeliveryDurationListListData {
  code: number;
  data: number[];
  msg: string;
}

export interface UserActivateCloudBrowserCreatePayload {
  windowId: number;
}

export interface UserActivateCloudBrowserCreateData {
  code: number;
  msg: string;
}

export type UserGetCloudBrowserInfoListPayload = object;

export interface UserGetCloudBrowserInfoListData {
  code: number;
  data: {
    connectUrl: string;
  };
  msg: string;
}

export interface UserMdfCloudBrowserActivateInfoCreatePayload {
  /** 上报浏览器使用了多长时间（单位毫秒） */
  usedMs: number;
}

export interface UserMdfCloudBrowserActivateInfoCreateData {
  code: number;
  data: {
    remainingUsageMs: number;
  };
  msg: string;
}

export interface UserGetCloudBrowserRemainingUsageListData {
  code: number;
  data: {
    remainingUsageMs: number;
    dirId: string;
  };
  msg: string;
}

export type UserGetCloudBrowserExperienceProxyListPayload = object;

export interface UserGetCloudBrowserExperienceProxyListData {
  code: number;
  data: {
    host: string;
    port: string;
    protocol: string;
    proxyUserName: string;
    proxyPassword: string;
    ipType: string;
  };
  msg: string;
}

export interface UserMdfWindowProxyCheckBatchCreatePayload {
  proxyList: {
    id: number;
    dirId: string;
    loading: boolean;
    checkStatus: number;
    lastIp: string;
    lastCity: string;
    lastCountry: string;
    timezone: string;
    checkTime: string;
    requestType: string;
  }[];
}

export interface UserMdfWindowProxyCheckBatchCreateData {
  code: number;
  msg: string;
}

export interface UserGetWindowOneClickConfigListListData {
  code: number;
  data: {
    darkImage: string | null;
    description: string;
    hover: string;
    id: number;
    image: string | null;
    preset: {
      coreType: string;
      coreVersion: string;
      lastCountry: string;
      os: string;
      osVersion: string;
      resolutionType: number;
      resolutionX: number;
      resolutionY: number;
      windowName: string;
      windowPlatformList: {
        platformEfa: string;
        platformIcon: string;
        platformIconDark: string;
        platformPassword: string;
        platformUrl: string;
        platformUserName: string;
      }[];
    };
    proxyInfo: {
      businessId: number;
      proxyPriceList: {
        proxyPrice: number;
        proxyPurchaseMonths: number;
      }[];
      proxyProviderId: number;
      purchaseCountry: {
        label: string;
        value: string;
      };
    };
    title: string;
  }[];
  msg: string;
}

export interface UserGetWindowOneClickProxyInfoListListParams {
  /** @example "2" */
  proxyProviderId?: string;
  /** @example "1" */
  businessId?: string;
}

export interface UserGetWindowOneClickProxyInfoListListData {
  code: number;
  data: {
    businessId: number;
    proxyPriceList: {
      proxyPrice: number;
      proxyPurchaseMonths: number;
    }[];
    proxyProviderId: number;
    purchaseCountry: {
      label: string;
      value: string;
    };
  }[];
  msg: string;
}

export interface UserAddProxyTemplateCreatePayload {
  port: string;
  proxyUserName: string;
  proxyPassword: string;
  ipType: string;
  host: string;
  protocol: string;
  proxyCategory: string;
  checkChannel: string;
  extInfo: object;
}

export interface UserAddProxyTemplateCreateData {
  code: number;
  msg: string;
}

export interface UserGetProxyTemplateListData {
  code: number;
  data: {
    id: number;
    proxyInfo: {
      port: string;
      proxyUserName: string;
      proxyPassword: string;
      ipType: string;
      host: string;
      protocol: string;
      proxyCategory: string;
      checkChannel: string;
      createTime: string;
      updateTime: string;
      extInfo: object;
    };
  };
  msg: string;
}

export interface UserMdfProxyTemplateCreatePayload {
  id: number;
  port: string;
  proxyUserName: string;
  proxyPassword: string;
  ipType: string;
  host: string;
  protocol: string;
  proxyCategory: string;
  checkChannel: string;
  extInfo: object;
}

export interface UserMdfProxyTemplateCreateData {
  code: number;
  msg: string;
}

export interface UserDeleteProxyTemplateCreatePayload {
  id: number;
}

export interface UserDeleteProxyTemplateCreateData {
  code: number;
  msg: string;
}

export interface UserMdfPlatformBindWindowCreatePayload {
  platformId: number;
  windowIds: number[];
}

export interface UserMdfPlatformBindWindowCreateData {
  code: number;
  msg: string;
}

export interface UserGetWindowInfoDetailListParams {
  /**
   * 窗口主键 ID，int，与 dirId 至少传一个
   * @example 12345
   */
  id?: number;
  /**
   * 窗口目录 ID，str，与 id 至少传一个
   * @example "dc1e73d4dd954a3a8ca087d53d2e18ce"
   */
  dirId?: string;
  /**
   * 是否删除，int，默认 0（未删除）；传 1 可查回收站
   * @example 0
   */
  isDelete?: number;
}

export interface UserGetWindowInfoDetailListData {
  /** 业务状态码，0 表示成功 */
  code: number;
  /** 提示信息 */
  msg?: string;
  data: {
    /**
     * 窗口id, int
     * 窗口id, int
     */
    id?: number;
    /**
     * 【页面不显示】，窗口目录id
     * 【页面不显示】，窗口目录id
     */
    dirId?: string;
    /**
     * 窗口序号,int
     * 窗口序号,int
     */
    windowSortNum?: number;
    /**
     * 项目ID,int
     * 项目ID,int
     */
    projectId?: string;
    /**
     * oss存放路径
     * oss存放路径
     */
    ossDirPath?: string;
    /**
     * 项目名称,str
     * 项目名称,str
     */
    projectName?: string;
    /**
     * 窗口名称, str
     * 窗口名称, str
     */
    windowName?: string;
    /**
     * id, int
     * id, int
     */
    groupId?: number;
    /**
     * 分组名称, str
     * 分组名称, str
     */
    groupName?: string;
    /**
     * 业务平台URL，str
     * 业务平台URL，str
     */
    platformUrl?: string;
    /**
     * 平台账号，str
     * 平台账号，str
     */
    platformUserName?: string;
    /**
     * 平台密码，str
     * 平台密码，str
     */
    platformPassword?: string;
    /**
     * 浏览器内核类型，Chrome/Firefox
     * 浏览器内核类型，Chrome/Firefox
     */
    coreType?: string;
    defaultOpenUrl?: string[];
    /**
     * 内核版本，枚举值：117，109, str类型
     * 内核版本，枚举值：117，109, str类型
     */
    coreVersion?: string;
    /**
     * 操作系统, Windows,macOS,Linux,Android,IOS
     * 操作系统, Windows,macOS,Linux,Android,IOS
     */
    os?: string;
    /**
     * 操作系统版本
     * 操作系统版本
     */
    osVersion?: string;
    /**
     * 浏览器版本
     * 浏览器版本
     */
    browserVersion?: string;
    /**
     * User Agent
     * User Agent
     */
    userAgent?: string;
    cookie?: {
      name?: string;
      value?: string;
      domain?: string;
    }[];
    /**
     * 窗口备注, str
     * 窗口备注, str
     */
    windowRemark?: string;
    /**
     * 是否常用
     * 是否常用
     */
    isOften?: boolean;
    /**
     * 是否已打开
     * 是否已打开
     */
    openStatus?: boolean;
    statusInfo?: {
      openUserId: number;
      openUserName: string;
      openTime: string;
    }[];
    /**
     * 【页面暂时不显示】，标签id
     * 【页面暂时不显示】，标签id
     */
    labelId?: number;
    /**
     * 【页面暂时不显示】，标签颜色
     * 【页面暂时不显示】，标签颜色
     */
    labelColor?: string;
    /**
     * 【页面暂时不显示】，标签名称
     * 【页面暂时不显示】，标签名称
     */
    labelName?: string;
    labelIds?: number[];
    labelInfo?: {
      labelId: number;
      labelName: string;
      labelColor: string;
    }[];
    /**
     * 【页面不显示】，用来存储网站的登录信息，网站会自动填充密码，List格式
     * 【页面不显示】，用来存储网站的登录信息，网站会自动填充密码，List格式
     */
    loginData?: string[];
    /**
     * 窗口创建时间, str
     * 窗口创建时间, str
     */
    createTime?: string;
    /**
     * 窗口修改时间, str
     * 窗口修改时间, str
     */
    updateTime?: string;
    /**
     * 窗口打开时间, str
     * 窗口打开时间, str
     */
    openTime?: string;
    /**
     * 窗口关闭时间, str
     * 窗口关闭时间, str
     */
    closeTime?: string;
    /**
     * 窗口归属人用户名,即用户账号, str
     * 窗口归属人用户名,即用户账号, str
     */
    userName?: string;
    /**
     * 窗口归属人用户姓名, str
     * 窗口归属人用户姓名, str
     */
    realName?: string;
    /**
     * 窗口归属人所属角色，枚举值：main:主账号, admin:管理员, manager:经理, staff:成员, str
     * 窗口归属人所属角色，枚举值：main:主账号, admin:管理员, manager:经理, staff:成员, str
     */
    role?: string;
    /**
     * 窗口绑定的代理IP的id
     * 窗口绑定的代理IP的id
     */
    moduleId?: number;
    /**
     * 代理方式，custom：自定义，import：导入的IP，api：API接入， 【取字典】
     * 代理方式，custom：自定义，import：导入的IP，api：API接入， 【取字典】
     */
    proxyMethod?: string;
    /**
     * 添加类型，str, 枚举值：add：新增IP，choose: 已添加IP【取字典】
     * 添加类型，str, 枚举值：add：新增IP，choose: 已添加IP【取字典】
     */
    addType?: string;
    /**
     * 代理名称
     * 代理名称
     */
    moduleName?: string;
    /**
     * 代理类型，str, 枚举值：static：静态IP，rotate: 动态IP， 【取字典】
     * 代理类型，str, 枚举值：static：静态IP，rotate: 动态IP， 【取字典】
     */
    proxyType?: string;
    /**
     * 代理网络，str, 枚举值：resi：住宅IP，mobile: 手机IP，dc: 机房IP，ipv6: IPv6， 【取字典】
     * 代理网络，str, 枚举值：resi：住宅IP，mobile: 手机IP，dc: 机房IP，ipv6: IPv6， 【取字典】
     */
    proxyNetwork?: string;
    /**
     * 计费方式，str,枚举值：month:包月，bandwidth:流量, 【取字典】
     * 计费方式，str,枚举值：month:包月，bandwidth:流量, 【取字典】
     */
    billMethod?: string;
    /**
     * 代理类型，枚举值：noproxy, HTTP, HTTPS, SOCKS5
     * 代理类型，枚举值：noproxy, HTTP, HTTPS, SOCKS5
     */
    proxyCategory?: string;
    /**
     * 网络协议，str, 枚举值：IPV4, IPV6
     * 网络协议，str, 枚举值：IPV4, IPV6
     */
    ipType?: string;
    /**
     * 代理服务商，str
     * 代理服务商，str
     */
    proxyProvider?: string;
    /**
     * 代理协议，枚举值：NOPROXY, HTTP, HTTPS, SOCKS5
     * 代理协议，枚举值：NOPROXY, HTTP, HTTPS, SOCKS5
     */
    protocol?: string;
    /**
     * 国家
     * 国家
     */
    country?: string;
    /**
     * 【页面暂时不显示】，州
     * 【页面暂时不显示】，州
     */
    state?: string;
    /**
     * 【页面暂时不显示】，城市
     * 【页面暂时不显示】，城市
     */
    city?: string;
    /**
     * 代理主机
     * 代理主机
     */
    host?: string;
    /**
     * 代理端口
     * 代理端口
     */
    port?: string;
    /**
     * 代理账号
     * 代理账号
     */
    proxyUserName?: string;
    /**
     * 代理密码
     * 代理密码
     */
    proxyPassword?: string;
    /**
     * ip时长
     * ip时长
     */
    proxyTime?: string;
    /**
     * 刷新URL
     * 刷新URL
     */
    refreshUrl?: string;
    /**
     * 接入点，【取字典】
     * 接入点，【取字典】
     */
    accessServer?: string;
    /**
     * 查询渠道
     * 查询渠道
     */
    checkChannel?: string;
    /**
     * 一期用不上，proxyMethod=api时，提取链接的服务商，ROLA
     * 一期用不上，proxyMethod=api时，提取链接的服务商，ROLA
     */
    extraChannel?: string;
    /**
     * 一期用不上，proxyMethod=api时，提取IP，每次打开都提取新IP，默认1, 枚举值：0和1
     * 一期用不上，proxyMethod=api时，提取IP，每次打开都提取新IP，默认1, 枚举值：0和1
     */
    isExtraNewIp?: boolean;
    /**
     * 一期用不上，proxyMethod=api时，提取IP校验重复，1 校验，0不校验。打开窗口时，将检测提取IP是否重复，重复则重新提取，最多重新提取5次,默认0
     * 一期用不上，proxyMethod=api时，提取IP校验重复，1 校验，0不校验。打开窗口时，将检测提取IP是否重复，重复则重新提取，最多重新提取5次,默认0
     */
    isRepectCheck?: boolean;
    /**
     * 一期用不上，proxyMethod=api时，提取IP链接，str
     * 一期用不上，proxyMethod=api时，提取IP链接，str
     */
    extraUrl?: string;
    /**
     * 【页面暂时不显示】，关闭窗口时写入，给用户显示用
     * 【页面暂时不显示】，关闭窗口时写入，给用户显示用
     */
    lastIp?: string;
    /**
     * 【页面暂时不显示】，关闭窗口时写入，给用户显示用
     * 【页面暂时不显示】，关闭窗口时写入，给用户显示用
     */
    lastCountry?: string;
    /**
     * 语言，1:跟随IP匹配，0自定义，默认1
     * 语言，1:跟随IP匹配，0自定义，默认1
     */
    isLanguageBaseIp?: boolean;
    /**
     * isLanguageBaseIp为0时选择的语言
     * isLanguageBaseIp为0时选择的语言
     */
    language?: string;
    /**
     * 界面语言，1: 跟随IP匹配，0：自定义，默认1
     * 界面语言，1: 跟随IP匹配，0：自定义，默认1
     */
    isDisplayLanguageBaseIp?: boolean;
    /**
     * isDisplayLanguageBaseIp为0时选择的语言
     * isDisplayLanguageBaseIp为0时选择的语言
     */
    displayLanguage?: string;
    /**
     * 时区，1: 跟随IP匹配，0：自定义，默认1
     * 时区，1: 跟随IP匹配，0：自定义，默认1
     */
    isTimeZone?: boolean;
    /**
     * isTimeZone为0时选择的时区
     * isTimeZone为0时选择的时区
     */
    timeZone?: string;
    /**
     * 地理位置 0询问|1允许|2禁止，默认0
     * 地理位置 0询问|1允许|2禁止，默认0
     */
    position?: number;
    /**
     * 基于IP生成对应的地理位置，不勾选可自定义，默认1，1：跟随IP匹配，0：自定义
     * 基于IP生成对应的地理位置，不勾选可自定义，默认1，1：跟随IP匹配，0：自定义
     */
    isPositionBaseIp?: boolean;
    /**
     * 经度 isPositionBaseIp为0时设置，选择自定义的时候设置
     * 经度 isPositionBaseIp为0时设置，选择自定义的时候设置
     */
    longitude?: string;
    /**
     * 纬度 isPositionBaseIp为0时设置，选择自定义的时候设置
     * 纬度 isPositionBaseIp为0时设置，选择自定义的时候设置
     */
    latitude?: string;
    /**
     * 精度米 isPositionBaseIp为0时设置，选择自定义的时候设置
     * 精度米 isPositionBaseIp为0时设置，选择自定义的时候设置
     */
    precisionPos?: string;
    /**
     * 声音，开启：1，关闭：0，默认1
     * 声音，开启：1，关闭：0，默认1
     */
    forbidAudio?: boolean;
    /**
     * 图片，允许加载：1，禁止加载：0，默认1
     * 图片，允许加载：1，禁止加载：0，默认1
     */
    forbidImage?: number;
    /**
     * 自定义加载图片尺寸，str
     * 自定义加载图片尺寸，str
     */
    forbiddenPictureSize?: string;
    /**
     * 视频，允许加载：1，禁止加载：0，默认1
     * 视频，允许加载：1，禁止加载：0，默认1
     */
    forbidMedia?: boolean;
    /**
     * 同步标签页，1：是，0：否，默认1
     * 同步标签页，1：是，0：否，默认1
     */
    syncTab?: boolean;
    localState?: {
      os_crypt: {
        audit_enabled: boolean;
        encrypted_key: string;
      };
    };
    /**
     * 同步Cookie，1：是，0：否，默认1, 传true和false
     * 同步Cookie，1：是，0：否，默认1, 传true和false
     */
    syncCookie?: boolean;
    /**
     * 多开设置，1：开启，0：关闭，默认0
     * 多开设置，1：开启，0：关闭，默认0
     */
    openMult?: boolean;
    /**
     * 弹出谷歌翻译，1：是，0：否，默认0
     * 弹出谷歌翻译，1：是，0：否，默认0
     */
    forbidTranslatePopup?: boolean;
    /**
     * 弹出保存密码，1：是，0：否，默认1
     * 弹出保存密码，1：是，0：否，默认1
     */
    forbidSavePassword?: boolean;
    /**
     * 网络不通停止打开，1：是，0：否，默认1
     * 网络不通停止打开，1：是，0：否，默认1
     */
    stopOpenNet?: boolean;
    /**
     * IP发生变化停止打开，1：是，0：否，默认0
     * IP发生变化停止打开，1：是，0：否，默认0
     */
    stopOpenIP?: boolean;
    /**
     * IP对应国家/地区发生变化停止打开，1：是，0：否，默认0
     * IP对应国家/地区发生变化停止打开，1：是，0：否，默认0
     */
    stopOpenPosition?: boolean;
    /**
     * 同步IndexedDB，1：是，0：否，默认0
     * 同步IndexedDB，1：是，0：否，默认0
     */
    syncIndexedDb?: boolean;
    /**
     * 同步Local Storage，1：是，0：否，默认0
     * 同步Local Storage，1：是，0：否，默认0
     */
    syncLocalStorage?: boolean;
    /**
     * 同步书签，1：是，0：否，默认0
     * 同步书签，1：是，0：否，默认0
     */
    syncBookmark?: boolean;
    /**
     * 同步已保存的用户名密码，1：是，0：否，默认1
     * 同步已保存的用户名密码，1：是，0：否，默认1
     */
    syncPassword?: boolean;
    /**
     * 同步历史记录，1：是，0：否，默认0
     * 同步历史记录，1：是，0：否，默认0
     */
    syncHistory?: boolean;
    /**
     * 同步扩展应用数据，1：是，0：否，默认0
     * 同步扩展应用数据，1：是，0：否，默认0
     */
    syncExtensions?: boolean;
    /**
     * 【页面不显示】，同步扩展应用数据时会用到，Json格式
     * 【页面不显示】，同步扩展应用数据时会用到，Json格式
     */
    syncValue?: object;
    /**
     * 启动浏览器前删除缓存文件，1：是，0：否，默认0
     * 启动浏览器前删除缓存文件，1：是，0：否，默认0
     */
    clearCacheFile?: boolean;
    /**
     * 启动浏览器前删除Cookie，1：是，0：否，默认0
     * 启动浏览器前删除Cookie，1：是，0：否，默认0
     */
    clearCookie?: boolean;
    /**
     * 启动浏览器前删除历史记录，1：是，0：否，默认0
     * 启动浏览器前删除历史记录，1：是，0：否，默认0
     */
    clearHistory?: boolean;
    /**
     * 窗口名是否在标题栏显示，显示：true，不显示：false，布尔类型，非必传, 默认false
     * 窗口名是否在标题栏显示，显示：true，不显示：false，布尔类型，非必传, 默认false
     */
    isDisplayName?: boolean;
    /**
     * 启动浏览时随机指纹，1：是，0：否，默认0
     * 启动浏览时随机指纹，1：是，0：否，默认0
     */
    randomFingerprint?: boolean;
    /**
     * 允许登录Chrome，1：是，0：否，默认0
     * 允许登录Chrome，1：是，0：否，默认0
     */
    allowLoginChrome?: boolean;
    /**
     * 关闭浏览器后继续运行应用，1：是，0：否，默认0
     * 关闭浏览器后继续运行应用，1：是，0：否，默认0
     */
    allowRunApplication?: boolean;
    /**
     * 使用硬件加速模式，1：是，0：否，默认1
     * 使用硬件加速模式，1：是，0：否，默认1
     */
    useGpu?: boolean;
    /**
     * webrtc 0替换|1真实|2禁用，默认0
     * webrtc 0替换|1真实|2禁用，默认0
     */
    webRTC?: number;
    /**
     * 忽略https证书错误，1|0，默认0
     * 忽略https证书错误，1|0，默认0
     */
    ignoreHttpsError?: boolean;
    /**
     * 窗口尺寸，宽度
     * 窗口尺寸，宽度
     */
    openWidth?: string;
    /**
     * 窗口尺寸，高度
     * 窗口尺寸，高度
     */
    openHeight?: string;
    /**
     * 分辨率， 0跟随电脑 | 1自定义，默认0
     * 分辨率， 0跟随电脑 | 1自定义，默认0
     */
    resolutionType?: boolean;
    /**
     * 自定义分辨率时，分辨率X值
     * 自定义分辨率时，分辨率X值
     */
    resolutionX?: string;
    /**
     * 自定义分辨率时，分辨率Y值
     * 自定义分辨率时，分辨率Y值
     */
    resolutionY?: string;
    /**
     * 字体， 0系统默认|1随机匹配，默认1
     * 字体， 0系统默认|1随机匹配，默认1
     */
    fontType?: boolean;
    /**
     * 【页面不显示】,字体值，指纹会用到
     * 【页面不显示】,字体值，指纹会用到
     */
    font?: string;
    /**
     * canvas 1随机｜0关闭，默认1
     * canvas 1随机｜0关闭，默认1
     */
    canvas?: boolean;
    /**
     * 【页面不显示】，canvas为随机时设置， 噪音值 10000 - 1000000，指纹会用到
     * 【页面不显示】，canvas为随机时设置， 噪音值 10000 - 1000000，指纹会用到
     */
    canvasValue?: string;
    /**
     * webGL图像，1随机｜0关闭，默认1
     * webGL图像，1随机｜0关闭，默认1
     */
    webGL?: boolean;
    /**
     * 【页面不显示】，webGL为随机时设置，随机噪音值 10000 - 1000000，指纹会用到
     * 【页面不显示】，webGL为随机时设置，随机噪音值 10000 - 1000000，指纹会用到
     */
    webGLValue?: string;
    /**
     * webgl元数据 1自定义｜0关闭，默认1
     * webgl元数据 1自定义｜0关闭，默认1
     */
    webGLMeta?: boolean;
    /**
     * webGLInfo开关，真实1，自定义0，默认0,true:真实，false:自定义
     * webGLInfo开关，真实1，自定义0，默认0,true:真实，false:自定义
     */
    webGLInfo?: boolean;
    /**
     * webGLMeta自定义时，webGL厂商值
     * webGLMeta自定义时，webGL厂商值
     */
    webGLManufacturer?: string;
    /**
     * webGLMeta自定义时，webGL渲染值
     * webGLMeta自定义时，webGL渲染值
     */
    webGLRender?: string;
    /**
     * webGpu基于webgl匹配、real 真实、block 禁止，默认值：webgl
     * webGpu基于webgl匹配、real 真实、block 禁止，默认值：webgl
     */
    webGpu?: string;
    /**
     * 【页面不显示】，指纹会用到
     * 【页面不显示】，指纹会用到
     */
    webGpuVendor?: string;
    /**
     * audioContext值，1随机｜0关闭，默认1
     * audioContext值，1随机｜0关闭，默认1
     */
    audioContext?: boolean;
    /**
     * 【页面不显示】，audioContext为随机时，噪音值， 1 - 100 ，关闭时默认10，指纹会用到
     * 【页面不显示】，audioContext为随机时，噪音值， 1 - 100 ，关闭时默认10，指纹会用到
     */
    audioContextValue?: string;
    /**
     * windows 版本转换替代字段，默认值：空字符串
     * windows 版本转换替代字段，默认值：空字符串
     */
    platformVersion?: string;
    /**
     * 电脑名称，默认值：空字符串
     * 电脑名称，默认值：空字符串
     */
    computerName?: string;
    /**
     * MAC地址，默认值：空字符串
     * MAC地址，默认值：空字符串
     */
    macAddress?: string;
    /**
     * Speech Voices，1随机｜0关闭，默认1
     * Speech Voices，1随机｜0关闭，默认1
     */
    speechVoices?: boolean;
    speechVoicesValue?: {
      enable: boolean;
      voices: {
        name: string;
        lang: string;
        isLocalService: boolean;
      }[];
    };
    /**
     * doNotTrack 0关闭 | 1开启，默认1， 枚举值：0和1
     * doNotTrack 0关闭 | 1开启，默认1， 枚举值：0和1
     */
    doNotTrack?: boolean;
    /**
     * ClientRects，1随机｜0关闭，默认1， 枚举值：0和1
     * ClientRects，1随机｜0关闭，默认1， 枚举值：0和1
     */
    clientRects?: boolean;
    clientRectsValue?: {
      enable: boolean;
      clientRectsNoiseFactorX: number;
      clientRectsNoiseFactorY: number;
    };
    /**
     * 设备信息，1自定义｜0关闭，默认1， 枚举值：0和1
     * 设备信息，1自定义｜0关闭，默认1， 枚举值：0和1
     */
    deviceInfo?: boolean;
    /**
     * 设备名称开关，真实1，自定义0，默认0,true:真实，false:自定义
     * 设备名称开关，真实1，自定义0，默认0,true:真实，false:自定义
     */
    deviceNameSwitch?: boolean;
    /**
     * 设备名称，deviceInfo为1时设置
     * 设备名称，deviceInfo为1时设置
     */
    deviceName?: string;
    /**
     * mac地址开关，真实1，自定义0，默认0，,true:真实，false:自定义
     * mac地址开关，真实1，自定义0，默认0，,true:真实，false:自定义
     */
    macInfo?: boolean;
    /**
     * mac地址，deviceInfo为1时设置
     * mac地址，deviceInfo为1时设置
     */
    macAddr?: string;
    /**
     * 端口扫描保护 0关闭｜1开启，默认1， 枚举值：0和1
     * 端口扫描保护 0关闭｜1开启，默认1， 枚举值：0和1
     */
    portScanProtect?: boolean;
    /**
     * 端口扫描保护开启时的白名单，逗号分隔，str
     * 端口扫描保护开启时的白名单，逗号分隔，str
     */
    portScanList?: string;
    /**
     * ssl指纹设置，0关闭｜1开启，默认1， 枚举值：0和1
     * ssl指纹设置，0关闭｜1开启，默认1， 枚举值：0和1
     */
    disableSsl?: boolean;
    /**
     * 序列化的ssl特性值，List格式
     * 序列化的ssl特性值，List格式
     */
    disableSslList?: string[];
    /**
     * 自定义插件指纹，0关闭｜1开启，默认1， 枚举值：0和1
     * 自定义插件指纹，0关闭｜1开启，默认1， 枚举值：0和1
     */
    enablePlugin?: boolean;
    enablePluginList?: {
      name: string;
      description: string;
      filename: string;
      mimeType: string;
      mimeDescription: string;
      suffixes: number;
    }[];
    /**
     * 【页面不显示】，媒体设备，默认0，指纹会用到
     * 【页面不显示】，媒体设备，默认0，指纹会用到
     */
    mediaDevice?: boolean;
    mediaDeviceList?: {
      deviceType?: string;
      deviceId?: string;
      label?: string;
      groupId?: string;
    }[];
    /**
     * 硬件并发数，默认4
     * 硬件并发数，默认4
     */
    hardwareConcurrent?: number;
    /**
     * 设备内存，1，2，4，8，不要传入大于8的值，默认8
     * 设备内存，1，2，4，8，不要传入大于8的值，默认8
     */
    deviceMemory?: number;
    /**
     * 【页面不显示】，user agent，指纹会用到
     * 【页面不显示】，user agent，指纹会用到
     */
    userAgentNew?: string;
    /**
     * 【页面不显示】，user agent版本号，指纹会用到
     * 【页面不显示】，user agent版本号，指纹会用到
     */
    userAgentVersion?: string;
    /**
     * 【页面不显示】，平台，指纹会用到
     * 【页面不显示】，平台，指纹会用到
     */
    platform?: string;
    /**
     * 【页面不显示】，导航平台，指纹会用到
     * 【页面不显示】，导航平台，指纹会用到
     */
    navigatorPlatform?: string;
    /**
     * 【页面不显示】，像素，指纹会用到
     * 【页面不显示】，像素，指纹会用到
     */
    pixelDepth?: number;
    /**
     * 【页面不显示】，颜色，指纹会用到
     * 【页面不显示】，颜色，指纹会用到
     */
    colorDepth?: number;
    /**
     * 是否有绑定rpa,true:有绑定，false:没有绑定 str
     * 是否有绑定rpa,true:有绑定，false:没有绑定 str
     */
    isBindRpa?: boolean;
    usePlugin?: {
      pluginDir?: string;
      pluginVersion?: string;
      pluginRoute?: string;
    }[];
    /**
     * 代理测试状态,0:没有测试，1:测试成功，2:检测失败
     * 代理测试状态,0:没有测试，1:测试成功，2:检测失败
     */
    checkStatus?: number;
    /**
     * 新业务平台列表
     * 新业务平台列表
     */
    platformUrlList?: string[];
    /**
     * 工作空间ID
     * 工作空间ID
     */
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
    /**
     * 电池模拟
     * 电池模拟
     */
    openBattery?: boolean;
    /**
     * 模拟充电状态
     * 模拟充电状态
     */
    openCharging?: boolean;
    /**
     * 充电时长（秒）
     * 充电时长（秒）
     */
    chargingTime?: string;
    /**
     * 放电时长（秒）
     * 放电时长（秒）
     */
    dischargingTime?: string;
    /**
     * 电量（%）0-1
     * 电量（%）0-1
     */
    level?: string;
    /**
     * 网络模拟
     * 网络模拟
     */
    openNetwork?: boolean;
    /** 网络类型 */
    networkType?: string;
    /**
     * 网络速度 slow-2g/2g/3g/4g
     * 网络速度 slow-2g/2g/3g/4g
     */
    networkSpeed?: string;
    /**
     * 下载速度（Mbps）
     * 下载速度（Mbps）
     */
    downloadSpeed?: string;
    /**
     * 最大下载速度（Mbps)
     * 最大下载速度（Mbps)
     */
    maxDownloadSpeed?: string;
    /**
     * 延迟（ms）
     * 延迟（ms）
     */
    latency?: number;
    /**
     * 省流模式
     * 省流模式
     */
    saveFlowMode?: boolean;
    /**
     * 打开蓝牙
     * 打开蓝牙
     */
    openBluetooth?: boolean;
    /**
     * 蓝牙适配器
     * 蓝牙适配器
     */
    bluetoothAdapter?: boolean;
    /**
     * 今日打开窗口次数
     * 今日打开窗口次数
     */
    todayOpenCount?: number;
    isDirect?: boolean;
  };
}

export type UserGetWindowInfoDetailListError = {
  code?: number;
  /** 如：id 和 dirId 至少传一个 / 窗口/数据不存在，请刷新页面后重试 */
  msg?: string;
  data?: string;
};

export interface UserGetQuickCreateTemplateListData {
  code: number;
  msg: string;
  /** 无模板时为 null */
  data: {
    /**
     * 模板ID
     * @example 1
     */
    id: number;
    /** 前端原样 JSON 对象（传什么存什么） */
    templateInfo: {
      /** 示例字段：代理主机 */
      host?: string;
      /** 示例字段：端口 */
      port?: string;
      /** 示例字段：协议 */
      protocol?: string;
      [key: string]: any;
    };
    /** 创建时间 */
    createTime: string;
    /** 更新时间 */
    updateTime: string;
  } | null;
}

/** 任意 JSON 对象，整包入库；下列为示例字段，可按需增删 */
export interface UserAddQuickCreateTemplateCreatePayload {
  /** 示例字段：代理主机 */
  host?: string;
  /** 示例字段：端口 */
  port?: string;
  /** 示例字段：协议 */
  protocol?: string;
  /** 示例字段：代理类型 */
  proxyCategory?: string;
  /** 示例字段：检测通道 */
  checkChannel?: string;
  /** 可继续扩展任意字段 */
  anyKey?: Record<string, any>;
  [key: string]: any;
}

export interface UserAddQuickCreateTemplateCreateData {
  code: number;
  msg: string;
}

/** id 外其余字段整包覆盖入库；下列为示例字段，可按需增删 */
export interface UserMdfQuickCreateTemplateCreatePayload {
  /**
   * 模板 ID
   * @example 1
   */
  id: number;
  /** 示例字段：代理主机 */
  host?: string;
  /** 示例字段：端口 */
  port?: string;
  /** 示例字段：协议 */
  protocol?: string;
  /** 可继续扩展任意字段 */
  foo?: boolean;
  [key: string]: any;
}

export interface UserMdfQuickCreateTemplateCreateData {
  code: number;
  msg: string;
}

export interface UserDeleteQuickCreateTemplateCreatePayload {
  /**
   * 模板 ID
   * @example 1
   */
  id: number;
}

export interface UserDeleteQuickCreateTemplateCreateData {
  code: number;
  msg: string;
}

export interface UserGetWindowSortNumListData {
  code: number;
  /** 下次创建会用到的序号 */
  data: {
    /** 当前已分配的最大序号 */
    windowSortNum: number;
    maxWindowSort: number;
  };
}

export interface UserGetProxyModuleListParams {
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

export type UserAddProxyModuleCreatePayload = {
  ipType?: string;
  protocol?: string;
  host?: string;
  port?: string;
  proxyUserName?: string;
  proxyPassword?: string;
  refreshUrl?: string;
  /** ip123.in/ip.json， str, 非必传 */
  checkChannel?: string;
  lastCountry?: string;
  checkTime?: string;
  remark?: string;
  checkStatus?: boolean;
}[];

export interface UserAddProxyModuleCreateData {
  code: number;
  data?: {
    index?: number;
    msg?: string[];
  }[];
  msg: string;
}

export interface UserMdfProxyModuleCreatePayload {
  requestType?: string;
  proxyList: {
    /** 代理ID */
    id?: number;
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
}

export interface UserMdfProxyModuleCreateData {
  /** 状态码, int */
  code: number;
  /** 返回结果, str */
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

export interface UserGetProxyTableSortOrderListData {
  code: number;
  data: {
    orderName: string;
    orderType: string;
  };
  msg: string;
}

export interface UserSaveProxyTableSortOrderCreatePayload {
  orderName: string;
  orderType: string;
}

export interface UserSaveProxyTableSortOrderCreateData {
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

export interface UserUpdateProxyTableRowsCreatePayload {
  tableRows: {
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

export interface UserGetUserBuyProxyListListParams {
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
   * 排序字段
   * @example "createTime"
   */
  orderName?: string;
  /**
   * 排序规则
   * @example "desc"
   */
  orderType?: string;
  /**
   * 代理是否隐藏，0：隐藏，1：不隐藏
   * @example 1
   */
  isHideProxy?: number;
  /**
   * 代理IP（代理链接）
   * @example "13.21.211.11"
   */
  proxyHost?: string;
  /**
   * 代理备注
   * @example "xxx"
   */
  proxyRemark?: string;
  /**
   * 代理过期状态 0:已过期 1:使用中 2：快过期
   * @example 0
   */
  proxyExpireStatus?: number;
  /**
   * 国家
   * @example "us"
   */
  proxyLastCountry?: string;
  /**
   * 代理协议，枚举值：HTTP, HTTPS, SOCKS5
   * @example "SOCKS5"
   */
  proxyProtocol?: string;
  /**
   * 查询类型：list_use：代理列表, window_use：窗口使用
   * @example "list_use"
   */
  type: string;
  /**
   * fuzzy，proxyHost，proxyLastCountry，proxyRemark，proxyProvider
   * @example "fuzzy"
   */
  queryKey?: string;
  /** @example "1" */
  queryValue?: string;
  /**
   * ISP Proxies，DataCenter Proxies
   * @example "ISP Proxies"
   */
  providerType?: string;
  /**
   * 0 不隐藏 1 隐藏
   * @example "0"
   */
  hideUnavailableIp?: string;
}

export interface UserGetUserBuyProxyListListData {
  code: number;
  data: {
    rows: {
      bindCount?: number;
      canRefund?: boolean;
      bindList?: string[];
      checkTime?: null;
      createTime?: string;
      id?: number;
      isBind?: boolean;
      poxyBusinessPurpose?: string;
      proxyCheckChannel?: string;
      checkChannelValue?: string;
      checkStatus?: number;
      country?: string;
      proxyExpireStatus?: number;
      host?: string;
      ipType?: string;
      lastCity?: string;
      lastCountry?: string;
      lastIp?: string;
      lastState?: string;
      proxyPassword?: string;
      port?: string;
      protocol?: string;
      proxyProviderId?: number;
      proxyProviderName?: string;
      remark?: string;
      proxyUserName?: string;
      renewalTime?: null;
      updateTime?: string;
      userId?: number;
      workspaceId?: number;
      expireDate?: string;
      orderNo?: string;
      orderStatus?: number;
      replaceStatus?: number;
      /** 能否续费 */
      canRenew?: boolean;
      /** 0关闭 1开启 */
      autoRenew?: number;
      providerType?: string;
      /** 折扣后价格 */
      proxyProviderDiscountPrice?: number;
    }[];
    total: number;
  };
  msg: string;
}

export interface UserGetProxyProviderListListData {
  code: number;
  data: {
    id: number;
    proxyProviderName: string;
    proxyTypeList: {
      typeName: string;
      id: number;
    }[];
    proxyProviderWebsite: string;
    proxyProviderIcon: string;
    proxyPrice: number;
    createTime: string;
    proxyProviderDesc: null;
    proxyProviderAdv: string[];
    iconList?: string[];
    newIconList?: {
      desc: string;
      url: string;
    }[];
    /** 代理供应商折扣 */
    proxyProviderDiscount?: number;
    jumpInfo?: {
      jumpUrl: string;
      username: string;
      password: string;
      apiKey: string;
    };
    isJump?: boolean;
  }[];
  msg: string;
}

export interface UserGetProxyBusinessUseListListData {
  code: number;
  data: {
    /** 创建时间 */
    createTime?: string;
    /** icon图标 */
    proxyBusinessIcon?: string;
    /** icon图标深色 */
    proxyBusinessIconDark?: string;
    /** 值 */
    proxyBusinessValue?: string;
    /** 键 */
    proxyBusinessKey?: string;
    /** 排序 */
    sort?: number;
  }[];
  msg: string;
}

export interface UserGetProxyPurchaseCountryListListParams {
  /**
   * 代理商名称：PrivateProxy,ProxySeller
   * @example "ProxySeller"
   */
  proxyProviderName: string;
}

export interface UserGetProxyPurchaseCountryListListData {
  code: number;
  data: {
    /** 国家编码 */
    country_code: string;
    /** 国家名称 */
    country_name: string;
    /** 代理运营商 */
    op_name: string;
    /** status，active: 可选，inactive: 不可选。 */
    status: string;
    inventory: number;
  }[];
  msg: string;
}

export interface UserGetProxyPurchaseTimePriceListParams {
  /** @example "供应商id" */
  proxyProviderId?: string;
}

export interface UserGetProxyPurchaseTimePriceListData {
  code: number;
  data: {
    /** 单个价格 */
    proxyPrice: number;
    /** 月份 */
    proxyPurchaseMonths: number;
  }[];
  msg: string;
}

export interface UserMdfUserBuyProxyRemarkCreatePayload {
  /** id */
  id: number;
  /** 代理备注 */
  proxyRemark: string;
}

export interface UserMdfUserBuyProxyRemarkCreateData {
  code: number;
  msg: string;
}

export interface UserProxyRefundOrReplaceCreatePayload {
  /** 代理id */
  proxyBuyId: number;
  /** 类型 refund：退款，replace：更换 */
  replaceType: string;
}

export interface UserProxyRefundOrReplaceCreateData {
  code: number;
  msg: string;
}

export interface UserCheckProxyCreatePayload {
  /** 代理列表 */
  proxyBuyId: number;
}

export interface UserCheckProxyCreateData {
  code: number;
  data: {
    checkTime: string;
    lastCity: string;
    lastCountry: string;
    lastIp: string;
  };
  msg: string;
}

export interface UserCheckWindowProxyStatusCreatePayload {
  windowIds: string[];
}

export interface UserCheckWindowProxyStatusCreateData {
  code: number;
  data: string[];
  msg: string;
}

export interface UserGetProxyRefundInfoListParams {
  /**
   * 退款代理ID
   * @example 11
   */
  proxyBuyId: number;
}

export interface UserGetProxyRefundInfoListData {
  code: number;
  data: {
    /** 总天数 */
    totalDays: number;
    /** 剩下天数 */
    remainingDays: number;
    /** 单个代理总额 */
    proxyAmount: number;
    /** 实际金额 */
    actualAmount: number;
    /** 退款时间 */
    refundHours: number;
  };
  msg: string;
}

export interface UserGetProxyAllCountriesListParams {
  /**
   * 0:代理列表 1：代理商店  不传查询全部
   * @example "0"
   */
  queryType?: string;
  /**
   * 代理过期状态 0:已过期 1:使用中 2：快过期
   * @example "1"
   */
  proxyExpireStatus?: string;
  /**
   * 代理是否隐藏，0：隐藏，1：不隐藏
   * @example "1"
   */
  isHideProxy?: string;
}

export interface UserGetProxyAllCountriesListData {
  code: number;
  data: {
    label: string;
    type: string;
    value: string;
  }[];
  msg: string;
}

export interface UserGetTimezoneByIpListParams {
  /**
   * IP地址
   * @example "45.192.242.201"
   */
  ip?: string;
}

export interface UserGetTimezoneByIpListData {
  code: number;
  data: {
    /** 时区 */
    timezone: string;
  };
  msg: string;
}

export interface UserGetPromotionRedeemCodeListListParams {
  /**
   * proxy:代理兑换码
   * @example "proxy"
   */
  queryType?: string;
}

export interface UserGetPromotionRedeemCodeListListData {
  code: number;
  data: {
    code: string;
    country: string;
    days: number;
    count: number;
  };
  msg: string;
}

export type UserRedeemProxyCodeCreatePayload = object;

export interface UserRedeemProxyCodeCreateData {
  code: number;
  msg: string;
}

export type UserSetProxyAutoRenewalCreatePayload = object;

export interface UserSetProxyAutoRenewalCreateData {
  code: number;
  msg: string;
}

export interface UserGetProxyProvidersTypeListData {
  code: number;
  data: string[];
  msg: string;
}

export interface UserRegisterProxyProviderUserCreatePayload {
  /** 代理供应商 */
  proxyProviderId: number;
}

export interface UserRegisterProxyProviderUserCreateData {
  /** code:466（用户已经存在）就直接跳到对应的登录页面就行 */
  code: number;
  data: string;
  msg: string;
}

export interface UserGetProxyStoreListListData {
  code: number;
  data: {
    id?: number;
    proxyProviderWebsite?: string;
    proxyTypeList?: {
      id?: number;
      typeName?: string;
    }[];
    iconList?: string[];
    newIconList?: {
      desc: string;
      url: string;
    }[];
    proxyProviderDiscount?: number;
    description?: string;
    isNew?: boolean;
    proxyPrice?: number;
    proxyProviderIcon?: string;
    proxyProviderName?: string;
    isJump?: number;
    proxyProviderDesc?: string;
    storeType?: number;
  }[];
  msg: string;
}

export interface GetConsumptionGiftIpConfigListData {
  code: number;
  data: {
    price: number;
    staticDays: number;
    ispCount: number;
    country: string;
    dynamicFlow: number;
    dynamicDays: number;
    isValid: boolean;
  };
  msg: string;
}

export interface UserGetProxyCountryPriceListListParams {
  /** @example "2" */
  proxyProviderId?: string;
}

export interface UserGetProxyCountryPriceListListData {
  code: number;
  data: {
    country_code: string;
    country_name: string;
    inventory: number;
    status: string;
    proxyTpye?: string;
    isNew?: boolean;
    proxyPriceList: {
      proxyPrice: number;
      proxyPurchaseMonths: number;
    }[];
  }[];
  msg: string;
}

export interface UserGetProxyListMergedListParams {
  /** @example "available_list" */
  type?: string;
  /** @example "1" */
  page_index?: string;
  /** @example "100" */
  page_size?: string;
  /** @example "lastCountry" */
  orderName?: string;
  /** @example "asc" */
  orderType?: string;
  /** @example "0" */
  proxyType?: string;
  /**
   * 不传 / 空  (全部) ，"1"（已关联），"0" （未关联）
   * @example "1"
   */
  proxyBindStatus?: string;
  /**
   * 不传 / 空  (全部) ，"1"（已开启），"0" （未开启）
   * @example "1"
   */
  proxyAutoRenew?: string;
}

export interface UserGetProxyListMergedListData {
  code: number;
  data: {
    total: number;
    rows: {
      id?: number;
      buyProxyType?: number;
      userId?: number;
      workspaceId?: number;
      canBandwidthUpgrade?: boolean;
      proxyProviderId?: number;
      businessUse?: string;
      orderNo?: string;
      orderStatus?: number;
      ipType?: string;
      host?: string;
      protocol?: string;
      country?: string;
      lastIp?: string;
      port?: string;
      proxyUserName?: string;
      proxyPassword?: string;
      proxyCheckChannel?: string;
      remark?: string;
      lastCountry?: string;
      lastState?: string;
      lastCity?: string;
      checkStatus?: number;
      proxyExpireStatus?: number;
      checkTime?: string;
      renewalTime?: string;
      createTime?: string;
      proxyMonths?: number;
      updateTime?: string;
      expireDate?: string;
      replaceStatus?: number;
      proxyProviderName?: string;
      proxyType?: number;
      providerType?: string;
      opName?: string;
      giftDays?: number;
      autoRenew?: number;
      canRenew?: boolean;
      modelParam?: string;
      refreshUrl?: string;
      isDirect?: boolean;
      badgeTypeDesc?: string;
      dataType?: string;
      checkChannel?: string;
      checkChannelValue?: string;
      isBind?: boolean;
      bindCount?: number;
      /** 是否仍具备长续首享资格 true 有 false 没有 */
      longRenewFirstEligible?: boolean;
      /** 是否已使用过长续首享  true 已使用 flase 未使用 */
      longRenewFirstUsed?: boolean;
      bindList?: number[];
      bindAccountList?: string[];
      canRefund?: boolean;
      bandwidthSpeed?: number;
    }[];
  };
  msg: string;
}

export interface UserGetProxyVendorListListData {
  code: number;
  data: {
    carouselList: string[];
    createTime: string;
    vendorDiscountDesc: string;
    vendorDiscountTitle: string;
    iconList: string[];
    id: number;
    isJump: number;
    isNew: number;
    isOfficial: boolean;
    jumpInfo: {
      apiKey: string;
      isToken: boolean;
      jumpUrl: string;
      password: string;
      thirdUuid: string;
      username: string;
    };
    proxyTypeList: string[];
    sort: number;
    status: number;
    updateTime: string;
    vendorAdv: string[];
    vendorDesc: string;
    vendorDiscount: number | null;
    vendorIcon: string;
    vendorName: string;
    vendorWebsite: string;
  }[];
  msg: string;
}

export interface UserGetProxyBusinessSceneListListParams {
  /** @example "1" */
  vendorId?: string;
  /**
   * 0 普通模式 2电商模式
   * @example "0"
   */
  workspaceType?: string;
}

export interface UserGetProxyBusinessSceneListListData {
  code: number;
  data: {
    id: number;
    sceneKey: string;
    isSpecialOffer: boolean;
    sceneValue: string;
    sceneDesc: string;
    scenePriceDesc: string;
    badgeType: string | null;
    badgeTypeDesc: string | null;
    sceneIcon: string;
    sceneIconDark: string;
    vendorId: number;
    sort: number;
    createTime: string;
    updateTime: string;
  }[];
  msg: string;
}

export interface UserGetProxyProvidersByBusinessSceneListParams {
  /** @example "5" */
  sceneId?: string;
}

export interface UserGetProxyProvidersByBusinessSceneListData {
  code: number;
  data: {
    id?: number;
    proxyProviderName?: string;
    typeName?: string;
    hoverText?: string;
  }[];
  msg: string;
}

export interface UserGetProxyCountryListByContinentListParams {
  /** @example "2" */
  proxyProviderId?: string;
}

export interface UserGetProxyCountryListByContinentListData {
  code: number;
  data: {
    continent: string;
    continent_name: string;
    country_code: string;
    country_name: string;
    inventory: number;
    isHot: boolean;
    isNew: boolean;
    proxyPriceList: {
      proxyPrice: number;
      proxyPurchaseMonths: number;
    }[];
    proxyTpye: string;
    status: string;
  }[];
  msg: string;
}

export interface UserGetProxyVendorJumpInfoListParams {
  /** @example "Rola-IP" */
  vendorName?: string;
}

export interface UserGetProxyVendorJumpInfoListData {
  code: number;
  data: {
    jumpUrl: string;
    isToken: boolean;
    username: string;
    password: string;
    apiKey: string;
    thirdUuid: string;
  };
  msg: string;
}

export interface UserReportProxyOutOfStockCreatePayload {
  sceneId: number;
  proxyProviderId: number;
  country: string;
}

export interface UserReportProxyOutOfStockCreateData {
  code: number;
  msg: string;
}

export type UserBatchMdfProxyModuleCheckCreatePayload = object;

export interface UserBatchMdfProxyModuleCheckCreateData {
  code: number;
  msg: string;
}

export interface UserGetProxyDetailMergedListParams {
  /** @example "397385" */
  id?: string;
}

export interface UserGetProxyDetailMergedListData {
  code: number;
  data: {
    id: number;
    userId: number;
    workspaceId: number;
    proxyProviderId: number;
    orderNo: string;
    orderStatus: number;
    ipType: string;
    host: string;
    protocol: string;
    country: string;
    lastIp: string;
    port: string;
    proxyUserName: string;
    proxyPassword: string;
    proxyCheckChannel: string;
    remark: string;
    lastCountry: string;
    lastState: string;
    lastCity: string;
    checkStatus: number;
    proxyExpireStatus: number;
    checkTime: string;
    renewalTime: null;
    createTime: string;
    proxyMonths: number;
    updateTime: string;
    expireDate: string;
    replaceStatus: number;
    proxyProviderName: string;
    proxyType: number;
    providerType: string;
    opName: string;
    giftDays: number;
    autoRenew: number;
    canRenew: boolean;
    modelParam: string;
    refreshUrl: string;
    isDirect: boolean;
    dataType: string;
    badgeTypeDesc: string;
    checkChannel: string;
    checkChannelValue: string;
    isBind: boolean;
    bindCount: number;
    bindList: number[];
    proxyProviderPrice: number;
    proxyProviderDiscountPrice: number;
    canRefund: boolean;
  };
  msg: string;
}

export interface UserGetProxyCountryListByBusinessSceneListParams {
  /** @example "1" */
  sceneId?: string;
  /**
   *  0 正常购买 1 购买并使用
   * @example "1"
   */
  entryType?: string;
}

export interface UserGetProxyCountryListByBusinessSceneListData {
  code: number;
  data: {
    continent: string;
    continent_name: string;
    country_code: string;
    country_name: string;
    isHot: boolean;
    isNew: boolean;
    proxyTpye: string;
    status: string;
    /** 代理类型列表 */
    proxyTpyeList?: string[];
  }[];
  msg: string;
}

export interface UserGetProxyProvidersByBusinessSceneCountryListParams {
  /** @example "1" */
  sceneId?: string;
  /** @example "hk" */
  countryCode?: string;
  /**
   *  0 正常购买 1 购买并使用
   * @example "1"
   */
  entryType?: string;
  /** @example "0" */
  workspaceType?: string;
}

export interface UserGetProxyProvidersByBusinessSceneCountryListData {
  code: number;
  data: {
    canBandwidthUpgrade: boolean;
    showDefaultSupport100M: boolean;
    hoverText: string;
    id: number;
    inventory: number;
    proxyBandwidthPriceList: {
      bandwidthPrice: number;
      bandwidthSpeed: number;
      bandwidthSpeedDesc: string;
      originalBandwidthPrice: number;
    }[];
    proxyPriceList: {
      originalProxyPrice: number;
      proxyPrice: number;
      proxyPurchaseMonths: number;
    }[];
    proxyProviderName: string;
    proxyType: string;
    typeName: string;
  }[];
  msg: string;
}

export type UserUpgradeProxyBandwidthSettlementCreatePayload = object;

export interface UserUpgradeProxyBandwidthSettlementCreateData {
  code: number;
  data: {
    bandwidthSpeed: number;
    endTime: string;
    orderAmount: number;
    orderNo: string;
    payId: number;
    payType: string;
    payUrl: string;
    realAmount: number;
  };
  msg: string;
}

export interface UserMdfProxyBindWindowCreatePayload {
  proxyId: number;
  windowIds: number[];
}

export interface UserMdfProxyBindWindowCreateData {
  code: number;
  msg: string;
}

export interface UserGetProxyBandwidthUpgradePriceListListParams {
  /** @example "754018" */
  proxyId?: string;
}

export interface UserGetProxyBandwidthUpgradePriceListListData {
  code: number;
  data: {
    currentBandwidthSpeed: number;
    proxyBandwidthPriceList: {
      bandwidthPrice: number;
      bandwidthSpeed: number;
      bandwidthUpgradePrice: number;
    }[];
    remainingDays: number;
  };
  msg: string;
}

export type UserRenewDeviceProxySettlementCreatePayload = object;

export interface UserRenewDeviceProxySettlementCreateData {
  code: number;
  data: {
    endTime: string;
    orderAmount: number;
    orderNo: string;
    payId: number;
    payType: string;
    payUrl: string;
    realAmount: number;
  };
  msg: string;
}

export interface UserGetProxyRenewPriceListListData {
  code: number;
  data: {
    proxyPriceList: {
      originalProxyPrice: number;
      proxyPrice: number;
      proxyPurchaseMonths: number;
    }[];
  };
  msg: string;
}

export interface UserExportProxyDeviceInfoCreatePayload {
  proxyModuleId: number;
}

export interface UserExportProxyDeviceInfoCreateData {
  code: number;
  msg: string;
}

export interface UserGetProxyOperateRecordListCreatePayload {
  proxyModuleId: number;
}

export interface UserGetProxyOperateRecordListCreateData {
  code: number;
  data: {
    rows: {
      id: number;
      operateContent: string;
      operateTime: string;
      operateType: number;
      operatorId: number;
      operatorName: string;
      windowAccountId: string;
      windowName: string;
    }[];
    total: number;
  };
  msg: string;
}

export interface UserCheckProxyBindRiskCreatePayload {
  proxyId: string;
  displayId: string;
  windowId?: number;
}

export interface UserCheckProxyBindRiskCreateData {
  code: number;
  data: {
    bindingRecords: {
      bindStatus?: string;
      bindStatusLabel?: string;
      isCurrentWorkspace?: boolean;
      platform?: string;
      platformUserName?: string;
      windowName?: string;
    }[];
    /** "high" 高风险  "medium" 中风险  "none" 无风险 */
    riskLevel: string;
  };
  msg: string;
}

export interface UserGetProxyDeviceDetailListParams {
  /** @example "754324" */
  id?: string;
}

export interface UserGetProxyDeviceDetailListData {
  code: number;
  data: {
    autoRenew: number;
    badgeTypeDesc: string;
    bandwidthPrice: number;
    bandwidthSpeed: number;
    bindCount: number;
    bindList: number[];
    canBandwidthUpgrade: boolean;
    canRefund: boolean;
    canRenew: boolean;
    checkChannel: string;
    checkChannelValue: string;
    checkStatus: number;
    checkTime: string;
    country: string;
    createTime: string;
    dataType: string;
    expireDate: string;
    giftDays: number;
    host: string;
    id: number;
    ipType: string;
    isBind: boolean;
    isDirect: boolean;
    isEncryptProxy: boolean;
    isPermanent: number;
    isSpecialOffer: number;
    lastCity: string;
    lastCountry: string;
    lastIp: string;
    lastState: string;
    modelParam: string;
    moduleOpName: null;
    opName: null;
    orderNo: string;
    orderStatus: number;
    port: string;
    protocol: string;
    providerType: null;
    proxyCheckChannel: string;
    proxyExpireStatus: number;
    proxyMonths: number;
    proxyPassword: string;
    proxyProviderDiscountPrice: number;
    proxyProviderId: null;
    proxyProviderName: null;
    proxyProviderPrice: number;
    proxyType: number;
    proxyUserName: string;
    refreshUrl: string;
    relatedAccountCount: number;
    relatedPlatformIcons: {
      platformIcon: string;
      platformIconDark: string;
    }[];
    remark: string;
    renewalTime: string;
    replaceStatus: number;
    unitPrice: number;
    updateTime: string;
    userId: number;
    workspaceId: number;
  };
  msg: string;
}

export interface UserBatchCheckProxyImportCreatePayload {
  items: {
    tempId?: string;
    host?: string;
    port?: string;
    proxyUserName?: string;
    proxyPassword?: string;
  }[];
}

export interface UserBatchCheckProxyImportCreateData {
  code: number;
  data: {
    items: {
      hasImportRecord?: boolean;
      tempId?: string;
    }[];
  };
  msg: string;
}

export interface UserGetProxyDeviceBoundAccountsListParams {
  /** @example "754324" */
  id?: string;
}

export interface UserGetProxyDeviceBoundAccountsListData {
  code: number;
  data: {
    rows: {
      accountName: string;
      lastLoginTime: string;
      lastLoginUser: string;
      lastLoginUserId: number;
      platform: string;
      windowId: number;
    }[];
    total: number;
  };
  msg: string;
}

export interface UserAddProxyModuleV2CreatePayload {
  workspaceType?: number;
  proxyList: {
    loading?: boolean;
    checkStatus?: number;
    lastIp?: string;
    lastCity?: string;
    lastCountry?: string;
    timezone?: string;
    checkTime?: string;
    host?: string;
    port?: string;
    proxyUserName?: string;
    proxyPassword?: string;
    proxyRules?: string;
    ipType?: string;
    proxyCategory?: string;
    checkChannel?: string;
    protocol?: string;
  }[];
}

export interface UserAddProxyModuleV2CreateData {
  code: number;
  data: {
    index?: number;
    msg?: string[];
  }[];
  msg: string;
}

export interface UserGetRandomAvailableProxyMergedListData {
  code: number;
  data: {
    id: number;
    userId: number;
    workspaceId: number;
    proxyProviderId: number;
    orderNo: string;
    orderStatus: number;
    ipType: string;
    host: string;
    protocol: string;
    country: string;
    lastIp: string;
    port: string;
    proxyUserName: string;
    proxyPassword: string;
    proxyCheckChannel: string;
    remark: string;
    lastCountry: string;
    lastState: string;
    lastCity: string;
    checkStatus: number;
    proxyExpireStatus: number;
    checkTime: string;
    renewalTime: null;
    createTime: string;
    proxyMonths: number;
    unitPrice: number;
    updateTime: string;
    expireDate: string;
    replaceStatus: number;
    proxyProviderName: string;
    proxyType: number;
    providerType: string;
    opName: string;
    moduleOpName: string;
    giftDays: number;
    autoRenew: number;
    canRenew: boolean;
    modelParam: string;
    refreshUrl: string;
    isSpecialOffer: number;
    bandwidthSpeed: number;
    bandwidthPrice: number;
    isPermanent: number;
    isDirect: boolean;
    isMaintenance: number;
    dataType: string;
    buyProxyType: number;
    badgeTypeDesc: string;
    businessUse: string;
    checkChannel: string;
    checkChannelValue: string;
    isBind: boolean;
    bindCount: number;
    bindList: string[];
    bindAccountList: string[];
    canBandwidthUpgrade: boolean;
    proxyProviderPrice: number;
    proxyProviderDiscountPrice: number;
    canRefund: boolean;
    isEncryptProxy: boolean;
    proxyEncryptInfo: string;
  };
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
      createTime?: string;
      id?: number;
      platformIcon?: string;
      platformIconDark?: string;
      platformUrl?: string;
      sort?: number;
      updateTime?: string;
    }[];
  };
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
  /** 关联邮箱 */
  platformEmail: string;
}

export interface UserAddPlatformInfoCreateData {
  code: number;
  data: object;
  msg: string;
}

export interface UserMdfPlatformInfoCreatePayload {
  requestType: string;
  platformList: {
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
    /** 关联邮箱 */
    platformEmail?: string;
  }[];
}

export interface UserMdfPlatformInfoCreateData {
  code: number;
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

export type UserAddPlatformInfoBatchCreatePayload = {
  platformIcon: string;
  platformIconDark: string;
  platformUrl: string;
  platformUserName: string;
  platformPassword: string;
  platformEfa: string;
  platformRemarks: string;
  /** 关联邮箱 */
  platformEmail: string;
}[];

export interface UserAddPlatformInfoBatchCreateData {
  code: number;
  data: object;
  msg: string;
}

export interface UserGetPlatformUrlTreeListData {
  code: number;
  data: {
    children: {
      children: {
        countryCode: string;
        displayName: string;
        id: number;
        name: string;
        platformIcon: string;
        platformIconDark: string;
        sort: number;
        url: string;
      }[];
      id: number;
      name: string;
      platformIcon: string;
      platformIconDark: string;
      sort: number;
    }[];
    id: number;
    name: string;
    sort: number;
    countryCode?: string;
    displayName?: string;
    platformIcon?: string;
    platformIconDark?: string;
    url?: string;
  }[];
  msg: string;
}

export interface UserUploadChromePluginsV2CreatePayload {
  /** 插件下载地址 */
  url: string;
}

export type UserUploadChromePluginsV2CreateData = object;

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

export interface UserRecordPluginUploadV2ListData {
  code: number;
  data: number;
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
      /** 插件 sha512 哈希值 */
      hashValue: string;
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
   * @example ["15","10"]
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
  /** @example "1" */
  pluginSwitchType?: string;
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
      /** 是否有权限修改 */
      canModify?: boolean;
      /** 是否有权限删除 */
      canDelete?: boolean;
      /** 上传者 */
      uploader?: string;
      /** 最后更新时间 */
      lateUpdateTime?: string;
      /**
       * 插件更新状态，0:没有更新，1:有更新
       * 插件更新状态，0:没有更新，1:有更新
       */
      pluginUpdateState?: number;
      /**
       * 插件最新版本，通过检测得到
       * 显示插件最新版本号
       */
      pluginNewVersion?: string;
    }[];
  };
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

export interface UserDelPluginInfoCreatePayload {
  /** 要删除的插件id */
  id: number;
}

export interface UserDelPluginInfoCreateData {
  code: number;
  msg: string;
}

export interface UserBatchDelPluginInfoCreatePayload {
  /** 插件id列表 */
  ids: number[];
}

export interface UserBatchDelPluginInfoCreateData {
  code: number;
  msg: string;
}

export interface UserCheckAllPluginsVersionListParams {
  /** 插件目录ID */
  pluginDir: string;
  /** 插件id */
  pluginID: number;
}

export interface UserCheckAllPluginsVersionListData {
  code: number;
  data: {
    pluginUpdateStates: {
      /** 插件目录ID */
      pluginDir?: string;
      /** 插件版本号 */
      pluginVersion?: string;
      /** 插件更新状态 */
      pluginUpdateState?: number;
      /** 插件新版本号 */
      pluginNewVersion?: string;
    }[];
  };
  msg: string;
}

export type UserCheckAllPluginsVersionListError = object;

export interface UserUpgradePluginsCreatePayload {
  /** 插件目录ID */
  pluginDir: string;
  /** 插件名称 */
  pluginName: string;
  /** 插件ID */
  pluginID: number;
}

export interface UserUpgradePluginsCreateData {
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

export interface UserReportSystemPluginErrorCreatePayload {
  /** 插件dirID */
  pluginDir: string;
}

export interface UserReportSystemPluginErrorCreateData {
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
      nickname?: string;
      workspaceNickname?: string;
      inviterInfo?: {
        inviterId: number;
        inviterName: string;
        email: string;
        phone: string;
        avatar: string;
      };
      user_id: number;
      userId?: number;
      role: number;
      status: number;
      email: string;
      phone?: string;
      userName: string;
      avatar: string;
      project_info: {
        project_id: number;
        projectName: string;
      }[];
    }[];
  };
  msg: string;
}

export interface UserMdfTeamInfoV2CreatePayload {
  nickname: string;
  email: string;
  /**
   * 用户ID
   * 用户ID
   */
  userId: number;
  /**
   * 权限
   * 权限
   */
  role: number;
  /** 项目ID列表 */
  projectIds: number[];
}

export interface UserMdfTeamInfoV2CreateData {
  code: number;
  msg: string;
}

export interface UserDelTeamInfoCreatePayload {
  email: string;
  /**
   * 用户ID
   * 用户ID
   */
  userId: number;
  /**
   * 权限
   * 权限
   */
  role: number;
  /** 项目ID列表 */
  projectIds: number[];
}

export interface UserDelTeamInfoCreateData {
  code: number;
  msg: string;
}

export interface UserAddTeamNicknameCreatePayload {
  /** 邮箱或者手机号 */
  emailOrPhone: string;
  /** 用户ID */
  targetUserId: number;
  /** 备注名称 */
  nickname: string;
}

export interface UserAddTeamNicknameCreateData {
  code: number;
  msg: string;
}

export interface UserAddTeamWorkspaceNicknameCreatePayload {
  /** 邮箱或者手机号 */
  emailOrPhone: string;
  /** 用户ID */
  targetUserId: number;
  /** 备注名称 */
  workspaceNickname: string;
}

export interface UserAddTeamWorkspaceNicknameCreateData {
  code: number;
  msg: string;
}

export interface UserGetTeamPermissionsListParams {
  /** @example "37340" */
  userId?: string;
  /** @example "111" */
  workspaceId?: string;
}

export interface UserGetTeamPermissionsListData {
  code: number;
  data: {
    rows: {
      moduleName: string;
      permissions: {
        permissionCode: string;
        permissionName: string;
        configurable: boolean;
        hasPermission: boolean;
        isSensitive: boolean;
      }[];
    }[];
  };
  msg: string;
}

export interface UserUpdateTeamPermissionsCreatePayload {
  userId?: number;
  permissions: {
    permissionCode?: string;
    hasPermission?: boolean;
  }[];
  emailCode?: string;
}

export interface UserUpdateTeamPermissionsCreateData {
  code: number;
  msg: string;
}

export interface UserGetRolePermissionsListParams {
  /** @example "2" */
  role?: string;
  /** @example "19312" */
  userId?: string;
}

export interface UserGetRolePermissionsListData {
  code: number;
  data: {
    rows: {
      moduleDes: string;
      moduleName: string;
      permissions: {
        configurable: boolean;
        hasPermission: boolean;
        isSensitive: boolean;
        permissionCode: string;
        permissionName: string;
      }[];
    }[];
  };
  msg: string;
}

export interface UserGetTeamPermissionVerifyStatusListData {
  code: number;
  data: {
    verified: boolean;
  };
  msg: string;
}

export interface UserSendTeamPermissionVerifyCodeListData {
  code: number;
  msg: string;
}

export interface UserSetTeamCostCenterViewerEditorAllowCreatePayload {
  allowViewerEditorCostCenter: number;
}

export interface UserSetTeamCostCenterViewerEditorAllowCreateData {
  code: number;
  msg: string;
}

export interface UserMdfWorkspaceTypeCreatePayload {
  id: number;
  workspaceType: number;
}

export interface UserMdfWorkspaceTypeCreateData {
  code: number;
  msg: string;
}

export interface UserSelectOnboardingWorkspaceTypeCreatePayload {
  /** （0=普通，2=电商专用） */
  workspaceType: number;
}

export interface UserSelectOnboardingWorkspaceTypeCreateData {
  code: number;
  msg: string;
}

export interface UserDelProjectMemberCreatePayload {
  userId: number;
  projectId: number;
}

export interface UserDelProjectMemberCreateData {
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
      id: number;
      email: string;
      userName: string;
      role: string;
      operateType: string;
      operateDetail: string;
      operateTime: string;
      operateModule: string;
      workspaceId: number;
      countryCode: string;
      status: boolean;
      location: string;
      country: string;
      code: string;
      phone: string;
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
      /** ID */
      id?: number;
      /** 创建人ID */
      userId?: number;
      /** 工作空间名称 */
      workspaceName?: string;
      /** 总窗口数量 */
      totalWindowCount?: number;
      /** 总成员数量 */
      totalMemberCount?: number;
      /** 工作空间图片 */
      workspacePicture?: string;
      /** 工作空间图片URL */
      workspacePictureUrl?: string;
      /** 是否默认工作空间，1：是 0：不是，默认不是 */
      workspaceDefault?: number;
      /** 工作空间状态，1：启用 0：停用 */
      workspaceStatus?: number;
      /** 创建时间 */
      createTime?: string;
      /** 修改时间 */
      updateTime?: string;
      /** 权限 */
      role?: number;
      /** 总窗口数量 */
      maxWindowCount?: number;
      /** 窗口使用数量 */
      useWindowCount?: number;
      /** 窗口编号 */
      workspaceNo?: number;
      email?: string;
      /** 0私有 1 公共的 */
      workspaceType?: number;
      /** 团队成员数量 */
      useMemberCount?: number;
      phone?: string;
    }[];
  };
  msg: string;
}

export interface UserAddWorkspaceInfoCreatePayload {
  /** 工作空间名称 */
  workspaceName: string;
  /** 0 普通空间，2电商专用 */
  workspaceType: number;
  workspacePicture?: string;
  /** 工作空间图片 */
  workspacePictureUrl?: string;
}

export interface UserAddWorkspaceInfoCreateData {
  code: number;
  data: {
    workspaceId: number;
  };
  msg: string;
}

export interface UserMdfWorkspaceInfoCreatePayload {
  /** 工作空间ID */
  id: number;
  /** 工作空间名称 */
  workspaceName: string;
  workspacePicture?: string;
  /** 工作空间图片 */
  workspacePictureUrl?: string;
}

export interface UserMdfWorkspaceInfoCreateData {
  code: number;
  msg: string;
}

export interface UserDelWorkspaceInfoCreatePayload {
  /** 工作空间名称 */
  workspaceName: string;
  /**
   * 工作空间ID
   * 工作空间ID
   */
  workspaceId: number;
}

export interface UserDelWorkspaceInfoCreateData {
  code: number;
  data: number;
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

export interface UserGetPublicWorkspaceListListData {
  code: number;
  data: {
    rows: {
      id?: number;
      workspaceName?: string;
      workspaceNo?: string;
      workspaceType?: number;
      workspacePicture?: string;
      /** 工作空间图片URL */
      workspacePictureUrl?: string;
      workspaceDefault?: number;
      workspaceStatus?: number;
      createTime?: string;
      updateTime?: string;
      role?: number;
    }[];
  };
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
  /**
   * 空间ID
   * @example "1"
   */
  workspaceId?: string;
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
      /** 项目ID */
      project_id?: number;
      user_info?: {
        /** role 权限： Viewer(查看者,枚举：0)  Editor(编辑者,枚举：1)  Manager(管理者,枚举：2) Owner(拥有者,枚举：3) */
        role: number;
        /** 用户ID */
        userId: number;
        /** 用户名 */
        userName: string;
        /** 昵称 */
        workspaceNickname: string;
        /** 邮箱 */
        email: string;
        /** 手机号 */
        phone: string;
        pinStatus: number;
      }[];
      /** 项目名称 */
      projectName?: string;
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
  /**
   * 类型
   * @example "show_list"
   */
  type?: string;
}

export interface UserGetMemberInfoByProjectIdListData {
  code: number;
  data: {
    rows: {
      userId: number;
      /**
       * 权限
       * 权限
       */
      role: number;
      /**
       * 用户名字
       * 用户名字
       */
      userName: string;
      /**
       * 用户邮箱
       * 用户邮箱
       */
      email: string;
      /** 手机号 */
      phone: string;
      /**
       * 用户头像
       * 用户头像
       */
      avatar: string;
      avatarColor: string;
    }[];
  };
  msg: string;
}

export interface UserGetTopProjectInfoListData {
  code: number;
  data: {
    rows: {
      /**
       * 项目ID
       * 项目ID
       */
      project_id?: number;
      /**
       * 用户信息
       * 用户信息
       */
      user_info?: string[];
      /**
       * 项目名字
       * 项目名字
       */
      projectName?: string;
      /**
       * 置顶时间
       * 置顶时间
       */
      topTime?: string;
      /**
       * 置顶状态
       * 置顶状态
       */
      pinStatus?: number;
      /** 窗口投送 */
      isTransfer?: number;
    }[];
  };
  msg: string;
}

export interface UserAddProjectInfoCreatePayload {
  /**
   * 项目名称
   * 项目名称
   */
  projectName: string;
  relatedUserIds?: number[];
}

export interface UserAddProjectInfoCreateData {
  code: number;
  data: {
    projectId: number;
  };
  msg: string;
}

export interface UserMdfProjectInfoCreatePayload {
  requestType?: string;
  /**
   * 项目ID
   * 项目ID
   */
  id: number;
  /** 绑定的空间ID */
  workspaceId?: number;
  /**
   * 项目名称
   * 项目名称
   */
  projectName?: string;
  /** pin状态 */
  pinStatus?: number;
}

export interface UserMdfProjectInfoCreateData {
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

export interface UserBatchInviteCreatePayload {
  emailList: string[];
  /** project: 项目  team: 团队 */
  inviteType: string;
  /** 权限 */
  role: number;
  projectIds: number[];
}

export interface UserBatchInviteCreateData {
  code: number;
  msg: string;
}

export type UserAddUserByProjectInfoCreatePayload = string;

export interface UserAddUserByProjectInfoCreateData {
  code: number;
  data: number;
  msg: string;
}

export type UserShowInvitationLinkStatusCreatePayload = object;

export interface UserShowInvitationLinkStatusCreateData {
  code: number;
  /** 已失效 */
  data: string;
  msg: string;
}

export interface CheckAddUserByProjectInfoCreatePayload {
  /** 加密数据 */
  data: string;
}

export interface CheckAddUserByProjectInfoCreateData {
  code: number;
  msg: string;
}

export interface UserMdfProjectSortCreatePayload {
  page_index?: number;
  page_size?: number;
  projectIds: number[];
  projectSortNumList: number[];
}

export interface UserMdfProjectSortCreateData {
  code: number;
  msg: string;
}

export interface UserGetUserPayInfoListData {
  code: number;
  data: {
    apiRate: number;
    /** true 展示续费折扣  false 不展示 */
    showProxyRenewMinDiscount: boolean;
    /** 续费最低优化 */
    proxyRenewMinDiscount: number;
    /** 终身窗口购买数量 */
    purchasePermanentWindowCount: number;
    points: number;
    isDirectWhitelist: boolean;
    autoRecharge: number;
    autoRenewDiscount: number;
    autoRenewDowngrade: boolean;
    balance: number;
    createWindowTimes: number;
    discount: number;
    firstPurchaseDiscount: number;
    freeProjectCount: number;
    freeWindowCount: number;
    identity: string;
    isAuto: number;
    isBlackFriday: boolean;
    isEaster: boolean;
    isFreedom: boolean;
    isTrial: number;
    logDays: number;
    maxMemberCount: number;
    maxWindowCount: number;
    maxWorkspaceCount: number;
    openWindowTimes: number;
    orderNo: string;
    originalAmount: number;
    proxyDiscount: number;
    proxyExpireCount: number;
    proxyUsingCount: number;
    purchaseWindowCount: number;
    realAmount: number;
    shouldShowAutoRenewal: boolean;
    showGiftDlg: boolean;
    showPayWallDlg: boolean;
    showSubExpiredDlg: boolean;
    singlePrice: number;
    staffSinglePrice: number;
    subCurrentDate: number;
    subEndDate: number;
    subLevel: string;
    subscriptionLogDays: number;
    totalCreateWindowTimes: number;
    totalOpenWindowTimes: number;
    trialDays: number;
    useMemberCount: number;
    useProjectCount: number;
    useWindowCount: number;
    useWorkspaceCount: number;
    walletDiscount: number;
    workspaceSinglePrice: number;
    pointsDiscount: number;
    isFirstRecharge: boolean;
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
      /** 是否隐藏金额 true 是 false 不是 */
      showAmount?: boolean;
      /** 订单类型 */
      orderType?: string;
      /** 操作者名字 */
      operatorName?: string;
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
        content: string;
      };
      /** 订单创建时间 */
      createTime?: string;
    }[];
  };
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

export type UserSevenDayTrialCreatePayload = object;

export interface UserSevenDayTrialCreateData {
  code: number;
  msg: string;
}

export interface UserPaySettlementCreatePayload {
  purchaseMember: {
    profile: number;
    workspace: number;
    staff: number;
  };
  /** 购买类型(wallet/workspace/staff/profile) */
  purchaseType: string;
  /** 订阅等级(Basic/Pro/Business/Enterprise) */
  subLevel: string;
  /** 购买月数(1/3/6/12) */
  subscriptionMonths: number;
  /** 购买天(7/30//90/180/360) 新版使用 */
  subscriptionDays: number;
  /** 是否自动购买和续费, */
  isAuto: boolean;
  /** 订单号 */
  orderNo: string;
  /** 支付方式: Balance,Alipay,USDT,Wechat,Card */
  payType: string;
  giftType: string;
  /** 订单类型(续费/订阅/购买/充值/提现/退款/兑换/赠送:renew/subscribe/purchase/recharge/withdraw/refund/exchange/gift) */
  orderType: string;
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

export interface UserRechargeSettlementCreatePayload {
  /** 支付方式: Balance,Alipay,USDT,Wechat,Card,ApplePay,GooglePay */
  payType: string;
  /** 充值金额 */
  rechargeAmount: number;
  /** 支付方式ID */
  paymentMethodId: string;
  /** 银行卡ID */
  cardId: string;
  /** 客户key */
  customerIdKey: string;
  /** 支付方式 为USDT USDC时候传 链类型 （TRX BSC SOLANA POLYGON） */
  chainType: string;
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
    clientSecret: string;
    chainAlias: string;
  };
  msg: string;
}

export interface UserWalletSettlementCreatePayload {
  /**
   * 订单号
   * 订单号
   */
  orderNo: string;
}

export interface UserWalletSettlementCreateData {
  code: number;
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

export interface UserCalculatePriceDifferenceV2ListParams {
  /**
   * 窗口数量
   * @example 100
   */
  purchaseMember: number;
}

export interface UserCalculatePriceDifferenceV2ListData {
  code: number;
  /** 差价金额(美元) */
  data: {
    /** 差价金额(美元) */
    originalAmount: number;
    /** 计算优惠后的实际差价金额 */
    actualAmount: number;
  };
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
   * @example ""
   */
  purchaseMember: number;
}

export interface UserDowngradeSubscriptionListData {
  code: number;
  /** 订阅地址 */
  data: string;
  msg: string;
}

export interface UserDowngradeSubscriptionV2ListParams {
  /**
   * 窗口数量
   * @example ""
   */
  purchaseMember: number;
}

export interface UserDowngradeSubscriptionV2ListData {
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

export interface UserCheckTeamUserRightsListData {
  code: number;
  msg: string;
}

export interface UserGetAutoSubscriptionInfoListParams {
  /**
   * profile：窗口
   * @example "profile"
   */
  queryType?: string;
}

export interface UserGetAutoSubscriptionInfoListData {
  code: number;
  data: {
    orderPrice: number;
    subscriptionMonths: number;
    subscriptionDays: number;
    windowCount: number;
    nextTime: string;
  };
  msg: string;
}

export interface UserBuyProxySettlementCreatePayload {
  entryType?: number;
  /** 购买数量 */
  purchaseMember?: number;
  /** 购买月数(1) */
  subscriptionMonths?: number;
  /** 支付方式: Balance,Alipay,USDT,Wechat,Card */
  payType?: string;
  /** 订单类型(续费//购买:renew/purchase) */
  orderType?: string;
  /** 购买供应商ID */
  proxyProviderId?: number;
  /** 购买的城市 */
  purchaseCountry?: string;
  /** 商业用途 */
  businessUse?: string;
  /** 商业用途 */
  businessId?: number;
  /** 代理ip 带宽 */
  bandwidthSpeed?: number;
  renewIdList?: number[];
}

export interface UserBuyProxySettlementCreateData {
  code: number;
  data: {
    immediate: boolean;
    orderNo: string;
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

export interface UserSetAutoRenewalStatusCreatePayload {
  /** 0：关闭  1：开启 */
  status: number;
}

export interface UserSetAutoRenewalStatusCreateData {
  code: number;
  msg: string;
}

export interface UserGetPendingPaymentListListParams {
  /** @example "1" */
  page_index?: string;
  /** @example "10" */
  page_size?: string;
}

export interface UserGetPendingPaymentListListData {
  code: number;
  data: {
    rows: {
      amount: number;
      subscriptionMonths: number;
      days: number;
      details: string;
      status: number;
      proxyInfo: {
        lastIp: string;
        lastCountry: string;
        proxyType: string;
      };
      startTime: string;
    }[];
    total: number;
  };
  msg: string;
}

export interface UserGetStripePkKeyListParams {
  /**
   * 0 银行卡绑定  1银行卡支付
   * @example "0"
   */
  queryType?: string;
}

export interface UserGetStripePkKeyListData {
  code: number;
  data: {
    stripe_pk_key: string;
    client_secret: string;
    customer_id_key: string;
  };
  msg: string;
}

export interface UserBindCardCreatePayload {
  paymentMethodId: string;
  cardDefault?: boolean;
}

export interface UserBindCardCreateData {
  code: number;
  data: {
    cardId: number;
  };
  msg: string;
}

export interface UserGetBindCardListListParams {
  /** @example "1" */
  page_index?: string;
  /** @example "10" */
  page_size?: string;
}

export interface UserGetBindCardListListData {
  code: number;
  data: {
    rows: {
      brand?: string;
      cardId?: string;
      last4?: string;
      exp_month?: number;
      exp_year?: number;
      funding?: string;
      country?: string;
      cardDefault?: number;
    }[];
    total: number;
  };
  msg: string;
}

export interface UserSetAutoRechargeStatusCreatePayload {
  /** 1开启 0关闭 */
  status: number;
}

export interface UserSetAutoRechargeStatusCreateData {
  code: number;
  msg: string;
}

export interface UserUnbindCardCreatePayload {
  /** 银行卡ID */
  cardId: number;
}

export interface UserUnbindCardCreateData {
  code: number;
  msg: string;
}

export interface UserSetMainCardCreatePayload {
  /** 银行卡ID */
  cardId: number;
}

export interface UserSetMainCardCreateData {
  code: number;
  msg: string;
}

export interface UserGetWindowSubscriptionUpgradeMessageListParams {
  /**
   * 窗口数量
   * @example 0
   */
  windowCount: number;
}

export interface UserGetWindowSubscriptionUpgradeMessageListData {
  code: number;
  data: {
    /** 金额 */
    amount: number;
    /** 下次扣费时间 */
    payTime: string;
    /** 天数 */
    subscriptionDays: number;
  };
  msg: string;
}

export interface UserGetStablecoinInfoListData {
  code: number;
  data: {
    USDT: {
      value: string;
      label: string;
      alias: string;
    }[];
    USDC: {
      value: string;
      label: string;
      alias: string;
    }[];
  };
  msg: string;
}

export interface UserRedeemWindowCodeCreatePayload {
  code: string;
}

export interface UserRedeemWindowCodeCreateData {
  code: number;
  msg: string;
}

export interface UserQueryRedeemCodeListParams {
  /** @example "5X8L-PVJQ-ERCX" */
  code?: string;
}

export interface UserQueryRedeemCodeListData {
  code: number;
  data: {
    activityName: string;
    detail: string;
  };
  msg: string;
}

export interface UserRedeemCodeListListData {
  code: number;
  data: {
    code: string;
    expireDate: string;
    rewardType: string;
    status: number;
  }[];
  msg: string;
}

export interface UserPayCaptchaTriggerListData {
  code: number;
  data: {
    captcha: boolean;
    sceneId: string;
    EncryptedSceneId: string;
  };
  msg: string;
}

export interface UserGetPayChannelFeesListParams {
  /** @example "10" */
  amount?: string;
}

export interface UserGetPayChannelFeesListData {
  code: number;
  data: {
    /** 支付方式标识（Wechat / Alipay / Card / fpx_my ...） */
    payType: string;
    /** 币种分类（CNY / USD / MYR / Crypto ...） */
    category: string;
    /** 比例手续费（百分比）：0=0%，3=3%，3.5=3.5% */
    feeRate: number;
    /** 固定手续费（美元）：如 1.0 表示 +$1 */
    feeFixed: number;
    /** 本次手续费合计（美元）= 充值金额 × feeRate% + feeFixed */
    fee: number;
    /** 用户实付总额（美元）= 充值金额 + fee */
    total: number;
    /** 是否展示：false=下架 / 超限额 / 网关不支持 */
    isShow: boolean;
  }[];
  msg: string;
}

export interface UserGetDurationDiscountsByDaysListData {
  "7": number;
  "30": number;
  "90": number;
  "180": number;
  "360": number;
}

export interface UserPermanentWindowSettlementCreatePayload {
  /** 支付类型 */
  payType: string;
  purchaseCount: number;
}

export interface UserPermanentWindowSettlementCreateData {
  /** 业务状态码：0 表示成功 */
  code: number;
  /** 提示文案 */
  msg: string;
  data: {
    /** 本次订单号（系统生成，可对账） */
    orderNo: string;
    /** 支付方式：钱包余额 */
    payType: string;
    /** 第三方支付单号；钱包即时扣款无第三方，固定为 0 */
    payId: number;
    /** 跳转支付链接；钱包支付无需跳转，为空 */
    payUrl: string;
    /** 应付金额（美元）：1 个终身窗口 × $20 */
    orderAmount: number;
    /** 原价（美元）；终身窗口无折扣，与应付一致 */
    originalAmount: number;
    /** 实付金额（美元）；与 orderAmount 一致 */
    realAmount: number;
    /** 本次购买数量：1 个终身窗口 */
    purchaseCount: number;
    /** 发货后用户永久窗口总数（user_identity_table.windowCount） */
    windowCount: number;
    /** 到期时间；终身窗口无过期，为空 */
    endTime: string;
    /** 是否即时到账：true = 扣款成功已直接加窗口 */
    immediate: boolean;
  };
}

export interface QueryOrderStatusListParams {
  /** @example "178783649528588837" */
  orderNo?: string;
}

export interface QueryOrderStatusListData {
  code: number;
  /** //支付状态 TRADE_SUCCESS: 支付成功,TRADE_CLOSED：交易关闭,WAIT_BUYER_PAY：待支付,TRADE_FAIL：自动扣款失败 */
  data: string;
  msg: string;
}

export interface CheckIpDownloadLimitListData {
  code: number;
  msg: string;
}

export interface AppTrackingEventCreatePayload {
  /** 用户唯一标识 */
  uuid: string;
  /** 用户语言，例如en, zh, ru */
  language?: string;
  /** 落地页 */
  landingPagePath?: string;
  /** 转化页 */
  conversionPagePath?: string;
  /** 渠道来源的完整URL */
  channelSourceUrl?: string;
  /** 操作系统 */
  operatingSystem?: string;
  /** 事件类型 'download_click':下载, 'install_complete'：安装完整, 'app_open'：打开APP, 'registration_complete'：注册完成 */
  eventType: string;
  /** eventType 为registration_complete 传 */
  userId?: number;
}

export interface AppTrackingEventCreateData {
  code: number;
  msg: string;
}

export interface AppTrackingEventDeletePayload {
  uuid: string;
}

export interface AppTrackingEventDeleteData {
  code: number;
  msg: string;
}

export interface GetVersionListListParams {
  /**
   * Windows,macOS
   * @example "Windows"
   */
  os?: string;
  /**
   * 64,32
   * @example "64"
   */
  osBit?: string;
  /** @example "1" */
  page_size?: string;
  /** @example "1" */
  page_index?: string;
}

export interface GetVersionListListData {
  code: number;
  data: {
    total: number;
    rows: {
      id?: number;
      os?: string;
      osVersion?: string;
      osBit?: string;
      cpu?: string;
      versionType?: string;
      coreVersion?: string;
      coreRealVersion?: string;
      version?: string;
      upgradeTitle?: string;
      upgradeDesc?: string;
      upgradeContent?: string;
      upgradeContentEn?: string;
      upgradeContentRu?: string;
      releaseTime?: string;
      downloadUrl?: string;
      forceUpgrade?: boolean;
      ipLimit?: boolean;
      createTime?: string;
      updateTime?: string;
      dataType?: string;
      status?: boolean;
      newFeatureTips?: object;
    }[];
  };
  msg: string;
}

export interface GetFaqHelpList2Data {
  code: number;
  data: {
    rows: {
      title: string;
      detail: string[];
    }[];
    qq_qrcode: string;
    wx_qrcode: string;
    tg_qrcode: string;
  };
  msg: string;
}

export interface GetPromotionLinkDiscountListParams {
  /** @example "0324OOSA" */
  code?: string;
}

export interface GetPromotionLinkDiscountListData {
  code: number;
  data: {
    userDiscount: number;
  };
  msg: string;
}

export interface GetQrcodeInfoListData {
  code: number;
  data: {
    /** 二维地址 */
    qrcodeUrl?: string;
    /** 状态，1:启用，0:停用 */
    status?: number;
    /** 类型,wechat:微信,qq:QQ,tg:Telegram' */
    type?: string;
  }[];
  msg: string;
}

export interface AddSystemTodoListParams {
  /** @example "200" */
  quota?: string;
}

export interface AddSystemTodoListData {
  code: number;
  msg: string;
}

export type UpdateAuthStatisticsCreatePayload = object;

export interface UpdateAuthStatisticsCreateData {
  code: number;
  data: {
    key: string;
    value: number;
  };
  msg: string;
}

export interface UserGetBoundRedeemCodesListData {
  code: number;
  data: {
    code: string;
    codeType: string;
  };
  msg: string;
}

export interface GetEasterEggRemainingListData {
  code: number;
  data: {
    common: {
      remaining: number;
      total: number;
    };
    rare: {
      remaining: number;
      total: number;
    };
    gold: {
      remaining: number;
      total: number;
    };
  };
  msg: string;
}

export interface UserBindRedeemCodeCreatePayload {
  code: string;
}

export interface UserBindRedeemCodeCreateData {
  code: number;
  msg: string;
}

export interface GetCompanyPartnerListListParams {
  /** @example "zh" */
  language: string;
}

export interface GetCompanyPartnerListListData {
  code: number;
  data: {
    id: number;
    name: string;
    summary: string;
    description: string;
    logo: string;
    website: string;
    sortOrder: number;
  }[];
  msg: string;
}

export interface GetCompanyPartnerDetailListParams {
  /** @example "1" */
  id: string;
  /** @example "e" */
  language: string;
}

export interface GetCompanyPartnerDetailListData {
  code: number;
  data: {
    id: number;
    name: string;
    summary: string;
    description: string;
    logo: string;
    website: string;
    sortOrder: number;
    useCase: string;
    supportedRegions: string;
    screenshots: string[];
  };
  msg: string;
}

export interface UserCalculatePointsPriceListParams {
  /** @example "1000" */
  rechargeAmount?: string;
}

export interface UserCalculatePointsPriceListData {
  code: number;
  data: {
    originalAmount: number;
    actualAmount: number;
    points: number;
    /** 梯度折扣 */
    tierDiscount: number;
    /** 用户身份折扣 */
    identityDiscount: number;
    /** 消费总折扣 */
    totalDiscount: number;
  };
  msg: string;
}

export type UserBuyPointsSettlementCreatePayload = object;

export interface UserBuyPointsSettlementCreateData {
  code: number;
  data: {
    orderNo: string;
    payType: string;
    payId: number;
    payUrl: string;
    orderAmount: number;
    endTime: string;
    realAmount: number;
    originalAmount: number;
    points: number;
    immediate: boolean;
  };
  msg: string;
}

export interface UserGetPointsRechargeRecordsListParams {
  /** @example 1 */
  page_index?: number;
  /** @example 10 */
  page_size?: number;
  /** @example "2026-06-02" */
  startDate?: string;
  /** @example "2026-06-02" */
  endDate?: string;
}

export interface UserGetPointsRechargeRecordsListData {
  code: number;
  data: {
    total: number;
    rows: {
      orderNo?: string;
      orderType?: string;
      payTime?: number;
      points?: number;
      amount?: number;
    }[];
  };
  msg: string;
}

export interface GetPointsTierDiscountRulesListData {
  code: number;
  data: {
    rules: {
      threshold: number;
      discount: number;
    }[];
  };
  msg: string;
}

export interface UserGetPointsChargesRecordsListParams {
  /** @example "1" */
  page_index?: string;
  /** @example "10" */
  page_size?: string;
  /** @example "2026-06-02" */
  startDate?: string;
  /** @example "2026-06-17" */
  endDate?: string;
}

export type UserGetPointsChargesRecordsListData = object;

export interface UserGetPointsDailyConsumptionListParams {
  /**
   * 不填默认查询最近七天
   * @example "2026-06-02"
   */
  startDate?: string;
  /** @example "2026-06-17" */
  endDate?: string;
}

export interface UserGetPointsDailyConsumptionListData {
  code: number;
  data: {
    startDate: string;
    endDate: string;
    rows: {
      day: string;
      data: number;
    }[];
  };
  msg: string;
}

export type UserGrantOnboardingGuidePointsCreatePayload = object;

export interface UserGrantOnboardingGuidePointsCreateData {
  code: number;
  data: {
    alreadyGifted: boolean;
    grantedPoints: number;
    workspaceId: number;
    userId: number;
    balance: number;
    orderNo: string;
  };
  msg: string;
}

export type WorkspaceStatusListData = ApiResponse & {
  data?: KycWorkspaceStatusResult;
};

export type KycPersonalSubmitData = ApiResponse & {
  data?: KycSubmitResult;
};

export type KycEnterpriseSubmitData = ApiResponse & {
  data?: KycSubmitResult;
};

export type KycStatusData = ApiResponse & {
  /** KYC 状态聚合结果（personal/enterprise 为当前用户；unlocked 看空间 Owner） */
  data?: KycStatusResult;
};

export interface UserReportRolaJumpClickCreateData {
  code: number;
  data: {
    recorded: boolean;
  };
  msg: string;
}

export type UserGetRatingRewardCreatePayload = object;

export interface UserGetRatingRewardCreateData {
  code: number;
  msg: string;
}

export interface UserGetRoxyClawListData {
  code: number;
  data: {
    userId: number;
    tg_bot_token: string;
    tg_allowed_chat_ids: string;
    lark_app_id: string;
    lark_app_secret: string;
    lark_allowed_chat_ids: string;
    enabled: number;
    lark_environment: string;
    slack_bot_token: string;
    slack_signing_secret: string;
    slack_app_token: string;
    slack_allowed_user_ids: string;
    slack_allowed_channel_ids: string;
    discord_bot_token: string;
    discord_allowed_user_ids: string;
  };
  msg: string;
}

export interface GetCountryConfigListParams {
  /** @example "hk" */
  country?: string;
}

export interface GetCountryConfigListData {
  code: number;
  data: {
    country: string;
    config: {
      outbounds: {
        tag: string;
        protocol: string;
        settings: {
          vnext: {
            address: string;
            port: number;
            users: {
              id: string;
              alterId: number;
              email: string;
              security: string;
            }[];
          }[];
        };
        streamSettings: {
          network: string;
        };
        mux: {
          enabled: boolean;
          concurrency: number;
        };
      }[];
    }[];
  };
  msg: string;
}

export interface ReportAppVersionUpdateCreatePayload {
  /** client_receive：客户端接收成功；install_complete：安装完成 */
  type: string;
  appVersion: string;
}

export interface ReportAppVersionUpdateCreateData {
  code: number;
  msg: string;
}

export interface GetUninstallReasonQuestionListListData {
  code: number;
  data: {
    id: number;
    code: string;
    title: string;
    sortNum: number;
  }[];
  msg: string;
}

export interface GetTgWechatQrcodeListData {
  code: number;
  data: {
    tgQrCode: string;
    wechatQrCode: string;
    tgName: string;
    wechatName: string;
  };
  msg: string;
}

export interface UserGetProxySegmentReplaceListListData {
  code: number;
  data: {
    list: {
      oldHost?: string;
      oldPort?: string;
      newHost?: string;
      newPort?: string;
      oldExpireDate?: string;
      newExpireDate?: string;
    }[];
  };
  msg: string;
}

export interface UserGetProxyDurationDiscountsByDaysListData {
  code: number;
  data: {
    "30": number;
    "90": number;
    "180": number;
    "360": number;
  };
  msg: string;
}
