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

/** ModelType */
export enum ModelType {
  TextModel = "text_model",
  ImageModel = "image_model",
  VlmModel = "vlm_model",
  VideoModel = "video_model",
}

/** ModelSource */
export enum ModelSource {
  User = "user",
  Workspace = "workspace",
  Default = "default",
}

/** AnthropicMessageResponse */
export interface AnthropicMessageResponse {
  /** Id */
  id: string;
  /** Type */
  type: "message";
  /** Role */
  role: "assistant";
  /** Content */
  content: Record<string, JsonValue>[];
  /** Model */
  model: string;
  /** Stop Reason */
  stop_reason: string | null;
  /** Stop Sequence */
  stop_sequence: string | null;
  usage: AnthropicUsage;
  [key: string]: any;
}

/** AnthropicUsage */
export interface AnthropicUsage {
  /** Input Tokens */
  input_tokens: number;
  /** Output Tokens */
  output_tokens: number;
  /** Cache Creation Input Tokens */
  cache_creation_input_tokens?: number | null;
  /** Cache Read Input Tokens */
  cache_read_input_tokens?: number | null;
  [key: string]: any;
}

/**
 * ApiErrorResponse
 * 非 Forward JSON API 统一失败信封。
 */
export interface ApiErrorResponse {
  /** Code */
  code: number | string;
  data: JsonValue | null;
  /** Message */
  message: string;
  /** Request Id */
  request_id?: string | null;
}

/** ApiResponse[FeedbackInfo] */
export interface ApiResponseFeedbackInfo {
  /** Code */
  code: 0;
  /** 反馈详情（用户侧与管理侧共用）。 */
  data: FeedbackInfo;
  /** Message */
  message: string;
}

/** ApiResponse[HealthInfo] */
export interface ApiResponseHealthInfo {
  /** Code */
  code: 0;
  data: HealthInfo;
  /** Message */
  message: string;
}

/** ApiResponse[ImageTaskCreateResponse] */
export interface ApiResponseImageTaskCreateResponse {
  /** Code */
  code: 0;
  /** 异步生图任务创建响应的 data 载荷（外层为 api_ok 信封，code=0）。 */
  data: ImageTaskCreateResponse;
  /** Message */
  message: string;
}

/** ApiResponse[InstalledSkillInfo] */
export interface ApiResponseInstalledSkillInfo {
  /** Code */
  code: 0;
  data: InstalledSkillInfo;
  /** Message */
  message: string;
}

/** ApiResponse[MediaTaskInfo] */
export interface ApiResponseMediaTaskInfo {
  /** Code */
  code: 0;
  data: MediaTaskInfo;
  /** Message */
  message: string;
}

/** ApiResponse[NoneType] */
export interface ApiResponseNoneType {
  /** Code */
  code: 0;
  /** Data */
  data: null;
  /** Message */
  message: string;
}

/** ApiResponse[OfficialScriptDetail] */
export interface ApiResponseOfficialScriptDetail {
  /** Code */
  code: 0;
  data: OfficialScriptDetail;
  /** Message */
  message: string;
}

/** ApiResponse[OfficialTemplateInfo] */
export interface ApiResponseOfficialTemplateInfo {
  /** Code */
  code: 0;
  data: OfficialTemplateInfo;
  /** Message */
  message: string;
}

/** ApiResponse[OfficialTemplatePage] */
export interface ApiResponseOfficialTemplatePage {
  /** Code */
  code: 0;
  data: OfficialTemplatePage;
  /** Message */
  message: string;
}

/** ApiResponse[SkillInfo] */
export interface ApiResponseSkillInfo {
  /** Code */
  code: 0;
  data: SkillInfo;
  /** Message */
  message: string;
}

/** ApiResponse[TaskHeartbeatResult] */
export interface ApiResponseTaskHeartbeatResult {
  /** Code */
  code: 0;
  data: TaskHeartbeatResult;
  /** Message */
  message: string;
}

/** ApiResponse[TemplateScriptAssetInfo] */
export interface ApiResponseTemplateScriptAssetInfo {
  /** Code */
  code: 0;
  data: TemplateScriptAssetInfo;
  /** Message */
  message: string;
}

/** ApiResponse[TemplateSkillAssetInfo] */
export interface ApiResponseTemplateSkillAssetInfo {
  /** Code */
  code: 0;
  data: TemplateSkillAssetInfo;
  /** Message */
  message: string;
}

/** ApiResponse[ToppedTemplateResult] */
export interface ApiResponseToppedTemplateResult {
  /** Code */
  code: 0;
  data: ToppedTemplateResult;
  /** Message */
  message: string;
}

/** ApiResponse[Union[TaskFinishResult, TaskStartRejectedResult, TaskStartAcquiredResult]] */
export interface ApiResponseUnionTaskFinishResultTaskStartRejectedResultTaskStartAcquiredResult {
  /** Code */
  code: 0;
  /** Data */
  data: TaskFinishResult | TaskStartRejectedResult | TaskStartAcquiredResult;
  /** Message */
  message: string;
}

/** ApiResponse[UploadedFileInfo] */
export interface ApiResponseUploadedFileInfo {
  /** Code */
  code: 0;
  data: UploadedFileInfo;
  /** Message */
  message: string;
}

/** ApiResponse[UpstreamUploadedFileInfo] */
export interface ApiResponseUpstreamUploadedFileInfo {
  /** Code */
  code: 0;
  data: UpstreamUploadedFileInfo;
  /** Message */
  message: string;
}

/** ApiResponse[UserModelInfo] */
export interface ApiResponseUserModelInfo {
  /** Code */
  code: 0;
  data: UserModelInfo;
  /** Message */
  message: string;
}

/** ApiResponse[UserModelOptionsResult] */
export interface ApiResponseUserModelOptionsResult {
  /** Code */
  code: 0;
  data: UserModelOptionsResult;
  /** Message */
  message: string;
}

/** ApiResponse[UserScriptInfo] */
export interface ApiResponseUserScriptInfo {
  /** Code */
  code: 0;
  data: UserScriptInfo;
  /** Message */
  message: string;
}

/** ApiResponse[UserScriptPage] */
export interface ApiResponseUserScriptPage {
  /** Code */
  code: 0;
  data: UserScriptPage;
  /** Message */
  message: string;
}

/** ApiResponse[UserTaskInfo] */
export interface ApiResponseUserTaskInfo {
  /** Code */
  code: 0;
  data: UserTaskInfo;
  /** Message */
  message: string;
}

/** ApiResponse[UserTaskPage] */
export interface ApiResponseUserTaskPage {
  /** Code */
  code: 0;
  data: UserTaskPage;
  /** Message */
  message: string;
}

/** ApiResponse[UserTemplateInfo] */
export interface ApiResponseUserTemplateInfo {
  /** Code */
  code: 0;
  data: UserTemplateInfo;
  /** Message */
  message: string;
}

/** ApiResponse[UserTemplatePage] */
export interface ApiResponseUserTemplatePage {
  /** Code */
  code: 0;
  data: UserTemplatePage;
  /** Message */
  message: string;
}

/** ApiResponse[list[ForwardModelInfo]] */
export interface ApiResponseListForwardModelInfo {
  /** Code */
  code: 0;
  /** Data */
  data: ForwardModelInfo[];
  /** Message */
  message: string;
}

/** ApiResponse[list[InstalledSkillInfo]] */
export interface ApiResponseListInstalledSkillInfo {
  /** Code */
  code: 0;
  /** Data */
  data: InstalledSkillInfo[];
  /** Message */
  message: string;
}

/** ApiResponse[list[MediaTaskInfo]] */
export interface ApiResponseListMediaTaskInfo {
  /** Code */
  code: 0;
  /** Data */
  data: MediaTaskInfo[];
  /** Message */
  message: string;
}

/** ApiResponse[list[OfficialScriptInfo]] */
export interface ApiResponseListOfficialScriptInfo {
  /** Code */
  code: 0;
  /** Data */
  data: OfficialScriptInfo[];
  /** Message */
  message: string;
}

/** ApiResponse[list[OfficialTemplateInfo]] */
export interface ApiResponseListOfficialTemplateInfo {
  /** Code */
  code: 0;
  /** Data */
  data: OfficialTemplateInfo[];
  /** Message */
  message: string;
}

/** ApiResponse[list[PromptTemplateInfo]] */
export interface ApiResponseListPromptTemplateInfo {
  /** Code */
  code: 0;
  /** Data */
  data: PromptTemplateInfo[];
  /** Message */
  message: string;
}

/** ApiResponse[list[ScriptCategoryInfo]] */
export interface ApiResponseListScriptCategoryInfo {
  /** Code */
  code: 0;
  /** Data */
  data: ScriptCategoryInfo[];
  /** Message */
  message: string;
}

/** ApiResponse[list[SkillCategoryInfo]] */
export interface ApiResponseListSkillCategoryInfo {
  /** Code */
  code: 0;
  /** Data */
  data: SkillCategoryInfo[];
  /** Message */
  message: string;
}

/** ApiResponse[list[SkillInfo]] */
export interface ApiResponseListSkillInfo {
  /** Code */
  code: 0;
  /** Data */
  data: SkillInfo[];
  /** Message */
  message: string;
}

/** ApiResponse[list[TemplateLabelCategoryInfo]] */
export interface ApiResponseListTemplateLabelCategoryInfo {
  /** Code */
  code: 0;
  /** Data */
  data: TemplateLabelCategoryInfo[];
  /** Message */
  message: string;
}

/** ApiResponse[list[TemplateLabelInfo]] */
export interface ApiResponseListTemplateLabelInfo {
  /** Code */
  code: 0;
  /** Data */
  data: TemplateLabelInfo[];
  /** Message */
  message: string;
}

/** Body_import_templates_admin_api_templates_import_post */
export interface BodyImportTemplatesAdminApiTemplatesImportPost {
  /**
   * File
   * @format binary
   */
  file: File;
  /**
   * Manifest
   * 官方模板导入索引；ZIP 内只包含 assets/ 文件
   */
  manifest: string;
}

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

/** Body_upload_file_v3_v3_files_upload_post */
export interface BodyUploadFileV3V3FilesUploadPost {
  /**
   * File
   * @format binary
   */
  file: File;
  /**
   * Forward
   * @default false
   */
  forward?: boolean;
  /** Model */
  model?: string | null;
  /** Expires After Seconds */
  expires_after_seconds?: number | null;
}

/** Body_upload_icon_file_admin_api_templates_upload_icon_post */
export interface BodyUploadIconFileAdminApiTemplatesUploadIconPost {
  /**
   * File
   * @format binary
   */
  file: File;
}

/** Body_upload_oss_file_admin_api_oss_files_upload_post */
export interface BodyUploadOssFileAdminApiOssFilesUploadPost {
  /**
   * File
   * @format binary
   */
  file: File;
  /**
   * Userid
   * 归属用户 ID，缺省为 admin
   */
  userId?: string | null;
}

/** Body_upload_script_file_admin_api_scripts__script_id__upload_post */
export interface BodyUploadScriptFileAdminApiScriptsScriptIdUploadPost {
  /**
   * File
   * @format binary
   */
  file: File;
  /** Slug */
  slug: string;
}

/** Body_upload_script_file_admin_api_templates_upload_script_post */
export interface BodyUploadScriptFileAdminApiTemplatesUploadScriptPost {
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

/** Body_upload_skill_file_admin_api_templates_upload_skill_post */
export interface BodyUploadSkillFileAdminApiTemplatesUploadSkillPost {
  /**
   * File
   * @format binary
   */
  file: File;
}

/** Body_upload_skill_icon_admin_api_skills_icon_upload_post */
export interface BodyUploadSkillIconAdminApiSkillsIconUploadPost {
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

/** Body_upload_user_template_script */
export interface BodyUploadUserTemplateScript {
  /**
   * File
   * @format binary
   */
  file: File;
}

/** Body_upload_user_template_skill */
export interface BodyUploadUserTemplateSkill {
  /**
   * File
   * @format binary
   */
  file: File;
}

/** ChatCompletionResponse */
export interface ChatCompletionResponse {
  /**
   * Id
   * @default ""
   */
  id?: string;
  /**
   * Object
   * @default "chat.completion"
   */
  object?: string;
  /**
   * Created
   * @default 0
   */
  created?: number;
  /**
   * Model
   * @default ""
   */
  model?: string;
  /** Choices */
  choices?: Record<string, any>[];
  usage?: TokenUsage | null;
  [key: string]: any;
}

/** EnabledPayload */
export interface EnabledPayload {
  /** Enabled */
  enabled: boolean;
}

/** FeedbackBatchBody */
export interface FeedbackBatchBody {
  /** Action */
  action: "delete";
  /**
   * Ids
   * @minItems 1
   */
  ids: number[];
}

/**
 * FeedbackCreateRequest
 * 提交反馈请求。图片需先调用 /v2/files/upload 上传，再传 file_id 列表。
 */
export interface FeedbackCreateRequest {
  /**
   * Contact
   * 联系方式（必填）
   * @minLength 1
   * @maxLength 255
   */
  contact: string;
  /**
   * Content
   * 反馈内容
   * @minLength 1
   * @maxLength 10000
   */
  content: string;
  /**
   * Imagefileids
   * 图片 file_id 列表（最多 9 张）
   * @maxItems 9
   */
  imageFileIds?: string[];
  /** Appversion */
  appVersion?: string | null;
  /** Platform */
  platform?: string | null;
}

/**
 * FeedbackImageInfo
 * 反馈图片快照：提交时由后端按 file_id 从 agent_oss_files 解析。
 */
export interface FeedbackImageInfo {
  /** Fileid */
  fileId: string;
  /** Url */
  url: string;
  /** Contenttype */
  contentType?: string | null;
  /** Size */
  size?: number | null;
}

/**
 * FeedbackInfo
 * 反馈详情（用户侧与管理侧共用）。
 */
export interface FeedbackInfo {
  /** Id */
  id: number;
  /** Userid */
  userId: string;
  /** Workspaceid */
  workspaceId?: string | null;
  /** Contact */
  contact: string;
  /** Content */
  content: string;
  /**
   * Images
   * @default []
   */
  images?: FeedbackImageInfo[];
  /** Appversion */
  appVersion?: string | null;
  /** Platform */
  platform?: string | null;
  /** Status */
  status: string;
  /** Comment */
  comment?: string | null;
  /** Createdat */
  createdAt?: string | null;
  /** Updatedat */
  updatedAt?: string | null;
}

/** FeedbackUpdateBody */
export interface FeedbackUpdateBody {
  /** Status */
  status?: string | null;
  /** Comment */
  comment?: string | null;
}

/** ForwardModelInfo */
export interface ForwardModelInfo {
  /** Id */
  id: string;
  /** Alias */
  alias: string | null;
  /** Meta */
  meta: Record<string, JsonValue> | null;
  /** Object */
  object: "model";
  /** Created */
  created: number;
  /** Owned By */
  owned_by: string;
}

/** HTTPValidationError */
export interface HTTPValidationError {
  /** Detail */
  detail?: ValidationError[];
}

/** HealthInfo */
export interface HealthInfo {
  /** Status */
  status: HealthInfoStatusEnum;
  /** Env */
  env: string;
  /** Timestamp */
  timestamp: string;
  /** Basepath */
  basePath: string;
  /** Checks */
  checks?: Record<string, JsonValue> | null;
}

/**
 * ImageTaskCreateResponse
 * 异步生图任务创建响应的 data 载荷（外层为 api_ok 信封，code=0）。
 */
export interface ImageTaskCreateResponse {
  /** Task Id */
  task_id: string;
  /** Status */
  status: string;
  /** Request Id */
  request_id: string;
}

/** InstalledSkillInfo */
export interface InstalledSkillInfo {
  /** Id */
  id: number;
  /** Category Id */
  category_id: number;
  /** Category Name */
  category_name: string | null;
  /** Category Slug */
  category_slug: string | null;
  /** Slug */
  slug: string;
  /** Name */
  name: string;
  /** Title */
  title: string | null;
  /** Description */
  description: string | null;
  /** Usage Example */
  usage_example: string | null;
  /** Iconinfo */
  iconInfo: Record<string, JsonValue> | null;
  /** Version */
  version: number;
  /** Release Notes */
  release_notes: string | null;
  /** Meta */
  meta: Record<string, JsonValue> | null;
  /** File Url */
  file_url: string | null;
  /** Published */
  published: number;
  /** Created At */
  created_at: string | null;
  /** Updated At */
  updated_at: string | null;
  /** Installed Version */
  installed_version: number;
  /** Has Update */
  has_update: boolean;
  /** Installed At */
  installed_at: string | null;
  /** Enabled */
  enabled: number;
  /** User Skill Id */
  user_skill_id: number;
}

/** IpWhitelistCreate */
export interface IpWhitelistCreate {
  /**
   * Ip
   * 精确 IPv4 或 IPv6 地址
   */
  ip: string;
  /**
   * Remark
   * 备注
   */
  remark?: string | null;
  /**
   * Durationhours
   * 有效期（小时），不传表示永不过期
   */
  durationHours?: number | null;
}

/** IpWhitelistUpdate */
export interface IpWhitelistUpdate {
  /**
   * Ip
   * 精确 IPv4 或 IPv6 地址
   */
  ip?: string | null;
  /**
   * Remark
   * 备注
   */
  remark?: string | null;
}

export type JsonValue = any;

/** MediaTaskImage */
export interface MediaTaskImage {
  /** Url */
  url: string;
  /** File Id */
  file_id?: string | null;
}

/** MediaTaskInfo */
export interface MediaTaskInfo {
  /** Task Id */
  task_id: string;
  /** Request Id */
  request_id: string;
  /** Status */
  status: MediaTaskInfoStatusEnum;
  /** Created At */
  created_at: string | null;
  /** Completed At */
  completed_at: string | null;
  /** Error Code */
  error_code?: string | null;
  /** Error Message */
  error_message?: string | null;
  /** Kind */
  kind?: MediaTaskInfoKindEnum | null;
  /** Phase */
  phase?: MediaTaskInfoPhaseEnum | null;
  /** Images */
  images?: MediaTaskImage[] | null;
  /** Videos */
  videos?: MediaTaskVideo[] | null;
  /** Url */
  url?: string | null;
  /** File Id */
  file_id?: string | null;
}

/** MediaTaskVideo */
export interface MediaTaskVideo {
  /** Url */
  url: string;
  /** File Id */
  file_id?: string | null;
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
   * 缓存读取输入单价（每百万 Token）
   * @default 0
   */
  cache_hit_price?: number;
  /**
   * Cache Creation Price
   * 缓存写入单价（每百万 Token）
   * @default 0
   */
  cache_creation_price?: number;
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
   * API 格式：anthropic 或 responses
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
   * Meta
   * 模型元信息 JSON，结构为 {title:{zh/en/ru}, desc:{zh/en/ru}}
   */
  meta?: Record<string, any> | null;
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
   * 缓存读取输入单价（每百万 Token）
   */
  cache_hit_price?: number | null;
  /**
   * Cache Creation Price
   * 缓存写入单价（每百万 Token）
   */
  cache_creation_price?: number | null;
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
   * Meta
   * 模型元信息 JSON
   */
  meta?: Record<string, any> | null;
  /**
   * Enabled
   * 是否启用
   */
  enabled?: boolean | null;
}

/** OfficialScriptCreate */
export interface OfficialScriptCreate {
  /**
   * Slug
   * 脚本唯一标识，兼容传入 official- 前缀
   * @minLength 1
   * @maxLength 128
   */
  slug: string;
  /**
   * Category Id
   * 脚本分类 ID；为空时回退到 general 分类
   */
  category_id?: number | null;
  /**
   * Name
   * 多语言脚本名称，如 {"zh": "...", "en": "..."}
   */
  name: Record<string, string>;
  /**
   * Description
   * 多语言脚本描述
   */
  description?: Record<string, string> | null;
  /**
   * Oss Url
   * OSS 下载 URL（可由上传接口自动填充）
   */
  oss_url?: string | null;
  /**
   * File Id
   * 后端 OSS 文件 ID
   */
  file_id?: string | null;
  /**
   * Options Schema
   * 脚本入参 options 的 JSON Schema（字符串）
   */
  options_schema?: string | null;
}

/** OfficialScriptDetail */
export interface OfficialScriptDetail {
  /** Id */
  id: number;
  /** Slug */
  slug: string;
  /** Categoryid */
  categoryId: number;
  category: ScriptCategoryInfo | null;
  /** Name */
  name: Record<string, string>;
  /** Description */
  description: Record<string, string> | null;
  /** Fileid */
  fileId: string | null;
  /** Sha512 */
  sha512: string | null;
  /** Version */
  version: number;
  /** Isofficial */
  isOfficial: true;
  /** Editable */
  editable: false;
  /** Optionsschema */
  optionsSchema: string | null;
  /** Createdat */
  createdAt: string | null;
  /** Updatedat */
  updatedAt: string | null;
  /** Ossurl */
  ossUrl: string | null;
}

/** OfficialScriptInfo */
export interface OfficialScriptInfo {
  /** Id */
  id: number;
  /** Slug */
  slug: string;
  /** Categoryid */
  categoryId: number;
  category: ScriptCategoryInfo | null;
  /** Name */
  name: Record<string, string>;
  /** Description */
  description: Record<string, string> | null;
  /** Fileid */
  fileId: string | null;
  /** Sha512 */
  sha512: string | null;
  /** Version */
  version: number;
  /** Isofficial */
  isOfficial: true;
  /** Editable */
  editable: false;
  /** Optionsschema */
  optionsSchema: string | null;
  /** Createdat */
  createdAt: string | null;
  /** Updatedat */
  updatedAt: string | null;
}

/** OfficialScriptUpdate */
export interface OfficialScriptUpdate {
  /**
   * Slug
   * 脚本唯一标识，兼容传入 official- 前缀
   */
  slug?: string | null;
  /** Category Id */
  category_id?: number | null;
  /**
   * Name
   * 多语言脚本名称
   */
  name?: Record<string, string> | null;
  /**
   * Description
   * 多语言脚本描述
   */
  description?: Record<string, string> | null;
  /** Oss Url */
  oss_url?: string | null;
  /** File Id */
  file_id?: string | null;
  /** Options Schema */
  options_schema?: string | null;
}

/** OfficialTemplateInfo */
export interface OfficialTemplateInfo {
  /** Id */
  id: number;
  /** Slug */
  slug: string;
  /** Templatetype */
  templateType: OfficialTemplateInfoTemplateTypeEnum;
  /** Name */
  name: Record<string, string>;
  /** Description */
  description: Record<string, string> | null;
  iconInfo: TemplateIconInfo | null;
  /** Sortorder */
  sortOrder: number;
  /** Ishot */
  isHot: boolean;
  /**
   * Istopped
   * @default false
   */
  isTopped?: boolean;
  /** Toppedat */
  toppedAt?: string | null;
  /** Approxpoints */
  approxPoints?: number | null;
  /** 官方模板 metadata 的稳定业务字段；允许保留未来扩展键。 */
  metadata: OfficialTemplateMetadataInfo;
  /** Labels */
  labels: TemplateLabelInfo[];
  /** Labelids */
  labelIds: number[];
  /** Createdat */
  createdAt: string | null;
  /** Updatedat */
  updatedAt: string | null;
}

/**
 * OfficialTemplateMetadataInfo
 * 官方模板 metadata 的稳定业务字段；允许保留未来扩展键。
 */
export interface OfficialTemplateMetadataInfo {
  /** Fileid */
  fileId?: string | null;
  /** Ossurl */
  ossUrl?: string | null;
  /** Sha512 */
  sha512?: string | null;
  /** Version */
  version?: string | null;
  /** Optionsschema */
  optionsSchema?: string | null;
  /** Skillmetadata */
  skillMetadata?: Record<string, any> | null;
  /** Prompt */
  prompt?: Record<string, string> | null;
  /** Usageexample */
  usageExample?: Record<string, string> | null;
  [key: string]: any;
}

/** OfficialTemplatePage */
export interface OfficialTemplatePage {
  /** Items */
  items: OfficialTemplateInfo[];
  /** Total */
  total: number;
  /** Limit */
  limit: number;
  /** Offset */
  offset: number;
}

/** PointsGrant */
export interface PointsGrant {
  /**
   * Points
   * 赠送积分数量（展示单位，非 nano）
   * @exclusiveMin 0
   */
  points: number;
  /**
   * Description
   * 赠送备注
   */
  description?: string | null;
}

/** PricingRuleCreate */
export interface PricingRuleCreate {
  /**
   * Name
   * 规则名称
   */
  name?: string | null;
  /**
   * Priority
   * 优先级，越大越优先
   * @default 0
   */
  priority?: number;
  /**
   * Effective From
   * 生效起始
   */
  effective_from?: string | null;
  /**
   * Effective To
   * 生效截止
   */
  effective_to?: string | null;
  /**
   * Enabled
   * 是否启用
   * @default true
   */
  enabled?: boolean;
  /**
   * Condition Type
   * always | time_window | param_match
   * @default "always"
   */
  condition_type?: string;
  /**
   * Conditions
   * 条件 JSON
   */
  conditions?: Record<string, any>;
  /**
   * Billing Mode
   * token | per_image | per_video_second | composite
   * @default "token"
   */
  billing_mode?: string;
  /** 费率 USD 浮点单价（非 micros）；Token 类为每百万 Token */
  rates?: RatesInput;
  /**
   * Currency
   * USD 或 CNY
   * @default "USD"
   */
  currency?: string;
}

/** PricingRuleUpdate */
export interface PricingRuleUpdate {
  /** Name */
  name?: string | null;
  /** Priority */
  priority?: number | null;
  /** Effective From */
  effective_from?: string | null;
  /** Effective To */
  effective_to?: string | null;
  /** Enabled */
  enabled?: boolean | null;
  /** Condition Type */
  condition_type?: string | null;
  /** Conditions */
  conditions?: Record<string, any> | null;
  /** Billing Mode */
  billing_mode?: string | null;
  rates?: RatesInput | null;
  /** Currency */
  currency?: string | null;
}

/** PromptTemplateCreate */
export interface PromptTemplateCreate {
  /**
   * Prompttemplatetitle
   * 提示模板标题
   */
  promptTemplateTitle: string;
  /**
   * Prompttemplatecontent
   * 提示模板内容
   */
  promptTemplateContent: string;
  /**
   * Prompttemplateiconlight
   * 提示模板图标亮色 URL
   * @default ""
   */
  promptTemplateIconLight?: string;
  /**
   * Prompttemplateicondark
   * 提示模板图标深色 URL
   * @default ""
   */
  promptTemplateIconDark?: string;
  /**
   * Prompttemplatecategory
   * 提示模板类别，多语言 JSON（zh/en/ru）
   */
  promptTemplateCategory: Record<string, string>;
  /**
   * Status
   * 是否生效
   * @default true
   */
  status?: boolean;
}

/** PromptTemplateInfo */
export interface PromptTemplateInfo {
  /** Id */
  id: number;
  /** Prompttemplatetitle */
  promptTemplateTitle: string;
  /** Prompttemplatecontent */
  promptTemplateContent: string;
  /** Prompttemplatecategory */
  promptTemplateCategory: string;
  /** Prompttemplateiconlight */
  promptTemplateIconLight: string | null;
  /** Prompttemplateicondark */
  promptTemplateIconDark: string | null;
  /** Status */
  status: number;
  /** Createtime */
  createTime: string | null;
  /** Updatetime */
  updateTime: string | null;
}

/** PromptTemplateUpdate */
export interface PromptTemplateUpdate {
  /**
   * Prompttemplatetitle
   * 提示模板标题
   */
  promptTemplateTitle?: string | null;
  /**
   * Prompttemplatecontent
   * 提示模板内容
   */
  promptTemplateContent?: string | null;
  /**
   * Prompttemplateiconlight
   * 提示模板图标亮色 URL
   */
  promptTemplateIconLight?: string | null;
  /**
   * Prompttemplateicondark
   * 提示模板图标深色 URL
   */
  promptTemplateIconDark?: string | null;
  /**
   * Prompttemplatecategory
   * 提示模板类别，多语言 JSON（zh/en/ru）
   */
  promptTemplateCategory?: Record<string, string> | null;
  /**
   * Status
   * 是否生效
   */
  status?: boolean | null;
}

/** PromptTokensDetails */
export interface PromptTokensDetails {
  /**
   * Cached Tokens
   * @default 0
   */
  cached_tokens?: number;
  [key: string]: any;
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

/**
 * RatesInput
 * Admin 入参：USD/CNY 浮点单价（未乘 10⁹），接口写入 DB 前转为 micros。
 */
export interface RatesInput {
  /**
   * Token Input
   * 输入 Token 单价 USD（每百万 Token，非 micros）
   * @default 0
   */
  token_input?: number;
  /**
   * Token Cache Hit
   * 缓存命中输入单价 USD（每百万 Token）
   * @default 0
   */
  token_cache_hit?: number;
  /**
   * Token Cache Creation
   * 缓存写入单价 USD（每百万 Token）
   * @default 0
   */
  token_cache_creation?: number;
  /**
   * Token Output
   * 输出 Token 单价 USD（每百万 Token）
   * @default 0
   */
  token_output?: number;
  /**
   * Image Count
   * 每张生图单价 USD
   * @default 0
   */
  image_count?: number;
  /**
   * Video Second
   * 每视频秒单价 USD
   * @default 0
   */
  video_second?: number;
}

/** ReorderPayload */
export interface ReorderPayload {
  /**
   * Moved Id
   * @min 1
   */
  moved_id: number;
  /**
   * Target Id
   * @min 1
   */
  target_id: number;
  /** Placement */
  placement: ReorderPayloadPlacementEnum;
}

/**
 * ResponsesResponse
 * OpenAI Responses API 响应的稳定顶层字段。
 */
export interface ResponsesResponse {
  /**
   * Id
   * @default ""
   */
  id?: string;
  /**
   * Object
   * @default "response"
   */
  object?: string;
  /**
   * Created At
   * @default 0
   */
  created_at?: number;
  /**
   * Status
   * @default ""
   */
  status?: string;
  /**
   * Model
   * @default ""
   */
  model?: string;
  /** Output */
  output?: Record<string, any>[];
  /** Usage */
  usage?: Record<string, any> | null;
  [key: string]: any;
}

/** ScriptCategoryCreate */
export interface ScriptCategoryCreate {
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

/** ScriptCategoryInfo */
export interface ScriptCategoryInfo {
  /** Id */
  id: number;
  /** Slug */
  slug: string;
  /** Name */
  name: Record<string, string>;
  /** Iconinfo */
  iconInfo: Record<string, JsonValue> | null;
  /** Sort Order */
  sort_order: number;
  /** Enabled */
  enabled: number;
}

/** ScriptCategoryUpdate */
export interface ScriptCategoryUpdate {
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

/** ScriptCreate */
export interface ScriptCreate {
  /**
   * Name
   * 脚本名称
   */
  name: string;
  /**
   * Oss Url
   * OSS 下载 URL（指向打包后的 zip）
   */
  oss_url?: string | null;
  /**
   * File Id
   * 后端 OSS 文件 ID
   */
  file_id?: string | null;
  /**
   * Description
   * 脚本描述
   */
  description?: string | null;
  /**
   * Source
   * 来源：recording/upload/...
   * @default "recording"
   */
  source?: string;
  /**
   * Conversation Id
   * 绑定的对话 ID
   */
  conversation_id?: string | null;
  /**
   * Options Schema
   * 脚本入参 options 的 JSON Schema（字符串）
   */
  options_schema?: string | null;
}

/** ScriptUpdate */
export interface ScriptUpdate {
  /**
   * Name
   * 脚本名称
   */
  name?: string | null;
  /**
   * Oss Url
   * OSS 下载 URL
   */
  oss_url?: string | null;
  /**
   * File Id
   * 后端 OSS 文件 ID
   */
  file_id?: string | null;
  /**
   * Description
   * 脚本描述
   */
  description?: string | null;
  /**
   * Conversation Id
   * 绑定的对话 ID
   */
  conversation_id?: string | null;
  /**
   * Options Schema
   * 脚本入参 options 的 JSON Schema（字符串）
   */
  options_schema?: string | null;
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

/** SkillCategoryInfo */
export interface SkillCategoryInfo {
  /** Id */
  id: number;
  /** Slug */
  slug: string;
  /** Name */
  name: string | null;
  /** Iconinfo */
  iconInfo: Record<string, JsonValue> | null;
  /** Sort Order */
  sort_order: number;
  /** Enabled */
  enabled: number;
  /** Created At */
  created_at: string | null;
  /** Updated At */
  updated_at: string | null;
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
  /** Usageexample */
  usageExample?: Record<string, string> | null;
  /** Iconinfo */
  iconInfo?: Record<string, any> | null;
  /**
   * Published
   * @default false
   */
  published?: boolean;
}

/** SkillInfo */
export interface SkillInfo {
  /** Id */
  id: number;
  /** Category Id */
  category_id: number;
  /** Category Name */
  category_name: string | null;
  /** Category Slug */
  category_slug: string | null;
  /** Slug */
  slug: string;
  /** Name */
  name: string;
  /** Title */
  title: string | null;
  /** Description */
  description: string | null;
  /** Usage Example */
  usage_example: string | null;
  /** Iconinfo */
  iconInfo: Record<string, JsonValue> | null;
  /** Version */
  version: number;
  /** Release Notes */
  release_notes: string | null;
  /** Meta */
  meta: Record<string, JsonValue> | null;
  /** File Url */
  file_url: string | null;
  /** Published */
  published: number;
  /** Created At */
  created_at: string | null;
  /** Updated At */
  updated_at: string | null;
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
  /** Usageexample */
  usageExample?: Record<string, string> | null;
  /** Iconinfo */
  iconInfo?: Record<string, any> | null;
  /** Published */
  published?: boolean | null;
}

/** TaskFinishResult */
export interface TaskFinishResult {
  /** Finished */
  finished: boolean;
  /** Reason */
  reason: string | null;
}

/** TaskHeartbeatRequest */
export interface TaskHeartbeatRequest {
  /**
   * Task Log Id
   * @minLength 1
   */
  task_log_id: string;
  /**
   * Lease Token
   * @minLength 1
   */
  lease_token: string;
}

/** TaskHeartbeatResult */
export interface TaskHeartbeatResult {
  /** Renewed */
  renewed: boolean;
  /** Reason */
  reason: string | null;
}

/** TaskStartAcquiredResult */
export interface TaskStartAcquiredResult {
  /** Acquired */
  acquired: true;
  /** Leasetoken */
  leaseToken: string;
  /** Occurrenceid */
  occurrenceId: string | null;
}

/** TaskStartRejectedResult */
export interface TaskStartRejectedResult {
  /** Acquired */
  acquired: false;
  /** Reason */
  reason: string | null;
}

/** TaskStateRequest */
export interface TaskStateRequest {
  /** Action */
  action: TaskStateRequestActionEnum;
  /**
   * Task Log Id
   * @minLength 1
   */
  task_log_id: string;
  /** Trigger Type */
  trigger_type?: TaskStateRequestTriggerTypeEnum | null;
  /** Scheduled At */
  scheduled_at?: string | null;
  /** Lease Token */
  lease_token?: string | null;
  /** Result Status */
  result_status?: TaskStateRequestResultStatusEnum | null;
}

/** TemplateBatch */
export interface TemplateBatch {
  /** Action */
  action: TemplateBatchActionEnum;
  /**
   * Ids
   * @minItems 1
   */
  ids: number[];
  /** Label Ids */
  label_ids?: number[] | null;
}

/** TemplateCreate */
export interface TemplateCreate {
  /**
   * Slug
   * @minLength 1
   * @maxLength 128
   */
  slug: string;
  /** Template Type */
  template_type: string;
  /** Name */
  name: Record<string, string>;
  /** Description */
  description?: Record<string, string> | null;
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
  /**
   * Ishot
   * @default false
   */
  isHot?: boolean;
  /** Approxpoints */
  approxPoints?: number | null;
  /** Metadata */
  metadata?: Record<string, any>;
  /** Label Ids */
  label_ids?: number[];
}

/** TemplateIconInfo */
export interface TemplateIconInfo {
  icon?: TemplateThemePairInfo | null;
  primaryColor?: TemplateThemePairInfo | null;
  bgColor?: TemplateThemePairInfo | null;
  [key: string]: any;
}

/** TemplateLabelBatch */
export interface TemplateLabelBatch {
  /** Action */
  action: TemplateLabelBatchActionEnum;
  /**
   * Ids
   * @minItems 1
   */
  ids: number[];
}

/** TemplateLabelCategoryCreate */
export interface TemplateLabelCategoryCreate {
  /**
   * Slug
   * @minLength 1
   * @maxLength 128
   */
  slug: string;
  /** Name */
  name: Record<string, string>;
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

/** TemplateLabelCategoryInfo */
export interface TemplateLabelCategoryInfo {
  /** Id */
  id: number;
  /** Slug */
  slug: string;
  /** Name */
  name: Record<string, string>;
  /** Sortorder */
  sortOrder: number;
  /** Enabled */
  enabled: number;
}

/** TemplateLabelCategoryUpdate */
export interface TemplateLabelCategoryUpdate {
  /** Slug */
  slug?: string | null;
  /** Name */
  name?: Record<string, string> | null;
  /** Sort Order */
  sort_order?: number | null;
  /** Enabled */
  enabled?: boolean | null;
}

/** TemplateLabelCreate */
export interface TemplateLabelCreate {
  /** Category Id */
  category_id: number;
  /**
   * Slug
   * @minLength 1
   * @maxLength 128
   */
  slug: string;
  /** Name */
  name: Record<string, string>;
  /** Color */
  color?: string | null;
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

/** TemplateLabelInfo */
export interface TemplateLabelInfo {
  /** Id */
  id: number;
  /** Categoryid */
  categoryId: number;
  category: TemplateLabelCategoryInfo;
  /** Slug */
  slug: string;
  /** Name */
  name: Record<string, string>;
  /** Color */
  color: string | null;
  /** Sortorder */
  sortOrder: number;
  /** Enabled */
  enabled: number;
}

/** TemplateLabelUpdate */
export interface TemplateLabelUpdate {
  /** Category Id */
  category_id?: number | null;
  /** Slug */
  slug?: string | null;
  /** Name */
  name?: Record<string, string> | null;
  /** Color */
  color?: string | null;
  /** Sort Order */
  sort_order?: number | null;
  /** Enabled */
  enabled?: boolean | null;
}

/** TemplateScriptAssetInfo */
export interface TemplateScriptAssetInfo {
  /** Fileid */
  fileId: string;
  /** Ossurl */
  ossUrl: string;
  /** Sha512 */
  sha512: string;
  /** Contenttype */
  contentType: string;
  /** Filesize */
  fileSize: number;
  /** Filename */
  filename: string;
}

/** TemplateSkillAssetInfo */
export interface TemplateSkillAssetInfo {
  /** Fileid */
  fileId: string;
  /** Ossurl */
  ossUrl: string;
  /** Sha512 */
  sha512: string;
  /** Contenttype */
  contentType: string;
  /** Filesize */
  fileSize: number;
  /** Filename */
  filename: string;
  /** Skillmetadata */
  skillMetadata: Record<string, JsonValue> | null;
  /** Packagename */
  packageName: string | null;
  /** Packageslug */
  packageSlug: string | null;
  /** Packagedescription */
  packageDescription: string | null;
  /** Packagefilename */
  packageFilename: string | null;
  /** Filecount */
  fileCount: number | null;
  /** Files */
  files: string[] | null;
  /** Skillmdpath */
  skillMdPath: string | null;
}

/** TemplateThemePairInfo */
export interface TemplateThemePairInfo {
  /** Light */
  light?: string | null;
  /** Dark */
  dark?: string | null;
}

/** TemplateUpdate */
export interface TemplateUpdate {
  /** Slug */
  slug?: string | null;
  /** Name */
  name?: Record<string, string> | null;
  /** Description */
  description?: Record<string, string> | null;
  /** Iconinfo */
  iconInfo?: Record<string, any> | null;
  /** Sort Order */
  sort_order?: number | null;
  /** Enabled */
  enabled?: boolean | null;
  /** Ishot */
  isHot?: boolean | null;
  /** Approxpoints */
  approxPoints?: number | null;
  /** Metadata */
  metadata?: Record<string, any> | null;
  /** Label Ids */
  label_ids?: number[] | null;
}

/** TokenUsage */
export interface TokenUsage {
  /**
   * Prompt Tokens
   * @default 0
   */
  prompt_tokens?: number;
  /**
   * Completion Tokens
   * @default 0
   */
  completion_tokens?: number;
  /**
   * Total Tokens
   * @default 0
   */
  total_tokens?: number;
  prompt_tokens_details?: PromptTokensDetails | null;
  [key: string]: any;
}

/** ToppedTemplateResult */
export interface ToppedTemplateResult {
  /** Templateid */
  templateId: number;
  /** Istopped */
  isTopped: boolean;
  /** Toppedat */
  toppedAt?: string | null;
}

/** UploadedFileInfo */
export interface UploadedFileInfo {
  /** File Id */
  file_id: string;
  /** Filename */
  filename: string | null;
  /** Content Type */
  content_type: string;
  /** Size */
  size: number;
  /** Url */
  url: string;
}

/** UpstreamUploadedFileInfo */
export interface UpstreamUploadedFileInfo {
  /** File Id */
  file_id: string;
  /** Filename */
  filename: string | null;
  /** Content Type */
  content_type: string;
  /** Size */
  size: number;
  /** Url */
  url: string;
  /** Upstream File Id */
  upstream_file_id?: string | null;
  /** Upstream Service */
  upstream_service?: string | null;
}

/** UserModelConfig */
export interface UserModelConfig {
  /** Model */
  model: string;
  /** Alias */
  alias: string | null;
  /** Meta */
  meta: Record<string, JsonValue> | null;
  /** Api Format */
  api_format: string;
  source: ModelSource;
}

/** UserModelInfo */
export interface UserModelInfo {
  text_model: UserModelConfig | null;
  image_model: UserModelConfig | null;
  vlm_model: UserModelConfig | null;
  video_model: UserModelConfig | null;
}

/** UserModelOption */
export interface UserModelOption {
  /** Model */
  model: string;
  /** Alias */
  alias: string | null;
  /** Meta */
  meta: Record<string, JsonValue> | null;
  /** Api Format */
  api_format: string;
}

/** UserModelOptionsResult */
export interface UserModelOptionsResult {
  model_type: ModelType;
  /** Items */
  items: UserModelOption[];
}

/** UserModelSwitchPayload */
export interface UserModelSwitchPayload {
  /** 模型类型 */
  model_type: ModelType;
  /**
   * Model
   * 目标模型名；传 null 或空字符串时清除用户绑定并回退到上级配置
   */
  model: string | null;
}

/** UserScriptInfo */
export interface UserScriptInfo {
  /** Id */
  id: number;
  /** Name */
  name: string;
  /** Description */
  description: string | null;
  /** Ossurl */
  ossUrl: string | null;
  /** Fileid */
  fileId: string | null;
  /** Source */
  source: string;
  /** Isofficial */
  isOfficial: false;
  /** Editable */
  editable: true;
  /** Conversationid */
  conversationId: string | null;
  /** Optionsschema */
  optionsSchema: string | null;
  /** Createdat */
  createdAt: string | null;
  /** Updatedat */
  updatedAt: string | null;
}

/** UserScriptPage */
export interface UserScriptPage {
  /** Items */
  items: UserScriptInfo[];
  /** Total */
  total: number;
  /** Limit */
  limit: number;
  /** Offset */
  offset: number;
  /** Search */
  search: string | null;
  /** Sortby */
  sortBy: string | null;
  /** Sortorder */
  sortOrder: string | null;
}

/** UserTaskCreate */
export interface UserTaskCreate {
  /**
   * Name
   * 任务名称
   */
  name: string;
  /**
   * User Template Id
   * 来源用户模板 ID
   */
  user_template_id: number;
  /**
   * Window Ids
   * 关联窗口 ID 数组（可空；每个元素为 32 位小写十六进制窗口 ID）
   */
  window_ids?: string[];
  /**
   * Plan Type
   * 执行模式：manual/once/cron
   * @default "manual"
   */
  plan_type?: UserTaskCreatePlanTypeEnum;
  /**
   * Cron
   * cron 表达式（planType=cron 时必填，标准 5 段）
   */
  cron?: string | null;
  /**
   * Timezone
   * cron 计划的 IANA 时区（planType=cron 时必填）
   */
  timezone?: string | null;
  /**
   * Execute At
   * 单次执行时间（planType=once 时必填，ISO 8601 时间）
   */
  execute_at?: string | null;
  /**
   * Enabled
   * 是否启用
   * @default true
   */
  enabled?: boolean;
  /** 任务执行配置；当前仅支持脚本任务并发数 */
  metadata?: UserTaskMetadata | null;
}

/** UserTaskInfo */
export interface UserTaskInfo {
  /** Id */
  id: number;
  /** Workspaceid */
  workspaceId: string;
  /** Name */
  name: string;
  /** Usertemplateid */
  userTemplateId: number;
  /** Windowids */
  windowIds: string[];
  /** Metadata */
  metadata: Record<string, JsonValue>;
  /** Plantype */
  planType: UserTaskInfoPlanTypeEnum;
  /** Cron */
  cron: string | null;
  /** Timezone */
  timezone: string | null;
  /** Executeat */
  executeAt: string | null;
  /** Nextexecuteat */
  nextExecuteAt: string | null;
  /** Enabled */
  enabled: boolean;
  /** Createdat */
  createdAt: string | null;
  /** Updatedat */
  updatedAt: string | null;
}

/** UserTaskMetadata */
export interface UserTaskMetadata {
  /**
   * Concurrency
   * 脚本任务单次执行的最大并发数；非脚本任务忽略
   */
  concurrency?: number | null;
}

/** UserTaskPage */
export interface UserTaskPage {
  /** Items */
  items: UserTaskRuntimeInfo[];
  /** Total */
  total: number;
  /** Limit */
  limit: number;
  /** Offset */
  offset: number;
  /** Search */
  search: string | null;
  /** Sortby */
  sortBy: string | null;
  /** Sortorder */
  sortOrder: string | null;
}

/** UserTaskRuntimeInfo */
export interface UserTaskRuntimeInfo {
  /** Id */
  id: number;
  /** Workspaceid */
  workspaceId: string;
  /** Name */
  name: string;
  /** Usertemplateid */
  userTemplateId: number;
  /** Windowids */
  windowIds: string[];
  /** Metadata */
  metadata: Record<string, JsonValue>;
  /** Plantype */
  planType: UserTaskRuntimeInfoPlanTypeEnum;
  /** Cron */
  cron: string | null;
  /** Timezone */
  timezone: string | null;
  /** Executeat */
  executeAt: string | null;
  /** Nextexecuteat */
  nextExecuteAt: string | null;
  /** Enabled */
  enabled: boolean;
  /** Createdat */
  createdAt: string | null;
  /** Updatedat */
  updatedAt: string | null;
  /** Runtimestatus */
  runtimeStatus: string;
  /** Runtimetasklogid */
  runtimeTaskLogId: string | null;
  /** Runtimestartedat */
  runtimeStartedAt: string | null;
  /** Runtimelastheartbeatat */
  runtimeLastHeartbeatAt: string | null;
}

/** UserTaskUpdate */
export interface UserTaskUpdate {
  /** Name */
  name?: string | null;
  /** Window Ids */
  window_ids?: string[] | null;
  /** Plan Type */
  plan_type?: UserTaskUpdatePlanTypeEnum | null;
  /** Cron */
  cron?: string | null;
  /** Timezone */
  timezone?: string | null;
  /** Execute At */
  execute_at?: string | null;
  /** Enabled */
  enabled?: boolean | null;
  /** 任务执行配置；传 null 或不含 concurrency 时删除脚本并发配置 */
  metadata?: UserTaskMetadata | null;
}

/** UserTemplateBatch */
export interface UserTemplateBatch {
  /** Action */
  action: "delete";
  /**
   * Ids
   * @minItems 1
   */
  ids: number[];
}

/** UserTemplateCreate */
export interface UserTemplateCreate {
  /**
   * Official Template Id
   * 来源官方模板 ID；提供时快照复制其内容
   */
  official_template_id?: number | null;
  /**
   * Template Type
   * 模板类型：script/skill/prompt（自建时必填）
   */
  template_type?: string | null;
  /**
   * Name
   * 模板名称（自建时必填）
   */
  name?: string | null;
  /**
   * Description
   * 模板描述
   */
  description?: string | null;
  /**
   * Metadata
   * 类型特定数据，如文件信息、optionsSchema、params、skillMetadata、prompt
   */
  metadata?: Record<string, JsonValue>;
}

/** UserTemplateInfo */
export interface UserTemplateInfo {
  /** Id */
  id: number;
  /** Workspaceid */
  workspaceId: string;
  /** Officialtemplateid */
  officialTemplateId: number | null;
  /** Templatetype */
  templateType: string;
  /** Name */
  name: string;
  /** Description */
  description: string | null;
  /** Source */
  source: string;
  /** Metadata */
  metadata: Record<string, JsonValue>;
  /** Hasfile */
  hasFile: boolean;
  /**
   * Istopped
   * @default false
   */
  isTopped?: boolean;
  /** Toppedat */
  toppedAt?: string | null;
  /** Createdat */
  createdAt: string | null;
  /** Updatedat */
  updatedAt: string | null;
}

/** UserTemplatePage */
export interface UserTemplatePage {
  /** Items */
  items: UserTemplateInfo[];
  /** Total */
  total: number;
  /** Limit */
  limit: number;
  /** Offset */
  offset: number;
  /** Search */
  search: string | null;
  /** Sortby */
  sortBy: string | null;
  /** Sortorder */
  sortOrder: string | null;
}

/** UserTemplateUpdate */
export interface UserTemplateUpdate {
  /** Name */
  name?: string | null;
  /** Description */
  description?: string | null;
  /** Metadata */
  metadata?: Record<string, JsonValue> | null;
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

/** Status */
export enum HealthInfoStatusEnum {
  Ok = "ok",
  Degraded = "degraded",
}

/** Status */
export enum MediaTaskInfoStatusEnum {
  Pending = "pending",
  Running = "running",
  Succeeded = "succeeded",
  Failed = "failed",
  Expired = "expired",
}

export enum MediaTaskInfoKindEnum {
  GenerateImage = "generate_image",
  GenerateImageEdit = "generate_image_edit",
  GenerateVideo = "generate_video",
}

export enum MediaTaskInfoPhaseEnum {
  Queued = "queued",
  Generating = "generating",
  Uploading = "uploading",
  Done = "done",
}

/** Templatetype */
export enum OfficialTemplateInfoTemplateTypeEnum {
  Script = "script",
  Skill = "skill",
  Prompt = "prompt",
}

/** Placement */
export enum ReorderPayloadPlacementEnum {
  Before = "before",
  After = "after",
}

/** Action */
export enum TaskStateRequestActionEnum {
  Start = "start",
  Finish = "finish",
}

export enum TaskStateRequestTriggerTypeEnum {
  Manual = "manual",
  Once = "once",
  Cron = "cron",
}

export enum TaskStateRequestResultStatusEnum {
  Success = "success",
  PartialFailed = "partial_failed",
  Failed = "failed",
  Interrupted = "interrupted",
}

/** Action */
export enum TemplateBatchActionEnum {
  Enable = "enable",
  Disable = "disable",
  Delete = "delete",
  SetLabels = "set_labels",
}

/** Action */
export enum TemplateLabelBatchActionEnum {
  Enable = "enable",
  Disable = "disable",
  Delete = "delete",
}

/**
 * Plan Type
 * 执行模式：manual/once/cron
 * @default "manual"
 */
export enum UserTaskCreatePlanTypeEnum {
  Manual = "manual",
  Once = "once",
  Cron = "cron",
}

/** Plantype */
export enum UserTaskInfoPlanTypeEnum {
  Manual = "manual",
  Once = "once",
  Cron = "cron",
}

/** Plantype */
export enum UserTaskRuntimeInfoPlanTypeEnum {
  Manual = "manual",
  Once = "once",
  Cron = "cron",
}

export enum UserTaskUpdatePlanTypeEnum {
  Manual = "manual",
  Once = "once",
  Cron = "cron",
}

export interface HealthHealthGetParams {
  /**
   * Deep
   * 1=深度检查 MySQL/Redis/缓存
   * @min 0
   * @max 1
   * @default 0
   */
  deep?: number;
}

export type HealthHealthGetData = ApiResponseHealthInfo;

export type HealthHealthGetError = ApiErrorResponse;

export type ChatCompletionsV1ChatCompletionsPostData = ChatCompletionResponse;

export type ChatCompletionsV1ChatCompletionsPostError = ApiErrorResponse;

export type ResponsesV1ResponsesPostData = ResponsesResponse;

export type ResponsesV1ResponsesPostError = ApiErrorResponse;

export type ImageGenerationsV1ImagesGenerationsPostData =
  ApiResponseImageTaskCreateResponse;

export type ImageGenerationsV1ImagesGenerationsPostError = ApiErrorResponse;

export type ImageEditsV1ImagesEditsPostData =
  ApiResponseImageTaskCreateResponse;

export type ImageEditsV1ImagesEditsPostError = ApiErrorResponse;

export type VideoGenerationsV1VideosGenerationsPostData = any;

export type VideoGenerationsV1VideosGenerationsPostError = ApiErrorResponse;

export type AnthropicMessagesV1MessagesPostData = AnthropicMessageResponse;

export type AnthropicMessagesV1MessagesPostError = ApiErrorResponse;

export type ListModelsV1ModelsGetData = ApiResponseListForwardModelInfo;

export type ListModelsV1ModelsGetError = ApiErrorResponse;

export type GetUserModelData = ApiResponseUserModelInfo;

export type GetUserModelError = ApiErrorResponse;

export type SwitchUserModelData = ApiResponseUserModelInfo;

export type SwitchUserModelError = ApiErrorResponse;

export interface ListUserModelOptionsParams {
  /** 模型类型：text_model / image_model / vlm_model / video_model */
  model_type: ModelType;
}

export type ListUserModelOptionsData = ApiResponseUserModelOptionsResult;

export type ListUserModelOptionsError = ApiErrorResponse;

export interface GetMediaTaskParams {
  /** Task Id */
  taskId: string;
}

export type GetMediaTaskData = ApiResponseMediaTaskInfo;

export type GetMediaTaskError = ApiErrorResponse;

export interface ListMediaTasksParams {
  /**
   * Request Id
   * @minLength 1
   * @maxLength 64
   */
  request_id: string;
}

export type ListMediaTasksData = ApiResponseListMediaTaskInfo;

export type ListMediaTasksError = ApiErrorResponse;

export type ListSkillCategoriesData = ApiResponseListSkillCategoryInfo;

export type ListSkillCategoriesError = ApiErrorResponse;

export interface ListSkillsParams {
  /**
   * Category
   * Category slug
   */
  category?: string | null;
}

export type ListSkillsData = ApiResponseListSkillInfo;

export type ListSkillsError = ApiErrorResponse;

export interface GetSkillParams {
  /** Slug */
  slug: string;
}

export type GetSkillData = ApiResponseSkillInfo;

export type GetSkillError = ApiErrorResponse;

export interface DownloadSkillParams {
  /** Slug */
  slug: string;
}

export type DownloadSkillError = ApiErrorResponse;

export type ListUserSkillsData = ApiResponseListInstalledSkillInfo;

export type ListUserSkillsError = ApiErrorResponse;

export interface InstallUserSkillParams {
  /** Slug */
  slug: string;
}

export type InstallUserSkillData = ApiResponseInstalledSkillInfo;

export type InstallUserSkillError = ApiErrorResponse;

export interface SetUserSkillEnabledParams {
  /** Slug */
  slug: string;
}

export type SetUserSkillEnabledData = ApiResponseInstalledSkillInfo;

export type SetUserSkillEnabledError = ApiErrorResponse;

export interface RemoveUserSkillParams {
  /** Slug */
  slug: string;
}

export type RemoveUserSkillData = ApiResponseNoneType;

export type RemoveUserSkillError = ApiErrorResponse;

export type CreateUserScriptData = ApiResponseUserScriptInfo;

export type CreateUserScriptError = ApiErrorResponse;

export interface ListUserScriptsParams {
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
   * 按名称、描述模糊搜索
   */
  search?: string | null;
  /**
   * Sortby
   * 排序字段：created_at / updated_at / name
   */
  sortBy?: string | null;
  /**
   * Sortorder
   * 排序方向：asc / desc
   */
  sortOrder?: string | null;
}

export type ListUserScriptsData = ApiResponseUserScriptPage;

export type ListUserScriptsError = ApiErrorResponse;

export interface GetUserScriptParams {
  /** Script Id */
  scriptId: number;
}

export type GetUserScriptData = ApiResponseUserScriptInfo;

export type GetUserScriptError = ApiErrorResponse;

export interface UpdateUserScriptParams {
  /** Script Id */
  scriptId: number;
}

export type UpdateUserScriptData = ApiResponseUserScriptInfo;

export type UpdateUserScriptError = ApiErrorResponse;

export interface DeleteUserScriptParams {
  /** Script Id */
  scriptId: number;
}

export type DeleteUserScriptData = ApiResponseNoneType;

export type DeleteUserScriptError = ApiErrorResponse;

export type ListScriptCategoriesData = ApiResponseListScriptCategoryInfo;

export type ListScriptCategoriesError = ApiErrorResponse;

export interface ListOfficialScriptsParams {
  /**
   * Search
   * 按 slug、名称、描述模糊搜索
   */
  search?: string | null;
  /**
   * Category Slug
   * 按分类 slug 过滤
   */
  category_slug?: string | null;
  /** Categoryslug */
  categorySlug?: string | null;
}

export type ListOfficialScriptsData = ApiResponseListOfficialScriptInfo;

export type ListOfficialScriptsError = ApiErrorResponse;

export interface GetOfficialScriptParams {
  /** Script Id Or Slug */
  scriptIdOrSlug: string;
}

export type GetOfficialScriptData = ApiResponseOfficialScriptDetail;

export type GetOfficialScriptError = ApiErrorResponse;

export type ListTemplateLabelCategoriesData =
  ApiResponseListTemplateLabelCategoryInfo;

export type ListTemplateLabelCategoriesError = ApiErrorResponse;

export interface ListTemplateLabelsParams {
  /**
   * Category Id
   * 按分类 ID 过滤
   */
  category_id?: number | null;
  /** Categoryid */
  categoryId?: number | null;
}

export type ListTemplateLabelsData = ApiResponseListTemplateLabelInfo;

export type ListTemplateLabelsError = ApiErrorResponse;

export interface ListOfficialTemplatesParams {
  /**
   * Limit
   * 最多返回条数
   */
  limit?: number | null;
  /**
   * Offset
   * 偏移量；传入后返回分页结构
   */
  offset?: number | null;
  /**
   * Search
   * 按 slug、名称、描述模糊搜索
   */
  search?: string | null;
  /**
   * Template Type
   * 按类型过滤：script/skill/prompt
   */
  template_type?: string | null;
  /** Templatetype */
  templateType?: string | null;
  /**
   * Label Slug
   * 按标签 slug 过滤
   */
  label_slug?: string | null;
  /** Labelslug */
  labelSlug?: string | null;
  /**
   * Label Ids
   * 按多个标签 ID 过滤；模板必须包含全部标签
   */
  label_ids?: number[] | null;
  /** Labelids */
  labelIds?: number[] | null;
  /**
   * Prioritizetopped
   * 是否按当前用户置顶顺序返回官方模板
   * @default true
   */
  prioritizeTopped?: boolean;
}

/** Response List Official Templates */
export type ListOfficialTemplatesData =
  | ApiResponseListOfficialTemplateInfo
  | ApiResponseOfficialTemplatePage;

export type ListOfficialTemplatesError = ApiErrorResponse;

export interface TopOfficialTemplateParams {
  /** Template Id */
  templateId: number;
}

export type TopOfficialTemplateData = ApiResponseToppedTemplateResult;

export type TopOfficialTemplateError = ApiErrorResponse;

export interface UntopOfficialTemplateParams {
  /** Template Id */
  templateId: number;
}

export type UntopOfficialTemplateData = ApiResponseToppedTemplateResult;

export type UntopOfficialTemplateError = ApiErrorResponse;

export interface GetOfficialTemplateParams {
  /** Template Id Or Slug */
  templateIdOrSlug: string;
}

export type GetOfficialTemplateData = ApiResponseOfficialTemplateInfo;

export type GetOfficialTemplateError = ApiErrorResponse;

export type UploadUserTemplateScriptData = ApiResponseTemplateScriptAssetInfo;

export type UploadUserTemplateScriptError = ApiErrorResponse;

export type UploadUserTemplateSkillData = ApiResponseTemplateSkillAssetInfo;

export type UploadUserTemplateSkillError = ApiErrorResponse;

export type CreateUserTemplateData = ApiResponseUserTemplateInfo;

export type CreateUserTemplateError = ApiErrorResponse;

export interface ListUserTemplatesParams {
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
   * 按名称、描述模糊搜索
   */
  search?: string | null;
  /**
   * Template Type
   * 按类型过滤：script/skill/prompt
   */
  template_type?: string | null;
  /** Templatetype */
  templateType?: string | null;
  /**
   * Sortby
   * 排序字段：created_at / updated_at / name
   */
  sortBy?: string | null;
  /**
   * Sortorder
   * 排序方向：asc / desc
   */
  sortOrder?: string | null;
}

export type ListUserTemplatesData = ApiResponseUserTemplatePage;

export type ListUserTemplatesError = ApiErrorResponse;

export interface TopUserTemplateParams {
  /** Template Id */
  templateId: number;
}

export type TopUserTemplateData = ApiResponseToppedTemplateResult;

export type TopUserTemplateError = ApiErrorResponse;

export interface UntopUserTemplateParams {
  /** Template Id */
  templateId: number;
}

export type UntopUserTemplateData = ApiResponseToppedTemplateResult;

export type UntopUserTemplateError = ApiErrorResponse;

export interface GetUserTemplateParams {
  /**
   * Template Type
   * 按类型过滤：script/skill/prompt
   */
  template_type?: string | null;
  /** Templatetype */
  templateType?: string | null;
  /** Template Id */
  templateId: string;
}

export type GetUserTemplateData = ApiResponseUserTemplateInfo;

export type GetUserTemplateError = ApiErrorResponse;

export interface UpdateUserTemplateParams {
  /** Template Id */
  templateId: number;
}

export type UpdateUserTemplateData = ApiResponseUserTemplateInfo;

export type UpdateUserTemplateError = ApiErrorResponse;

export interface DeleteUserTemplateParams {
  /** Template Id */
  templateId: number;
}

export type DeleteUserTemplateData = ApiResponseNoneType;

export type DeleteUserTemplateError = ApiErrorResponse;

export type CreateUserTaskData = ApiResponseUserTaskInfo;

export type CreateUserTaskError = ApiErrorResponse;

export interface ListUserTasksParams {
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
   * 按任务名称模糊搜索
   */
  search?: string | null;
  /**
   * Plan Type
   * 按执行模式过滤：manual/once/cron
   */
  plan_type?: PlanTypeEnum | null;
  /** Plantype */
  planType?: PlanTypeEnum1 | null;
  /**
   * Sortby
   * 排序字段：created_at / updated_at / name
   */
  sortBy?: string | null;
  /**
   * Sortorder
   * 排序方向：asc / desc
   */
  sortOrder?: string | null;
}

export enum PlanTypeEnum {
  Manual = "manual",
  Once = "once",
  Cron = "cron",
}

export enum PlanTypeEnum1 {
  Manual = "manual",
  Once = "once",
  Cron = "cron",
}

export type ListUserTasksData = ApiResponseUserTaskPage;

export type ListUserTasksError = ApiErrorResponse;

export enum ListUserTasksParams1PlanTypeEnum {
  Manual = "manual",
  Once = "once",
  Cron = "cron",
}

export enum ListUserTasksParams1PlanTypeEnum1 {
  Manual = "manual",
  Once = "once",
  Cron = "cron",
}

export interface GetUserTaskParams {
  /** Task Id */
  taskId: number;
}

export type GetUserTaskData = ApiResponseUserTaskInfo;

export type GetUserTaskError = ApiErrorResponse;

export interface UpdateUserTaskParams {
  /** Task Id */
  taskId: number;
}

export type UpdateUserTaskData = ApiResponseUserTaskInfo;

export type UpdateUserTaskError = ApiErrorResponse;

export interface DeleteUserTaskParams {
  /** Task Id */
  taskId: number;
}

export type DeleteUserTaskData = ApiResponseNoneType;

export type DeleteUserTaskError = ApiErrorResponse;

export interface UpdateUserTaskStateParams {
  /** Task Id */
  taskId: number;
}

export type UpdateUserTaskStateData =
  ApiResponseUnionTaskFinishResultTaskStartRejectedResultTaskStartAcquiredResult;

export type UpdateUserTaskStateError = ApiErrorResponse;

export interface HeartbeatUserTaskParams {
  /** Task Id */
  taskId: number;
}

export type HeartbeatUserTaskData = ApiResponseTaskHeartbeatResult;

export type HeartbeatUserTaskError = ApiErrorResponse;

export type SubmitFeedbackData = ApiResponseFeedbackInfo;

export type SubmitFeedbackError = ApiErrorResponse;

export type GetPromptTemplateListV1PromptTemplatesListGetData =
  ApiResponseListPromptTemplateInfo;

export type GetPromptTemplateListV1PromptTemplatesListGetError =
  ApiErrorResponse;

export type UploadFileV1FilesUploadPostData = ApiResponseUploadedFileInfo;

export type UploadFileV1FilesUploadPostError = ApiErrorResponse;

export interface GetFileV1FilesFileIdGetParams {
  /** File Id */
  fileId: string;
}

export type GetFileV1FilesFileIdGetData = any;

export type GetFileV1FilesFileIdGetError = ApiErrorResponse;

export type UploadFileV2V2FilesUploadPostData = ApiResponseUploadedFileInfo;

export type UploadFileV2V2FilesUploadPostError = ApiErrorResponse;

export interface GetFileV2V2FilesFileIdGetParams {
  /** File Id */
  fileId: string;
}

export type GetFileV2V2FilesFileIdGetError = ApiErrorResponse;

export type UploadFileV3V3FilesUploadPostData =
  ApiResponseUpstreamUploadedFileInfo;

export type UploadFileV3V3FilesUploadPostError = ApiErrorResponse;

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

export interface ListPricingRulesAdminApiModelsModelIdPricingRulesGetParams {
  /** Model Id */
  modelId: number;
}

export type ListPricingRulesAdminApiModelsModelIdPricingRulesGetData = any;

export type ListPricingRulesAdminApiModelsModelIdPricingRulesGetError =
  HTTPValidationError;

export interface CreatePricingRuleAdminApiModelsModelIdPricingRulesPostParams {
  /** Model Id */
  modelId: number;
}

export type CreatePricingRuleAdminApiModelsModelIdPricingRulesPostData = any;

export type CreatePricingRuleAdminApiModelsModelIdPricingRulesPostError =
  HTTPValidationError;

export interface GetPricingRuleAdminApiModelsModelIdPricingRulesRuleIdGetParams {
  /** Model Id */
  modelId: number;
  /** Rule Id */
  ruleId: number;
}

export type GetPricingRuleAdminApiModelsModelIdPricingRulesRuleIdGetData = any;

export type GetPricingRuleAdminApiModelsModelIdPricingRulesRuleIdGetError =
  HTTPValidationError;

export interface UpdatePricingRuleAdminApiModelsModelIdPricingRulesRuleIdPutParams {
  /** Model Id */
  modelId: number;
  /** Rule Id */
  ruleId: number;
}

export type UpdatePricingRuleAdminApiModelsModelIdPricingRulesRuleIdPutData =
  any;

export type UpdatePricingRuleAdminApiModelsModelIdPricingRulesRuleIdPutError =
  HTTPValidationError;

export interface DeletePricingRuleAdminApiModelsModelIdPricingRulesRuleIdDeleteParams {
  /** Model Id */
  modelId: number;
  /** Rule Id */
  ruleId: number;
}

export type DeletePricingRuleAdminApiModelsModelIdPricingRulesRuleIdDeleteData =
  any;

export type DeletePricingRuleAdminApiModelsModelIdPricingRulesRuleIdDeleteError =
  HTTPValidationError;

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
   * 排序字段：balance / points_balance / total_used_points / last_active_at
   */
  sortBy?: string | null;
  /**
   * Sortorder
   * 排序方向：asc / desc
   */
  sortOrder?: string | null;
  /**
   * Activefilter
   * 活跃用户筛选：today（当日）/ last7days（近7天）
   */
  activeFilter?: string | null;
}

export type ListUsersAdminApiUsersGetData = any;

export type ListUsersAdminApiUsersGetError = HTTPValidationError;

export interface ListRechargeRecordsAdminApiUsersRechargeRecordsGetParams {
  /**
   * Limit
   * Page size
   * @min 1
   * @max 100
   * @default 20
   */
  limit?: number;
  /**
   * Offset
   * Offset
   * @min 0
   * @default 0
   */
  offset?: number;
  /**
   * Userid
   * Filter by business user ID
   */
  userId?: string | null;
  /**
   * Username
   * Filter by user.userName (partial match)
   */
  userName?: string | null;
}

export type ListRechargeRecordsAdminApiUsersRechargeRecordsGetData = any;

export type ListRechargeRecordsAdminApiUsersRechargeRecordsGetError =
  HTTPValidationError;

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

export interface GetPointsAdminApiUsersUserIdPointsGetParams {
  /** User Id */
  userId: string;
}

export type GetPointsAdminApiUsersUserIdPointsGetData = any;

export type GetPointsAdminApiUsersUserIdPointsGetError = HTTPValidationError;

export interface GrantPointsAdminApiUsersUserIdPointsGrantPostParams {
  /** User Id */
  userId: string;
}

export type GrantPointsAdminApiUsersUserIdPointsGrantPostData = any;

export type GrantPointsAdminApiUsersUserIdPointsGrantPostError =
  HTTPValidationError;

export interface ListUserWorkspacesAdminApiUsersUserIdWorkspacesGetParams {
  /** User Id */
  userId: string;
}

export type ListUserWorkspacesAdminApiUsersUserIdWorkspacesGetData = any;

export type ListUserWorkspacesAdminApiUsersUserIdWorkspacesGetError =
  HTTPValidationError;

export interface ListBillingWorkspacesAdminApiUsersUserIdBillingWorkspacesGetParams {
  /** User Id */
  userId: string;
}

export type ListBillingWorkspacesAdminApiUsersUserIdBillingWorkspacesGetData =
  any;

export type ListBillingWorkspacesAdminApiUsersUserIdBillingWorkspacesGetError =
  HTTPValidationError;

export interface ListBillingMembersAdminApiUsersUserIdBillingMembersGetParams {
  /**
   * Workspace Id
   * 工作空间 ID，不传则查全部
   */
  workspace_id?: string | null;
  /** User Id */
  userId: string;
}

export type ListBillingMembersAdminApiUsersUserIdBillingMembersGetData = any;

export type ListBillingMembersAdminApiUsersUserIdBillingMembersGetError =
  HTTPValidationError;

export interface UserDailyPointsAdminApiUsersUserIdStatsDailyPointsGetParams {
  /**
   * Days
   * 近 N 天：7 / 14 / 30
   * @default 30
   */
  days?: number;
  /**
   * Start Date
   * 自定义起始日期 YYYY-MM-DD
   */
  start_date?: string | null;
  /**
   * End Date
   * 自定义结束日期 YYYY-MM-DD
   */
  end_date?: string | null;
  /**
   * Group By
   * 分组维度：model（模型）/ caller_id（成员）
   * @default "model"
   */
  group_by?: string;
  /**
   * Workspace Id
   * 工作空间 ID，不传则查全部
   */
  workspace_id?: string | null;
  /**
   * Member Caller Id
   * 成员 caller_id，不传则查全部成员
   */
  member_caller_id?: string | null;
  /** User Id */
  userId: string;
}

export type UserDailyPointsAdminApiUsersUserIdStatsDailyPointsGetData = any;

export type UserDailyPointsAdminApiUsersUserIdStatsDailyPointsGetError =
  HTTPValidationError;

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
  /**
   * Conversation Id
   * Filter by conversation ID
   */
  conversation_id?: string | null;
  /**
   * Turn Id
   * Filter by turn ID
   */
  turn_id?: string | null;
  /** User Id */
  userId: string;
}

export type ListRequestsAdminApiUsersUserIdRequestsGetData = any;

export type ListRequestsAdminApiUsersUserIdRequestsGetError =
  HTTPValidationError;

export interface ListConversationsAdminApiUsersUserIdConversationsGetParams {
  /**
   * Limit
   * Page size
   * @min 1
   * @max 100
   * @default 20
   */
  limit?: number;
  /**
   * Offset
   * Offset
   * @min 0
   * @default 0
   */
  offset?: number;
  /**
   * Conversation Id
   * Conversation ID
   */
  conversation_id?: string | null;
  /** User Id */
  userId: string;
}

export type ListConversationsAdminApiUsersUserIdConversationsGetData = any;

export type ListConversationsAdminApiUsersUserIdConversationsGetError =
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
  /**
   * Conversation Id
   * Filter by conversation ID
   */
  conversation_id?: string | null;
  /**
   * Turn Id
   * Filter by turn ID
   */
  turn_id?: string | null;
  /** User Id */
  userId: string;
}

export type ExportRequestsAdminApiUsersUserIdRequestsExportGetData = any;

export type ExportRequestsAdminApiUsersUserIdRequestsExportGetError =
  HTTPValidationError;

export interface ExportConversationsAdminApiUsersUserIdRequestsExportConversationsGetParams {
  /**
   * Conversation Id
   * Filter by conversation ID
   */
  conversation_id?: string | null;
  /**
   * Turn Id
   * Filter by turn ID
   */
  turn_id?: string | null;
  /** User Id */
  userId: string;
}

export type ExportConversationsAdminApiUsersUserIdRequestsExportConversationsGetData =
  any;

export type ExportConversationsAdminApiUsersUserIdRequestsExportConversationsGetError =
  HTTPValidationError;

export interface ExportConversationMarkdownAdminApiUsersUserIdRequestsExportConversationMarkdownGetParams {
  /**
   * Conversation Id
   * Conversation ID (required)
   */
  conversation_id: string;
  /**
   * Turn Id
   * Filter by turn ID
   */
  turn_id?: string | null;
  /**
   * Preview
   * Preview truncated markdown without download
   * @default false
   */
  preview?: boolean;
  /** User Id */
  userId: string;
}

export type ExportConversationMarkdownAdminApiUsersUserIdRequestsExportConversationMarkdownGetData =
  any;

export type ExportConversationMarkdownAdminApiUsersUserIdRequestsExportConversationMarkdownGetError =
  HTTPValidationError;

export type TotalUsageAdminApiStatsTotalUsageGetData = any;

export type TotalUsageAdminApiStatsTotalUsageGetError = HTTPValidationError;

export interface DailyTokensAdminApiStatsDailyTokensGetParams {
  /**
   * Days
   * 近 N 天：7 / 14 / 30
   * @default 30
   */
  days?: number;
  /**
   * Start Date
   * 自定义起始日期 YYYY-MM-DD
   */
  start_date?: string | null;
  /**
   * End Date
   * 自定义结束日期 YYYY-MM-DD
   */
  end_date?: string | null;
}

export type DailyTokensAdminApiStatsDailyTokensGetData = any;

export type DailyTokensAdminApiStatsDailyTokensGetError = HTTPValidationError;

export interface DailyTokensByModelAdminApiStatsDailyTokensByModelGetParams {
  /**
   * Days
   * 近 N 天：7 / 14 / 30
   * @default 30
   */
  days?: number;
  /**
   * Start Date
   * 自定义起始日期 YYYY-MM-DD
   */
  start_date?: string | null;
  /**
   * End Date
   * 自定义结束日期 YYYY-MM-DD
   */
  end_date?: string | null;
}

export type DailyTokensByModelAdminApiStatsDailyTokensByModelGetData = any;

export type DailyTokensByModelAdminApiStatsDailyTokensByModelGetError =
  HTTPValidationError;

export interface DailyPointsAdminApiStatsDailyPointsGetParams {
  /**
   * Days
   * 近 N 天：7 / 14 / 30
   * @default 30
   */
  days?: number;
  /**
   * Start Date
   * 自定义起始日期 YYYY-MM-DD
   */
  start_date?: string | null;
  /**
   * End Date
   * 自定义结束日期 YYYY-MM-DD
   */
  end_date?: string | null;
}

export type DailyPointsAdminApiStatsDailyPointsGetData = any;

export type DailyPointsAdminApiStatsDailyPointsGetError = HTTPValidationError;

export interface DailyUsageByModelAdminApiStatsDailyUsageByModelGetParams {
  /**
   * Days
   * 近 N 天：7 / 14 / 30
   * @default 30
   */
  days?: number;
  /**
   * Start Date
   * 自定义起始日期 YYYY-MM-DD
   */
  start_date?: string | null;
  /**
   * End Date
   * 自定义结束日期 YYYY-MM-DD
   */
  end_date?: string | null;
}

export type DailyUsageByModelAdminApiStatsDailyUsageByModelGetData = any;

export type DailyUsageByModelAdminApiStatsDailyUsageByModelGetError =
  HTTPValidationError;

export interface AppEventsAdminApiStatsAppEventsGetParams {
  /**
   * Days
   * 近 N 天：7 / 14 / 30
   * @default 30
   */
  days?: number;
  /**
   * Start Date
   * 自定义起始日期 YYYY-MM-DD
   */
  start_date?: string | null;
  /**
   * End Date
   * 自定义结束日期 YYYY-MM-DD
   */
  end_date?: string | null;
}

export type AppEventsAdminApiStatsAppEventsGetData = any;

export type AppEventsAdminApiStatsAppEventsGetError = HTTPValidationError;

export interface DailyRechargeAdminApiStatsDailyRechargeGetParams {
  /**
   * Days
   * 近 N 天：7 / 14 / 30
   * @default 30
   */
  days?: number;
  /**
   * Start Date
   * 自定义起始日期 YYYY-MM-DD
   */
  start_date?: string | null;
  /**
   * End Date
   * 自定义结束日期 YYYY-MM-DD
   */
  end_date?: string | null;
}

export type DailyRechargeAdminApiStatsDailyRechargeGetData = any;

export type DailyRechargeAdminApiStatsDailyRechargeGetError =
  HTTPValidationError;

export interface DailyActiveUsersAdminApiStatsDailyActiveUsersGetParams {
  /**
   * Days
   * 近 N 天：7 / 14 / 30
   * @default 30
   */
  days?: number;
  /**
   * Start Date
   * 自定义起始日期 YYYY-MM-DD
   */
  start_date?: string | null;
  /**
   * End Date
   * 自定义结束日期 YYYY-MM-DD
   */
  end_date?: string | null;
}

export type DailyActiveUsersAdminApiStatsDailyActiveUsersGetData = any;

export type DailyActiveUsersAdminApiStatsDailyActiveUsersGetError =
  HTTPValidationError;

export interface DailyApiRequestsAdminApiStatsDailyApiRequestsGetParams {
  /**
   * Days
   * 近 N 天：7 / 14 / 30
   * @default 30
   */
  days?: number;
  /**
   * Start Date
   * 自定义起始日期 YYYY-MM-DD
   */
  start_date?: string | null;
  /**
   * End Date
   * 自定义结束日期 YYYY-MM-DD
   */
  end_date?: string | null;
}

export type DailyApiRequestsAdminApiStatsDailyApiRequestsGetData = any;

export type DailyApiRequestsAdminApiStatsDailyApiRequestsGetError =
  HTTPValidationError;

export interface DailyNewUsersAdminApiStatsDailyNewUsersGetParams {
  /**
   * Days
   * 近 N 天：7 / 14 / 30
   * @default 30
   */
  days?: number;
  /**
   * Start Date
   * 自定义起始日期 YYYY-MM-DD
   */
  start_date?: string | null;
  /**
   * End Date
   * 自定义结束日期 YYYY-MM-DD
   */
  end_date?: string | null;
}

export type DailyNewUsersAdminApiStatsDailyNewUsersGetData = any;

export type DailyNewUsersAdminApiStatsDailyNewUsersGetError =
  HTTPValidationError;

export interface TopSkillInstallsAdminApiStatsTopSkillInstallsGetParams {
  /**
   * Limit
   * 返回条数
   * @min 1
   * @max 100
   * @default 10
   */
  limit?: number;
}

export type TopSkillInstallsAdminApiStatsTopSkillInstallsGetData = any;

export type TopSkillInstallsAdminApiStatsTopSkillInstallsGetError =
  HTTPValidationError;

export interface TopTemplateAdditionsAdminApiStatsTopTemplateAdditionsGetParams {
  /**
   * Templatetype
   * 模板类型：script / skill
   * @default "script"
   */
  templateType?: string;
  /**
   * Limit
   * 返回条数
   * @min 1
   * @max 100
   * @default 10
   */
  limit?: number;
}

export type TopTemplateAdditionsAdminApiStatsTopTemplateAdditionsGetData = any;

export type TopTemplateAdditionsAdminApiStatsTopTemplateAdditionsGetError =
  HTTPValidationError;

export interface FailedRequestsAdminApiStatsFailedRequestsGetParams {
  /**
   * Days
   * 近 N 天：7 / 14 / 30
   * @default 30
   */
  days?: number;
  /**
   * Start Date
   * 自定义起始日期 YYYY-MM-DD
   */
  start_date?: string | null;
  /**
   * End Date
   * 自定义结束日期 YYYY-MM-DD
   */
  end_date?: string | null;
  /**
   * Limit
   * 每页条数
   * @min 1
   * @max 100
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
}

export type FailedRequestsAdminApiStatsFailedRequestsGetData = any;

export type FailedRequestsAdminApiStatsFailedRequestsGetError =
  HTTPValidationError;

export interface AppVersionUsersAdminApiStatsAppVersionUsersGetParams {
  /**
   * Days
   * 近 N 天：7 / 14 / 30
   * @default 30
   */
  days?: number;
  /**
   * Start Date
   * 自定义起始日期 YYYY-MM-DD
   */
  start_date?: string | null;
  /**
   * End Date
   * 自定义结束日期 YYYY-MM-DD
   */
  end_date?: string | null;
}

export type AppVersionUsersAdminApiStatsAppVersionUsersGetData = any;

export type AppVersionUsersAdminApiStatsAppVersionUsersGetError =
  HTTPValidationError;

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

export type DownloadBatchConversationExportAdminApiConversationsBatchExportDownloadGetData =
  any;

export type DownloadBatchConversationExportAdminApiConversationsBatchExportDownloadGetError =
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

export type ListScriptCategoriesAdminApiScriptCategoriesGetData = any;

export type ListScriptCategoriesAdminApiScriptCategoriesGetError =
  HTTPValidationError;

export type CreateScriptCategoryAdminApiScriptCategoriesPostData = any;

export type CreateScriptCategoryAdminApiScriptCategoriesPostError =
  HTTPValidationError;

export interface UpdateScriptCategoryAdminApiScriptCategoriesCategoryIdPutParams {
  /** Category Id */
  categoryId: number;
}

export type UpdateScriptCategoryAdminApiScriptCategoriesCategoryIdPutData = any;

export type UpdateScriptCategoryAdminApiScriptCategoriesCategoryIdPutError =
  HTTPValidationError;

export interface DeleteScriptCategoryAdminApiScriptCategoriesCategoryIdDeleteParams {
  /** Category Id */
  categoryId: number;
}

export type DeleteScriptCategoryAdminApiScriptCategoriesCategoryIdDeleteData =
  any;

export type DeleteScriptCategoryAdminApiScriptCategoriesCategoryIdDeleteError =
  HTTPValidationError;

export interface SetScriptCategoryEnabledAdminApiScriptCategoriesCategoryIdEnabledPutParams {
  /** Category Id */
  categoryId: number;
}

export type SetScriptCategoryEnabledAdminApiScriptCategoriesCategoryIdEnabledPutData =
  any;

export type SetScriptCategoryEnabledAdminApiScriptCategoriesCategoryIdEnabledPutError =
  HTTPValidationError;

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

export type UploadSkillIconAdminApiSkillsIconUploadPostData = any;

export type UploadSkillIconAdminApiSkillsIconUploadPostError =
  HTTPValidationError;

export interface UploadSkillPackageAdminApiSkillsSkillIdUploadPostParams {
  /** Skill Id */
  skillId: number;
}

export type UploadSkillPackageAdminApiSkillsSkillIdUploadPostData = any;

export type UploadSkillPackageAdminApiSkillsSkillIdUploadPostError =
  HTTPValidationError;

export interface DownloadSkillPackageAdminApiSkillsSkillIdDownloadGetParams {
  /** Skill Id */
  skillId: number;
}

export type DownloadSkillPackageAdminApiSkillsSkillIdDownloadGetData = any;

export type DownloadSkillPackageAdminApiSkillsSkillIdDownloadGetError =
  HTTPValidationError;

export interface ListPromptTemplatesAdminApiPromptTemplatesGetParams {
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
   * 按标题、内容或 ID 模糊搜索
   */
  search?: string | null;
  /**
   * Status
   * 状态过滤：1=生效,0=失效
   */
  status?: number | null;
  /**
   * Sortby
   * 排序字段：id / createTime / updateTime
   */
  sortBy?: string | null;
  /**
   * Sortorder
   * 排序方向：asc / desc
   */
  sortOrder?: string | null;
}

export type ListPromptTemplatesAdminApiPromptTemplatesGetData = any;

export type ListPromptTemplatesAdminApiPromptTemplatesGetError =
  HTTPValidationError;

export type CreatePromptTemplateAdminApiPromptTemplatesPostData = any;

export type CreatePromptTemplateAdminApiPromptTemplatesPostError =
  HTTPValidationError;

export interface GetPromptTemplateAdminApiPromptTemplatesTemplateIdGetParams {
  /** Template Id */
  templateId: number;
}

export type GetPromptTemplateAdminApiPromptTemplatesTemplateIdGetData = any;

export type GetPromptTemplateAdminApiPromptTemplatesTemplateIdGetError =
  HTTPValidationError;

export interface UpdatePromptTemplateAdminApiPromptTemplatesTemplateIdPutParams {
  /** Template Id */
  templateId: number;
}

export type UpdatePromptTemplateAdminApiPromptTemplatesTemplateIdPutData = any;

export type UpdatePromptTemplateAdminApiPromptTemplatesTemplateIdPutError =
  HTTPValidationError;

export interface DeletePromptTemplateAdminApiPromptTemplatesTemplateIdDeleteParams {
  /** Template Id */
  templateId: number;
}

export type DeletePromptTemplateAdminApiPromptTemplatesTemplateIdDeleteData =
  any;

export type DeletePromptTemplateAdminApiPromptTemplatesTemplateIdDeleteError =
  HTTPValidationError;

export interface ListScriptsAdminApiScriptsGetParams {
  /**
   * Search
   * 按 slug、名称、描述模糊搜索
   */
  search?: string | null;
  /**
   * Category Slug
   * 按分类 slug 过滤
   */
  category_slug?: string | null;
  /** Categoryslug */
  categorySlug?: string | null;
}

export type ListScriptsAdminApiScriptsGetData = any;

export type ListScriptsAdminApiScriptsGetError = HTTPValidationError;

export type CreateScriptAdminApiScriptsPostData = any;

export type CreateScriptAdminApiScriptsPostError = HTTPValidationError;

export interface GetScriptAdminApiScriptsScriptIdGetParams {
  /** Script Id */
  scriptId: number;
}

export type GetScriptAdminApiScriptsScriptIdGetData = any;

export type GetScriptAdminApiScriptsScriptIdGetError = HTTPValidationError;

export interface UpdateScriptAdminApiScriptsScriptIdPutParams {
  /** Script Id */
  scriptId: number;
}

export type UpdateScriptAdminApiScriptsScriptIdPutData = any;

export type UpdateScriptAdminApiScriptsScriptIdPutError = HTTPValidationError;

export interface DeleteScriptAdminApiScriptsScriptIdDeleteParams {
  /** Script Id */
  scriptId: number;
}

export type DeleteScriptAdminApiScriptsScriptIdDeleteData = any;

export type DeleteScriptAdminApiScriptsScriptIdDeleteError =
  HTTPValidationError;

export interface UploadScriptFileAdminApiScriptsScriptIdUploadPostParams {
  /** Script Id */
  scriptId: number;
}

export type UploadScriptFileAdminApiScriptsScriptIdUploadPostData = any;

export type UploadScriptFileAdminApiScriptsScriptIdUploadPostError =
  HTTPValidationError;

export interface ListTemplatesAdminApiTemplatesGetParams {
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
   * 按 slug、名称、描述模糊搜索
   */
  search?: string | null;
  /**
   * Template Type
   * 按类型过滤：script/skill/prompt
   */
  template_type?: string | null;
  /** Templatetype */
  templateType?: string | null;
  /**
   * Label Slug
   * 按标签 slug 过滤
   */
  label_slug?: string | null;
  /** Labelslug */
  labelSlug?: string | null;
  /**
   * Label Ids
   * 按多个标签 ID 过滤；模板必须包含全部标签
   */
  label_ids?: number[] | null;
  /** Labelids */
  labelIds?: number[] | null;
  /**
   * Order By
   * 排序字段：id/slug/name/version/updated_at
   */
  order_by?: string | null;
  /** Orderby */
  orderBy?: string | null;
  /**
   * Order Dir
   * 排序方向：asc/desc
   */
  order_dir?: string | null;
  /** Orderdir */
  orderDir?: string | null;
}

export type ListTemplatesAdminApiTemplatesGetData = any;

export type ListTemplatesAdminApiTemplatesGetError = HTTPValidationError;

export type CreateTemplateAdminApiTemplatesPostData = any;

export type CreateTemplateAdminApiTemplatesPostError = HTTPValidationError;

export interface ExportTemplatesAdminApiTemplatesExportGetParams {
  /**
   * Ids
   * 要导出的模板 ID；为空时导出全部
   */
  ids?: number[] | null;
}

export type ExportTemplatesAdminApiTemplatesExportGetData = any;

export type ExportTemplatesAdminApiTemplatesExportGetError =
  HTTPValidationError;

export type ReorderTemplatesAdminApiTemplatesReorderPutData = any;

export type ReorderTemplatesAdminApiTemplatesReorderPutError =
  HTTPValidationError;

export interface ImportTemplatesAdminApiTemplatesImportPostParams {
  /**
   * Overwrite
   * 同 slug 模板存在时是否覆盖
   * @default true
   */
  overwrite?: boolean;
}

export type ImportTemplatesAdminApiTemplatesImportPostData = any;

export type ImportTemplatesAdminApiTemplatesImportPostError =
  HTTPValidationError;

export interface GetTemplateAdminApiTemplatesTemplateIdGetParams {
  /** Template Id */
  templateId: number;
}

export type GetTemplateAdminApiTemplatesTemplateIdGetData = any;

export type GetTemplateAdminApiTemplatesTemplateIdGetError =
  HTTPValidationError;

export interface UpdateTemplateAdminApiTemplatesTemplateIdPutParams {
  /** Template Id */
  templateId: number;
}

export type UpdateTemplateAdminApiTemplatesTemplateIdPutData = any;

export type UpdateTemplateAdminApiTemplatesTemplateIdPutError =
  HTTPValidationError;

export interface DeleteTemplateAdminApiTemplatesTemplateIdDeleteParams {
  /** Template Id */
  templateId: number;
}

export type DeleteTemplateAdminApiTemplatesTemplateIdDeleteData = any;

export type DeleteTemplateAdminApiTemplatesTemplateIdDeleteError =
  HTTPValidationError;

export type BatchTemplatesAdminApiTemplatesBatchPostData = any;

export type BatchTemplatesAdminApiTemplatesBatchPostError = HTTPValidationError;

export type UploadScriptFileAdminApiTemplatesUploadScriptPostData = any;

export type UploadScriptFileAdminApiTemplatesUploadScriptPostError =
  HTTPValidationError;

export type UploadSkillFileAdminApiTemplatesUploadSkillPostData = any;

export type UploadSkillFileAdminApiTemplatesUploadSkillPostError =
  HTTPValidationError;

export type UploadIconFileAdminApiTemplatesUploadIconPostData = any;

export type UploadIconFileAdminApiTemplatesUploadIconPostError =
  HTTPValidationError;

export type ListTemplateLabelCategoriesAdminApiTemplateLabelCategoriesGetData =
  any;

export type ListTemplateLabelCategoriesAdminApiTemplateLabelCategoriesGetError =
  HTTPValidationError;

export type CreateTemplateLabelCategoryAdminApiTemplateLabelCategoriesPostData =
  any;

export type CreateTemplateLabelCategoryAdminApiTemplateLabelCategoriesPostError =
  HTTPValidationError;

export type ReorderTemplateLabelCategoriesAdminApiTemplateLabelCategoriesReorderPutData =
  any;

export type ReorderTemplateLabelCategoriesAdminApiTemplateLabelCategoriesReorderPutError =
  HTTPValidationError;

export interface UpdateTemplateLabelCategoryAdminApiTemplateLabelCategoriesCategoryIdPutParams {
  /** Category Id */
  categoryId: number;
}

export type UpdateTemplateLabelCategoryAdminApiTemplateLabelCategoriesCategoryIdPutData =
  any;

export type UpdateTemplateLabelCategoryAdminApiTemplateLabelCategoriesCategoryIdPutError =
  HTTPValidationError;

export interface DeleteTemplateLabelCategoryAdminApiTemplateLabelCategoriesCategoryIdDeleteParams {
  /** Category Id */
  categoryId: number;
}

export type DeleteTemplateLabelCategoryAdminApiTemplateLabelCategoriesCategoryIdDeleteData =
  any;

export type DeleteTemplateLabelCategoryAdminApiTemplateLabelCategoriesCategoryIdDeleteError =
  HTTPValidationError;

export interface SetTemplateLabelCategoryEnabledAdminApiTemplateLabelCategoriesCategoryIdEnabledPutParams {
  /** Category Id */
  categoryId: number;
}

export type SetTemplateLabelCategoryEnabledAdminApiTemplateLabelCategoriesCategoryIdEnabledPutData =
  any;

export type SetTemplateLabelCategoryEnabledAdminApiTemplateLabelCategoriesCategoryIdEnabledPutError =
  HTTPValidationError;

export interface ListTemplateLabelsAdminApiTemplateLabelsGetParams {
  /**
   * Limit
   * 每页条数；不传则返回全部数组
   */
  limit?: number | null;
  /**
   * Offset
   * 偏移量
   * @min 0
   * @default 0
   */
  offset?: number;
  /**
   * Search
   * 按 slug、名称模糊搜索
   */
  search?: string | null;
  /**
   * Category Id
   * 按分类 ID 过滤
   */
  category_id?: number | null;
  /** Categoryid */
  categoryId?: number | null;
}

export type ListTemplateLabelsAdminApiTemplateLabelsGetData = any;

export type ListTemplateLabelsAdminApiTemplateLabelsGetError =
  HTTPValidationError;

export type CreateTemplateLabelAdminApiTemplateLabelsPostData = any;

export type CreateTemplateLabelAdminApiTemplateLabelsPostError =
  HTTPValidationError;

export type ReorderTemplateLabelsAdminApiTemplateLabelsReorderPutData = any;

export type ReorderTemplateLabelsAdminApiTemplateLabelsReorderPutError =
  HTTPValidationError;

export interface UpdateTemplateLabelAdminApiTemplateLabelsLabelIdPutParams {
  /** Label Id */
  labelId: number;
}

export type UpdateTemplateLabelAdminApiTemplateLabelsLabelIdPutData = any;

export type UpdateTemplateLabelAdminApiTemplateLabelsLabelIdPutError =
  HTTPValidationError;

export interface DeleteTemplateLabelAdminApiTemplateLabelsLabelIdDeleteParams {
  /** Label Id */
  labelId: number;
}

export type DeleteTemplateLabelAdminApiTemplateLabelsLabelIdDeleteData = any;

export type DeleteTemplateLabelAdminApiTemplateLabelsLabelIdDeleteError =
  HTTPValidationError;

export interface SetTemplateLabelEnabledAdminApiTemplateLabelsLabelIdEnabledPutParams {
  /** Label Id */
  labelId: number;
}

export type SetTemplateLabelEnabledAdminApiTemplateLabelsLabelIdEnabledPutData =
  any;

export type SetTemplateLabelEnabledAdminApiTemplateLabelsLabelIdEnabledPutError =
  HTTPValidationError;

export type BatchTemplateLabelsAdminApiTemplateLabelsBatchPostData = any;

export type BatchTemplateLabelsAdminApiTemplateLabelsBatchPostError =
  HTTPValidationError;

export interface ListUserScriptsAdminApiUserScriptsGetParams {
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
   * 按名称、描述模糊搜索
   */
  search?: string | null;
  /**
   * Userid
   * 按用户 ID 过滤
   */
  userId?: string | null;
}

export type ListUserScriptsAdminApiUserScriptsGetData = any;

export type ListUserScriptsAdminApiUserScriptsGetError = HTTPValidationError;

export interface DeleteUserScriptAdminApiUserScriptsScriptIdDeleteParams {
  /** Script Id */
  scriptId: number;
}

export type DeleteUserScriptAdminApiUserScriptsScriptIdDeleteData = any;

export type DeleteUserScriptAdminApiUserScriptsScriptIdDeleteError =
  HTTPValidationError;

export interface ListUserTemplatesAdminApiUserTemplatesGetParams {
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
   * 按名称、描述模糊搜索
   */
  search?: string | null;
  /**
   * Userid
   * 按用户 ID 过滤
   */
  userId?: string | null;
  /**
   * Workspaceid
   * 按 workspace ID 过滤
   */
  workspaceId?: string | null;
  /**
   * Templatetype
   * 按类型过滤：script/skill/prompt
   */
  templateType?: string | null;
}

export type ListUserTemplatesAdminApiUserTemplatesGetData = any;

export type ListUserTemplatesAdminApiUserTemplatesGetError =
  HTTPValidationError;

export interface DeleteUserTemplateAdminApiUserTemplatesTemplateIdDeleteParams {
  /** Template Id */
  templateId: number;
}

export type DeleteUserTemplateAdminApiUserTemplatesTemplateIdDeleteData = any;

export type DeleteUserTemplateAdminApiUserTemplatesTemplateIdDeleteError =
  HTTPValidationError;

export type BatchUserTemplatesAdminApiUserTemplatesBatchPostData = any;

export type BatchUserTemplatesAdminApiUserTemplatesBatchPostError =
  HTTPValidationError;

export interface ListFeedbacksAdminApiFeedbacksGetParams {
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
   * Status
   * 按状态过滤，可重复传入：status=pending&status=processing；也兼容逗号分隔。
   */
  status?: string[] | null;
  /**
   * Search
   * 按内容、联系方式模糊搜索
   */
  search?: string | null;
  /**
   * Userid
   * 按用户 ID 过滤
   */
  userId?: string | null;
}

export type ListFeedbacksAdminApiFeedbacksGetData = any;

export type ListFeedbacksAdminApiFeedbacksGetError = HTTPValidationError;

export interface GetFeedbackAdminApiFeedbacksFeedbackIdGetParams {
  /** Feedback Id */
  feedbackId: number;
}

export type GetFeedbackAdminApiFeedbacksFeedbackIdGetData = any;

export type GetFeedbackAdminApiFeedbacksFeedbackIdGetError =
  HTTPValidationError;

export interface UpdateFeedbackAdminApiFeedbacksFeedbackIdPatchParams {
  /** Feedback Id */
  feedbackId: number;
}

export type UpdateFeedbackAdminApiFeedbacksFeedbackIdPatchData = any;

export type UpdateFeedbackAdminApiFeedbacksFeedbackIdPatchError =
  HTTPValidationError;

export interface DeleteFeedbackAdminApiFeedbacksFeedbackIdDeleteParams {
  /** Feedback Id */
  feedbackId: number;
}

export type DeleteFeedbackAdminApiFeedbacksFeedbackIdDeleteData = any;

export type DeleteFeedbackAdminApiFeedbacksFeedbackIdDeleteError =
  HTTPValidationError;

export type BatchFeedbacksAdminApiFeedbacksBatchPostData = any;

export type BatchFeedbacksAdminApiFeedbacksBatchPostError = HTTPValidationError;

export interface ListOssFilesAdminApiOssFilesGetParams {
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
   * 按文件名、OSS key 模糊搜索
   */
  search?: string | null;
  /**
   * Userid
   * 按用户 ID 过滤
   */
  userId?: string | null;
}

export type ListOssFilesAdminApiOssFilesGetData = any;

export type ListOssFilesAdminApiOssFilesGetError = HTTPValidationError;

export type UploadOssFileAdminApiOssFilesUploadPostData = any;

export type UploadOssFileAdminApiOssFilesUploadPostError = HTTPValidationError;

export interface ListRequestLogArchivesAdminApiRequestLogArchivesGetParams {
  /**
   * Limit
   * @min 1
   * @max 200
   * @default 20
   */
  limit?: number;
  /**
   * Offset
   * @min 0
   * @default 0
   */
  offset?: number;
  /**
   * Status
   * pending|processing|completed|failed
   */
  status?: string | null;
  /**
   * Log From
   * 日志时间范围起点 YYYY-MM-DD
   */
  log_from?: string | null;
  /**
   * Log To
   * 日志时间范围终点 YYYY-MM-DD
   */
  log_to?: string | null;
}

export type ListRequestLogArchivesAdminApiRequestLogArchivesGetData = any;

export type ListRequestLogArchivesAdminApiRequestLogArchivesGetError =
  HTTPValidationError;

export interface GetRequestLogArchiveAdminApiRequestLogArchivesArchiveIdGetParams {
  /** Archive Id */
  archiveId: number;
}

export type GetRequestLogArchiveAdminApiRequestLogArchivesArchiveIdGetData =
  any;

export type GetRequestLogArchiveAdminApiRequestLogArchivesArchiveIdGetError =
  HTTPValidationError;

export interface ListIpWhitelistAdminApiIpWhitelistGetParams {
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
   * 按 IP 或备注模糊搜索
   */
  search?: string | null;
}

export type ListIpWhitelistAdminApiIpWhitelistGetData = any;

export type ListIpWhitelistAdminApiIpWhitelistGetError = HTTPValidationError;

export type CreateIpWhitelistAdminApiIpWhitelistPostData = any;

export type CreateIpWhitelistAdminApiIpWhitelistPostError = HTTPValidationError;

export interface UpdateIpWhitelistAdminApiIpWhitelistEntryIdPutParams {
  /** Entry Id */
  entryId: number;
}

export type UpdateIpWhitelistAdminApiIpWhitelistEntryIdPutData = any;

export type UpdateIpWhitelistAdminApiIpWhitelistEntryIdPutError =
  HTTPValidationError;

export interface DeleteIpWhitelistAdminApiIpWhitelistEntryIdDeleteParams {
  /** Entry Id */
  entryId: number;
}

export type DeleteIpWhitelistAdminApiIpWhitelistEntryIdDeleteData = any;

export type DeleteIpWhitelistAdminApiIpWhitelistEntryIdDeleteError =
  HTTPValidationError;
