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
  CheckOtherDeviceLoginListData,
  CheckOtherDeviceLoginListParams,
  ForgetPasswordCreateData,
  ForgetPasswordCreatePayload,
  GetAppUpgradeCreateData,
  GetAppUpgradeCreatePayload,
  GetCheckBindEmailVerCodeListData,
  GetCheckBindEmailVerCodeListParams,
  GetCoreUpgradeCreateData,
  GetCoreUpgradeCreatePayload,
  LoginCreateData,
  LoginCreatePayload,
  LoginGithubCreateData,
  LoginGithubCreatePayload,
  LoginGoogleV2CreateData,
  LoginGoogleV2CreatePayload,
  PostBaseData,
  PostBasePayload,
  SaveChannelSourcesPeopleListData,
  SaveChannelSourcesPeopleListParams,
  SavePromotionLinkClickCountListData,
  SavePromotionLinkClickCountListParams,
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
  UserChangeUsernameCreateData,
  UserChangeUsernameCreatePayload,
  UserGetAnntListListData,
  UserGetAppUpgradeCreateData,
  UserGetAppUpgradeCreatePayload,
  UserGetBannerPictureListListData,
  UserGetBannerPictureListListParams,
  UserGetBannerPictureListV2ListData,
  UserGetBannerPictureListV2ListParams,
  UserGetCheckOldEmailVerCodeListData,
  UserGetCheckOldEmailVerCodeListParams,
  UserGetCoreUpgradeCreateData,
  UserGetCoreUpgradeCreatePayload,
  UserGetDefConfigListData,
  UserGetDictVersionListData,
  UserGetInviteCodeListData,
  UserGetInviteLinkListData,
  UserGetInviteUserListV2ListData,
  UserGetInviteUserListV2ListParams,
  UserGetLoginInfoListData,
  UserGetNotifyListData,
  UserGetOssCredentialV2ListData,
  UserGetPromotionInfoListData,
  UserGetRewardRecordListListData,
  UserGetRewardRecordListListParams,
  UserGetSystemDictV2CreateData,
  UserGetSystemDictV2CreatePayload,
  UserGetUserApiListData,
  UserGetUserConfigListData,
  UserGetUserInfoListData,
  UserGetWithdrawRecordListListData,
  UserGetWithdrawRecordListListParams,
  UserMigrateDataListData,
  UserReadNotifyCreateData,
  UserReadNotifyCreatePayload,
  UserSendEmailVerifyCodeListData,
  UserSendEmailVerifyCodeListParams,
  UserSettingPasswordCreateData,
  UserSettingPasswordCreatePayload,
  UserSettingPasswordVerifyCodeListData,
  UserSettingPasswordVerifyCodeListParams,
  UserSetUserApiCreateData,
  UserSetUserApiCreatePayload,
  UserSetUserConfigCreateData,
  UserSetUserConfigCreatePayload,
  UserUploadAvatarCreateData,
  UserUploadAvatarCreatePayload,
  UserVerifyEmailCreateData,
  UserVerifyEmailCreatePayload,
  UserWithdrawCreateData,
  UserWithdrawCreatePayload,
  UserWithdrawVerifyCodeListData,
  UserWriteInviteCodeCreateData,
  UserWriteInviteCodeCreatePayload,
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
   * @response `200` `LoginCreateData`
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
   * @response `200` `PostBaseData`
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
   * @summary 找回密码发送验证码
   * @request GET:/send_email_forget_verify_code
   * @response `200` `SendEmailForgetVerifyCodeListData`
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
   * @name ForgetPasswordCreate
   * @summary 找回密码
   * @request POST:/forget_password
   * @response `200` `ForgetPasswordCreateData`
   */
  forgetPasswordCreate = (data: ForgetPasswordCreatePayload, params: RequestParams = {}) =>
    this.http.request<ForgetPasswordCreateData, any>({
      path: `/forget_password`,
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
   * @name SendEmailRegisterVerifyCodeList
   * @summary  注册验证码
   * @request GET:/send_email_register_verify_code
   * @response `200` `SendEmailRegisterVerifyCodeListData`
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
   * @summary 修改真实姓名(老的版本用)
   * @request POST:/user_change_account
   * @response `200` `UserChangeAccountCreateData`
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
   * @response `200` `UserChangePwdCreateData`
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
   * @response `200` `UserSendEmailVerifyCodeListData`
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
   * @response `200` `UserChangeEmailCreateData`
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
   * @response `200` `UserGetUserInfoListData`
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
   * @summary app升版-->获取版本信息--有权限认证
   * @request POST:/user_get_app_upgrade
   * @response `200` `UserGetAppUpgradeCreateData`
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
   * @summary core升级->获取版本信息--有权限认证
   * @request POST:/user_get_core_upgrade
   * @response `200` `UserGetCoreUpgradeCreateData`
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
   * @response `200` `UserGetUserConfigListData`
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
   * @response `200` `UserGetDefConfigListData`
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
   * @response `200` `UserSetUserConfigCreateData`
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
   * @response `200` `UserGetUserApiListData`
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
   * @response `200` `UserSetUserApiCreateData`
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
   * @response `200` `UserGetDictVersionListData`
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
   * @response `200` `UserGetSystemDictV2CreateData`
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
   * @name UserGetAnntListList
   * @summary 用户获取公告
   * @request GET:/user_get_annt_list
   * @response `200` `UserGetAnntListListData`
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
   * @response `200` `UserGetNotifyListData`
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
   * @response `200` `UserReadNotifyCreateData`
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
   * @name LoginGoogleV2Create
   * @summary 谷歌登录
   * @request POST:/login_google_v2
   * @response `200` `LoginGoogleV2CreateData`
   */
  loginGoogleV2Create = (data: LoginGoogleV2CreatePayload, params: RequestParams = {}) =>
    this.http.request<LoginGoogleV2CreateData, any>({
      path: `/login_google_v2`,
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
   * @name UserGetOssCredentialV2List
   * @summary oss窗口数据同步上传和下载权限获取
   * @request GET:/user_get_oss_credential_v2
   * @response `200` `UserGetOssCredentialV2ListData`
   */
  userGetOssCredentialV2List = (params: RequestParams = {}) =>
    this.http.request<UserGetOssCredentialV2ListData, any>({
      path: `/user_get_oss_credential_v2`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserUploadAvatarCreate
   * @summary 用户上传头像
   * @request POST:/user_upload_avatar
   * @response `200` `UserUploadAvatarCreateData`
   */
  userUploadAvatarCreate = (data: UserUploadAvatarCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserUploadAvatarCreateData, any>({
      path: `/user_upload_avatar`,
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
   * @name UserChangeUsernameCreate
   * @summary 修改用户名
   * @request POST:/user_change_username
   * @response `200` `UserChangeUsernameCreateData`
   */
  userChangeUsernameCreate = (data: UserChangeUsernameCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserChangeUsernameCreateData, any>({
      path: `/user_change_username`,
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
   * @name GetCheckBindEmailVerCodeList
   * @summary 比对验证码
   * @request GET:/get_check_bind_email_ver_code
   * @response `200` `GetCheckBindEmailVerCodeListData`
   */
  getCheckBindEmailVerCodeList = (query: GetCheckBindEmailVerCodeListParams, params: RequestParams = {}) =>
    this.http.request<GetCheckBindEmailVerCodeListData, any>({
      path: `/get_check_bind_email_ver_code`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserMigrateDataList
   * @summary 用户迁移数据
   * @request GET:/user_migrate_data
   * @response `200` `UserMigrateDataListData`
   */
  userMigrateDataList = (params: RequestParams = {}) =>
    this.http.request<UserMigrateDataListData, any>({
      path: `/user_migrate_data`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name GetAppUpgradeCreate
   * @summary app升级->获取版本信息--无权限认证
   * @request POST:/get_app_upgrade
   * @response `200` `GetAppUpgradeCreateData`
   */
  getAppUpgradeCreate = (data: GetAppUpgradeCreatePayload, params: RequestParams = {}) =>
    this.http.request<GetAppUpgradeCreateData, any>({
      path: `/get_app_upgrade`,
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
   * @name SaveChannelSourcesPeopleList
   * @summary 存储渠道来源人数
   * @request GET:/save_channel_sources_people
   * @response `200` `SaveChannelSourcesPeopleListData`
   */
  saveChannelSourcesPeopleList = (query: SaveChannelSourcesPeopleListParams, params: RequestParams = {}) =>
    this.http.request<SaveChannelSourcesPeopleListData, any>({
      path: `/save_channel_sources_people`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetInviteUserListV2List
   * @summary 获取邀请的用户列表
   * @request GET:/user_get_invite_user_list_v2
   * @response `200` `UserGetInviteUserListV2ListData`
   */
  userGetInviteUserListV2List = (query: UserGetInviteUserListV2ListParams, params: RequestParams = {}) =>
    this.http.request<UserGetInviteUserListV2ListData, any>({
      path: `/user_get_invite_user_list_v2`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetInviteCodeList
   * @summary 生成邀请码(老用户才有)
   * @request GET:/user_get_invite_code
   * @response `200` `UserGetInviteCodeListData`
   */
  userGetInviteCodeList = (params: RequestParams = {}) =>
    this.http.request<UserGetInviteCodeListData, any>({
      path: `/user_get_invite_code`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetInviteLinkList
   * @summary 生成邀请链接
   * @request GET:/user_get_invite_link
   * @response `200` `UserGetInviteLinkListData`
   */
  userGetInviteLinkList = (params: RequestParams = {}) =>
    this.http.request<UserGetInviteLinkListData, any>({
      path: `/user_get_invite_link`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserWriteInviteCodeCreate
   * @summary 填写邀请码
   * @request POST:/user_write_invite_code
   * @response `200` `UserWriteInviteCodeCreateData`
   */
  userWriteInviteCodeCreate = (data: UserWriteInviteCodeCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserWriteInviteCodeCreateData, any>({
      path: `/user_write_invite_code`,
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
   * @name UserGetBannerPictureListList
   * @summary 获取banner图片数据
   * @request GET:/user_get_banner_picture_list
   * @response `200` `UserGetBannerPictureListListData`
   */
  userGetBannerPictureListList = (query: UserGetBannerPictureListListParams, params: RequestParams = {}) =>
    this.http.request<UserGetBannerPictureListListData, any>({
      path: `/user_get_banner_picture_list`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name GetCoreUpgradeCreate
   * @summary core升级->获取版本信息--无权限认证
   * @request POST:/get_core_upgrade
   * @response `200` `GetCoreUpgradeCreateData`
   */
  getCoreUpgradeCreate = (data: GetCoreUpgradeCreatePayload, params: RequestParams = {}) =>
    this.http.request<GetCoreUpgradeCreateData, any>({
      path: `/get_core_upgrade`,
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
   * @name UserSettingPasswordCreate
   * @summary 设置密码
   * @request POST:/user_setting_password
   * @response `200` `UserSettingPasswordCreateData`
   */
  userSettingPasswordCreate = (data: UserSettingPasswordCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserSettingPasswordCreateData, any>({
      path: `/user_setting_password`,
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
   * @name UserSettingPasswordVerifyCodeList
   * @summary 设置密码的验证码
   * @request GET:/user_setting_password_verify_code
   * @response `200` `UserSettingPasswordVerifyCodeListData`
   */
  userSettingPasswordVerifyCodeList = (query: UserSettingPasswordVerifyCodeListParams, params: RequestParams = {}) =>
    this.http.request<UserSettingPasswordVerifyCodeListData, any>({
      path: `/user_setting_password_verify_code`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name LoginGithubCreate
   * @summary Github登录
   * @request POST:/login_github
   * @response `200` `LoginGithubCreateData`
   */
  loginGithubCreate = (data: LoginGithubCreatePayload, params: RequestParams = {}) =>
    this.http.request<LoginGithubCreateData, any>({
      path: `/login_github`,
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
   * @name UserGetLoginInfoList
   * @summary 获取用户登录信息
   * @request GET:/user_get_login_info
   * @response `200` `UserGetLoginInfoListData`
   */
  userGetLoginInfoList = (params: RequestParams = {}) =>
    this.http.request<UserGetLoginInfoListData, any>({
      path: `/user_get_login_info`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name CheckOtherDeviceLoginList
   * @summary 判断是否有在其他设备已经登录
   * @request GET:/check_other_device_login
   * @response `200` `CheckOtherDeviceLoginListData`
   */
  checkOtherDeviceLoginList = (query: CheckOtherDeviceLoginListParams, params: RequestParams = {}) =>
    this.http.request<CheckOtherDeviceLoginListData, any>({
      path: `/check_other_device_login`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetPromotionInfoList
   * @summary 获取用户推广信息
   * @request GET:/user_get_promotion_info
   * @response `200` `UserGetPromotionInfoListData`
   */
  userGetPromotionInfoList = (params: RequestParams = {}) =>
    this.http.request<UserGetPromotionInfoListData, any>({
      path: `/user_get_promotion_info`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetRewardRecordListList
   * @summary 用户奖励记录列表
   * @request GET:/user_get_reward_record_list
   * @response `200` `UserGetRewardRecordListListData`
   */
  userGetRewardRecordListList = (query: UserGetRewardRecordListListParams, params: RequestParams = {}) =>
    this.http.request<UserGetRewardRecordListListData, any>({
      path: `/user_get_reward_record_list`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetWithdrawRecordListList
   * @summary 用户提款记录列表
   * @request GET:/user_get_withdraw_record_list
   * @response `200` `UserGetWithdrawRecordListListData`
   */
  userGetWithdrawRecordListList = (query: UserGetWithdrawRecordListListParams, params: RequestParams = {}) =>
    this.http.request<UserGetWithdrawRecordListListData, any>({
      path: `/user_get_withdraw_record_list`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserWithdrawCreate
   * @summary 用户提现
   * @request POST:/user_withdraw
   * @response `200` `UserWithdrawCreateData`
   */
  userWithdrawCreate = (data: UserWithdrawCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserWithdrawCreateData, any>({
      path: `/user_withdraw`,
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
   * @name SavePromotionLinkClickCountList
   * @summary 存储渠道推广链接点击次数
   * @request GET:/save_promotion_link_click_count
   * @response `200` `SavePromotionLinkClickCountListData`
   */
  savePromotionLinkClickCountList = (query: SavePromotionLinkClickCountListParams, params: RequestParams = {}) =>
    this.http.request<SavePromotionLinkClickCountListData, any>({
      path: `/save_promotion_link_click_count`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserWithdrawVerifyCodeList
   * @summary 发送提现的验证码
   * @request GET:/user_withdraw_verify_code
   * @response `200` `UserWithdrawVerifyCodeListData`
   */
  userWithdrawVerifyCodeList = (params: RequestParams = {}) =>
    this.http.request<UserWithdrawVerifyCodeListData, any>({
      path: `/user_withdraw_verify_code`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserVerifyEmailCreate
   * @summary 邮箱换绑验证码发送
   * @request POST:/user_verify_email
   * @response `200` `UserVerifyEmailCreateData`
   */
  userVerifyEmailCreate = (data: UserVerifyEmailCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserVerifyEmailCreateData, any>({
      path: `/user_verify_email`,
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
   * @name UserGetCheckOldEmailVerCodeList
   * @summary 比对旧邮箱验证码或者密码
   * @request GET:/user_get_check_old_email_ver_code
   * @response `200` `UserGetCheckOldEmailVerCodeListData`
   */
  userGetCheckOldEmailVerCodeList = (query: UserGetCheckOldEmailVerCodeListParams, params: RequestParams = {}) =>
    this.http.request<UserGetCheckOldEmailVerCodeListData, any>({
      path: `/user_get_check_old_email_ver_code`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetBannerPictureListV2List
   * @summary 获取banner图片数据-收费版本
   * @request GET:/user_get_banner_picture_list_v2
   * @response `200` `UserGetBannerPictureListV2ListData`
   */
  userGetBannerPictureListV2List = (query: UserGetBannerPictureListV2ListParams, params: RequestParams = {}) =>
    this.http.request<UserGetBannerPictureListV2ListData, any>({
      path: `/user_get_banner_picture_list_v2`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
}
