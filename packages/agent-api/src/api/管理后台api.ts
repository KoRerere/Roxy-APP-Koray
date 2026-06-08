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
  BodyUploadSkillCategoryIconAdminApiSkillCategoriesIconUploadPost,
  BodyUploadSkillIconAdminApiSkillsSkillIdIconPost,
  BodyUploadSkillPackageAdminApiSkillsSkillIdUploadPost,
  CreateModelAdminApiModelsPostData,
  CreateModelAdminApiModelsPostError,
  CreateProviderAdminApiProvidersPostData,
  CreateProviderAdminApiProvidersPostError,
  CreateSettingAdminApiSettingsPostData,
  CreateSettingAdminApiSettingsPostError,
  CreateSkillAdminApiSkillsPostData,
  CreateSkillAdminApiSkillsPostError,
  CreateSkillCategoryAdminApiSkillCategoriesPostData,
  CreateSkillCategoryAdminApiSkillCategoriesPostError,
  DeleteModelAdminApiModelsModelIdDeleteData,
  DeleteModelAdminApiModelsModelIdDeleteError,
  DeleteModelAdminApiModelsModelIdDeleteParams,
  DeleteProviderAdminApiProvidersProviderIdDeleteData,
  DeleteProviderAdminApiProvidersProviderIdDeleteError,
  DeleteProviderAdminApiProvidersProviderIdDeleteParams,
  DeleteSettingAdminApiSettingsKeyDeleteData,
  DeleteSettingAdminApiSettingsKeyDeleteError,
  DeleteSettingAdminApiSettingsKeyDeleteParams,
  DeleteSkillCategoryAdminApiSkillCategoriesCategoryIdDeleteData,
  DeleteSkillCategoryAdminApiSkillCategoriesCategoryIdDeleteError,
  DeleteSkillCategoryAdminApiSkillCategoriesCategoryIdDeleteParams,
  DownloadConversationAdminApiConversationGetData,
  DownloadConversationAdminApiConversationGetError,
  DownloadConversationAdminApiConversationGetParams,
  DownloadSkillPackageAdminApiSkillsSkillIdDownloadGetData,
  DownloadSkillPackageAdminApiSkillsSkillIdDownloadGetError,
  DownloadSkillPackageAdminApiSkillsSkillIdDownloadGetParams,
  EnabledPayload,
  ExportRequestsAdminApiUsersUserIdRequestsExportGetData,
  ExportRequestsAdminApiUsersUserIdRequestsExportGetError,
  ExportRequestsAdminApiUsersUserIdRequestsExportGetParams,
  ExportTransactionsAdminApiUsersUserIdTransactionsExportGetData,
  ExportTransactionsAdminApiUsersUserIdTransactionsExportGetError,
  ExportTransactionsAdminApiUsersUserIdTransactionsExportGetParams,
  GetModelAdminApiModelsModelIdGetData,
  GetModelAdminApiModelsModelIdGetError,
  GetModelAdminApiModelsModelIdGetParams,
  GetProviderAdminApiProvidersProviderIdGetData,
  GetProviderAdminApiProvidersProviderIdGetError,
  GetProviderAdminApiProvidersProviderIdGetParams,
  GetSkillAdminApiSkillsSkillIdGetData,
  GetSkillAdminApiSkillsSkillIdGetError,
  GetSkillAdminApiSkillsSkillIdGetParams,
  GetUserAdminApiUsersUserIdGetData,
  GetUserAdminApiUsersUserIdGetError,
  GetUserAdminApiUsersUserIdGetParams,
  ListModelsAdminApiModelsGetData,
  ListModelsAdminApiModelsGetError,
  ListModelsAdminApiModelsGetParams,
  ListProvidersAdminApiProvidersGetData,
  ListProvidersAdminApiProvidersGetError,
  ListProvidersAdminApiProvidersGetParams,
  ListRequestsAdminApiUsersUserIdRequestsGetData,
  ListRequestsAdminApiUsersUserIdRequestsGetError,
  ListRequestsAdminApiUsersUserIdRequestsGetParams,
  ListSettingsAdminApiSettingsGetData,
  ListSettingsAdminApiSettingsGetError,
  ListSkillCategoriesAdminApiSkillCategoriesGetData,
  ListSkillCategoriesAdminApiSkillCategoriesGetError,
  ListSkillsAdminApiSkillsGetData,
  ListSkillsAdminApiSkillsGetError,
  ListTransactionsAdminApiUsersUserIdTransactionsGetData,
  ListTransactionsAdminApiUsersUserIdTransactionsGetError,
  ListTransactionsAdminApiUsersUserIdTransactionsGetParams,
  ListUploadedFilesAdminApiUsersUserIdFilesGetData,
  ListUploadedFilesAdminApiUsersUserIdFilesGetError,
  ListUploadedFilesAdminApiUsersUserIdFilesGetParams,
  ListUsersAdminApiUsersGetData,
  ListUsersAdminApiUsersGetError,
  ListUsersAdminApiUsersGetParams,
  ModelCreate,
  ModelUpdate,
  ProviderCreate,
  ProviderUpdate,
  PublishPayload,
  SetSkillCategoryEnabledAdminApiSkillCategoriesCategoryIdEnabledPutData,
  SetSkillCategoryEnabledAdminApiSkillCategoriesCategoryIdEnabledPutError,
  SetSkillCategoryEnabledAdminApiSkillCategoriesCategoryIdEnabledPutParams,
  SetSkillPublishStateAdminApiSkillsSkillIdPublishPutData,
  SetSkillPublishStateAdminApiSkillsSkillIdPublishPutError,
  SetSkillPublishStateAdminApiSkillsSkillIdPublishPutParams,
  SettingCreate,
  SettingUpdate,
  SkillCategoryCreate,
  SkillCategoryUpdate,
  SkillCreate,
  SkillUpdate,
  TotalUsageAdminApiStatsTotalUsageGetData,
  TotalUsageAdminApiStatsTotalUsageGetError,
  UpdateModelAdminApiModelsModelIdPutData,
  UpdateModelAdminApiModelsModelIdPutError,
  UpdateModelAdminApiModelsModelIdPutParams,
  UpdateProviderAdminApiProvidersProviderIdPutData,
  UpdateProviderAdminApiProvidersProviderIdPutError,
  UpdateProviderAdminApiProvidersProviderIdPutParams,
  UpdateSettingAdminApiSettingsKeyPutData,
  UpdateSettingAdminApiSettingsKeyPutError,
  UpdateSettingAdminApiSettingsKeyPutParams,
  UpdateSkillAdminApiSkillsSkillIdPutData,
  UpdateSkillAdminApiSkillsSkillIdPutError,
  UpdateSkillAdminApiSkillsSkillIdPutParams,
  UpdateSkillCategoryAdminApiSkillCategoriesCategoryIdPutData,
  UpdateSkillCategoryAdminApiSkillCategoriesCategoryIdPutError,
  UpdateSkillCategoryAdminApiSkillCategoriesCategoryIdPutParams,
  UpdateUserAdminApiUsersUserIdPutData,
  UpdateUserAdminApiUsersUserIdPutError,
  UpdateUserAdminApiUsersUserIdPutParams,
  UploadSkillCategoryIconAdminApiSkillCategoriesIconUploadPostData,
  UploadSkillCategoryIconAdminApiSkillCategoriesIconUploadPostError,
  UploadSkillIconAdminApiSkillsSkillIdIconPostData,
  UploadSkillIconAdminApiSkillsSkillIdIconPostError,
  UploadSkillIconAdminApiSkillsSkillIdIconPostParams,
  UploadSkillPackageAdminApiSkillsSkillIdUploadPostData,
  UploadSkillPackageAdminApiSkillsSkillIdUploadPostError,
  UploadSkillPackageAdminApiSkillsSkillIdUploadPostParams,
  UserUpdate,
  VerifySecretAdminApiVerifySecretPostData,
  VerifySecretAdminApiVerifySecretPostError,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class 管理后台api<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description 验证请求头 `x-admin-secret` 是否正确；成功返回 `{ code: 0, data: null, message: "ok" }`。
   *
   * @tags 管理后台
   * @name VerifySecretAdminApiVerifySecretPost
   * @summary 校验管理密钥
   * @request POST:/admin/api/verify-secret
   * @response `200` `VerifySecretAdminApiVerifySecretPostData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  verifySecretAdminApiVerifySecretPost = (params: RequestParams = {}) =>
    this.http.request<
      VerifySecretAdminApiVerifySecretPostData,
      VerifySecretAdminApiVerifySecretPostError
    >({
      path: `/admin/api/verify-secret`,
      method: "POST",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name ListProvidersAdminApiProvidersGet
   * @summary 分页列出 Provider
   * @request GET:/admin/api/providers
   * @response `200` `ListProvidersAdminApiProvidersGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  listProvidersAdminApiProvidersGet = (
    query: ListProvidersAdminApiProvidersGetParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      ListProvidersAdminApiProvidersGetData,
      ListProvidersAdminApiProvidersGetError
    >({
      path: `/admin/api/providers`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * @description 创建后自动刷新内存中的 Provider 路由缓存。
   *
   * @tags 管理后台
   * @name CreateProviderAdminApiProvidersPost
   * @summary 创建 Provider
   * @request POST:/admin/api/providers
   * @response `200` `CreateProviderAdminApiProvidersPostData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  createProviderAdminApiProvidersPost = (
    data: ProviderCreate,
    params: RequestParams = {},
  ) =>
    this.http.request<
      CreateProviderAdminApiProvidersPostData,
      CreateProviderAdminApiProvidersPostError
    >({
      path: `/admin/api/providers`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name GetProviderAdminApiProvidersProviderIdGet
   * @summary 获取单个 Provider
   * @request GET:/admin/api/providers/{provider_id}
   * @response `200` `GetProviderAdminApiProvidersProviderIdGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  getProviderAdminApiProvidersProviderIdGet = (
    { providerId }: GetProviderAdminApiProvidersProviderIdGetParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      GetProviderAdminApiProvidersProviderIdGetData,
      GetProviderAdminApiProvidersProviderIdGetError
    >({
      path: `/admin/api/providers/${providerId}`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name UpdateProviderAdminApiProvidersProviderIdPut
   * @summary 更新 Provider
   * @request PUT:/admin/api/providers/{provider_id}
   * @response `200` `UpdateProviderAdminApiProvidersProviderIdPutData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  updateProviderAdminApiProvidersProviderIdPut = (
    { providerId }: UpdateProviderAdminApiProvidersProviderIdPutParams,
    data: ProviderUpdate,
    params: RequestParams = {},
  ) =>
    this.http.request<
      UpdateProviderAdminApiProvidersProviderIdPutData,
      UpdateProviderAdminApiProvidersProviderIdPutError
    >({
      path: `/admin/api/providers/${providerId}`,
      method: "PUT",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name DeleteProviderAdminApiProvidersProviderIdDelete
   * @summary 删除 Provider
   * @request DELETE:/admin/api/providers/{provider_id}
   * @response `200` `DeleteProviderAdminApiProvidersProviderIdDeleteData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  deleteProviderAdminApiProvidersProviderIdDelete = (
    { providerId }: DeleteProviderAdminApiProvidersProviderIdDeleteParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      DeleteProviderAdminApiProvidersProviderIdDeleteData,
      DeleteProviderAdminApiProvidersProviderIdDeleteError
    >({
      path: `/admin/api/providers/${providerId}`,
      method: "DELETE",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name ListModelsAdminApiModelsGet
   * @summary 分页列出模型配置
   * @request GET:/admin/api/models
   * @response `200` `ListModelsAdminApiModelsGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  listModelsAdminApiModelsGet = (
    query: ListModelsAdminApiModelsGetParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      ListModelsAdminApiModelsGetData,
      ListModelsAdminApiModelsGetError
    >({
      path: `/admin/api/models`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * @description 创建后自动刷新内存中的模型路由缓存。
   *
   * @tags 管理后台
   * @name CreateModelAdminApiModelsPost
   * @summary 创建模型配置
   * @request POST:/admin/api/models
   * @response `200` `CreateModelAdminApiModelsPostData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  createModelAdminApiModelsPost = (
    data: ModelCreate,
    params: RequestParams = {},
  ) =>
    this.http.request<
      CreateModelAdminApiModelsPostData,
      CreateModelAdminApiModelsPostError
    >({
      path: `/admin/api/models`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name GetModelAdminApiModelsModelIdGet
   * @summary 获取单个模型配置
   * @request GET:/admin/api/models/{model_id}
   * @response `200` `GetModelAdminApiModelsModelIdGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  getModelAdminApiModelsModelIdGet = (
    { modelId }: GetModelAdminApiModelsModelIdGetParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      GetModelAdminApiModelsModelIdGetData,
      GetModelAdminApiModelsModelIdGetError
    >({
      path: `/admin/api/models/${modelId}`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name UpdateModelAdminApiModelsModelIdPut
   * @summary 更新模型配置
   * @request PUT:/admin/api/models/{model_id}
   * @response `200` `UpdateModelAdminApiModelsModelIdPutData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  updateModelAdminApiModelsModelIdPut = (
    { modelId }: UpdateModelAdminApiModelsModelIdPutParams,
    data: ModelUpdate,
    params: RequestParams = {},
  ) =>
    this.http.request<
      UpdateModelAdminApiModelsModelIdPutData,
      UpdateModelAdminApiModelsModelIdPutError
    >({
      path: `/admin/api/models/${modelId}`,
      method: "PUT",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name DeleteModelAdminApiModelsModelIdDelete
   * @summary 删除模型配置
   * @request DELETE:/admin/api/models/{model_id}
   * @response `200` `DeleteModelAdminApiModelsModelIdDeleteData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  deleteModelAdminApiModelsModelIdDelete = (
    { modelId }: DeleteModelAdminApiModelsModelIdDeleteParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      DeleteModelAdminApiModelsModelIdDeleteData,
      DeleteModelAdminApiModelsModelIdDeleteError
    >({
      path: `/admin/api/models/${modelId}`,
      method: "DELETE",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name ListUsersAdminApiUsersGet
   * @summary Paginated users
   * @request GET:/admin/api/users
   * @response `200` `ListUsersAdminApiUsersGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  listUsersAdminApiUsersGet = (
    query: ListUsersAdminApiUsersGetParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      ListUsersAdminApiUsersGetData,
      ListUsersAdminApiUsersGetError
    >({
      path: `/admin/api/users`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name GetUserAdminApiUsersUserIdGet
   * @summary Get user
   * @request GET:/admin/api/users/{user_id}
   * @response `200` `GetUserAdminApiUsersUserIdGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  getUserAdminApiUsersUserIdGet = (
    { userId }: GetUserAdminApiUsersUserIdGetParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      GetUserAdminApiUsersUserIdGetData,
      GetUserAdminApiUsersUserIdGetError
    >({
      path: `/admin/api/users/${userId}`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name UpdateUserAdminApiUsersUserIdPut
   * @summary Update user
   * @request PUT:/admin/api/users/{user_id}
   * @response `200` `UpdateUserAdminApiUsersUserIdPutData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  updateUserAdminApiUsersUserIdPut = (
    { userId }: UpdateUserAdminApiUsersUserIdPutParams,
    data: UserUpdate,
    params: RequestParams = {},
  ) =>
    this.http.request<
      UpdateUserAdminApiUsersUserIdPutData,
      UpdateUserAdminApiUsersUserIdPutError
    >({
      path: `/admin/api/users/${userId}`,
      method: "PUT",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name ListTransactionsAdminApiUsersUserIdTransactionsGet
   * @summary Paginated user transactions
   * @request GET:/admin/api/users/{user_id}/transactions
   * @response `200` `ListTransactionsAdminApiUsersUserIdTransactionsGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  listTransactionsAdminApiUsersUserIdTransactionsGet = (
    {
      userId,
      ...query
    }: ListTransactionsAdminApiUsersUserIdTransactionsGetParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      ListTransactionsAdminApiUsersUserIdTransactionsGetData,
      ListTransactionsAdminApiUsersUserIdTransactionsGetError
    >({
      path: `/admin/api/users/${userId}/transactions`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name ListRequestsAdminApiUsersUserIdRequestsGet
   * @summary Paginated user requests
   * @request GET:/admin/api/users/{user_id}/requests
   * @response `200` `ListRequestsAdminApiUsersUserIdRequestsGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  listRequestsAdminApiUsersUserIdRequestsGet = (
    { userId, ...query }: ListRequestsAdminApiUsersUserIdRequestsGetParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      ListRequestsAdminApiUsersUserIdRequestsGetData,
      ListRequestsAdminApiUsersUserIdRequestsGetError
    >({
      path: `/admin/api/users/${userId}/requests`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name ListUploadedFilesAdminApiUsersUserIdFilesGet
   * @summary Paginated user uploaded files
   * @request GET:/admin/api/users/{user_id}/files
   * @response `200` `ListUploadedFilesAdminApiUsersUserIdFilesGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  listUploadedFilesAdminApiUsersUserIdFilesGet = (
    { userId, ...query }: ListUploadedFilesAdminApiUsersUserIdFilesGetParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      ListUploadedFilesAdminApiUsersUserIdFilesGetData,
      ListUploadedFilesAdminApiUsersUserIdFilesGetError
    >({
      path: `/admin/api/users/${userId}/files`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name ExportTransactionsAdminApiUsersUserIdTransactionsExportGet
   * @summary Export transactions CSV
   * @request GET:/admin/api/users/{user_id}/transactions/export
   * @response `200` `ExportTransactionsAdminApiUsersUserIdTransactionsExportGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  exportTransactionsAdminApiUsersUserIdTransactionsExportGet = (
    {
      userId,
    }: ExportTransactionsAdminApiUsersUserIdTransactionsExportGetParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      ExportTransactionsAdminApiUsersUserIdTransactionsExportGetData,
      ExportTransactionsAdminApiUsersUserIdTransactionsExportGetError
    >({
      path: `/admin/api/users/${userId}/transactions/export`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name ExportRequestsAdminApiUsersUserIdRequestsExportGet
   * @summary Export requests CSV
   * @request GET:/admin/api/users/{user_id}/requests/export
   * @response `200` `ExportRequestsAdminApiUsersUserIdRequestsExportGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  exportRequestsAdminApiUsersUserIdRequestsExportGet = (
    { userId }: ExportRequestsAdminApiUsersUserIdRequestsExportGetParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      ExportRequestsAdminApiUsersUserIdRequestsExportGetData,
      ExportRequestsAdminApiUsersUserIdRequestsExportGetError
    >({
      path: `/admin/api/users/${userId}/requests/export`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * @description 汇总所有用户的余额、累计消费等聚合指标，供管理后台仪表盘使用。
   *
   * @tags 管理后台
   * @name TotalUsageAdminApiStatsTotalUsageGet
   * @summary 全站用量统计
   * @request GET:/admin/api/stats/total-usage
   * @response `200` `TotalUsageAdminApiStatsTotalUsageGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  totalUsageAdminApiStatsTotalUsageGet = (params: RequestParams = {}) =>
    this.http.request<
      TotalUsageAdminApiStatsTotalUsageGetData,
      TotalUsageAdminApiStatsTotalUsageGetError
    >({
      path: `/admin/api/stats/total-usage`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * @description 通过 `request_id` 或 `path`（从路径末段解析 request_id）下载完整请求/响应日志。
   *
   * @tags 管理后台
   * @name DownloadConversationAdminApiConversationGet
   * @summary 下载单次对话 JSONL
   * @request GET:/admin/api/conversation
   * @response `200` `DownloadConversationAdminApiConversationGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  downloadConversationAdminApiConversationGet = (
    query: DownloadConversationAdminApiConversationGetParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      DownloadConversationAdminApiConversationGetData,
      DownloadConversationAdminApiConversationGetError
    >({
      path: `/admin/api/conversation`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name ListSettingsAdminApiSettingsGet
   * @summary 列出所有系统配置
   * @request GET:/admin/api/settings
   * @response `200` `ListSettingsAdminApiSettingsGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  listSettingsAdminApiSettingsGet = (params: RequestParams = {}) =>
    this.http.request<
      ListSettingsAdminApiSettingsGetData,
      ListSettingsAdminApiSettingsGetError
    >({
      path: `/admin/api/settings`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name CreateSettingAdminApiSettingsPost
   * @summary 创建系统配置项
   * @request POST:/admin/api/settings
   * @response `200` `CreateSettingAdminApiSettingsPostData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  createSettingAdminApiSettingsPost = (
    data: SettingCreate,
    params: RequestParams = {},
  ) =>
    this.http.request<
      CreateSettingAdminApiSettingsPostData,
      CreateSettingAdminApiSettingsPostError
    >({
      path: `/admin/api/settings`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name UpdateSettingAdminApiSettingsKeyPut
   * @summary 修改系统配置项
   * @request PUT:/admin/api/settings/{key}
   * @response `200` `UpdateSettingAdminApiSettingsKeyPutData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  updateSettingAdminApiSettingsKeyPut = (
    { key }: UpdateSettingAdminApiSettingsKeyPutParams,
    data: SettingUpdate,
    params: RequestParams = {},
  ) =>
    this.http.request<
      UpdateSettingAdminApiSettingsKeyPutData,
      UpdateSettingAdminApiSettingsKeyPutError
    >({
      path: `/admin/api/settings/${key}`,
      method: "PUT",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name DeleteSettingAdminApiSettingsKeyDelete
   * @summary 删除系统配置项
   * @request DELETE:/admin/api/settings/{key}
   * @response `200` `DeleteSettingAdminApiSettingsKeyDeleteData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  deleteSettingAdminApiSettingsKeyDelete = (
    { key }: DeleteSettingAdminApiSettingsKeyDeleteParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      DeleteSettingAdminApiSettingsKeyDeleteData,
      DeleteSettingAdminApiSettingsKeyDeleteError
    >({
      path: `/admin/api/settings/${key}`,
      method: "DELETE",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name ListSkillCategoriesAdminApiSkillCategoriesGet
   * @summary List skill categories
   * @request GET:/admin/api/skill-categories
   * @response `200` `ListSkillCategoriesAdminApiSkillCategoriesGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  listSkillCategoriesAdminApiSkillCategoriesGet = (
    params: RequestParams = {},
  ) =>
    this.http.request<
      ListSkillCategoriesAdminApiSkillCategoriesGetData,
      ListSkillCategoriesAdminApiSkillCategoriesGetError
    >({
      path: `/admin/api/skill-categories`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name CreateSkillCategoryAdminApiSkillCategoriesPost
   * @summary Create skill category
   * @request POST:/admin/api/skill-categories
   * @response `200` `CreateSkillCategoryAdminApiSkillCategoriesPostData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  createSkillCategoryAdminApiSkillCategoriesPost = (
    data: SkillCategoryCreate,
    params: RequestParams = {},
  ) =>
    this.http.request<
      CreateSkillCategoryAdminApiSkillCategoriesPostData,
      CreateSkillCategoryAdminApiSkillCategoriesPostError
    >({
      path: `/admin/api/skill-categories`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name UploadSkillCategoryIconAdminApiSkillCategoriesIconUploadPost
   * @summary Upload skill category icon to OSS
   * @request POST:/admin/api/skill-categories/icon/upload
   * @response `200` `UploadSkillCategoryIconAdminApiSkillCategoriesIconUploadPostData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  uploadSkillCategoryIconAdminApiSkillCategoriesIconUploadPost = (
    data: BodyUploadSkillCategoryIconAdminApiSkillCategoriesIconUploadPost,
    params: RequestParams = {},
  ) =>
    this.http.request<
      UploadSkillCategoryIconAdminApiSkillCategoriesIconUploadPostData,
      UploadSkillCategoryIconAdminApiSkillCategoriesIconUploadPostError
    >({
      path: `/admin/api/skill-categories/icon/upload`,
      method: "POST",
      body: data,
      type: ContentType.FormData,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name UpdateSkillCategoryAdminApiSkillCategoriesCategoryIdPut
   * @summary Update skill category
   * @request PUT:/admin/api/skill-categories/{category_id}
   * @response `200` `UpdateSkillCategoryAdminApiSkillCategoriesCategoryIdPutData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  updateSkillCategoryAdminApiSkillCategoriesCategoryIdPut = (
    {
      categoryId,
    }: UpdateSkillCategoryAdminApiSkillCategoriesCategoryIdPutParams,
    data: SkillCategoryUpdate,
    params: RequestParams = {},
  ) =>
    this.http.request<
      UpdateSkillCategoryAdminApiSkillCategoriesCategoryIdPutData,
      UpdateSkillCategoryAdminApiSkillCategoriesCategoryIdPutError
    >({
      path: `/admin/api/skill-categories/${categoryId}`,
      method: "PUT",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name DeleteSkillCategoryAdminApiSkillCategoriesCategoryIdDelete
   * @summary Delete skill category
   * @request DELETE:/admin/api/skill-categories/{category_id}
   * @response `200` `DeleteSkillCategoryAdminApiSkillCategoriesCategoryIdDeleteData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  deleteSkillCategoryAdminApiSkillCategoriesCategoryIdDelete = (
    {
      categoryId,
    }: DeleteSkillCategoryAdminApiSkillCategoriesCategoryIdDeleteParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      DeleteSkillCategoryAdminApiSkillCategoriesCategoryIdDeleteData,
      DeleteSkillCategoryAdminApiSkillCategoriesCategoryIdDeleteError
    >({
      path: `/admin/api/skill-categories/${categoryId}`,
      method: "DELETE",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name SetSkillCategoryEnabledAdminApiSkillCategoriesCategoryIdEnabledPut
   * @summary Toggle skill category enabled
   * @request PUT:/admin/api/skill-categories/{category_id}/enabled
   * @response `200` `SetSkillCategoryEnabledAdminApiSkillCategoriesCategoryIdEnabledPutData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  setSkillCategoryEnabledAdminApiSkillCategoriesCategoryIdEnabledPut = (
    {
      categoryId,
    }: SetSkillCategoryEnabledAdminApiSkillCategoriesCategoryIdEnabledPutParams,
    data: EnabledPayload,
    params: RequestParams = {},
  ) =>
    this.http.request<
      SetSkillCategoryEnabledAdminApiSkillCategoriesCategoryIdEnabledPutData,
      SetSkillCategoryEnabledAdminApiSkillCategoriesCategoryIdEnabledPutError
    >({
      path: `/admin/api/skill-categories/${categoryId}/enabled`,
      method: "PUT",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name ListSkillsAdminApiSkillsGet
   * @summary List skills
   * @request GET:/admin/api/skills
   * @response `200` `ListSkillsAdminApiSkillsGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  listSkillsAdminApiSkillsGet = (params: RequestParams = {}) =>
    this.http.request<
      ListSkillsAdminApiSkillsGetData,
      ListSkillsAdminApiSkillsGetError
    >({
      path: `/admin/api/skills`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name CreateSkillAdminApiSkillsPost
   * @summary Create skill
   * @request POST:/admin/api/skills
   * @response `200` `CreateSkillAdminApiSkillsPostData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  createSkillAdminApiSkillsPost = (
    data: SkillCreate,
    params: RequestParams = {},
  ) =>
    this.http.request<
      CreateSkillAdminApiSkillsPostData,
      CreateSkillAdminApiSkillsPostError
    >({
      path: `/admin/api/skills`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name GetSkillAdminApiSkillsSkillIdGet
   * @summary Get skill
   * @request GET:/admin/api/skills/{skill_id}
   * @response `200` `GetSkillAdminApiSkillsSkillIdGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  getSkillAdminApiSkillsSkillIdGet = (
    { skillId }: GetSkillAdminApiSkillsSkillIdGetParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      GetSkillAdminApiSkillsSkillIdGetData,
      GetSkillAdminApiSkillsSkillIdGetError
    >({
      path: `/admin/api/skills/${skillId}`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name UpdateSkillAdminApiSkillsSkillIdPut
   * @summary Update skill
   * @request PUT:/admin/api/skills/{skill_id}
   * @response `200` `UpdateSkillAdminApiSkillsSkillIdPutData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  updateSkillAdminApiSkillsSkillIdPut = (
    { skillId }: UpdateSkillAdminApiSkillsSkillIdPutParams,
    data: SkillUpdate,
    params: RequestParams = {},
  ) =>
    this.http.request<
      UpdateSkillAdminApiSkillsSkillIdPutData,
      UpdateSkillAdminApiSkillsSkillIdPutError
    >({
      path: `/admin/api/skills/${skillId}`,
      method: "PUT",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name SetSkillPublishStateAdminApiSkillsSkillIdPublishPut
   * @summary Toggle skill publish state
   * @request PUT:/admin/api/skills/{skill_id}/publish
   * @response `200` `SetSkillPublishStateAdminApiSkillsSkillIdPublishPutData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  setSkillPublishStateAdminApiSkillsSkillIdPublishPut = (
    { skillId }: SetSkillPublishStateAdminApiSkillsSkillIdPublishPutParams,
    data: PublishPayload,
    params: RequestParams = {},
  ) =>
    this.http.request<
      SetSkillPublishStateAdminApiSkillsSkillIdPublishPutData,
      SetSkillPublishStateAdminApiSkillsSkillIdPublishPutError
    >({
      path: `/admin/api/skills/${skillId}/publish`,
      method: "PUT",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name UploadSkillPackageAdminApiSkillsSkillIdUploadPost
   * @summary Upload skill package
   * @request POST:/admin/api/skills/{skill_id}/upload
   * @response `200` `UploadSkillPackageAdminApiSkillsSkillIdUploadPostData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  uploadSkillPackageAdminApiSkillsSkillIdUploadPost = (
    { skillId }: UploadSkillPackageAdminApiSkillsSkillIdUploadPostParams,
    data: BodyUploadSkillPackageAdminApiSkillsSkillIdUploadPost,
    params: RequestParams = {},
  ) =>
    this.http.request<
      UploadSkillPackageAdminApiSkillsSkillIdUploadPostData,
      UploadSkillPackageAdminApiSkillsSkillIdUploadPostError
    >({
      path: `/admin/api/skills/${skillId}/upload`,
      method: "POST",
      body: data,
      type: ContentType.FormData,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name UploadSkillIconAdminApiSkillsSkillIdIconPost
   * @summary Upload skill icon
   * @request POST:/admin/api/skills/{skill_id}/icon
   * @response `200` `UploadSkillIconAdminApiSkillsSkillIdIconPostData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  uploadSkillIconAdminApiSkillsSkillIdIconPost = (
    { skillId }: UploadSkillIconAdminApiSkillsSkillIdIconPostParams,
    data: BodyUploadSkillIconAdminApiSkillsSkillIdIconPost,
    params: RequestParams = {},
  ) =>
    this.http.request<
      UploadSkillIconAdminApiSkillsSkillIdIconPostData,
      UploadSkillIconAdminApiSkillsSkillIdIconPostError
    >({
      path: `/admin/api/skills/${skillId}/icon`,
      method: "POST",
      body: data,
      type: ContentType.FormData,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags 管理后台
   * @name DownloadSkillPackageAdminApiSkillsSkillIdDownloadGet
   * @summary Download current skill package
   * @request GET:/admin/api/skills/{skill_id}/download
   * @response `200` `DownloadSkillPackageAdminApiSkillsSkillIdDownloadGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  downloadSkillPackageAdminApiSkillsSkillIdDownloadGet = (
    { skillId }: DownloadSkillPackageAdminApiSkillsSkillIdDownloadGetParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      DownloadSkillPackageAdminApiSkillsSkillIdDownloadGetData,
      DownloadSkillPackageAdminApiSkillsSkillIdDownloadGetError
    >({
      path: `/admin/api/skills/${skillId}/download`,
      method: "GET",
      format: "json",
      ...params,
    });
}
