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
  DownloadSkillError,
  DownloadSkillParams,
  EnabledPayload,
  GetSkillData,
  GetSkillError,
  GetSkillParams,
  InstallUserSkillData,
  InstallUserSkillError,
  InstallUserSkillParams,
  ListSkillCategoriesData,
  ListSkillCategoriesError,
  ListSkillsData,
  ListSkillsError,
  ListSkillsParams,
  ListUserSkillsData,
  ListUserSkillsError,
  RemoveUserSkillData,
  RemoveUserSkillError,
  RemoveUserSkillParams,
  SetUserSkillEnabledData,
  SetUserSkillEnabledError,
  SetUserSkillEnabledParams,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class SkillsApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags Skills
   * @name ListSkillCategories
   * @summary List enabled skill categories
   * @request GET:/v1/skill-categories
   * @response `200` `ListSkillCategoriesData` Successful Response
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
  listSkillCategories = (params: RequestParams = {}) =>
    this.http.request<ListSkillCategoriesData, ListSkillCategoriesError>({
      path: `/v1/skill-categories`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Skills
   * @name ListSkills
   * @summary List published skills
   * @request GET:/v1/skills
   * @response `200` `ListSkillsData` Successful Response
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
  listSkills = (query: ListSkillsParams, params: RequestParams = {}) =>
    this.http.request<ListSkillsData, ListSkillsError>({
      path: `/v1/skills`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Skills
   * @name GetSkill
   * @summary Get skill detail
   * @request GET:/v1/skills/{slug}
   * @response `200` `GetSkillData` Successful Response
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
  getSkill = ({ slug }: GetSkillParams, params: RequestParams = {}) =>
    this.http.request<GetSkillData, GetSkillError>({
      path: `/v1/skills/${slug}`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Skills
   * @name DownloadSkill
   * @summary Download skill package
   * @request GET:/v1/skills/{slug}/download
   * @response `302` `void` Successful Response
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
  downloadSkill = ({ slug }: DownloadSkillParams, params: RequestParams = {}) =>
    this.http.request<any, DownloadSkillError>({
      path: `/v1/skills/${slug}/download`,
      method: "GET",
      ...params,
    });
  /**
   * No description
   *
   * @tags Skills
   * @name ListUserSkills
   * @summary List installed skills for current user
   * @request GET:/v1/user/skills
   * @response `200` `ListUserSkillsData` Successful Response
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
  listUserSkills = (params: RequestParams = {}) =>
    this.http.request<ListUserSkillsData, ListUserSkillsError>({
      path: `/v1/user/skills`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Skills
   * @name InstallUserSkill
   * @summary Record skill installation
   * @request POST:/v1/user/skills/{slug}/install
   * @response `200` `InstallUserSkillData` Successful Response
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
  installUserSkill = (
    { slug }: InstallUserSkillParams,
    params: RequestParams = {},
  ) =>
    this.http.request<InstallUserSkillData, InstallUserSkillError>({
      path: `/v1/user/skills/${slug}/install`,
      method: "POST",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Skills
   * @name SetUserSkillEnabled
   * @summary Toggle installed skill enabled
   * @request PUT:/v1/user/skills/{slug}/enabled
   * @response `200` `SetUserSkillEnabledData` Successful Response
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
  setUserSkillEnabled = (
    { slug }: SetUserSkillEnabledParams,
    data: EnabledPayload,
    params: RequestParams = {},
  ) =>
    this.http.request<SetUserSkillEnabledData, SetUserSkillEnabledError>({
      path: `/v1/user/skills/${slug}/enabled`,
      method: "PUT",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Skills
   * @name RemoveUserSkill
   * @summary Remove installed skill record
   * @request DELETE:/v1/user/skills/{slug}
   * @response `200` `RemoveUserSkillData` Successful Response
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
  removeUserSkill = (
    { slug }: RemoveUserSkillParams,
    params: RequestParams = {},
  ) =>
    this.http.request<RemoveUserSkillData, RemoveUserSkillError>({
      path: `/v1/user/skills/${slug}`,
      method: "DELETE",
      format: "json",
      ...params,
    });
}
