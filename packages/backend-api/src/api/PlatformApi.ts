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
  UserGetPlatformTableRowsListData,
  UserGetPlatformTableSortOrderListData,
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
   * @name UserGetPlatformInfoList
   * @summary 业务平台查询（显示我们系统自带的平台）
   * @request GET:/user_get_platform_info
   * @response `200` `UserGetPlatformInfoListData` 成功
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
   * @response `200` `UserAddPlatformInfoCreateData` 成功
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
   * @response `200` `UserDelPlatformInfoCreateData` 成功
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
   * @response `200` `UserMdfPlatformInfoCreateData` 成功
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
   * @response `200` `UserUpdatePlatformTableRowsCreateData` 成功
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
   * @summary 保存业务平台列表排序规则
   * @request POST:/user_save_platform_table_sort_order
   * @response `200` `UserSavePlatformTableSortOrderCreateData` 成功
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
   * @response `200` `UserGetPlatformTableRowsListData` 成功
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
   * @summary 获取业务平台列表排序规则
   * @request GET:/user_get_platform_table_sort_order
   * @response `200` `UserGetPlatformTableSortOrderListData` 成功
   */
  userGetPlatformTableSortOrderList = (params: RequestParams = {}) =>
    this.http.request<UserGetPlatformTableSortOrderListData, any>({
      path: `/user_get_platform_table_sort_order`,
      method: "GET",
      format: "json",
      ...params,
    });
}
