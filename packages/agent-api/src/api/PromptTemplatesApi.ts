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
  GetPromptTemplateListV1PromptTemplatesListGetData,
  GetPromptTemplateListV1PromptTemplatesListGetError,
} from "./data-contracts";
import { HttpClient, RequestParams } from "./http-client";

export class PromptTemplatesApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags PromptTemplates
   * @name GetPromptTemplateListV1PromptTemplatesListGet
   * @summary 查询提示模板列表（多语言）
   * @request GET:/v1/prompt_templates_list
   * @response `200` `GetPromptTemplateListV1PromptTemplatesListGetData` Successful Response
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
  getPromptTemplateListV1PromptTemplatesListGet = (
    params: RequestParams = {},
  ) =>
    this.http.request<
      GetPromptTemplateListV1PromptTemplatesListGetData,
      GetPromptTemplateListV1PromptTemplatesListGetError
    >({
      path: `/v1/prompt_templates_list`,
      method: "GET",
      format: "json",
      ...params,
    });
}
