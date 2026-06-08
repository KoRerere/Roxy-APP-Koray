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

/** Body_upload_file_v1_files_upload_post */
export interface BodyUploadFileV1FilesUploadPost {
  /**
   * File
   * @format binary
   */
  file: File;
}

/** Body_upload_file_v2_v2_files_upload_post */
export interface BodyUploadFileV2V2FilesUploadPost {
  /**
   * File
   * @format binary
   */
  file: File;
}

/** Body_upload_skill_category_icon_admin_api_skill_categories_icon_upload_post */
export interface BodyUploadSkillCategoryIconAdminApiSkillCategoriesIconUploadPost {
  /**
   * File
   * @format binary
   */
  file: File;
}

/** Body_upload_skill_icon_admin_api_skills__skill_id__icon_post */
export interface BodyUploadSkillIconAdminApiSkillsSkillIdIconPost {
  /**
   * File
   * @format binary
   */
  file: File;
}

/** Body_upload_skill_package_admin_api_skills__skill_id__upload_post */
export interface BodyUploadSkillPackageAdminApiSkillsSkillIdUploadPost {
  /**
   * File
   * @format binary
   */
  file: File;
  /** Release Notes */
  release_notes?: string | null;
}

/** EnabledPayload */
export interface EnabledPayload {
  /** Enabled */
  enabled: boolean;
}

/** HTTPValidationError */
export interface HTTPValidationError {
  /** Detail */
  detail?: ValidationError[];
}

/** ModelCreate */
export interface ModelCreate {
  /**
   * Name
   * 模型标识，与客户端请求中的 model 字段一致
   */
  name: string;
  /**
   * Alias
   * 模型展示别名，仅用于前端显示
   */
  alias?: string | null;
  /**
   * Provider Id
   * 所属 Provider 的数据库 ID
   */
  provider_id: number;
  /**
   * Input Price
   * 输入单价（每百万 Token）
   * @default 0
   */
  input_price?: number;
  /**
   * Cache Hit Price
   * 缓存命中输入单价（每百万 Token）
   * @default 0
   */
  cache_hit_price?: number;
  /**
   * Output Price
   * 输出单价（每百万 Token）
   * @default 0
   */
  output_price?: number;
  /**
   * Image Price
   * 生图每张单价；0 表示按 Token 单价计费
   * @default 0
   */
  image_price?: number;
  /**
   * Image Price Micros
   * 生图每张单价 micros（可直接写入 DB）；与 image_price 同时传时以 image_price 为准
   */
  image_price_micros?: number | null;
  /**
   * Currency
   * 计价货币：USD 或 CNY（CNY 会按汇率折算）
   * @default "USD"
   */
  currency?: string;
  /**
   * Api Format
   * API 格式：openai 或 anthropic
   * @default "openai"
   */
  api_format?: string;
  /**
   * Modality
   * 模型能力：chat / image / vlm / video
   * @default "chat"
   */
  modality?: string;
  /**
   * Image Delivery Mode
   * 图片返回模式：async_poll=先返回轮询地址；sync_url=首响应直接返回图片 URL/数据
   * @default "async_poll"
   */
  image_delivery_mode?: string;
  /**
   * Endpoint Path
   * 覆盖上游请求路径，如 /v1/images/generations
   */
  endpoint_path?: string | null;
  /**
   * Enabled
   * 是否在 /v1/models 与路由中可见
   * @default true
   */
  enabled?: boolean;
}

/** ModelUpdate */
export interface ModelUpdate {
  /**
   * Name
   * 模型标识
   */
  name?: string | null;
  /**
   * Alias
   * 模型展示别名，仅用于前端显示
   */
  alias?: string | null;
  /**
   * Provider Id
   * 所属 Provider ID
   */
  provider_id?: number | null;
  /**
   * Input Price
   * 输入单价（每百万 Token）
   */
  input_price?: number | null;
  /**
   * Cache Hit Price
   * 缓存命中输入单价（每百万 Token）
   */
  cache_hit_price?: number | null;
  /**
   * Output Price
   * 输出单价（每百万 Token）
   */
  output_price?: number | null;
  /**
   * Image Price
   * 生图每张单价；0 表示按 Token 单价计费
   */
  image_price?: number | null;
  /**
   * Image Price Micros
   * 生图每张单价 micros（可直接写入 DB）；与 image_price 同时传时以 image_price 为准
   */
  image_price_micros?: number | null;
  /**
   * Currency
   * 计价货币
   */
  currency?: string | null;
  /**
   * Api Format
   * API 格式
   */
  api_format?: string | null;
  /**
   * Modality
   * 模型能力：chat / image / vlm / video
   */
  modality?: string | null;
  /**
   * Image Delivery Mode
   * 图片返回模式：async_poll / sync_url
   */
  image_delivery_mode?: string | null;
  /**
   * Endpoint Path
   * 覆盖上游请求路径
   */
  endpoint_path?: string | null;
  /**
   * Enabled
   * 是否启用
   */
  enabled?: boolean | null;
}

/** ProviderCreate */
export interface ProviderCreate {
  /**
   * Name
   * Provider 唯一名称
   */
  name: string;
  /**
   * Base Url
   * 上游 API 根地址，如 https://api.openai.com/v1
   */
  base_url: string;
  /**
   * Api Key
   * 访问上游的 API Key
   * @default ""
   */
  api_key?: string;
  /**
   * Enabled
   * 是否参与路由（按 priority 选最高优先级）
   * @default true
   */
  enabled?: boolean;
  /**
   * Priority
   * 优先级，数值越大越优先
   * @default 0
   */
  priority?: number;
}

/** ProviderUpdate */
export interface ProviderUpdate {
  /**
   * Name
   * Provider 名称
   */
  name?: string | null;
  /**
   * Base Url
   * 上游 API 根地址
   */
  base_url?: string | null;
  /**
   * Api Key
   * API Key
   */
  api_key?: string | null;
  /**
   * Enabled
   * 是否启用
   */
  enabled?: boolean | null;
  /**
   * Priority
   * 路由优先级
   */
  priority?: number | null;
}

/** PublishPayload */
export interface PublishPayload {
  /** Published */
  published: boolean;
}

/** SettingCreate */
export interface SettingCreate {
  /**
   * Key
   * @minLength 1
   * @maxLength 128
   */
  key: string;
  /** Value */
  value?: string | null;
  /** Description */
  description?: string | null;
}

/** SettingUpdate */
export interface SettingUpdate {
  /** Value */
  value?: string | null;
  /** Description */
  description?: string | null;
}

/** SkillCategoryCreate */
export interface SkillCategoryCreate {
  /**
   * Slug
   * @minLength 1
   * @maxLength 128
   */
  slug: string;
  /** Name */
  name: Record<string, string>;
  /** Iconinfo */
  iconInfo?: Record<string, any> | null;
  /**
   * Sort Order
   * @default 0
   */
  sort_order?: number;
  /**
   * Enabled
   * @default true
   */
  enabled?: boolean;
}

/** SkillCategoryUpdate */
export interface SkillCategoryUpdate {
  /** Slug */
  slug?: string | null;
  /** Name */
  name?: Record<string, string> | null;
  /** Iconinfo */
  iconInfo?: Record<string, any> | null;
  /** Sort Order */
  sort_order?: number | null;
  /** Enabled */
  enabled?: boolean | null;
}

/** SkillCreate */
export interface SkillCreate {
  /** Category Id */
  category_id: number;
  /**
   * Slug
   * @minLength 1
   * @maxLength 128
   */
  slug: string;
  /**
   * Name
   * @minLength 1
   * @maxLength 128
   */
  name: string;
  /** Title */
  title: Record<string, string>;
  /** Description */
  description?: Record<string, string> | null;
  /**
   * Published
   * @default false
   */
  published?: boolean;
}

/** SkillUpdate */
export interface SkillUpdate {
  /** Category Id */
  category_id?: number | null;
  /** Slug */
  slug?: string | null;
  /** Name */
  name?: string | null;
  /** Title */
  title?: Record<string, string> | null;
  /** Description */
  description?: Record<string, string> | null;
  /** Published */
  published?: boolean | null;
}

/** UserModelSwitchPayload */
export interface UserModelSwitchPayload {
  /**
   * Model Type
   * 模型类型
   */
  model_type: UserModelSwitchPayloadModelTypeEnum;
  /**
   * Model
   * 目标模型名；传 null 或空字符串时清除用户绑定并回退到系统默认模型
   */
  model: string | null;
}

/** UserUpdate */
export interface UserUpdate {
  /**
   * Balance
   * Updated account balance in USD
   */
  balance?: number | null;
  /**
   * Balancedescription
   * Optional adjustment note
   */
  balanceDescription?: string | null;
  /**
   * Username
   * Display name
   */
  userName?: string | null;
  /**
   * Phone
   * Phone
   */
  phone?: string | null;
  /**
   * Email
   * Email
   */
  email?: string | null;
  /**
   * Model
   * Legacy default model binding
   */
  model?: string | null;
  /**
   * Textmodel
   * Text model
   */
  textModel?: string | null;
  /**
   * Imagemodel
   * Image model
   */
  imageModel?: string | null;
  /**
   * Vlmmodel
   * VLM model
   */
  vlmModel?: string | null;
  /**
   * Videomodel
   * Video model
   */
  videoModel?: string | null;
  /**
   * Imagequota
   * Remaining image quota
   */
  imageQuota?: number | null;
}

/** ValidationError */
export interface ValidationError {
  /** Location */
  loc: (string | number)[];
  /** Message */
  msg: string;
  /** Error Type */
  type: string;
  /** Input */
  input?: any;
  /** Context */
  ctx?: object;
}

/**
 * Model Type
 * 模型类型
 */
export enum UserModelSwitchPayloadModelTypeEnum {
  TextModel = "text_model",
  ImageModel = "image_model",
  VlmModel = "vlm_model",
  VideoModel = "video_model",
}

export type HealthHealthGetData = any;

export type AdminRedirectAdminGetData = any;

export type ChatCompletionsV1ChatCompletionsPostData = any;

export type ChatCompletionsV1ChatCompletionsPostError = HTTPValidationError;

export type ImageGenerationsV1ImagesGenerationsPostData = any;

export type ImageGenerationsV1ImagesGenerationsPostError = HTTPValidationError;

export type ImageEditsV1ImagesEditsPostData = any;

export type ImageEditsV1ImagesEditsPostError = HTTPValidationError;

export type AnthropicMessagesV1MessagesPostData = any;

export type AnthropicMessagesV1MessagesPostError = HTTPValidationError;

export type ListModelsV1ModelsGetData = any;

export type GetUserModelV1UserModelGetData = any;

export type GetUserModelV1UserModelGetError = HTTPValidationError;

export type SwitchUserModelV1UserModelPutData = any;

export type SwitchUserModelV1UserModelPutError = HTTPValidationError;

export interface ListUserModelOptionsV1UserModelOptionsGetParams {
  /**
   * Model Type
   * 模型类型：text_model / image_model / vlm_model / video_model
   */
  model_type: ModelTypeEnum;
}

/**
 * Model Type
 * 模型类型：text_model / image_model / vlm_model / video_model
 */
export enum ModelTypeEnum {
  TextModel = "text_model",
  ImageModel = "image_model",
  VlmModel = "vlm_model",
  VideoModel = "video_model",
}

export type ListUserModelOptionsV1UserModelOptionsGetData = any;

export type ListUserModelOptionsV1UserModelOptionsGetError =
  HTTPValidationError;

/**
 * Model Type
 * 模型类型：text_model / image_model / vlm_model / video_model
 */
export enum ListUserModelOptionsV1UserModelOptionsGetParams1ModelTypeEnum {
  TextModel = "text_model",
  ImageModel = "image_model",
  VlmModel = "vlm_model",
  VideoModel = "video_model",
}

export type ListSkillCategoriesV1SkillCategoriesGetData = any;

export type ListSkillCategoriesV1SkillCategoriesGetError = HTTPValidationError;

export interface ListSkillsV1SkillsGetParams {
  /**
   * Category
   * Category slug
   */
  category?: string | null;
}

export type ListSkillsV1SkillsGetData = any;

export type ListSkillsV1SkillsGetError = HTTPValidationError;

export interface GetSkillV1SkillsSlugGetParams {
  /** Slug */
  slug: string;
}

export type GetSkillV1SkillsSlugGetData = any;

export type GetSkillV1SkillsSlugGetError = HTTPValidationError;

export interface DownloadSkillV1SkillsSlugDownloadGetParams {
  /** Slug */
  slug: string;
}

export type DownloadSkillV1SkillsSlugDownloadGetData = any;

export type DownloadSkillV1SkillsSlugDownloadGetError = HTTPValidationError;

export type ListUserSkillsV1UserSkillsGetData = any;

export type ListUserSkillsV1UserSkillsGetError = HTTPValidationError;

export interface InstallSkillV1UserSkillsSlugInstallPostParams {
  /** Slug */
  slug: string;
}

export type InstallSkillV1UserSkillsSlugInstallPostData = any;

export type InstallSkillV1UserSkillsSlugInstallPostError = HTTPValidationError;

export interface SetInstalledSkillEnabledV1UserSkillsSlugEnabledPutParams {
  /** Slug */
  slug: string;
}

export type SetInstalledSkillEnabledV1UserSkillsSlugEnabledPutData = any;

export type SetInstalledSkillEnabledV1UserSkillsSlugEnabledPutError =
  HTTPValidationError;

export interface RemoveInstalledSkillV1UserSkillsSlugDeleteParams {
  /** Slug */
  slug: string;
}

export type RemoveInstalledSkillV1UserSkillsSlugDeleteData = any;

export type RemoveInstalledSkillV1UserSkillsSlugDeleteError =
  HTTPValidationError;

export type UploadFileV1FilesUploadPostData = any;

export type UploadFileV1FilesUploadPostError = HTTPValidationError;

export interface GetFileV1FilesFileIdGetParams {
  /** File Id */
  fileId: string;
}

export type GetFileV1FilesFileIdGetData = any;

export type GetFileV1FilesFileIdGetError = HTTPValidationError;

export type UploadFileV2V2FilesUploadPostData = any;

export type UploadFileV2V2FilesUploadPostError = HTTPValidationError;

export interface GetFileV2V2FilesFileIdGetParams {
  /** File Id */
  fileId: string;
}

export type GetFileV2V2FilesFileIdGetData = any;

export type GetFileV2V2FilesFileIdGetError = HTTPValidationError;

export type VerifySecretAdminApiVerifySecretPostData = any;

export type VerifySecretAdminApiVerifySecretPostError = HTTPValidationError;

export interface ListProvidersAdminApiProvidersGetParams {
  /**
   * Limit
   * 每页条数
   * @min 1
   * @max 200
   * @default 20
   */
  limit?: number;
  /**
   * Offset
   * 偏移量
   * @min 0
   * @default 0
   */
  offset?: number;
  /**
   * Search
   * 按名称或 ID 模糊搜索
   */
  search?: string | null;
  /**
   * Sortby
   * 排序字段：priority / name / created_at
   */
  sortBy?: string | null;
  /**
   * Sortorder
   * 排序方向：asc / desc
   */
  sortOrder?: string | null;
}

export type ListProvidersAdminApiProvidersGetData = any;

export type ListProvidersAdminApiProvidersGetError = HTTPValidationError;

export type CreateProviderAdminApiProvidersPostData = any;

export type CreateProviderAdminApiProvidersPostError = HTTPValidationError;

export interface GetProviderAdminApiProvidersProviderIdGetParams {
  /** Provider Id */
  providerId: number;
}

export type GetProviderAdminApiProvidersProviderIdGetData = any;

export type GetProviderAdminApiProvidersProviderIdGetError =
  HTTPValidationError;

export interface UpdateProviderAdminApiProvidersProviderIdPutParams {
  /** Provider Id */
  providerId: number;
}

export type UpdateProviderAdminApiProvidersProviderIdPutData = any;

export type UpdateProviderAdminApiProvidersProviderIdPutError =
  HTTPValidationError;

export interface DeleteProviderAdminApiProvidersProviderIdDeleteParams {
  /** Provider Id */
  providerId: number;
}

export type DeleteProviderAdminApiProvidersProviderIdDeleteData = any;

export type DeleteProviderAdminApiProvidersProviderIdDeleteError =
  HTTPValidationError;

export interface ListModelsAdminApiModelsGetParams {
  /**
   * Limit
   * 每页条数
   * @min 1
   * @max 200
   * @default 20
   */
  limit?: number;
  /**
   * Offset
   * 偏移量
   * @min 0
   * @default 0
   */
  offset?: number;
  /**
   * Search
   * 按模型名或 ID 模糊搜索
   */
  search?: string | null;
  /**
   * Providerid
   * 按 Provider ID 筛选
   */
  providerId?: number | null;
  /**
   * Sortby
   * 排序字段：name / provider_id / created_at
   */
  sortBy?: string | null;
  /**
   * Sortorder
   * 排序方向：asc / desc
   */
  sortOrder?: string | null;
}

export type ListModelsAdminApiModelsGetData = any;

export type ListModelsAdminApiModelsGetError = HTTPValidationError;

export type CreateModelAdminApiModelsPostData = any;

export type CreateModelAdminApiModelsPostError = HTTPValidationError;

export interface GetModelAdminApiModelsModelIdGetParams {
  /** Model Id */
  modelId: number;
}

export type GetModelAdminApiModelsModelIdGetData = any;

export type GetModelAdminApiModelsModelIdGetError = HTTPValidationError;

export interface UpdateModelAdminApiModelsModelIdPutParams {
  /** Model Id */
  modelId: number;
}

export type UpdateModelAdminApiModelsModelIdPutData = any;

export type UpdateModelAdminApiModelsModelIdPutError = HTTPValidationError;

export interface DeleteModelAdminApiModelsModelIdDeleteParams {
  /** Model Id */
  modelId: number;
}

export type DeleteModelAdminApiModelsModelIdDeleteData = any;

export type DeleteModelAdminApiModelsModelIdDeleteError = HTTPValidationError;

export interface ListUsersAdminApiUsersGetParams {
  /**
   * Limit
   * Page size
   * @default 20
   */
  limit?: number;
  /**
   * Offset
   * Offset
   * @default 0
   */
  offset?: number;
  /**
   * Search
   * Search by user_id, name, phone, email
   */
  search?: string | null;
  /**
   * Sortby
   * Sort field
   */
  sortBy?: string | null;
  /**
   * Sortorder
   * Sort direction
   */
  sortOrder?: string | null;
}

export type ListUsersAdminApiUsersGetData = any;

export type ListUsersAdminApiUsersGetError = HTTPValidationError;

export interface GetUserAdminApiUsersUserIdGetParams {
  /** User Id */
  userId: string;
}

export type GetUserAdminApiUsersUserIdGetData = any;

export type GetUserAdminApiUsersUserIdGetError = HTTPValidationError;

export interface UpdateUserAdminApiUsersUserIdPutParams {
  /** User Id */
  userId: string;
}

export type UpdateUserAdminApiUsersUserIdPutData = any;

export type UpdateUserAdminApiUsersUserIdPutError = HTTPValidationError;

export interface ListTransactionsAdminApiUsersUserIdTransactionsGetParams {
  /**
   * Limit
   * Page size
   * @default 20
   */
  limit?: number;
  /**
   * Offset
   * Offset
   * @default 0
   */
  offset?: number;
  /** User Id */
  userId: string;
}

export type ListTransactionsAdminApiUsersUserIdTransactionsGetData = any;

export type ListTransactionsAdminApiUsersUserIdTransactionsGetError =
  HTTPValidationError;

export interface ListRequestsAdminApiUsersUserIdRequestsGetParams {
  /**
   * Limit
   * Page size
   * @default 20
   */
  limit?: number;
  /**
   * Offset
   * Offset
   * @default 0
   */
  offset?: number;
  /** User Id */
  userId: string;
}

export type ListRequestsAdminApiUsersUserIdRequestsGetData = any;

export type ListRequestsAdminApiUsersUserIdRequestsGetError =
  HTTPValidationError;

export interface ListUploadedFilesAdminApiUsersUserIdFilesGetParams {
  /**
   * Limit
   * Page size
   * @default 20
   */
  limit?: number;
  /**
   * Offset
   * Offset
   * @default 0
   */
  offset?: number;
  /** User Id */
  userId: string;
}

export type ListUploadedFilesAdminApiUsersUserIdFilesGetData = any;

export type ListUploadedFilesAdminApiUsersUserIdFilesGetError =
  HTTPValidationError;

export interface ExportTransactionsAdminApiUsersUserIdTransactionsExportGetParams {
  /** User Id */
  userId: string;
}

export type ExportTransactionsAdminApiUsersUserIdTransactionsExportGetData =
  any;

export type ExportTransactionsAdminApiUsersUserIdTransactionsExportGetError =
  HTTPValidationError;

export interface ExportRequestsAdminApiUsersUserIdRequestsExportGetParams {
  /** User Id */
  userId: string;
}

export type ExportRequestsAdminApiUsersUserIdRequestsExportGetData = any;

export type ExportRequestsAdminApiUsersUserIdRequestsExportGetError =
  HTTPValidationError;

export type TotalUsageAdminApiStatsTotalUsageGetData = any;

export type TotalUsageAdminApiStatsTotalUsageGetError = HTTPValidationError;

export interface DownloadConversationAdminApiConversationGetParams {
  /**
   * Path
   * 对话文件路径，将解析末段作为 request_id
   */
  path?: string | null;
  /**
   * Request Id
   * 请求 UUID
   */
  request_id?: string | null;
}

export type DownloadConversationAdminApiConversationGetData = any;

export type DownloadConversationAdminApiConversationGetError =
  HTTPValidationError;

export type ListSettingsAdminApiSettingsGetData = any;

export type ListSettingsAdminApiSettingsGetError = HTTPValidationError;

export type CreateSettingAdminApiSettingsPostData = any;

export type CreateSettingAdminApiSettingsPostError = HTTPValidationError;

export interface UpdateSettingAdminApiSettingsKeyPutParams {
  /** Key */
  key: string;
}

export type UpdateSettingAdminApiSettingsKeyPutData = any;

export type UpdateSettingAdminApiSettingsKeyPutError = HTTPValidationError;

export interface DeleteSettingAdminApiSettingsKeyDeleteParams {
  /** Key */
  key: string;
}

export type DeleteSettingAdminApiSettingsKeyDeleteData = any;

export type DeleteSettingAdminApiSettingsKeyDeleteError = HTTPValidationError;

export type ListSkillCategoriesAdminApiSkillCategoriesGetData = any;

export type ListSkillCategoriesAdminApiSkillCategoriesGetError =
  HTTPValidationError;

export type CreateSkillCategoryAdminApiSkillCategoriesPostData = any;

export type CreateSkillCategoryAdminApiSkillCategoriesPostError =
  HTTPValidationError;

export type UploadSkillCategoryIconAdminApiSkillCategoriesIconUploadPostData =
  any;

export type UploadSkillCategoryIconAdminApiSkillCategoriesIconUploadPostError =
  HTTPValidationError;

export interface UpdateSkillCategoryAdminApiSkillCategoriesCategoryIdPutParams {
  /** Category Id */
  categoryId: number;
}

export type UpdateSkillCategoryAdminApiSkillCategoriesCategoryIdPutData = any;

export type UpdateSkillCategoryAdminApiSkillCategoriesCategoryIdPutError =
  HTTPValidationError;

export interface DeleteSkillCategoryAdminApiSkillCategoriesCategoryIdDeleteParams {
  /** Category Id */
  categoryId: number;
}

export type DeleteSkillCategoryAdminApiSkillCategoriesCategoryIdDeleteData =
  any;

export type DeleteSkillCategoryAdminApiSkillCategoriesCategoryIdDeleteError =
  HTTPValidationError;

export interface SetSkillCategoryEnabledAdminApiSkillCategoriesCategoryIdEnabledPutParams {
  /** Category Id */
  categoryId: number;
}

export type SetSkillCategoryEnabledAdminApiSkillCategoriesCategoryIdEnabledPutData =
  any;

export type SetSkillCategoryEnabledAdminApiSkillCategoriesCategoryIdEnabledPutError =
  HTTPValidationError;

export type ListSkillsAdminApiSkillsGetData = any;

export type ListSkillsAdminApiSkillsGetError = HTTPValidationError;

export type CreateSkillAdminApiSkillsPostData = any;

export type CreateSkillAdminApiSkillsPostError = HTTPValidationError;

export interface GetSkillAdminApiSkillsSkillIdGetParams {
  /** Skill Id */
  skillId: number;
}

export type GetSkillAdminApiSkillsSkillIdGetData = any;

export type GetSkillAdminApiSkillsSkillIdGetError = HTTPValidationError;

export interface UpdateSkillAdminApiSkillsSkillIdPutParams {
  /** Skill Id */
  skillId: number;
}

export type UpdateSkillAdminApiSkillsSkillIdPutData = any;

export type UpdateSkillAdminApiSkillsSkillIdPutError = HTTPValidationError;

export interface SetSkillPublishStateAdminApiSkillsSkillIdPublishPutParams {
  /** Skill Id */
  skillId: number;
}

export type SetSkillPublishStateAdminApiSkillsSkillIdPublishPutData = any;

export type SetSkillPublishStateAdminApiSkillsSkillIdPublishPutError =
  HTTPValidationError;

export interface UploadSkillPackageAdminApiSkillsSkillIdUploadPostParams {
  /** Skill Id */
  skillId: number;
}

export type UploadSkillPackageAdminApiSkillsSkillIdUploadPostData = any;

export type UploadSkillPackageAdminApiSkillsSkillIdUploadPostError =
  HTTPValidationError;

export interface UploadSkillIconAdminApiSkillsSkillIdIconPostParams {
  /** Skill Id */
  skillId: number;
}

export type UploadSkillIconAdminApiSkillsSkillIdIconPostData = any;

export type UploadSkillIconAdminApiSkillsSkillIdIconPostError =
  HTTPValidationError;

export interface DownloadSkillPackageAdminApiSkillsSkillIdDownloadGetParams {
  /** Skill Id */
  skillId: number;
}

export type DownloadSkillPackageAdminApiSkillsSkillIdDownloadGetData = any;

export type DownloadSkillPackageAdminApiSkillsSkillIdDownloadGetError =
  HTTPValidationError;
