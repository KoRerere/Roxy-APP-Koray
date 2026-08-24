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
  GetOfficialTemplateData,
  GetOfficialTemplateError,
  GetOfficialTemplateParams,
  ListOfficialTemplatesData,
  ListOfficialTemplatesError,
  ListOfficialTemplatesParams,
  ListTemplateLabelCategoriesData,
  ListTemplateLabelCategoriesError,
  ListTemplateLabelsData,
  ListTemplateLabelsError,
  ListTemplateLabelsParams,
} from "./data-contracts";
import { HttpClient, RequestParams } from "./http-client";

export class TemplatesApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags Templates
   * @name ListTemplateLabelCategories
   * @summary 列出启用的模板标签分类
   * @request GET:/v1/template-label-categories
   * @response `200` `ListTemplateLabelCategoriesData` Successful Response
   * @response `304` `void` Not Modified
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
  listTemplateLabelCategories = (params: RequestParams = {}) =>
    this.http.request<
      ListTemplateLabelCategoriesData,
      ListTemplateLabelCategoriesError
    >({
      path: `/v1/template-label-categories`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Templates
   * @name ListTemplateLabels
   * @summary 列出启用的模板标签
   * @request GET:/v1/template-labels
   * @response `200` `ListTemplateLabelsData` Successful Response
   * @response `304` `void` Not Modified
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
  listTemplateLabels = (
    query: ListTemplateLabelsParams,
    params: RequestParams = {},
  ) =>
    this.http.request<ListTemplateLabelsData, ListTemplateLabelsError>({
      path: `/v1/template-labels`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Templates
   * @name ListOfficialTemplates
   * @summary 列出官方模板
   * @request GET:/v1/templates
   * @response `200` `ListOfficialTemplatesData` Successful Response
   * @response `304` `void` Not Modified
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
  listOfficialTemplates = (
    query: ListOfficialTemplatesParams,
    params: RequestParams = {},
  ) =>
    this.http.request<ListOfficialTemplatesData, ListOfficialTemplatesError>({
      path: `/v1/templates`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Templates
   * @name GetOfficialTemplate
   * @summary 按 ID 或 slug 获取模板详情
   * @request GET:/v1/templates/{template_id_or_slug}
   * @response `200` `GetOfficialTemplateData` Successful Response
   * @response `304` `void` Not Modified
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
  getOfficialTemplate = (
    { templateIdOrSlug }: GetOfficialTemplateParams,
    params: RequestParams = {},
  ) =>
    this.http.request<GetOfficialTemplateData, GetOfficialTemplateError>({
      path: `/v1/templates/${templateIdOrSlug}`,
      method: "GET",
      format: "json",
      ...params,
    });
}
