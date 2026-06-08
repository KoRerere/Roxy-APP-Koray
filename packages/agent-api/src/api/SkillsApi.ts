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
  DownloadSkillV1SkillsSlugDownloadGetData,
  DownloadSkillV1SkillsSlugDownloadGetError,
  DownloadSkillV1SkillsSlugDownloadGetParams,
  EnabledPayload,
  GetSkillV1SkillsSlugGetData,
  GetSkillV1SkillsSlugGetError,
  GetSkillV1SkillsSlugGetParams,
  InstallSkillV1UserSkillsSlugInstallPostData,
  InstallSkillV1UserSkillsSlugInstallPostError,
  InstallSkillV1UserSkillsSlugInstallPostParams,
  ListSkillCategoriesV1SkillCategoriesGetData,
  ListSkillCategoriesV1SkillCategoriesGetError,
  ListSkillsV1SkillsGetData,
  ListSkillsV1SkillsGetError,
  ListSkillsV1SkillsGetParams,
  ListUserSkillsV1UserSkillsGetData,
  ListUserSkillsV1UserSkillsGetError,
  RemoveInstalledSkillV1UserSkillsSlugDeleteData,
  RemoveInstalledSkillV1UserSkillsSlugDeleteError,
  RemoveInstalledSkillV1UserSkillsSlugDeleteParams,
  SetInstalledSkillEnabledV1UserSkillsSlugEnabledPutData,
  SetInstalledSkillEnabledV1UserSkillsSlugEnabledPutError,
  SetInstalledSkillEnabledV1UserSkillsSlugEnabledPutParams,
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
   * @name ListSkillCategoriesV1SkillCategoriesGet
   * @summary List enabled skill categories
   * @request GET:/v1/skill-categories
   * @response `200` `ListSkillCategoriesV1SkillCategoriesGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  listSkillCategoriesV1SkillCategoriesGet = (params: RequestParams = {}) =>
    this.http.request<
      ListSkillCategoriesV1SkillCategoriesGetData,
      ListSkillCategoriesV1SkillCategoriesGetError
    >({
      path: `/v1/skill-categories`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Skills
   * @name ListSkillsV1SkillsGet
   * @summary List published skills
   * @request GET:/v1/skills
   * @response `200` `ListSkillsV1SkillsGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  listSkillsV1SkillsGet = (
    query: ListSkillsV1SkillsGetParams,
    params: RequestParams = {},
  ) =>
    this.http.request<ListSkillsV1SkillsGetData, ListSkillsV1SkillsGetError>({
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
   * @name GetSkillV1SkillsSlugGet
   * @summary Get skill detail
   * @request GET:/v1/skills/{slug}
   * @response `200` `GetSkillV1SkillsSlugGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  getSkillV1SkillsSlugGet = (
    { slug }: GetSkillV1SkillsSlugGetParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      GetSkillV1SkillsSlugGetData,
      GetSkillV1SkillsSlugGetError
    >({
      path: `/v1/skills/${slug}`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Skills
   * @name DownloadSkillV1SkillsSlugDownloadGet
   * @summary Download skill package
   * @request GET:/v1/skills/{slug}/download
   * @response `200` `DownloadSkillV1SkillsSlugDownloadGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  downloadSkillV1SkillsSlugDownloadGet = (
    { slug }: DownloadSkillV1SkillsSlugDownloadGetParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      DownloadSkillV1SkillsSlugDownloadGetData,
      DownloadSkillV1SkillsSlugDownloadGetError
    >({
      path: `/v1/skills/${slug}/download`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Skills
   * @name ListUserSkillsV1UserSkillsGet
   * @summary List installed skills for current user
   * @request GET:/v1/user/skills
   * @response `200` `ListUserSkillsV1UserSkillsGetData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  listUserSkillsV1UserSkillsGet = (params: RequestParams = {}) =>
    this.http.request<
      ListUserSkillsV1UserSkillsGetData,
      ListUserSkillsV1UserSkillsGetError
    >({
      path: `/v1/user/skills`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Skills
   * @name InstallSkillV1UserSkillsSlugInstallPost
   * @summary Record skill installation
   * @request POST:/v1/user/skills/{slug}/install
   * @response `200` `InstallSkillV1UserSkillsSlugInstallPostData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  installSkillV1UserSkillsSlugInstallPost = (
    { slug }: InstallSkillV1UserSkillsSlugInstallPostParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      InstallSkillV1UserSkillsSlugInstallPostData,
      InstallSkillV1UserSkillsSlugInstallPostError
    >({
      path: `/v1/user/skills/${slug}/install`,
      method: "POST",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Skills
   * @name SetInstalledSkillEnabledV1UserSkillsSlugEnabledPut
   * @summary Toggle installed skill enabled
   * @request PUT:/v1/user/skills/{slug}/enabled
   * @response `200` `SetInstalledSkillEnabledV1UserSkillsSlugEnabledPutData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  setInstalledSkillEnabledV1UserSkillsSlugEnabledPut = (
    { slug }: SetInstalledSkillEnabledV1UserSkillsSlugEnabledPutParams,
    data: EnabledPayload,
    params: RequestParams = {},
  ) =>
    this.http.request<
      SetInstalledSkillEnabledV1UserSkillsSlugEnabledPutData,
      SetInstalledSkillEnabledV1UserSkillsSlugEnabledPutError
    >({
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
   * @name RemoveInstalledSkillV1UserSkillsSlugDelete
   * @summary Remove installed skill record
   * @request DELETE:/v1/user/skills/{slug}
   * @response `200` `RemoveInstalledSkillV1UserSkillsSlugDeleteData` Successful Response
   * @response `422` `HTTPValidationError` Validation Error
   */
  removeInstalledSkillV1UserSkillsSlugDelete = (
    { slug }: RemoveInstalledSkillV1UserSkillsSlugDeleteParams,
    params: RequestParams = {},
  ) =>
    this.http.request<
      RemoveInstalledSkillV1UserSkillsSlugDeleteData,
      RemoveInstalledSkillV1UserSkillsSlugDeleteError
    >({
      path: `/v1/user/skills/${slug}`,
      method: "DELETE",
      format: "json",
      ...params,
    });
}
