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
  ForgetPasswordListData,
  ForgetPasswordListParams,
  LoginCreateData,
  LoginCreatePayload,
  LoginGoogleCreateData,
  LoginGoogleCreatePayload,
  PostBaseData,
  PostBasePayload,
  SendEmailForgetVerifyCodeListData,
  SendEmailForgetVerifyCodeListParams,
  SendEmailRegisterVerifyCodeListData,
  SendEmailRegisterVerifyCodeListParams,
  UserChangeAccountCreateData,
  UserChangeAccountCreatePayload,
  UserChangeEmailCreateData,
  UserChangeEmailCreatePayload,
  UserChangePwdCreateData,
  UserChangePwdCreatePayload,
  UserGetAnntListListData,
  UserGetAppUpgradeCreateData,
  UserGetAppUpgradeCreatePayload,
  UserGetCoreUpgradeCreateData,
  UserGetCoreUpgradeCreatePayload,
  UserGetDefConfigListData,
  UserGetDictVersionListData,
  UserGetNotifyListData,
  UserGetOssCredentialListData,
  UserGetSystemDictV2CreateData,
  UserGetSystemDictV2CreatePayload,
  UserGetUserApiListData,
  UserGetUserConfigListData,
  UserGetUserInfoListData,
  UserMdfTeamInfoCreateData,
  UserMdfTeamInfoCreatePayload,
  UserReadNotifyCreateData,
  UserReadNotifyCreatePayload,
  UserSendEmailVerifyCodeListData,
  UserSendEmailVerifyCodeListParams,
  UserSetUserApiCreateData,
  UserSetUserApiCreatePayload,
  UserSetUserConfigCreateData,
  UserSetUserConfigCreatePayload,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class BaseApi<SecurityDataType = unknown> {
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
   * @response `200` `LoginCreateData` 成功
   */
  loginCreate = (data: LoginCreatePayload, params: RequestParams = {}) =>
    this.http.request<LoginCreateData, any>({
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
   * @response `200` `PostBaseData` 成功
   */
  postBase = (data: PostBasePayload, params: RequestParams = {}) =>
    this.http.request<PostBaseData, any>({
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
   * @response `200` `SendEmailForgetVerifyCodeListData` 成功
   */
  sendEmailForgetVerifyCodeList = (query: SendEmailForgetVerifyCodeListParams, params: RequestParams = {}) =>
    this.http.request<SendEmailForgetVerifyCodeListData, any>({
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
   * @response `200` `ForgetPasswordListData` 成功
   */
  forgetPasswordList = (query: ForgetPasswordListParams, params: RequestParams = {}) =>
    this.http.request<ForgetPasswordListData, any>({
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
   * @response `200` `SendEmailRegisterVerifyCodeListData` 成功
   */
  sendEmailRegisterVerifyCodeList = (query: SendEmailRegisterVerifyCodeListParams, params: RequestParams = {}) =>
    this.http.request<SendEmailRegisterVerifyCodeListData, any>({
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
   * @response `200` `UserChangeAccountCreateData` 成功
   */
  userChangeAccountCreate = (data: UserChangeAccountCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserChangeAccountCreateData, any>({
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
   * @response `200` `UserChangePwdCreateData` 成功
   */
  userChangePwdCreate = (data: UserChangePwdCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserChangePwdCreateData, any>({
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
   * @response `200` `UserSendEmailVerifyCodeListData` 成功
   */
  userSendEmailVerifyCodeList = (query: UserSendEmailVerifyCodeListParams, params: RequestParams = {}) =>
    this.http.request<UserSendEmailVerifyCodeListData, any>({
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
   * @response `200` `UserChangeEmailCreateData` 成功
   */
  userChangeEmailCreate = (data: UserChangeEmailCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserChangeEmailCreateData, any>({
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
   * @response `200` `UserGetUserInfoListData` 成功
   */
  userGetUserInfoList = (params: RequestParams = {}) =>
    this.http.request<UserGetUserInfoListData, any>({
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
   * @response `200` `UserGetAppUpgradeCreateData` 成功
   */
  userGetAppUpgradeCreate = (data: UserGetAppUpgradeCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserGetAppUpgradeCreateData, any>({
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
   * @response `200` `UserGetCoreUpgradeCreateData` 成功
   */
  userGetCoreUpgradeCreate = (data: UserGetCoreUpgradeCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserGetCoreUpgradeCreateData, any>({
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
   * @response `200` `UserGetUserConfigListData` 成功
   */
  userGetUserConfigList = (params: RequestParams = {}) =>
    this.http.request<UserGetUserConfigListData, any>({
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
   * @response `200` `UserGetDefConfigListData` 成功
   */
  userGetDefConfigList = (params: RequestParams = {}) =>
    this.http.request<UserGetDefConfigListData, any>({
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
   * @response `200` `UserSetUserConfigCreateData` 成功
   */
  userSetUserConfigCreate = (data: UserSetUserConfigCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserSetUserConfigCreateData, any>({
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
   * @response `200` `UserGetUserApiListData` 成功
   */
  userGetUserApiList = (params: RequestParams = {}) =>
    this.http.request<UserGetUserApiListData, any>({
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
   * @response `200` `UserSetUserApiCreateData` 成功
   */
  userSetUserApiCreate = (data: UserSetUserApiCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserSetUserApiCreateData, any>({
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
   * @response `200` `UserGetDictVersionListData` 成功
   */
  userGetDictVersionList = (params: RequestParams = {}) =>
    this.http.request<UserGetDictVersionListData, any>({
      path: `/user_get_dict_version`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * @description oss: oss的配置信息,同步的时候会用到 os: 操作系统 proxyMethod: 代理方式 proxyType：代理类型 proxyNetwork：代理网络 billMethod：计费方式 ipType：网络协议 protocol：代理协议 country: 国家 proxyProvider：代理服务商 proxyTime：IP时长 checkChannel：查询渠道 language：语言 displayLanguage：界面语言 timeZone：时区 resolution：分辨率 disableSslList：ssl特性值 hardwareConcurrent：硬件并发数 deviceMemory：设备内存 windowType: 窗口类型 source: 代理来源 accessServer: 接入点 osVersion-Windows: 操作系统版本 osVersion-macOS: 操作系统版本 osVersion-Linux: 操作系统版本 osVersion-Android: 操作系统版本 osVersion-IOS: 操作系统版本 versionType: 版本类型 rotateCountry: 动态机房选择国家 addType: 添加类型：新增IP，已添加IP frequency: 执行频率 exeType: 任务执行 proxyCategory：代理类型 isExtraNewIp: 提取方式 isRepectCheck: 校验重复
   *
   * @tags Base
   * @name UserGetSystemDictV2Create
   * @summary 获取字典内容V2
   * @request POST:/user_get_system_dict_v2
   * @response `200` `UserGetSystemDictV2CreateData` 成功
   */
  userGetSystemDictV2Create = (data: UserGetSystemDictV2CreatePayload, params: RequestParams = {}) =>
    this.http.request<UserGetSystemDictV2CreateData, any>({
      path: `/user_get_system_dict_v2`,
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
   * @name UserMdfTeamInfoCreate
   * @summary 修改团队
   * @request POST:/user_mdf_team_info
   * @response `200` `UserMdfTeamInfoCreateData` 成功
   */
  userMdfTeamInfoCreate = (data: UserMdfTeamInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserMdfTeamInfoCreateData, any>({
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
   * @response `200` `UserGetAnntListListData` 成功
   */
  userGetAnntListList = (params: RequestParams = {}) =>
    this.http.request<UserGetAnntListListData, any>({
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
   * @response `200` `UserGetNotifyListData` 成功
   */
  userGetNotifyList = (params: RequestParams = {}) =>
    this.http.request<UserGetNotifyListData, any>({
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
   * @response `200` `UserReadNotifyCreateData` 成功
   */
  userReadNotifyCreate = (data: UserReadNotifyCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserReadNotifyCreateData, any>({
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
   * @response `200` `UserGetOssCredentialListData` 成功
   */
  userGetOssCredentialList = (params: RequestParams = {}) =>
    this.http.request<UserGetOssCredentialListData, any>({
      path: `/user_get_oss_credential`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name LoginGoogleCreate
   * @summary 谷歌登录
   * @request POST:/login_google
   * @response `200` `LoginGoogleCreateData` 成功
   */
  loginGoogleCreate = (data: LoginGoogleCreatePayload, params: RequestParams = {}) =>
    this.http.request<LoginGoogleCreateData, any>({
      path: `/login_google`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
}
