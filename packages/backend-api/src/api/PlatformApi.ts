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
  UserAddPlatformInfoCreateData,
  UserAddPlatformInfoCreatePayload,
  UserDelPlatformInfoCreateData,
  UserDelPlatformInfoCreatePayload,
  UserGetPlatformInfoListData,
  UserGetPlatformInfoListParams,
  UserGetPlatformInfoV2ListData,
  UserGetPlatformInfoV2ListParams,
  UserGetPlatformTableRowsListData,
  UserGetPlatformTableSortOrderListData,
  UserGetSearchEnginesListData,
  UserMdfPlatformInfoCreateData,
  UserMdfPlatformInfoCreatePayload,
  UserSavePlatformTableSortOrderCreateData,
  UserSavePlatformTableSortOrderCreatePayload,
  UserUpdatePlatformTableRowsCreateData,
  UserUpdatePlatformTableRowsCreatePayload,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class PlatformApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags Platform
   * @name UserGetPlatformInfoV2List
   * @summary 用户添加业务平台列表
   * @request GET:/user_get_platform_info_v2
   * @response `200` `UserGetPlatformInfoV2ListData`
   */
  userGetPlatformInfoV2List = (query: UserGetPlatformInfoV2ListParams, params: RequestParams = {}) =>
    this.http.request<UserGetPlatformInfoV2ListData, any>({
      path: `/user_get_platform_info_v2`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Platform
   * @name UserGetSearchEnginesList
   * @summary 获取搜索引擎列表
   * @request GET:/user_get_search_engines
   * @response `200` `UserGetSearchEnginesListData`
   */
  userGetSearchEnginesList = (params: RequestParams = {}) =>
    this.http.request<UserGetSearchEnginesListData, any>({
      path: `/user_get_search_engines`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Platform
   * @name UserGetPlatformInfoList
   * @summary 系统自带业务平台列表
   * @request GET:/user_get_platform_info
   * @response `200` `UserGetPlatformInfoListData`
   */
  userGetPlatformInfoList = (query: UserGetPlatformInfoListParams, params: RequestParams = {}) =>
    this.http.request<UserGetPlatformInfoListData, any>({
      path: `/user_get_platform_info`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * @description 字符串类型值：如果用户没有输入值就传空字符串
   *
   * @tags Platform
   * @name UserAddPlatformInfoCreate
   * @summary 业务平台新增
   * @request POST:/user_add_platform_info
   * @response `200` `UserAddPlatformInfoCreateData`
   */
  userAddPlatformInfoCreate = (data: UserAddPlatformInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserAddPlatformInfoCreateData, any>({
      path: `/user_add_platform_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Platform
   * @name UserDelPlatformInfoCreate
   * @summary 业务平台删除
   * @request POST:/user_del_platform_info
   * @response `200` `UserDelPlatformInfoCreateData`
   */
  userDelPlatformInfoCreate = (data: UserDelPlatformInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserDelPlatformInfoCreateData, any>({
      path: `/user_del_platform_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * @description 字符串类型值：如果用户没有输入值就传空字符串
   *
   * @tags Platform
   * @name UserMdfPlatformInfoCreate
   * @summary 业务平台修改
   * @request POST:/user_mdf_platform_info
   * @response `200` `UserMdfPlatformInfoCreateData`
   */
  userMdfPlatformInfoCreate = (data: UserMdfPlatformInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserMdfPlatformInfoCreateData, any>({
      path: `/user_mdf_platform_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Platform
   * @name UserUpdatePlatformTableRowsCreate
   * @summary 修改业务平台表格列顺序
   * @request POST:/user_update_platform_table_rows
   * @response `200` `UserUpdatePlatformTableRowsCreateData`
   */
  userUpdatePlatformTableRowsCreate = (data: UserUpdatePlatformTableRowsCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserUpdatePlatformTableRowsCreateData, any>({
      path: `/user_update_platform_table_rows`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Platform
   * @name UserSavePlatformTableSortOrderCreate
   * @summary 保存业务平台列表排序规则（暂时没有用到）
   * @request POST:/user_save_platform_table_sort_order
   * @response `200` `UserSavePlatformTableSortOrderCreateData`
   */
  userSavePlatformTableSortOrderCreate = (
    data: UserSavePlatformTableSortOrderCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserSavePlatformTableSortOrderCreateData, any>({
      path: `/user_save_platform_table_sort_order`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Platform
   * @name UserGetPlatformTableRowsList
   * @summary 获取业务平台表格列顺序
   * @request GET:/user_get_platform_table_rows
   * @response `200` `UserGetPlatformTableRowsListData`
   */
  userGetPlatformTableRowsList = (params: RequestParams = {}) =>
    this.http.request<UserGetPlatformTableRowsListData, any>({
      path: `/user_get_platform_table_rows`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Platform
   * @name UserGetPlatformTableSortOrderList
   * @summary 获取业务平台列表排序规则（暂时没有用到）
   * @request GET:/user_get_platform_table_sort_order
   * @response `200` `UserGetPlatformTableSortOrderListData`
   */
  userGetPlatformTableSortOrderList = (params: RequestParams = {}) =>
    this.http.request<UserGetPlatformTableSortOrderListData, any>({
      path: `/user_get_platform_table_sort_order`,
      method: "GET",
      format: "json",
      ...params,
    });
}
