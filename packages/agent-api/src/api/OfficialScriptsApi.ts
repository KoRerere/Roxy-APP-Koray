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
  GetOfficialScriptData,
  GetOfficialScriptError,
  GetOfficialScriptParams,
  ListOfficialScriptsData,
  ListOfficialScriptsError,
  ListOfficialScriptsParams,
  ListScriptCategoriesData,
  ListScriptCategoriesError,
} from "./data-contracts";
import { HttpClient, RequestParams } from "./http-client";

export class OfficialScriptsApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description **Deprecated:** 脚本分类接口已废弃。脚本和 Skill 已合并为模板，请使用 `/v1/template-label-categories` 和 `/v1/template-labels` 管理模板分类/标签。
   *
   * @tags OfficialScripts
   * @name ListScriptCategories
   * @summary 列出启用的官方脚本分类
   * @request GET:/v1/script-categories
   * @deprecated
   * @response `200` `ListScriptCategoriesData` Successful Response
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
  listScriptCategories = (params: RequestParams = {}) =>
    this.http.request<ListScriptCategoriesData, ListScriptCategoriesError>({
      path: `/v1/script-categories`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * @description **Deprecated:** 官方脚本接口已废弃。脚本和 Skill 已合并为模板，请使用 `/v1/templates?templateType=script` 获取官方脚本模板。
   *
   * @tags OfficialScripts
   * @name ListOfficialScripts
   * @summary 列出官方脚本
   * @request GET:/v1/official/scripts
   * @deprecated
   * @response `200` `ListOfficialScriptsData` Successful Response
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
  listOfficialScripts = (
    query: ListOfficialScriptsParams,
    params: RequestParams = {},
  ) =>
    this.http.request<ListOfficialScriptsData, ListOfficialScriptsError>({
      path: `/v1/official/scripts`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * @description **Deprecated:** 官方脚本详情接口已废弃。脚本和 Skill 已合并为模板，请使用 `/v1/templates/{template_id_or_slug}` 获取官方模板详情。
   *
   * @tags OfficialScripts
   * @name GetOfficialScript
   * @summary 按 ID 或 slug 获取官方脚本详情
   * @request GET:/v1/official/scripts/{script_id_or_slug}
   * @deprecated
   * @response `200` `GetOfficialScriptData` Successful Response
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
  getOfficialScript = (
    { scriptIdOrSlug }: GetOfficialScriptParams,
    params: RequestParams = {},
  ) =>
    this.http.request<GetOfficialScriptData, GetOfficialScriptError>({
      path: `/v1/official/scripts/${scriptIdOrSlug}`,
      method: "GET",
      format: "json",
      ...params,
    });
}
