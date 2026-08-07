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
  ListModelsV1ModelsGetData,
  ListModelsV1ModelsGetError,
} from "./data-contracts";
import { HttpClient, RequestParams } from "./http-client";

export class ForwardModelsApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description 返回数据库中 `enabled=true` 的模型，去重后以 OpenAI `list models` 格式包装在 `data` 字段中。无需鉴权。
   *
   * @tags Forward-Models
   * @name ListModelsV1ModelsGet
   * @summary 列出可用模型
   * @request GET:/v1/models
   * @response `200` `ListModelsV1ModelsGetData` Successful Response
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
  listModelsV1ModelsGet = (params: RequestParams = {}) =>
    this.http.request<ListModelsV1ModelsGetData, ListModelsV1ModelsGetError>({
      path: `/v1/models`,
      method: "GET",
      format: "json",
      ...params,
    });
}
