/* eslint-disable */
/* tslint:disable */
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

import {
  UserClearWindowCacheApiV2CreateData,
  UserClearWindowCacheApiV2CreatePayload,
  UserDelWindowInfoApiV2CreateData,
  UserDelWindowInfoApiV2CreatePayload,
  UserGetLabelInfoApiListData,
  UserGetLabelInfoApiListParams,
  UserGetWorkspaceListApiListData,
  UserGetWorkspaceListApiListParams,
  UserMdfWindowInfoRandomV2CreateData,
  UserMdfWindowInfoRandomV2CreatePayload,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class ApiApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags Api
   * @name UserGetWorkspaceListApiList
   * @summary  获取空间及空间下的项目列表api
   * @request GET:/user_get_workspace_list_api
   * @response `200` `UserGetWorkspaceListApiListData`
   */
  userGetWorkspaceListApiList = (query: UserGetWorkspaceListApiListParams, params: RequestParams = {}) =>
    this.http.request<UserGetWorkspaceListApiListData, any>({
      path: `/user_get_workspace_list_api`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Api
   * @name UserDelWindowInfoApiV2Create
   * @summary 批量删除窗口api
   * @request POST:/user_del_window_info_api_v2
   * @response `200` `UserDelWindowInfoApiV2CreateData`
   */
  userDelWindowInfoApiV2Create = (data: UserDelWindowInfoApiV2CreatePayload, params: RequestParams = {}) =>
    this.http.request<UserDelWindowInfoApiV2CreateData, any>({
      path: `/user_del_window_info_api_v2`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Api
   * @name UserMdfWindowInfoRandomV2Create
   * @summary 窗口随机指纹api
   * @request POST:/user_mdf_window_info_random_v2
   * @response `200` `UserMdfWindowInfoRandomV2CreateData`
   */
  userMdfWindowInfoRandomV2Create = (data: UserMdfWindowInfoRandomV2CreatePayload, params: RequestParams = {}) =>
    this.http.request<UserMdfWindowInfoRandomV2CreateData, any>({
      path: `/user_mdf_window_info_random_v2`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Api
   * @name UserClearWindowCacheApiV2Create
   * @summary 清空所有缓存api
   * @request POST:/user_clear_window_cache_api_v2
   * @response `200` `UserClearWindowCacheApiV2CreateData`
   */
  userClearWindowCacheApiV2Create = (data: UserClearWindowCacheApiV2CreatePayload, params: RequestParams = {}) =>
    this.http.request<UserClearWindowCacheApiV2CreateData, any>({
      path: `/user_clear_window_cache_api_v2`,
      method: "POST",
      body: data,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Api
   * @name UserGetLabelInfoApiList
   * @summary 获得标签列表api
   * @request GET:/user_get_label_info_api
   * @response `200` `UserGetLabelInfoApiListData`
   */
  userGetLabelInfoApiList = (query: UserGetLabelInfoApiListParams, params: RequestParams = {}) =>
    this.http.request<UserGetLabelInfoApiListData, any>({
      path: `/user_get_label_info_api`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
}
