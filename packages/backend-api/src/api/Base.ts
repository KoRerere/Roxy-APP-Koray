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

import {
  ForgetPasswordListParams,
  LoginCreatePayload,
  PostBasePayload,
  SendEmailForgetVerifyCodeListParams,
  SendEmailRegisterVerifyCodeListParams,
  UserChangeAccountCreatePayload,
  UserChangeEmailCreatePayload,
  UserChangePwdCreatePayload,
  UserGetAppUpgradeCreatePayload,
  UserGetCoreUpgradeCreatePayload,
  UserGetSystemDictV2ListParams,
  UserMdfTeamInfoCreatePayload,
  UserReadNotifyCreatePayload,
  UserSendEmailVerifyCodeListParams,
  UserSetUserApiCreatePayload,
  UserSetUserConfigCreatePayload,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class Base<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags Base
   * @name LoginCreate
   * @summary 登录
   * @request POST:/login
   */
  loginCreate = (data: LoginCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          token: string;
          type: number;
          user_name: string;
          user_id: number;
          role: string;
        };
        msg: string;
      },
      any
    >({
      path: `/login`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name PostBase
   * @summary 注册
   * @request POST:/reg
   */
  postBase = (data: PostBasePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
      path: `/reg`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name SendEmailForgetVerifyCodeList
   * @summary 找回密码->验证码
   * @request GET:/send_email_forget_verify_code
   */
  sendEmailForgetVerifyCodeList = (query: SendEmailForgetVerifyCodeListParams, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
      path: `/send_email_forget_verify_code`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name ForgetPasswordList
   * @summary 找回密码
   * @request GET:/forget_password
   */
  forgetPasswordList = (query: ForgetPasswordListParams, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
      path: `/forget_password`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name SendEmailRegisterVerifyCodeList
   * @summary  注册验证码
   * @request GET:/send_email_register_verify_code
   */
  sendEmailRegisterVerifyCodeList = (query: SendEmailRegisterVerifyCodeListParams, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
      path: `/send_email_register_verify_code`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserChangeAccountCreate
   * @summary 修改姓名
   * @request POST:/user_change_account
   */
  userChangeAccountCreate = (data: UserChangeAccountCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
      path: `/user_change_account`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserChangePwdCreate
   * @summary 修改密码
   * @request POST:/user_change_pwd
   */
  userChangePwdCreate = (data: UserChangePwdCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
      path: `/user_change_pwd`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserSendEmailVerifyCodeList
   * @summary 修改邮箱验证码
   * @request GET:/user_send_email_verify_code
   */
  userSendEmailVerifyCodeList = (query: UserSendEmailVerifyCodeListParams, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
      path: `/user_send_email_verify_code`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserChangeEmailCreate
   * @summary 修改邮箱
   * @request POST:/user_change_email
   */
  userChangeEmailCreate = (data: UserChangeEmailCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
      path: `/user_change_email`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetUserInfoList
   * @summary 用户基本信息
   * @request GET:/user_get_user_info
   */
  userGetUserInfoList = (params: RequestParams = {}) =>
    this.http.request<
      {
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
      },
      any
    >({
      path: `/user_get_user_info`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetAppUpgradeCreate
   * @summary app升版
   * @request POST:/user_get_app_upgrade
   */
  userGetAppUpgradeCreate = (data: UserGetAppUpgradeCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        downloadUrl: string;
        version: string;
        upgradeTitle: string;
        upgradeDesc: string;
        releaseTime: string;
        webDomain: string;
      },
      any
    >({
      path: `/user_get_app_upgrade`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetCoreUpgradeCreate
   * @summary core升版
   * @request POST:/user_get_core_upgrade
   */
  userGetCoreUpgradeCreate = (data: UserGetCoreUpgradeCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          rows: {
            coreVersion: string;
            version: string;
            downloadUrl: string;
          }[];
        };
        msg: string;
      },
      any
    >({
      path: `/user_get_core_upgrade`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetUserConfigList
   * @summary 获取软件设置
   * @request GET:/user_get_user_config
   */
  userGetUserConfigList = (params: RequestParams = {}) =>
    this.http.request<
      {
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
      },
      any
    >({
      path: `/user_get_user_config`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetDefConfigList
   * @summary 系统默认配置
   * @request GET:/user_get_def_config
   */
  userGetDefConfigList = (params: RequestParams = {}) =>
    this.http.request<
      {
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
      },
      any
    >({
      path: `/user_get_def_config`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserSetUserConfigCreate
   * @summary 保存软件设置
   * @request POST:/user_set_user_config
   */
  userSetUserConfigCreate = (data: UserSetUserConfigCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
      path: `/user_set_user_config`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetUserApiList
   * @summary 获取用户api
   * @request GET:/user_get_user_api
   */
  userGetUserApiList = (params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          apiKey: string;
          port: string;
          open: boolean;
        };
        msg: string;
      },
      any
    >({
      path: `/user_get_user_api`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserSetUserApiCreate
   * @summary 保存用户api
   * @request POST:/user_set_user_api
   */
  userSetUserApiCreate = (data: UserSetUserApiCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
      path: `/user_set_user_api`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetDictVersionList
   * @summary 获取字典版本
   * @request GET:/user_get_dict_version
   */
  userGetDictVersionList = (params: RequestParams = {}) =>
    this.http.request<
      {
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
      },
      any
    >({
      path: `/user_get_dict_version`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * @description oss: oss的配置信息,同步的时候会用到 os: 操作系统 proxyMethod: 代理方式 proxyType：代理类型 proxyNetwork：代理网络 billMethod：计费方式 ipType：网络协议 protocol：代理协议 country: 国家 proxyProvider：代理服务商 proxyTime：IP时长 checkChannel：查询渠道 language：语言 displayLanguage：界面语言 timeZone：时区 resolution：分辨率 disableSslList：ssl特性值 hardwareConcurrent：硬件并发数 deviceMemory：设备内存 windowType: 窗口类型 source: 代理来源 accessServer: 接入点 osVersion-Windows: 操作系统版本 osVersion-macOS: 操作系统版本 osVersion-Linux: 操作系统版本 osVersion-Android: 操作系统版本 osVersion-IOS: 操作系统版本 versionType: 版本类型 rotateCountry: 动态机房选择国家 addType: 添加类型：新增IP，已添加IP frequency: 执行频率 exeType: 任务执行 proxyCategory：代理类型 isExtraNewIp: 提取方式 isRepectCheck: 校验重复
   *
   * @tags Base
   * @name UserGetSystemDictV2List
   * @summary 获取字典内容V2
   * @request GET:/user_get_system_dict_v2
   */
  userGetSystemDictV2List = (query: UserGetSystemDictV2ListParams, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          type: string;
          label: string;
          value: string;
        }[];
        msg: string;
      },
      any
    >({
      path: `/user_get_system_dict_v2`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserMdfTeamInfoCreate
   * @summary 修改团队
   * @request POST:/user_mdf_team_info
   */
  userMdfTeamInfoCreate = (data: UserMdfTeamInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
      path: `/user_mdf_team_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetAnntListList
   * @summary 用户获取公告【返回最近的5条】
   * @request GET:/user_get_annt_list
   */
  userGetAnntListList = (params: RequestParams = {}) =>
    this.http.request<
      {
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
      },
      any
    >({
      path: `/user_get_annt_list`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetNotifyList
   * @summary 获取通知【最近的10条】
   * @request GET:/user_get_notify
   */
  userGetNotifyList = (params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          id: number;
          type: string;
          notify: string;
          status: number;
          createTime: string;
        }[];
        msg: string;
      },
      any
    >({
      path: `/user_get_notify`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserReadNotifyCreate
   * @summary 通知已读
   * @request POST:/user_read_notify
   */
  userReadNotifyCreate = (data: UserReadNotifyCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
      path: `/user_read_notify`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetOssCredentialList
   * @summary oss窗口数据同步上传和下载权限获取
   * @request GET:/user_get_oss_credential
   */
  userGetOssCredentialList = (params: RequestParams = {}) =>
    this.http.request<
      {
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
      },
      any
    >({
      path: `/user_get_oss_credential`,
      method: "GET",
      format: "json",
      ...params,
    });
}
