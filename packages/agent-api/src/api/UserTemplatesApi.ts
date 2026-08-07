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
  BodyUploadUserTemplateScript,
  BodyUploadUserTemplateSkill,
  CreateUserTemplateData,
  CreateUserTemplateError,
  DeleteUserTemplateData,
  DeleteUserTemplateError,
  DeleteUserTemplateParams,
  GetUserTemplateData,
  GetUserTemplateError,
  GetUserTemplateParams,
  InitializeUserTemplatePresetsData,
  InitializeUserTemplatePresetsError,
  ListUserTemplatesData,
  ListUserTemplatesError,
  ListUserTemplatesParams,
  UpdateUserTemplateData,
  UpdateUserTemplateError,
  UpdateUserTemplateParams,
  UploadUserTemplateScriptData,
  UploadUserTemplateScriptError,
  UploadUserTemplateSkillData,
  UploadUserTemplateSkillError,
  UserTemplateCreate,
  UserTemplateUpdate,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class UserTemplatesApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags UserTemplates
   * @name UploadUserTemplateScript
   * @summary 上传用户模板脚本文件
   * @request POST:/v1/user/templates/upload-script
   * @response `200` `UploadUserTemplateScriptData` Successful Response
   * @response `400` `ApiErrorResponse` Bad Request
   * @response `401` `ApiErrorResponse` Unauthorized
   * @response `402` `ApiErrorResponse` Payment Required
   * @response `403` `ApiErrorResponse` Forbidden
   * @response `404` `ApiErrorResponse` Not Found
   * @response `409` `ApiErrorResponse` Conflict
   * @response `413` `ApiErrorResponse` Request Entity Too Large
   * @response `415` `ApiErrorResponse` Unsupported Media Type
   * @response `422` `ApiErrorResponse` Unprocessable Entity
   * @response `429` `ApiErrorResponse` Too Many Requests
   * @response `500` `ApiErrorResponse` Internal Server Error
   * @response `503` `ApiErrorResponse` Service Unavailable
   * @response `504` `ApiErrorResponse` Gateway Timeout
   */
  uploadUserTemplateScript = (
    data: BodyUploadUserTemplateScript,
    params: RequestParams = {},
  ) =>
    this.http.request<
      UploadUserTemplateScriptData,
      UploadUserTemplateScriptError
    >({
      path: `/v1/user/templates/upload-script`,
      method: "POST",
      body: data,
      type: ContentType.FormData,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags UserTemplates
   * @name UploadUserTemplateSkill
   * @summary 解析并上传用户模板 Skill
   * @request POST:/v1/user/templates/upload-skill
   * @response `200` `UploadUserTemplateSkillData` Successful Response
   * @response `400` `ApiErrorResponse` Bad Request
   * @response `401` `ApiErrorResponse` Unauthorized
   * @response `402` `ApiErrorResponse` Payment Required
   * @response `403` `ApiErrorResponse` Forbidden
   * @response `404` `ApiErrorResponse` Not Found
   * @response `409` `ApiErrorResponse` Conflict
   * @response `413` `ApiErrorResponse` Request Entity Too Large
   * @response `415` `ApiErrorResponse` Unsupported Media Type
   * @response `422` `ApiErrorResponse` Unprocessable Entity
   * @response `429` `ApiErrorResponse` Too Many Requests
   * @response `500` `ApiErrorResponse` Internal Server Error
   * @response `503` `ApiErrorResponse` Service Unavailable
   * @response `504` `ApiErrorResponse` Gateway Timeout
   */
  uploadUserTemplateSkill = (
    data: BodyUploadUserTemplateSkill,
    params: RequestParams = {},
  ) =>
    this.http.request<
      UploadUserTemplateSkillData,
      UploadUserTemplateSkillError
    >({
      path: `/v1/user/templates/upload-skill`,
      method: "POST",
      body: data,
      type: ContentType.FormData,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags UserTemplates
   * @name CreateUserTemplate
   * @summary 创建用户模板（可基于官方模板快照派生）
   * @request POST:/v1/user/templates
   * @response `200` `CreateUserTemplateData` Successful Response
   * @response `400` `ApiErrorResponse` Bad Request
   * @response `401` `ApiErrorResponse` Unauthorized
   * @response `402` `ApiErrorResponse` Payment Required
   * @response `403` `ApiErrorResponse` Forbidden
   * @response `404` `ApiErrorResponse` Not Found
   * @response `409` `ApiErrorResponse` Conflict
   * @response `413` `ApiErrorResponse` Request Entity Too Large
   * @response `415` `ApiErrorResponse` Unsupported Media Type
   * @response `422` `ApiErrorResponse` Unprocessable Entity
   * @response `429` `ApiErrorResponse` Too Many Requests
   * @response `500` `ApiErrorResponse` Internal Server Error
   * @response `503` `ApiErrorResponse` Service Unavailable
   * @response `504` `ApiErrorResponse` Gateway Timeout
   */
  createUserTemplate = (data: UserTemplateCreate, params: RequestParams = {}) =>
    this.http.request<CreateUserTemplateData, CreateUserTemplateError>({
      path: `/v1/user/templates`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags UserTemplates
   * @name ListUserTemplates
   * @summary 分页列出用户模板
   * @request GET:/v1/user/templates
   * @response `200` `ListUserTemplatesData` Successful Response
   * @response `400` `ApiErrorResponse` Bad Request
   * @response `401` `ApiErrorResponse` Unauthorized
   * @response `402` `ApiErrorResponse` Payment Required
   * @response `403` `ApiErrorResponse` Forbidden
   * @response `404` `ApiErrorResponse` Not Found
   * @response `409` `ApiErrorResponse` Conflict
   * @response `413` `ApiErrorResponse` Request Entity Too Large
   * @response `415` `ApiErrorResponse` Unsupported Media Type
   * @response `422` `ApiErrorResponse` Unprocessable Entity
   * @response `429` `ApiErrorResponse` Too Many Requests
   * @response `500` `ApiErrorResponse` Internal Server Error
   * @response `503` `ApiErrorResponse` Service Unavailable
   * @response `504` `ApiErrorResponse` Gateway Timeout
   */
  listUserTemplates = (
    query: ListUserTemplatesParams,
    params: RequestParams = {},
  ) =>
    this.http.request<ListUserTemplatesData, ListUserTemplatesError>({
      path: `/v1/user/templates`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags UserTemplates
   * @name InitializeUserTemplatePresets
   * @summary 为未初始化的空 workspace 初始化预置用户模板
   * @request POST:/v1/user/templates/initialize-presets
   * @response `200` `InitializeUserTemplatePresetsData` Successful Response
   * @response `400` `ApiErrorResponse` Bad Request
   * @response `401` `ApiErrorResponse` Unauthorized
   * @response `402` `ApiErrorResponse` Payment Required
   * @response `403` `ApiErrorResponse` Forbidden
   * @response `404` `ApiErrorResponse` Not Found
   * @response `409` `ApiErrorResponse` Conflict
   * @response `413` `ApiErrorResponse` Request Entity Too Large
   * @response `415` `ApiErrorResponse` Unsupported Media Type
   * @response `422` `ApiErrorResponse` Unprocessable Entity
   * @response `429` `ApiErrorResponse` Too Many Requests
   * @response `500` `ApiErrorResponse` Internal Server Error
   * @response `503` `ApiErrorResponse` Service Unavailable
   * @response `504` `ApiErrorResponse` Gateway Timeout
   */
  initializeUserTemplatePresets = (params: RequestParams = {}) =>
    this.http.request<
      InitializeUserTemplatePresetsData,
      InitializeUserTemplatePresetsError
    >({
      path: `/v1/user/templates/initialize-presets`,
      method: "POST",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags UserTemplates
   * @name GetUserTemplate
   * @summary 获取用户模板详情
   * @request GET:/v1/user/templates/{template_id}
   * @response `200` `GetUserTemplateData` Successful Response
   * @response `400` `ApiErrorResponse` Bad Request
   * @response `401` `ApiErrorResponse` Unauthorized
   * @response `402` `ApiErrorResponse` Payment Required
   * @response `403` `ApiErrorResponse` Forbidden
   * @response `404` `ApiErrorResponse` Not Found
   * @response `409` `ApiErrorResponse` Conflict
   * @response `413` `ApiErrorResponse` Request Entity Too Large
   * @response `415` `ApiErrorResponse` Unsupported Media Type
   * @response `422` `ApiErrorResponse` Unprocessable Entity
   * @response `429` `ApiErrorResponse` Too Many Requests
   * @response `500` `ApiErrorResponse` Internal Server Error
   * @response `503` `ApiErrorResponse` Service Unavailable
   * @response `504` `ApiErrorResponse` Gateway Timeout
   */
  getUserTemplate = (
    { templateId }: GetUserTemplateParams,
    params: RequestParams = {},
  ) =>
    this.http.request<GetUserTemplateData, GetUserTemplateError>({
      path: `/v1/user/templates/${templateId}`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags UserTemplates
   * @name UpdateUserTemplate
   * @summary 更新用户模板
   * @request PUT:/v1/user/templates/{template_id}
   * @response `200` `UpdateUserTemplateData` Successful Response
   * @response `400` `ApiErrorResponse` Bad Request
   * @response `401` `ApiErrorResponse` Unauthorized
   * @response `402` `ApiErrorResponse` Payment Required
   * @response `403` `ApiErrorResponse` Forbidden
   * @response `404` `ApiErrorResponse` Not Found
   * @response `409` `ApiErrorResponse` Conflict
   * @response `413` `ApiErrorResponse` Request Entity Too Large
   * @response `415` `ApiErrorResponse` Unsupported Media Type
   * @response `422` `ApiErrorResponse` Unprocessable Entity
   * @response `429` `ApiErrorResponse` Too Many Requests
   * @response `500` `ApiErrorResponse` Internal Server Error
   * @response `503` `ApiErrorResponse` Service Unavailable
   * @response `504` `ApiErrorResponse` Gateway Timeout
   */
  updateUserTemplate = (
    { templateId }: UpdateUserTemplateParams,
    data: UserTemplateUpdate,
    params: RequestParams = {},
  ) =>
    this.http.request<UpdateUserTemplateData, UpdateUserTemplateError>({
      path: `/v1/user/templates/${templateId}`,
      method: "PUT",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags UserTemplates
   * @name DeleteUserTemplate
   * @summary 删除用户模板
   * @request DELETE:/v1/user/templates/{template_id}
   * @response `200` `DeleteUserTemplateData` Successful Response
   * @response `400` `ApiErrorResponse` Bad Request
   * @response `401` `ApiErrorResponse` Unauthorized
   * @response `402` `ApiErrorResponse` Payment Required
   * @response `403` `ApiErrorResponse` Forbidden
   * @response `404` `ApiErrorResponse` Not Found
   * @response `409` `ApiErrorResponse` Conflict
   * @response `413` `ApiErrorResponse` Request Entity Too Large
   * @response `415` `ApiErrorResponse` Unsupported Media Type
   * @response `422` `ApiErrorResponse` Unprocessable Entity
   * @response `429` `ApiErrorResponse` Too Many Requests
   * @response `500` `ApiErrorResponse` Internal Server Error
   * @response `503` `ApiErrorResponse` Service Unavailable
   * @response `504` `ApiErrorResponse` Gateway Timeout
   */
  deleteUserTemplate = (
    { templateId }: DeleteUserTemplateParams,
    params: RequestParams = {},
  ) =>
    this.http.request<DeleteUserTemplateData, DeleteUserTemplateError>({
      path: `/v1/user/templates/${templateId}`,
      method: "DELETE",
      format: "json",
      ...params,
    });
}
