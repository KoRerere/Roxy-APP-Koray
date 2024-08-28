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
  GetPlatformTableRowsListData,
  GetPlatformTableSortOrderListData,
  SavePlatformTableSortOrderCreateData,
  SavePlatformTableSortOrderCreatePayload,
  UpdatePlatformTableRowsCreateData,
  UpdatePlatformTableRowsCreatePayload,
  UserAddPlatformInfoCreateData,
  UserAddPlatformInfoCreatePayload,
  UserDelPlatformInfoCreateData,
  UserDelPlatformInfoCreatePayload,
  UserGetPlatformInfoListData,
  UserGetPlatformInfoListParams,
  UserGetPlatformInfoV2ListData,
  UserGetPlatformInfoV2ListParams,
  UserMdfPlatformInfoCreateData,
  UserMdfPlatformInfoCreatePayload,
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
   * @name UserGetPlatformInfoV2List
   * @summary 业务平台查询（只显示当前用户添加的平台）
   * @request GET:/user_get_platform_info_v2
   * @response `200` `UserGetPlatformInfoV2ListData` 成功
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
   * @name UpdatePlatformTableRowsCreate
   * @summary 修改业务平台表格列顺序
   * @request POST:/update_platform_table_rows
   * @response `200` `UpdatePlatformTableRowsCreateData` 成功
   */
  updatePlatformTableRowsCreate = (data: UpdatePlatformTableRowsCreatePayload, params: RequestParams = {}) =>
    this.http.request<UpdatePlatformTableRowsCreateData, any>({
      path: `/update_platform_table_rows`,
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
   * @name SavePlatformTableSortOrderCreate
   * @summary 保存业务平台列表排序规则
   * @request POST:/save_platform_table_sort_order
   * @response `200` `SavePlatformTableSortOrderCreateData` 成功
   */
  savePlatformTableSortOrderCreate = (data: SavePlatformTableSortOrderCreatePayload, params: RequestParams = {}) =>
    this.http.request<SavePlatformTableSortOrderCreateData, any>({
      path: `/save_platform_table_sort_order`,
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
   * @name GetPlatformTableRowsList
   * @summary 获取业务平台表格列顺序
   * @request GET:/get_platform_table_rows
   * @response `200` `GetPlatformTableRowsListData` 成功
   */
  getPlatformTableRowsList = (params: RequestParams = {}) =>
    this.http.request<GetPlatformTableRowsListData, any>({
      path: `/get_platform_table_rows`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Platform
   * @name GetPlatformTableSortOrderList
   * @summary 获取业务平台列表排序规则
   * @request GET:/get_platform_table_sort_order
   * @response `200` `GetPlatformTableSortOrderListData` 成功
   */
  getPlatformTableSortOrderList = (params: RequestParams = {}) =>
    this.http.request<GetPlatformTableSortOrderListData, any>({
      path: `/get_platform_table_sort_order`,
      method: "GET",
      format: "json",
      ...params,
    });
}
