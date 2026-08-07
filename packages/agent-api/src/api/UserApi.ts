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
  GetUserModelData,
  GetUserModelError,
  ListUserModelOptionsData,
  ListUserModelOptionsError,
  ListUserModelOptionsParams,
  SwitchUserModelData,
  SwitchUserModelError,
  UserModelSwitchPayload,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class UserApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description 返回当前用户各能力绑定的模型名、api_format 及来源。未绑定时依次回退到 workspace 与系统默认模型配置。
   *
   * @tags User
   * @name GetUserModel
   * @summary 获取用户绑定模型
   * @request GET:/v1/user/model
   * @response `200` `GetUserModelData` Successful Response
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
  getUserModel = (params: RequestParams = {}) =>
    this.http.request<GetUserModelData, GetUserModelError>({
      path: `/v1/user/model`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * @description 用户按模型类型切换自己的绑定模型；传 null 或空字符串时清除绑定并回退到 workspace 或系统默认模型。
   *
   * @tags User
   * @name SwitchUserModel
   * @summary 切换用户模型
   * @request PUT:/v1/user/model
   * @response `200` `SwitchUserModelData` Successful Response
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
  switchUserModel = (
    data: UserModelSwitchPayload,
    params: RequestParams = {},
  ) =>
    this.http.request<SwitchUserModelData, SwitchUserModelError>({
      path: `/v1/user/model`,
      method: "PUT",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * @description 按模型类型返回当前可选模型列表，仅返回用户切换所需字段，不包含上游 Provider 信息。
   *
   * @tags User
   * @name ListUserModelOptions
   * @summary 获取某类模型列表
   * @request GET:/v1/user/model/options
   * @response `200` `ListUserModelOptionsData` Successful Response
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
  listUserModelOptions = (
    query: ListUserModelOptionsParams,
    params: RequestParams = {},
  ) =>
    this.http.request<ListUserModelOptionsData, ListUserModelOptionsError>({
      path: `/v1/user/model/options`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
}
