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
  GetUserModelV1UserModelGetData,
  GetUserModelV1UserModelGetError,
  ListUserModelOptionsV1UserModelOptionsGetData,
  ListUserModelOptionsV1UserModelOptionsGetError,
  ListUserModelOptionsV1UserModelOptionsGetParams,
  SwitchUserModelV1UserModelPutData,
  SwitchUserModelV1UserModelPutError,
  UserModelSwitchPayload,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class UserApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description 返回当前用户各能力绑定的模型名、api_format 及来源。未绑定时回退到数据库中的默认模型配置。
   *
   * @tags User
   * @name GetUserModelV1UserModelGet
   * @summary 获取用户绑定模型
   * @request GET:/v1/user/model
   * @response `200` `GetUserModelV1UserModelGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  getUserModelV1UserModelGet = (params: RequestParams = {}) =>
    this.http.request<
      GetUserModelV1UserModelGetData,
      GetUserModelV1UserModelGetError
    >({
      path: `/v1/user/model`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * @description 用户按模型类型切换自己的绑定模型；传 null 或空字符串时清除绑定并回退到系统默认模型。
   *
   * @tags User
   * @name SwitchUserModelV1UserModelPut
   * @summary 切换用户模型
   * @request PUT:/v1/user/model
   * @response `200` `SwitchUserModelV1UserModelPutData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  switchUserModelV1UserModelPut = (
    data: UserModelSwitchPayload,
    params: RequestParams = {},
  ) =>
    this.http.request<
      SwitchUserModelV1UserModelPutData,
      SwitchUserModelV1UserModelPutError
    >({
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
   * @name ListUserModelOptionsV1UserModelOptionsGet
   * @summary 获取某类模型列表
   * @request GET:/v1/user/model/options
   * @response `200` `ListUserModelOptionsV1UserModelOptionsGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  listUserModelOptionsV1UserModelOptionsGet = (
    query: ListUserModelOptionsV1UserModelOptionsGetParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      ListUserModelOptionsV1UserModelOptionsGetData,
      ListUserModelOptionsV1UserModelOptionsGetError
    >({
      path: `/v1/user/model/options`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
}
