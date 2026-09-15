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

import {
  AppUpdateDetailData,
  AppUpdateDetailError,
  AppUpdateDetailParams,
  CheckEmailOr2FaVerifyListData,
  CheckEmailOr2FaVerifyListParams,
  CheckEmailPasswordCreateData,
  CheckEmailPasswordCreatePayload,
  CheckEmailRegisteredListData,
  CheckEmailRegisteredListParams,
  CheckOtherDeviceLoginListData,
  CheckOtherDeviceLoginListParams,
  CheckPhoneRegisteredListData,
  CheckPhoneRegisteredListParams,
  CheckPhoneRegisteredListPayload,
  CheckRecoverCodeCreateData,
  CheckRecoverCodeCreatePayload,
  ForgetPasswordCreateData,
  ForgetPasswordCreatePayload,
  GenerateValidatorRecoverCodeListData,
  GenerateValidatorRecoverCodeListParams,
  Get2FaLoginInfoListData,
  Get2FaLoginInfoListParams,
  GetActivityDiscountListData,
  GetAppUpgradeCreateData,
  GetAppUpgradeCreatePayload,
  GetBlackFridayTimeListData,
  GetCheckBindEmailVerCodeListData,
  GetCheckBindEmailVerCodeListParams,
  GetCoreDownloadUrlsCreateData,
  GetCoreDownloadUrlsCreatePayload,
  GetCoreUpgradeCreateData,
  GetCoreUpgradeCreatePayload,
  GetEasterPromoTimeListData,
  GetEcommerceWhitelistDomainsListData,
  GetFaqHelpList2Data,
  GetFaqHelpListData,
  GetJuneRechargePromoTimeListData,
  GetMayFreedomSeasonPromoTimeListData,
  GetMidAutumnPromoTimeListData,
  GetPersonalVerifyValidatorCodeListData,
  GetPersonalVerifyValidatorCodeListParams,
  GetPromotionLinkDiscountAndUsernameListData,
  GetQrcodeInfoListData,
  GetSpringFestivalTimeListData,
  GetTgWechatQrcodeListData,
  GetUninstallReasonQuestionListListData,
  GetValidatorTokenInfoListData,
  GetValidatorTokenInfoListParams,
  LoginCreateData,
  LoginCreatePayload,
  LoginFacebookCreateData,
  LoginFacebookCreatePayload,
  LoginGithubCreateData,
  LoginGithubCreatePayload,
  LoginGoogleV2CreateData,
  LoginGoogleV2CreatePayload,
  LoginLinuxDoCreateData,
  LoginLinuxDoCreateError,
  LoginLinuxDoCreatePayload,
  LoginPhoneCreateData,
  LoginPhoneCreatePayload,
  LoginVkCreateData,
  LoginVkCreatePayload,
  PostBaseData,
  PostBasePayload,
  ReportAppVersionUpdateCreateData,
  ReportAppVersionUpdateCreatePayload,
  SaveChannelSourcesPeopleListData,
  SaveChannelSourcesPeopleListParams,
  SavePromotionLinkClickCountListData,
  SavePromotionLinkClickCountListParams,
  SendEmailForgetVerifyCodeListData,
  SendEmailForgetVerifyCodeListParams,
  SendEmailRegisterVerifyCodeListData,
  SendEmailRegisterVerifyCodeListParams,
  SendPhoneVerCodeCreateData,
  SendPhoneVerCodeCreatePayload,
  SendValidatorEmailVerifyCodeListData,
  SendValidatorEmailVerifyCodeListParams,
  UninstallReasonReportCreateData,
  UninstallReasonReportCreatePayload,
  UserAppRatingData,
  UserAppRatingSubmitRequest,
  UserBindEmailCreateData,
  UserBindEmailCreatePayload,
  UserBindEmailListListData,
  UserBindEmailVerifyCodeListData,
  UserBindEmailVerifyCodeListParams,
  UserBindPhoneCreateData,
  UserBindPhoneCreatePayload,
  UserCalcLlmTokenCostCreateData,
  UserCalcLlmTokenCostCreatePayload,
  UserChangeAccountCreateData,
  UserChangeAccountCreatePayload,
  UserChangeEmailCreateData,
  UserChangeEmailCreatePayload,
  UserChangePwdCreateData,
  UserChangePwdCreatePayload,
  UserChangeUsernameCreateData,
  UserChangeUsernameCreatePayload,
  UserCloseValidatorCreateData,
  UserCloseValidatorCreatePayload,
  UserGetAnntListListData,
  UserGetAppFeatureTipsCreateData,
  UserGetAppFeatureTipsCreatePayload,
  UserGetAppUpgradeCreateData,
  UserGetAppUpgradeCreatePayload,
  UserGetBannerPictureListListData,
  UserGetBannerPictureListListParams,
  UserGetBannerPictureListV2ListData,
  UserGetBannerPictureListV2ListParams,
  UserGetCheckOldEmailVerCodeListData,
  UserGetCheckOldEmailVerCodeListParams,
  UserGetCheckPhoneVerCodeCreateData,
  UserGetCheckPhoneVerCodeCreatePayload,
  UserGetCoreUpgradeCreateData,
  UserGetCoreUpgradeCreatePayload,
  UserGetDefConfigListData,
  UserGetDictVersionListData,
  UserGetGuideVideosByTypeListData,
  UserGetGuideVideosByTypeListParams,
  UserGetInfluencerRankingListData,
  UserGetInviteCodeListData,
  UserGetInviteLinkListData,
  UserGetInviteNotifyListData,
  UserGetInviteUserListV2ListData,
  UserGetInviteUserListV2ListParams,
  UserGetLlmInfoListData,
  UserGetLoginInfoListData,
  UserGetMessageTipsCreateData,
  UserGetMessageTipsCreatePayload,
  UserGetNewUserBenefitConfigListData,
  UserGetNotifyListData,
  UserGetNotifyListParams,
  UserGetOssCredentialV2ListData,
  UserGetPhoneListData,
  UserGetPromotionInfoByTypeListData,
  UserGetPromotionInfoByTypeListParams,
  UserGetPromotionInfoListData,
  UserGetPromotionLinkListListData,
  UserGetPromptTemplateListListData,
  UserGetRatingRewardCreateData,
  UserGetRatingRewardCreatePayload,
  UserGetRewardRecordListListData,
  UserGetRewardRecordListListParams,
  UserGetRoxyClawListData,
  UserGetRpaScriptLibraryListListData,
  UserGetSystemDictV2CreateData,
  UserGetSystemDictV2CreatePayload,
  UserGetUninstallReasonQuestionListListData,
  UserGetUserApiListData,
  UserGetUserConfigListData,
  UserGetUserInfoListData,
  UserGetValidatorBindInfoListData,
  UserGetValidatorInfoListData,
  UserGetValidatorInfoListParams,
  UserGetWithdrawRecordListListData,
  UserGetWithdrawRecordListListParams,
  UserIsNaifeiUserListData,
  UserLogoutListData,
  UserMayFreedomResultListData,
  UserMigrateDataListData,
  UserModifyPromotionLinkCreateData,
  UserModifyPromotionLinkCreatePayload,
  UserModifyRemarkDisplayStatusCreateData,
  UserModifyRemarkDisplayStatusCreatePayload,
  UserReadNotifyCreateData,
  UserReadNotifyCreatePayload,
  UserRegGiftCreateData,
  UserRegGiftCreatePayload,
  UserRegisterGiftConfigListData,
  UserReportAppEventCreateData,
  UserReportAppEventCreatePayload,
  UserSaveLlmDataCreateData,
  UserSaveLlmDataCreatePayload,
  UserSendAccountPasswordVerifyCodeListData,
  UserSendAccountPasswordVerifyCodeListParams,
  UserSendEmailVerifyCodeListData,
  UserSendEmailVerifyCodeListParams,
  UserSendValidatorVerifyCodeListData,
  UserSentryClientCreateData,
  UserSentryClientCreatePayload,
  UserSetPromotionLinkShowCreateData,
  UserSetPromotionLinkShowCreatePayload,
  UserSetRoxyClawCreateData,
  UserSetRoxyClawCreatePayload,
  UserSettingAccountPasswordCreateData,
  UserSettingAccountPasswordCreatePayload,
  UserSettingPasswordCreateData,
  UserSettingPasswordCreatePayload,
  UserSettingPasswordVerifyCodeListData,
  UserSettingPasswordVerifyCodeListParams,
  UserSetUserApiCreateData,
  UserSetUserApiCreatePayload,
  UserSetUserConfigCreateData,
  UserSetUserConfigCreatePayload,
  UserSubmitSurveyAnswerCreateData,
  UserSubmitSurveyAnswerCreatePayload,
  UserUnbindEmailCreateData,
  UserUnbindEmailCreatePayload,
  UserUpdateDeviceNameCreateData,
  UserUpdateDeviceNameCreatePayload,
  UserUpdateOnboardingTaskStatusCreateData,
  UserUpdateOnboardingTaskStatusCreatePayload,
  UserUpdateValidatorTokenCreateData,
  UserUpdateValidatorTokenCreatePayload,
  UserUploadAvatarCreateData,
  UserUploadAvatarCreatePayload,
  UserVerifyEmailCreateData,
  UserVerifyEmailCreatePayload,
  UserVerifyValidatorVerifyCodeListData,
  UserVerifyValidatorVerifyCodeListParams,
  UserWithdrawCreateData,
  UserWithdrawCreatePayload,
  UserWithdrawVerifyCodeListData,
  UserWithdrawVerifyCodeListParams,
  UserWriteInviteCodeCreateData,
  UserWriteInviteCodeCreatePayload,
  ValidatorBindCreateData,
  ValidatorBindCreatePayload,
  VerifyValidatorEmailVerifyCodeCreateData,
  VerifyValidatorEmailVerifyCodeCreatePayload,
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
   * @name UserLogoutList
   * @summary 用户退出登录
   * @request GET:/user_logout
   * @response `200` `UserLogoutListData`
   */
  userLogoutList = (params: RequestParams = {}) =>
    this.http.request<UserLogoutListData, any>({
      path: `/user_logout`,
      method: "GET",
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
  loginGoogleV2Create = (
    data: LoginGoogleV2CreatePayload,
    params: RequestParams = {},
  ) =>
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
   * @name LoginGithubCreate
   * @summary Github登录
   * @request POST:/login_github
   * @response `200` `LoginGithubCreateData`
   */
  loginGithubCreate = (
    data: LoginGithubCreatePayload,
    params: RequestParams = {},
  ) =>
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
   * @name LoginFacebookCreate
   * @summary Facebook登录
   * @request POST:/login_facebook
   * @response `200` `LoginFacebookCreateData`
   */
  loginFacebookCreate = (
    data: LoginFacebookCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<LoginFacebookCreateData, any>({
      path: `/login_facebook`,
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
   * @name LoginVkCreate
   * @summary VK登录
   * @request POST:/login_vk
   * @response `200` `LoginVkCreateData`
   */
  loginVkCreate = (data: LoginVkCreatePayload, params: RequestParams = {}) =>
    this.http.request<LoginVkCreateData, any>({
      path: `/login_vk`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
 * @description Linux Do OAuth2 授权登录/绑定。 **登录**：不传 header `token`，body 传 `linuxDoToken`（Connect 授权码）。 **绑定**（个人信息页）：已登录时在 header 传 `token`，body 同样传 `linuxDoToken`。 `oauthHost` 与后端四套 OAuth 配置对应： - `com` + 测试环境 → `https://gatetest.roxybrowser.co/auth?source=linuxdo` - `cn` + 测试环境 → `https://test.roxybrowser.cn/auth?source=linuxdo` - `com` + 生产环境 → `https://roxybrowser.com/auth?source=linuxdo` - `cn` + 生产环境 → `https://roxybrowser.cn/auth?source=linuxdo` 绑定失败常见错误：`已绑定其他 Linux Do 账号`、`该 Linux Do 账号已绑定其他用户`。 无真实邮箱时使用 `username@privaterelay.linux.do` 占位，`regType=6`。
 *
 * @tags Base
 * @name LoginLinuxDoCreate
 * @summary Linux Do登录
 * @request POST:/login_linux_do
 * @response `200` `LoginLinuxDoCreateData`
 * @response `x-200-2` `{
    code: number,
    msg: string,

}` 已绑定其他 Linux Do 账号 / 该 Linux Do 账号已绑定其他用户
 */
  loginLinuxDoCreate = (
    data: LoginLinuxDoCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<LoginLinuxDoCreateData, LoginLinuxDoCreateError>({
      path: `/login_linux_do`,
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
   * @name SendEmailRegisterVerifyCodeList
   * @summary  注册验证码
   * @request GET:/send_email_register_verify_code
   * @response `200` `SendEmailRegisterVerifyCodeListData`
   */
  sendEmailRegisterVerifyCodeList = (
    query: SendEmailRegisterVerifyCodeListParams,
    params: RequestParams = {},
  ) =>
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
   * @name SendEmailForgetVerifyCodeList
   * @summary 找回密码发送验证码
   * @request GET:/send_email_forget_verify_code
   * @response `200` `SendEmailForgetVerifyCodeListData`
   */
  sendEmailForgetVerifyCodeList = (
    query: SendEmailForgetVerifyCodeListParams,
    params: RequestParams = {},
  ) =>
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
  forgetPasswordCreate = (
    data: ForgetPasswordCreatePayload,
    params: RequestParams = {},
  ) =>
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
   * @name UserChangeAccountCreate
   * @summary 修改真实姓名(老的版本用)
   * @request POST:/user_change_account
   * @response `200` `UserChangeAccountCreateData`
   */
  userChangeAccountCreate = (
    data: UserChangeAccountCreatePayload,
    params: RequestParams = {},
  ) =>
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
   * @name UserChangeUsernameCreate
   * @summary 修改用户名
   * @request POST:/user_change_username
   * @response `200` `UserChangeUsernameCreateData`
   */
  userChangeUsernameCreate = (
    data: UserChangeUsernameCreatePayload,
    params: RequestParams = {},
  ) =>
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
   * @name UserChangePwdCreate
   * @summary 修改密码
   * @request POST:/user_change_pwd
   * @response `200` `UserChangePwdCreateData`
   */
  userChangePwdCreate = (
    data: UserChangePwdCreatePayload,
    params: RequestParams = {},
  ) =>
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
   * @name UserSettingPasswordCreate
   * @summary 设置密码
   * @request POST:/user_setting_password
   * @response `200` `UserSettingPasswordCreateData`
   */
  userSettingPasswordCreate = (
    data: UserSettingPasswordCreatePayload,
    params: RequestParams = {},
  ) =>
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
  userSettingPasswordVerifyCodeList = (
    query: UserSettingPasswordVerifyCodeListParams,
    params: RequestParams = {},
  ) =>
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
   * @name GetCheckBindEmailVerCodeList
   * @summary 比对验证码
   * @request GET:/get_check_bind_email_ver_code
   * @response `200` `GetCheckBindEmailVerCodeListData`
   */
  getCheckBindEmailVerCodeList = (
    query: GetCheckBindEmailVerCodeListParams,
    params: RequestParams = {},
  ) =>
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
   * @name UserSendEmailVerifyCodeList
   * @summary 修改邮箱验证码
   * @request GET:/user_send_email_verify_code
   * @response `200` `UserSendEmailVerifyCodeListData`
   */
  userSendEmailVerifyCodeList = (
    query: UserSendEmailVerifyCodeListParams,
    params: RequestParams = {},
  ) =>
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
   * @name UserVerifyEmailCreate
   * @summary 邮箱换绑验证码发送
   * @request POST:/user_verify_email
   * @response `200` `UserVerifyEmailCreateData`
   */
  userVerifyEmailCreate = (
    data: UserVerifyEmailCreatePayload,
    params: RequestParams = {},
  ) =>
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
  userGetCheckOldEmailVerCodeList = (
    query: UserGetCheckOldEmailVerCodeListParams,
    params: RequestParams = {},
  ) =>
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
   * @name UserChangeEmailCreate
   * @summary 修改邮箱
   * @request POST:/user_change_email
   * @response `200` `UserChangeEmailCreateData`
   */
  userChangeEmailCreate = (
    data: UserChangeEmailCreatePayload,
    params: RequestParams = {},
  ) =>
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
  userGetAppUpgradeCreate = (
    data: UserGetAppUpgradeCreatePayload,
    params: RequestParams = {},
  ) =>
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
   * @name GetAppUpgradeCreate
   * @summary app升级->获取版本信息--无权限认证
   * @request POST:/get_app_upgrade
   * @response `200` `GetAppUpgradeCreateData`
   */
  getAppUpgradeCreate = (
    data: GetAppUpgradeCreatePayload,
    params: RequestParams = {},
  ) =>
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
   * @name UserGetCoreUpgradeCreate
   * @summary core升级->获取版本信息--有权限认证
   * @request POST:/user_get_core_upgrade
   * @response `200` `UserGetCoreUpgradeCreateData`
   */
  userGetCoreUpgradeCreate = (
    data: UserGetCoreUpgradeCreatePayload,
    params: RequestParams = {},
  ) =>
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
   * @name GetCoreUpgradeCreate
   * @summary core升级->获取版本信息--无权限认证
   * @request POST:/get_core_upgrade
   * @response `200` `GetCoreUpgradeCreateData`
   */
  getCoreUpgradeCreate = (
    data: GetCoreUpgradeCreatePayload,
    params: RequestParams = {},
  ) =>
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
  userSetUserConfigCreate = (
    data: UserSetUserConfigCreatePayload,
    params: RequestParams = {},
  ) =>
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
  userSetUserApiCreate = (
    data: UserSetUserApiCreatePayload,
    params: RequestParams = {},
  ) =>
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
  userGetSystemDictV2Create = (
    data: UserGetSystemDictV2CreatePayload,
    params: RequestParams = {},
  ) =>
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
  userGetNotifyList = (
    query: UserGetNotifyListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetNotifyListData, any>({
      path: `/user_get_notify`,
      method: "GET",
      query: query,
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
  userReadNotifyCreate = (
    data: UserReadNotifyCreatePayload,
    params: RequestParams = {},
  ) =>
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
  userUploadAvatarCreate = (
    data: UserUploadAvatarCreatePayload,
    params: RequestParams = {},
  ) =>
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
   * @name SaveChannelSourcesPeopleList
   * @summary 存储渠道来源人数
   * @request GET:/save_channel_sources_people
   * @response `200` `SaveChannelSourcesPeopleListData`
   */
  saveChannelSourcesPeopleList = (
    query: SaveChannelSourcesPeopleListParams,
    params: RequestParams = {},
  ) =>
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
   * @name SavePromotionLinkClickCountList
   * @summary 存储渠道推广链接点击次数
   * @request GET:/save_promotion_link_click_count
   * @response `200` `SavePromotionLinkClickCountListData`
   */
  savePromotionLinkClickCountList = (
    query: SavePromotionLinkClickCountListParams,
    params: RequestParams = {},
  ) =>
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
  userWriteInviteCodeCreate = (
    data: UserWriteInviteCodeCreatePayload,
    params: RequestParams = {},
  ) =>
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
  userGetBannerPictureListList = (
    query: UserGetBannerPictureListListParams,
    params: RequestParams = {},
  ) =>
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
   * @name CheckOtherDeviceLoginList
   * @summary 判断是否有在其他设备已经登录
   * @request GET:/check_other_device_login
   * @response `200` `CheckOtherDeviceLoginListData`
   */
  checkOtherDeviceLoginList = (
    query: CheckOtherDeviceLoginListParams,
    params: RequestParams = {},
  ) =>
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
   * @name CheckEmailRegisteredList
   * @summary 检测邮箱是否已注册
   * @request GET:/check_email_registered
   * @response `200` `CheckEmailRegisteredListData`
   */
  checkEmailRegisteredList = (
    query: CheckEmailRegisteredListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<CheckEmailRegisteredListData, any>({
      path: `/check_email_registered`,
      method: "GET",
      query: query,
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
   * @name UserGetInviteUserListV2List
   * @summary 获取邀请的用户列表
   * @request GET:/user_get_invite_user_list_v2
   * @response `200` `UserGetInviteUserListV2ListData`
   */
  userGetInviteUserListV2List = (
    query: UserGetInviteUserListV2ListParams,
    params: RequestParams = {},
  ) =>
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
   * @name UserGetRewardRecordListList
   * @summary 用户奖励记录列表
   * @request GET:/user_get_reward_record_list
   * @response `200` `UserGetRewardRecordListListData`
   */
  userGetRewardRecordListList = (
    query: UserGetRewardRecordListListParams,
    params: RequestParams = {},
  ) =>
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
  userGetWithdrawRecordListList = (
    query: UserGetWithdrawRecordListListParams,
    params: RequestParams = {},
  ) =>
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
   * @name UserWithdrawCreate
   * @summary 用户提现
   * @request POST:/user_withdraw
   * @response `200` `UserWithdrawCreateData`
   */
  userWithdrawCreate = (
    data: UserWithdrawCreatePayload,
    params: RequestParams = {},
  ) =>
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
   * @name UserWithdrawVerifyCodeList
   * @summary 发送提现的验证码
   * @request GET:/user_withdraw_verify_code
   * @response `200` `UserWithdrawVerifyCodeListData`
   */
  userWithdrawVerifyCodeList = (
    query: UserWithdrawVerifyCodeListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserWithdrawVerifyCodeListData, any>({
      path: `/user_withdraw_verify_code`,
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
  userGetBannerPictureListV2List = (
    query: UserGetBannerPictureListV2ListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetBannerPictureListV2ListData, any>({
      path: `/user_get_banner_picture_list_v2`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * @description 查询当前用户第三方账号绑定状态。 返回 `Google`、`Github`、`Facebook`、`VK`、`LINUXDO` 五种类型；未绑定时 `thirdEmail`/`thirdId`/`thirdUserName` 为空。 Linux Do 绑定通过 `POST /login_linux_do`（header 带 `token`）完成，不在 `user_bind_email` 邮箱验证码流程内。
   *
   * @tags Base
   * @name UserBindEmailListList
   * @summary 用户绑定邮箱列表
   * @request GET:/user_bind_email_list
   * @response `200` `UserBindEmailListListData`
   */
  userBindEmailListList = (params: RequestParams = {}) =>
    this.http.request<UserBindEmailListListData, any>({
      path: `/user_bind_email_list`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserBindEmailCreate
   * @summary 用户校验绑定第三方邮箱
   * @request POST:/user_bind_email
   * @response `200` `UserBindEmailCreateData`
   */
  userBindEmailCreate = (
    data: UserBindEmailCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserBindEmailCreateData, any>({
      path: `/user_bind_email`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * @description 解绑第三方账号。`bind_type` 传 `LINUXDO` 可解绑 Linux Do。 Linux Do 绑定请使用 `POST /login_linux_do` + header `token`，不要使用 `user_bind_email`。
   *
   * @tags Base
   * @name UserUnbindEmailCreate
   * @summary 用户解绑第三方邮箱
   * @request POST:/user_unbind_email
   * @response `200` `UserUnbindEmailCreateData`
   */
  userUnbindEmailCreate = (
    data: UserUnbindEmailCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserUnbindEmailCreateData, any>({
      path: `/user_unbind_email`,
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
   * @name UserBindEmailVerifyCodeList
   * @summary 用户绑定邮箱验证码
   * @request GET:/user_bind_email_verify_code
   * @response `200` `UserBindEmailVerifyCodeListData`
   */
  userBindEmailVerifyCodeList = (
    query: UserBindEmailVerifyCodeListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserBindEmailVerifyCodeListData, any>({
      path: `/user_bind_email_verify_code`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserSettingAccountPasswordCreate
   * @summary 设置第三方绑定账号密码
   * @request POST:/user_setting_account_password
   * @response `200` `UserSettingAccountPasswordCreateData`
   */
  userSettingAccountPasswordCreate = (
    data: UserSettingAccountPasswordCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserSettingAccountPasswordCreateData, any>({
      path: `/user_setting_account_password`,
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
   * @name UserSendAccountPasswordVerifyCodeList
   * @summary 发送绑定邮箱的验证码
   * @request GET:/user_send_account_password_verify_code
   * @response `200` `UserSendAccountPasswordVerifyCodeListData`
   */
  userSendAccountPasswordVerifyCodeList = (
    query: UserSendAccountPasswordVerifyCodeListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserSendAccountPasswordVerifyCodeListData, any>({
      path: `/user_send_account_password_verify_code`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserModifyRemarkDisplayStatusCreate
   * @summary 修改备注显示状态
   * @request POST:/user_modify_remark_display_status
   * @deprecated
   * @response `200` `UserModifyRemarkDisplayStatusCreateData`
   */
  userModifyRemarkDisplayStatusCreate = (
    data: UserModifyRemarkDisplayStatusCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserModifyRemarkDisplayStatusCreateData, any>({
      path: `/user_modify_remark_display_status`,
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
   * @name UserSendValidatorVerifyCodeList
   * @summary 发送开启验证器验证码
   * @request GET:/user_send_validator_verify_code
   * @response `200` `UserSendValidatorVerifyCodeListData`
   */
  userSendValidatorVerifyCodeList = (params: RequestParams = {}) =>
    this.http.request<UserSendValidatorVerifyCodeListData, any>({
      path: `/user_send_validator_verify_code`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserVerifyValidatorVerifyCodeList
   * @summary 比对开启验证器验证码
   * @request GET:/user_verify_validator_verify_code
   * @response `200` `UserVerifyValidatorVerifyCodeListData`
   */
  userVerifyValidatorVerifyCodeList = (
    query: UserVerifyValidatorVerifyCodeListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserVerifyValidatorVerifyCodeListData, any>({
      path: `/user_verify_validator_verify_code`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name GetValidatorTokenInfoList
   * @summary 获取用户验证器token
   * @request GET:/get_validator_token_info
   * @response `200` `GetValidatorTokenInfoListData`
   */
  getValidatorTokenInfoList = (
    query: GetValidatorTokenInfoListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<GetValidatorTokenInfoListData, any>({
      path: `/get_validator_token_info`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name GetPersonalVerifyValidatorCodeList
   * @summary 个人设置比对验证器code
   * @request GET:/get_personal_verify_validator_code
   * @response `200` `GetPersonalVerifyValidatorCodeListData`
   */
  getPersonalVerifyValidatorCodeList = (
    query: GetPersonalVerifyValidatorCodeListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<GetPersonalVerifyValidatorCodeListData, any>({
      path: `/get_personal_verify_validator_code`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name SendValidatorEmailVerifyCodeList
   * @summary 发送恢复邮箱验证码
   * @request GET:/send_validator_email_verify_code
   * @response `200` `SendValidatorEmailVerifyCodeListData`
   */
  sendValidatorEmailVerifyCodeList = (
    query: SendValidatorEmailVerifyCodeListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<SendValidatorEmailVerifyCodeListData, any>({
      path: `/send_validator_email_verify_code`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name GenerateValidatorRecoverCodeList
   * @summary 生成恢复验证器恢复代码
   * @request GET:/generate_validator_recover_code
   * @response `200` `GenerateValidatorRecoverCodeListData`
   */
  generateValidatorRecoverCodeList = (
    query: GenerateValidatorRecoverCodeListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<GenerateValidatorRecoverCodeListData, any>({
      path: `/generate_validator_recover_code`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name ValidatorBindCreate
   * @summary 用户验证器绑定
   * @request POST:/validator_bind
   * @response `200` `ValidatorBindCreateData`
   */
  validatorBindCreate = (
    data: ValidatorBindCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<ValidatorBindCreateData, any>({
      path: `/validator_bind`,
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
   * @name UserCloseValidatorCreate
   * @summary 关闭验证器
   * @request POST:/user_close_validator
   * @response `200` `UserCloseValidatorCreateData`
   */
  userCloseValidatorCreate = (
    data: UserCloseValidatorCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserCloseValidatorCreateData, any>({
      path: `/user_close_validator`,
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
   * @name UserGetValidatorBindInfoList
   * @summary 获取验证器绑定信息
   * @request GET:/user_get_validator_bind_info
   * @response `200` `UserGetValidatorBindInfoListData`
   */
  userGetValidatorBindInfoList = (params: RequestParams = {}) =>
    this.http.request<UserGetValidatorBindInfoListData, any>({
      path: `/user_get_validator_bind_info`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetValidatorInfoList
   * @summary 获取验证信息
   * @request GET:/user_get_validator_info
   * @response `200` `UserGetValidatorInfoListData`
   */
  userGetValidatorInfoList = (
    query: UserGetValidatorInfoListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetValidatorInfoListData, any>({
      path: `/user_get_validator_info`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserUpdateValidatorTokenCreate
   * @summary 更新验证器的token
   * @request POST:/user_update_validator_token
   * @response `200` `UserUpdateValidatorTokenCreateData`
   */
  userUpdateValidatorTokenCreate = (
    data: UserUpdateValidatorTokenCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserUpdateValidatorTokenCreateData, any>({
      path: `/user_update_validator_token`,
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
   * @name CheckRecoverCodeCreate
   * @summary 恢复代码
   * @request POST:/check_recover_code
   * @response `200` `CheckRecoverCodeCreateData`
   */
  checkRecoverCodeCreate = (
    data: CheckRecoverCodeCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<CheckRecoverCodeCreateData, any>({
      path: `/check_recover_code`,
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
   * @name CheckEmailPasswordCreate
   * @summary 校验邮箱密码
   * @request POST:/check_email_password
   * @response `200` `CheckEmailPasswordCreateData`
   */
  checkEmailPasswordCreate = (
    data: CheckEmailPasswordCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<CheckEmailPasswordCreateData, any>({
      path: `/check_email_password`,
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
   * @name VerifyValidatorEmailVerifyCodeCreate
   * @summary 验证恢复邮箱验证码
   * @request POST:/verify_validator_email_verify_code
   * @response `200` `VerifyValidatorEmailVerifyCodeCreateData`
   */
  verifyValidatorEmailVerifyCodeCreate = (
    data: VerifyValidatorEmailVerifyCodeCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<VerifyValidatorEmailVerifyCodeCreateData, any>({
      path: `/verify_validator_email_verify_code`,
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
   * @name Get2FaLoginInfoList
   * @summary 获取2FA登录信息
   * @request GET:/get_2fa_login_info
   * @response `200` `Get2FaLoginInfoListData`
   */
  get2FaLoginInfoList = (
    query: Get2FaLoginInfoListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<Get2FaLoginInfoListData, any>({
      path: `/get_2fa_login_info`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name CheckEmailOr2FaVerifyList
   * @summary 校验是用邮箱还是2FA码验证
   * @request GET:/check_email_or_2fa_verify
   * @response `200` `CheckEmailOr2FaVerifyListData`
   */
  checkEmailOr2FaVerifyList = (
    query: CheckEmailOr2FaVerifyListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<CheckEmailOr2FaVerifyListData, any>({
      path: `/check_email_or_2fa_verify`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetPromotionInfoByTypeList
   * @summary 根据链接类型获取用户推广信息
   * @request GET:/user_get_promotion_info_by_type
   * @response `200` `UserGetPromotionInfoByTypeListData`
   */
  userGetPromotionInfoByTypeList = (
    query: UserGetPromotionInfoByTypeListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetPromotionInfoByTypeListData, any>({
      path: `/user_get_promotion_info_by_type`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetGuideVideosByTypeList
   * @summary 通过类型查询引导视频
   * @request GET:/user_get_guide_videos_by_type
   * @response `200` `UserGetGuideVideosByTypeListData`
   */
  userGetGuideVideosByTypeList = (
    query: UserGetGuideVideosByTypeListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetGuideVideosByTypeListData, any>({
      path: `/user_get_guide_videos_by_type`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserUpdateDeviceNameCreate
   * @summary 修改当前登录设备名称
   * @request POST:/user_update_device_name
   * @response `200` `UserUpdateDeviceNameCreateData`
   */
  userUpdateDeviceNameCreate = (
    data: UserUpdateDeviceNameCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserUpdateDeviceNameCreateData, any>({
      path: `/user_update_device_name`,
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
   * @name UserUpdateOnboardingTaskStatusCreate
   * @summary 更新引导状态
   * @request POST:/user_update_onboarding_task_status
   * @response `200` `UserUpdateOnboardingTaskStatusCreateData`
   */
  userUpdateOnboardingTaskStatusCreate = (
    data: UserUpdateOnboardingTaskStatusCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserUpdateOnboardingTaskStatusCreateData, any>({
      path: `/user_update_onboarding_task_status`,
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
   * @name GetFaqHelpList
   * @summary 获取FAQ&HELP
   * @request GET:/get_faq_help
   * @response `200` `GetFaqHelpListData`
   */
  getFaqHelpList = (params: RequestParams = {}) =>
    this.http.request<GetFaqHelpListData, any>({
      path: `/get_faq_help`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserIsNaifeiUserList
   * @summary 获取奈飞用户列表
   * @request GET:/user_is_naifei_user
   * @response `200` `UserIsNaifeiUserListData`
   */
  userIsNaifeiUserList = (params: RequestParams = {}) =>
    this.http.request<UserIsNaifeiUserListData, any>({
      path: `/user_is_naifei_user`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name GetBlackFridayTimeList
   * @summary 获取黑色星期五活动时间
   * @request GET:/get_black_friday_time
   * @response `200` `GetBlackFridayTimeListData`
   */
  getBlackFridayTimeList = (params: RequestParams = {}) =>
    this.http.request<GetBlackFridayTimeListData, any>({
      path: `/get_black_friday_time`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserSubmitSurveyAnswerCreate
   * @summary 用户首次登录信息收集
   * @request POST:/user_submit_survey_answer
   * @response `200` `UserSubmitSurveyAnswerCreateData`
   */
  userSubmitSurveyAnswerCreate = (
    data: UserSubmitSurveyAnswerCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserSubmitSurveyAnswerCreateData, any>({
      path: `/user_submit_survey_answer`,
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
   * @name SendPhoneVerCodeCreate
   * @summary 发送手机验证码
   * @request POST:/send_phone_ver_code
   * @response `200` `SendPhoneVerCodeCreateData`
   */
  sendPhoneVerCodeCreate = (
    data: SendPhoneVerCodeCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<SendPhoneVerCodeCreateData, any>({
      path: `/send_phone_ver_code`,
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
   * @name LoginPhoneCreate
   * @summary 手机号登录
   * @request POST:/login_phone
   * @response `200` `LoginPhoneCreateData`
   */
  loginPhoneCreate = (
    data: LoginPhoneCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<LoginPhoneCreateData, any>({
      path: `/login_phone`,
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
   * @name UserBindPhoneCreate
   * @summary 用户绑定手机号码
   * @request POST:/user_bind_phone
   * @response `200` `UserBindPhoneCreateData`
   */
  userBindPhoneCreate = (
    data: UserBindPhoneCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserBindPhoneCreateData, any>({
      path: `/user_bind_phone`,
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
   * @name UserSetPromotionLinkShowCreate
   * @summary 设置用户推广链接是否展示
   * @request POST:/user_set_promotion_link_show
   * @response `200` `UserSetPromotionLinkShowCreateData`
   */
  userSetPromotionLinkShowCreate = (
    data: UserSetPromotionLinkShowCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserSetPromotionLinkShowCreateData, any>({
      path: `/user_set_promotion_link_show`,
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
   * @name GetPromotionLinkDiscountAndUsernameList
   * @summary 查询用户邀请链接折扣和用户名
   * @request GET:/get_promotion_link_discount_and_username
   * @response `200` `GetPromotionLinkDiscountAndUsernameListData`
   */
  getPromotionLinkDiscountAndUsernameList = (params: RequestParams = {}) =>
    this.http.request<GetPromotionLinkDiscountAndUsernameListData, any>({
      path: `/get_promotion_link_discount_and_username`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetLlmInfoList
   * @summary 获取数字员工内测权限
   * @request GET:/user_get_llm_info
   * @response `200` `UserGetLlmInfoListData`
   */
  userGetLlmInfoList = (params: RequestParams = {}) =>
    this.http.request<UserGetLlmInfoListData, any>({
      path: `/user_get_llm_info`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetPromptTemplateListList
   * @summary 查询提示模板列表
   * @request GET:/user_get_prompt_template_list
   * @response `200` `UserGetPromptTemplateListListData`
   */
  userGetPromptTemplateListList = (params: RequestParams = {}) =>
    this.http.request<UserGetPromptTemplateListListData, any>({
      path: `/user_get_prompt_template_list`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserSaveLlmDataCreate
   * @summary 存储用户数字员工数据
   * @request POST:/user_save_llm_data
   * @response `200` `UserSaveLlmDataCreateData`
   */
  userSaveLlmDataCreate = (
    data: UserSaveLlmDataCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserSaveLlmDataCreateData, any>({
      path: `/user_save_llm_data`,
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
   * @name UserGetUninstallReasonQuestionListList
   * @summary 查询卸载原因列表
   * @request GET:/user_get_uninstall_reason_question_list
   * @response `200` `UserGetUninstallReasonQuestionListListData`
   */
  userGetUninstallReasonQuestionListList = (params: RequestParams = {}) =>
    this.http.request<UserGetUninstallReasonQuestionListListData, any>({
      path: `/user_get_uninstall_reason_question_list`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserRegisterGiftConfigList
   * @summary 获取注册赠送代理配置信息
   * @request GET:/user_register_gift_config
   * @response `200` `UserRegisterGiftConfigListData`
   */
  userRegisterGiftConfigList = (params: RequestParams = {}) =>
    this.http.request<UserRegisterGiftConfigListData, any>({
      path: `/user_register_gift_config`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserRegGiftCreate
   * @summary 新用户注册赠送代理相关礼物
   * @request POST:/user_reg_gift
   * @response `200` `UserRegGiftCreateData`
   */
  userRegGiftCreate = (
    data: UserRegGiftCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserRegGiftCreateData, any>({
      path: `/user_reg_gift`,
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
   * @name GetSpringFestivalTimeList
   * @summary 获取春节活动时间
   * @request GET:/get_spring_festival_time
   * @response `200` `GetSpringFestivalTimeListData`
   */
  getSpringFestivalTimeList = (params: RequestParams = {}) =>
    this.http.request<GetSpringFestivalTimeListData, any>({
      path: `/get_spring_festival_time`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetCheckPhoneVerCodeCreate
   * @summary 用户验证手机验证码
   * @request POST:/user_get_check_phone_ver_code
   * @response `200` `UserGetCheckPhoneVerCodeCreateData`
   */
  userGetCheckPhoneVerCodeCreate = (
    data: UserGetCheckPhoneVerCodeCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetCheckPhoneVerCodeCreateData, any>({
      path: `/user_get_check_phone_ver_code`,
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
   * @name GetActivityDiscountList
   * @summary 获取活动折扣
   * @request GET:/get_activity_discount
   * @response `200` `GetActivityDiscountListData`
   */
  getActivityDiscountList = (params: RequestParams = {}) =>
    this.http.request<GetActivityDiscountListData, any>({
      path: `/get_activity_discount`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserCalcLlmTokenCostCreate
   * @summary MCPToken结算
   * @request POST:/user_calc_llm_token_cost
   * @response `200` `UserCalcLlmTokenCostCreateData`
   */
  userCalcLlmTokenCostCreate = (
    data: UserCalcLlmTokenCostCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserCalcLlmTokenCostCreateData, any>({
      path: `/user_calc_llm_token_cost`,
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
   * @name UserGetInviteNotifyList
   * @summary 用户获取邀请通知
   * @request GET:/user_get_invite_notify
   * @response `200` `UserGetInviteNotifyListData`
   */
  userGetInviteNotifyList = (params: RequestParams = {}) =>
    this.http.request<UserGetInviteNotifyListData, any>({
      path: `/user_get_invite_notify`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * @description 提交用户评价。图片需前端先上传 OSS，此处传完整 URL 列表。 服务端根据 workspaceId 自动记录 sceneMask（1=通用，2=电商）。
   *
   * @tags Base
   * @name UserAppRating
   * @summary 提交 APP 评价
   * @request POST:/user_app_rating
   * @response `200` `UserAppRatingData` 成功
   */
  userAppRating = (
    data: UserAppRatingSubmitRequest,
    params: RequestParams = {},
  ) =>
    this.http.request<UserAppRatingData, any>({
      path: `/user_app_rating`,
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
   * @name UserSentryClientCreate
   * @summary 窗口右键编辑数据收集
   * @request POST:/user_sentry_client
   * @response `200` `UserSentryClientCreateData`
   */
  userSentryClientCreate = (
    data: UserSentryClientCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserSentryClientCreateData, any>({
      path: `/user_sentry_client`,
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
   * @name UserGetPhoneList
   * @summary 获取用户手机号
   * @request GET:/user_get_phone
   * @response `200` `UserGetPhoneListData`
   */
  userGetPhoneList = (params: RequestParams = {}) =>
    this.http.request<UserGetPhoneListData, any>({
      path: `/user_get_phone`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name GetEasterPromoTimeList
   * @summary 复活节活动时间
   * @request GET:/get_easter_promo_time
   * @response `200` `GetEasterPromoTimeListData`
   */
  getEasterPromoTimeList = (params: RequestParams = {}) =>
    this.http.request<GetEasterPromoTimeListData, any>({
      path: `/get_easter_promo_time`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserSetRoxyClawCreate
   * @summary Roxy Claw：设置
   * @request POST:/user_set_roxy_claw
   * @response `200` `UserSetRoxyClawCreateData`
   */
  userSetRoxyClawCreate = (
    data: UserSetRoxyClawCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserSetRoxyClawCreateData, any>({
      path: `/user_set_roxy_claw`,
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
   * @name GetMayFreedomSeasonPromoTimeList
   * @summary 获取五月自由季活动信息
   * @request GET:/get_may_freedom_season_promo_time
   * @response `200` `GetMayFreedomSeasonPromoTimeListData`
   */
  getMayFreedomSeasonPromoTimeList = (params: RequestParams = {}) =>
    this.http.request<GetMayFreedomSeasonPromoTimeListData, any>({
      path: `/get_may_freedom_season_promo_time`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserMayFreedomResultList
   * @summary 获取五一活动抽奖结果
   * @request GET:/user_may_freedom_result
   * @response `200` `UserMayFreedomResultListData`
   */
  userMayFreedomResultList = (params: RequestParams = {}) =>
    this.http.request<UserMayFreedomResultListData, any>({
      path: `/user_may_freedom_result`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name GetEcommerceWhitelistDomainsList
   * @summary 获取直连白名单
   * @request GET:/get_ecommerce_whitelist_domains
   * @response `200` `GetEcommerceWhitelistDomainsListData`
   */
  getEcommerceWhitelistDomainsList = (params: RequestParams = {}) =>
    this.http.request<GetEcommerceWhitelistDomainsListData, any>({
      path: `/get_ecommerce_whitelist_domains`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetRpaScriptLibraryListList
   * @summary 脚本广场列表
   * @request GET:/user_get_rpa_script_library_list
   * @response `200` `UserGetRpaScriptLibraryListListData`
   */
  userGetRpaScriptLibraryListList = (params: RequestParams = {}) =>
    this.http.request<UserGetRpaScriptLibraryListListData, any>({
      path: `/user_get_rpa_script_library_list`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UninstallReasonReportCreate
   * @summary 上报卸载原因 -无权限
   * @request POST:/uninstall_reason_report
   * @response `200` `UninstallReasonReportCreateData`
   */
  uninstallReasonReportCreate = (
    data: UninstallReasonReportCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UninstallReasonReportCreateData, any>({
      path: `/uninstall_reason_report`,
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
   * @name UserGetInfluencerRankingList
   * @summary 获取影响力排行榜 (10条数据)
   * @request GET:/user_get_influencer_ranking
   * @response `200` `UserGetInfluencerRankingListData`
   */
  userGetInfluencerRankingList = (params: RequestParams = {}) =>
    this.http.request<UserGetInfluencerRankingListData, any>({
      path: `/user_get_influencer_ranking`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetPromotionLinkListList
   * @summary 获取推广链接列表
   * @request GET:/user_get_promotion_link_list
   * @response `200` `UserGetPromotionLinkListListData`
   */
  userGetPromotionLinkListList = (params: RequestParams = {}) =>
    this.http.request<UserGetPromotionLinkListListData, any>({
      path: `/user_get_promotion_link_list`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserReportAppEventCreate
   * @summary 客户端事件上报
   * @request POST:/user_report_app_event
   * @response `200` `UserReportAppEventCreateData`
   */
  userReportAppEventCreate = (
    data: UserReportAppEventCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserReportAppEventCreateData, any>({
      path: `/user_report_app_event`,
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
   * @name CheckPhoneRegisteredList
   * @summary 检测手机号是否已注册
   * @request GET:/check_phone_registered
   * @response `200` `CheckPhoneRegisteredListData`
   */
  checkPhoneRegisteredList = (
    query: CheckPhoneRegisteredListParams,
    data: CheckPhoneRegisteredListPayload,
    params: RequestParams = {},
  ) =>
    this.http.request<CheckPhoneRegisteredListData, any>({
      path: `/check_phone_registered`,
      method: "GET",
      query: query,
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name GetJuneRechargePromoTimeList
   * @summary 6月充值活动
   * @request GET:/get_june_recharge_promo_time
   * @response `200` `GetJuneRechargePromoTimeListData`
   */
  getJuneRechargePromoTimeList = (params: RequestParams = {}) =>
    this.http.request<GetJuneRechargePromoTimeListData, any>({
      path: `/get_june_recharge_promo_time`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserModifyPromotionLinkCreate
   * @summary 用户修改自定义推广邀请码
   * @request POST:/user_modify_promotion_link
   * @response `200` `UserModifyPromotionLinkCreateData`
   */
  userModifyPromotionLinkCreate = (
    data: UserModifyPromotionLinkCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserModifyPromotionLinkCreateData, any>({
      path: `/user_modify_promotion_link`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
 * @description 面向 electron-updater（generic provider）的动态更新清单。 客户端 setFeedURL 示例： `https://apitest.roxybrowser.co/app_update/?os=win32&osBit=64` updater 实际请求： - Windows: GET /app_update/latest.yml?os=win32&osBit=64 - macOS: GET /app_update/latest-mac.yml?os=darwin&cpu=apple - Linux: GET /app_update/latest-linux.yml?os=linux&osBit=64 行为： 1. 取该平台对当前 IP 可见的最新版本（尊重 ipLimit/白名单） 2. 从 OSS 读取原始 latest.yml（优先 private，回退 public） 3. 将 path / files[].url 相对路径改写为短时预签名完整 URL 4. 返回 text/yaml，Cache-Control: no-store 成功 HTTP 200；参数错误 400；无版本/无对象 404；OSS 失败 502。 旧版 JSON POST /app_update 已移除。
 *
 * @tags Base
 * @name AppUpdateDetail
 * @summary app升级->electron-updater动态feed--无权限认证
 * @request GET:/app_update/{ymlFile}
 * @response `200` `AppUpdateDetailData` 返回改写后的 electron-updater 清单（text/yaml）
 * @response `400` `{
    code?: number,
    msg?: string,
    data?: string,

}` os/osBit/cpu 非法，或 ymlFile 与 os 不匹配
 * @response `404` `{
    code?: number,
    msg?: string,

}` 无可见版本，或 OSS 上找不到 latest.yml
 * @response `502` `{
    code?: number,
    msg?: string,

}`
 */
  appUpdateDetail = (
    { ymlFile, ...query }: AppUpdateDetailParams,
    params: RequestParams = {},
  ) =>
    this.http.request<AppUpdateDetailData, AppUpdateDetailError>({
      path: `/app_update/${ymlFile}`,
      method: "GET",
      query: query,
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name GetCoreDownloadUrlsCreate
   * @summary core升级->获取内核预签名下载地址
   * @request POST:/get_core_download_urls
   * @response `200` `GetCoreDownloadUrlsCreateData`
   */
  getCoreDownloadUrlsCreate = (
    data: GetCoreDownloadUrlsCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<GetCoreDownloadUrlsCreateData, any>({
      path: `/get_core_download_urls`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * @description 定向新特性内容优先，统一返回 newFeatureTips
   *
   * @tags Base
   * @name UserGetAppFeatureTipsCreate
   * @summary 获取新特性
   * @request POST:/user_get_app_feature_tips
   * @response `200` `UserGetAppFeatureTipsCreateData`
   */
  userGetAppFeatureTipsCreate = (
    data: UserGetAppFeatureTipsCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetAppFeatureTipsCreateData, any>({
      path: `/user_get_app_feature_tips`,
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
   * @name UserGetMessageTipsCreate
   * @summary 获取定向消息弹窗
   * @request POST:/user_get_message_tips
   * @response `200` `UserGetMessageTipsCreateData`
   */
  userGetMessageTipsCreate = (
    data: UserGetMessageTipsCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetMessageTipsCreateData, any>({
      path: `/user_get_message_tips`,
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
   * @name UserGetNewUserBenefitConfigList
   * @summary 获取用户福利资格与剩余状态
   * @request GET:/user_get_new_user_benefit_config
   * @response `200` `UserGetNewUserBenefitConfigListData`
   */
  userGetNewUserBenefitConfigList = (params: RequestParams = {}) =>
    this.http.request<UserGetNewUserBenefitConfigListData, any>({
      path: `/user_get_new_user_benefit_config`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name GetFaqHelpList2
   * @summary 获取FAQ&HELP
   * @request GET:/app_statistics/get_faq_help
   * @originalName getFaqHelpList
   * @duplicate
   * @response `200` `GetFaqHelpList2Data`
   */
  getFaqHelpList2 = (params: RequestParams = {}) =>
    this.http.request<GetFaqHelpList2Data, any>({
      path: `/app_statistics/get_faq_help`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name GetQrcodeInfoList
   * @summary 官网获取二维码信息
   * @request GET:/app_statistics/get_qrcode_info
   * @response `200` `GetQrcodeInfoListData`
   */
  getQrcodeInfoList = (params: RequestParams = {}) =>
    this.http.request<GetQrcodeInfoListData, any>({
      path: `/app_statistics/get_qrcode_info`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name UserGetRatingRewardCreate
   * @summary 用户领取评分IP奖励
   * @request POST:/user_get_rating_reward
   * @response `200` `UserGetRatingRewardCreateData`
   */
  userGetRatingRewardCreate = (
    data: UserGetRatingRewardCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetRatingRewardCreateData, any>({
      path: `/user_get_rating_reward`,
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
   * @name UserGetRoxyClawList
   * @summary Roxy Claw：获取配置
   * @request GET:/user_get_roxy_claw
   * @response `200` `UserGetRoxyClawListData`
   */
  userGetRoxyClawList = (params: RequestParams = {}) =>
    this.http.request<UserGetRoxyClawListData, any>({
      path: `/user_get_roxy_claw`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name ReportAppVersionUpdateCreate
   * @summary 版本更新监控
   * @request POST:/report_app_version_update
   * @response `200` `ReportAppVersionUpdateCreateData`
   */
  reportAppVersionUpdateCreate = (
    data: ReportAppVersionUpdateCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<ReportAppVersionUpdateCreateData, any>({
      path: `/report_app_version_update`,
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
   * @name GetUninstallReasonQuestionListList
   * @summary 查询卸载原因列表
   * @request GET:/get_uninstall_reason_question_list
   * @response `200` `GetUninstallReasonQuestionListListData`
   */
  getUninstallReasonQuestionListList = (params: RequestParams = {}) =>
    this.http.request<GetUninstallReasonQuestionListListData, any>({
      path: `/get_uninstall_reason_question_list`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name GetTgWechatQrcodeList
   * @summary 获取 TG / 微信二维码
   * @request GET:/get_tg_wechat_qrcode
   * @response `200` `GetTgWechatQrcodeListData`
   */
  getTgWechatQrcodeList = (params: RequestParams = {}) =>
    this.http.request<GetTgWechatQrcodeListData, any>({
      path: `/get_tg_wechat_qrcode`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Base
   * @name GetMidAutumnPromoTimeList
   * @summary 获取中秋活动配置信息
   * @request GET:/get_mid_autumn_promo_time
   * @response `200` `GetMidAutumnPromoTimeListData`
   */
  getMidAutumnPromoTimeList = (params: RequestParams = {}) =>
    this.http.request<GetMidAutumnPromoTimeListData, any>({
      path: `/get_mid_autumn_promo_time`,
      method: "GET",
      format: "json",
      ...params,
    });
}
