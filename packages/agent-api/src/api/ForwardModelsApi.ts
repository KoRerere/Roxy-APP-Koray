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

import { ListModelsV1ModelsGetData } from "./data-contracts";
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
   */
  listModelsV1ModelsGet = (params: RequestParams = {}) =>
    this.http.request<ListModelsV1ModelsGetData, any>({
      path: `/v1/models`,
      method: "GET",
      format: "json",
      ...params,
    });
}
