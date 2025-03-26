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
  UserAddProxyModuleCreateData,
  UserAddProxyModuleCreatePayload,
  UserDelProxyModuleV2CreateData,
  UserDelProxyModuleV2CreatePayload,
  UserGetProxyModuleListData,
  UserGetProxyModuleListParams,
  UserGetProxyRecommendInfoListData,
  UserGetProxyTableRowsListData,
  UserGetProxyTableSortOrderListData,
  UserGetTimezoneByCoordinatesInfoListData,
  UserGetTimezoneByCoordinatesInfoListParams,
  UserMdfProxyModuleCreateData,
  UserMdfProxyModuleCreatePayload,
  UserSaveProxyTableSortOrderCreateData,
  UserSaveProxyTableSortOrderCreatePayload,
  UserUpdateProxyTableRowsCreateData,
  UserUpdateProxyTableRowsCreatePayload,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class ProxyApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyModuleList
   * @summary 代理IP列表
   * @request GET:/user_get_proxy_module
   * @response `200` `UserGetProxyModuleListData`
   */
  userGetProxyModuleList = (query: UserGetProxyModuleListParams, params: RequestParams = {}) =>
    this.http.request<UserGetProxyModuleListData, any>({
      path: `/user_get_proxy_module`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserAddProxyModuleCreate
   * @summary 批量导入代理
   * @request POST:/user_add_proxy_module
   * @response `200` `UserAddProxyModuleCreateData`
   */
  userAddProxyModuleCreate = (data: UserAddProxyModuleCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserAddProxyModuleCreateData, any>({
      path: `/user_add_proxy_module`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserMdfProxyModuleCreate
   * @summary 单个代理修改
   * @request POST:/user_mdf_proxy_module
   * @response `200` `UserMdfProxyModuleCreateData`
   */
  userMdfProxyModuleCreate = (data: UserMdfProxyModuleCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserMdfProxyModuleCreateData, any>({
      path: `/user_mdf_proxy_module`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyTableSortOrderList
   * @summary 获取代理列表排序规则（暂时没有用到）
   * @request GET:/user_get_proxy_table_sort_order
   * @response `200` `UserGetProxyTableSortOrderListData`
   */
  userGetProxyTableSortOrderList = (params: RequestParams = {}) =>
    this.http.request<UserGetProxyTableSortOrderListData, any>({
      path: `/user_get_proxy_table_sort_order`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserSaveProxyTableSortOrderCreate
   * @summary 保存代理列表排序规则（暂时没有用到）
   * @request POST:/user_save_proxy_table_sort_order
   * @response `200` `UserSaveProxyTableSortOrderCreateData`
   */
  userSaveProxyTableSortOrderCreate = (data: UserSaveProxyTableSortOrderCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserSaveProxyTableSortOrderCreateData, any>({
      path: `/user_save_proxy_table_sort_order`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserUpdateProxyTableRowsCreate
   * @summary 修改代理表格列顺序
   * @request POST:/user_update_proxy_table_rows
   * @response `200` `UserUpdateProxyTableRowsCreateData`
   */
  userUpdateProxyTableRowsCreate = (data: UserUpdateProxyTableRowsCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserUpdateProxyTableRowsCreateData, any>({
      path: `/user_update_proxy_table_rows`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyTableRowsList
   * @summary 获取代理表格列顺序
   * @request GET:/user_get_proxy_table_rows
   * @response `200` `UserGetProxyTableRowsListData`
   */
  userGetProxyTableRowsList = (params: RequestParams = {}) =>
    this.http.request<UserGetProxyTableRowsListData, any>({
      path: `/user_get_proxy_table_rows`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetProxyRecommendInfoList
   * @summary 代理推荐列表（暂时没有用到）
   * @request GET:/user_get_proxy_recommend_info
   * @response `200` `UserGetProxyRecommendInfoListData`
   */
  userGetProxyRecommendInfoList = (params: RequestParams = {}) =>
    this.http.request<UserGetProxyRecommendInfoListData, any>({
      path: `/user_get_proxy_recommend_info`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserDelProxyModuleV2Create
   * @summary 批量删除代理
   * @request POST:/user_del_proxy_module_v2
   * @response `200` `UserDelProxyModuleV2CreateData`
   */
  userDelProxyModuleV2Create = (data: UserDelProxyModuleV2CreatePayload, params: RequestParams = {}) =>
    this.http.request<UserDelProxyModuleV2CreateData, any>({
      path: `/user_del_proxy_module_v2`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserGetTimezoneByCoordinatesInfoList
   * @summary 根据经纬度获取时区
   * @request GET:/user_get_timezone_by_coordinates_info
   * @response `200` `UserGetTimezoneByCoordinatesInfoListData`
   */
  userGetTimezoneByCoordinatesInfoList = (
    query: UserGetTimezoneByCoordinatesInfoListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetTimezoneByCoordinatesInfoListData, any>({
      path: `/user_get_timezone_by_coordinates_info`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
}
