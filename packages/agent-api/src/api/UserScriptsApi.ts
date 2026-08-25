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
  CreateUserScriptData,
  CreateUserScriptError,
  DeleteUserScriptData,
  DeleteUserScriptError,
  DeleteUserScriptParams,
  GetUserScriptData,
  GetUserScriptError,
  GetUserScriptParams,
  ListUserScriptsData,
  ListUserScriptsError,
  ListUserScriptsParams,
  ScriptCreate,
  ScriptUpdate,
  UpdateUserScriptData,
  UpdateUserScriptError,
  UpdateUserScriptParams,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class UserScriptsApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description **Deprecated:** 用户脚本接口已废弃。脚本和 Skill 已合并为模板，请使用 `/v1/user/templates?templateType=script` 管理用户脚本模板；上传脚本文件请使用 `/v1/user/templates/upload-script`。
   *
   * @tags UserScripts
   * @name CreateUserScript
   * @summary 创建用户脚本
   * @request POST:/v1/user/scripts
   * @deprecated
   * @response `200` `CreateUserScriptData` Successful Response
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
  createUserScript = (data: ScriptCreate, params: RequestParams = {}) =>
    this.http.request<CreateUserScriptData, CreateUserScriptError>({
      path: `/v1/user/scripts`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * @description **Deprecated:** 用户脚本接口已废弃。脚本和 Skill 已合并为模板，请使用 `/v1/user/templates?templateType=script` 管理用户脚本模板；上传脚本文件请使用 `/v1/user/templates/upload-script`。
   *
   * @tags UserScripts
   * @name ListUserScripts
   * @summary 分页列出用户脚本
   * @request GET:/v1/user/scripts
   * @deprecated
   * @response `200` `ListUserScriptsData` Successful Response
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
  listUserScripts = (
    query: ListUserScriptsParams,
    params: RequestParams = {},
  ) =>
    this.http.request<ListUserScriptsData, ListUserScriptsError>({
      path: `/v1/user/scripts`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * @description **Deprecated:** 用户脚本详情/更新/删除接口已废弃。脚本和 Skill 已合并为模板，请使用 `/v1/user/templates/{template_id}` 管理用户模板。
   *
   * @tags UserScripts
   * @name GetUserScript
   * @summary 获取脚本详情
   * @request GET:/v1/user/scripts/{script_id}
   * @deprecated
   * @response `200` `GetUserScriptData` Successful Response
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
  getUserScript = (
    { scriptId }: GetUserScriptParams,
    params: RequestParams = {},
  ) =>
    this.http.request<GetUserScriptData, GetUserScriptError>({
      path: `/v1/user/scripts/${scriptId}`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * @description **Deprecated:** 用户脚本详情/更新/删除接口已废弃。脚本和 Skill 已合并为模板，请使用 `/v1/user/templates/{template_id}` 管理用户模板。
   *
   * @tags UserScripts
   * @name UpdateUserScript
   * @summary 更新脚本
   * @request PUT:/v1/user/scripts/{script_id}
   * @deprecated
   * @response `200` `UpdateUserScriptData` Successful Response
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
  updateUserScript = (
    { scriptId }: UpdateUserScriptParams,
    data: ScriptUpdate,
    params: RequestParams = {},
  ) =>
    this.http.request<UpdateUserScriptData, UpdateUserScriptError>({
      path: `/v1/user/scripts/${scriptId}`,
      method: "PUT",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * @description **Deprecated:** 用户脚本详情/更新/删除接口已废弃。脚本和 Skill 已合并为模板，请使用 `/v1/user/templates/{template_id}` 管理用户模板。
   *
   * @tags UserScripts
   * @name DeleteUserScript
   * @summary 删除脚本
   * @request DELETE:/v1/user/scripts/{script_id}
   * @deprecated
   * @response `200` `DeleteUserScriptData` Successful Response
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
  deleteUserScript = (
    { scriptId }: DeleteUserScriptParams,
    params: RequestParams = {},
  ) =>
    this.http.request<DeleteUserScriptData, DeleteUserScriptError>({
      path: `/v1/user/scripts/${scriptId}`,
      method: "DELETE",
      format: "json",
      ...params,
    });
}
