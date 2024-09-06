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
  UserCheckIpCreateData,
  UserCheckIpCreatePayload,
  UserDelProxyModuleCreateData,
  UserDelProxyModuleCreatePayload,
  UserGetProxyModuleListData,
  UserGetProxyModuleListParams,
  UserGetProxyTableSortOrderListData,
  UserMdfProxyModuleCreateData,
  UserMdfProxyModuleCreatePayload,
  UserSaveProxyTableSortOrderCreateData,
  UserSaveProxyTableSortOrderCreatePayload,
  UserUnbindProxyModuleCreateData,
  UserUnbindProxyModuleCreatePayload,
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
   * @response `200` `UserGetProxyModuleListData` 成功
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
   * @response `200` `UserAddProxyModuleCreateData` 成功
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
   * @response `200` `UserMdfProxyModuleCreateData` 成功
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
   * @name UserDelProxyModuleCreate
   * @summary 批量删除代理
   * @request POST:/user_del_proxy_module
   * @response `200` `UserDelProxyModuleCreateData` 成功
   */
  userDelProxyModuleCreate = (data: UserDelProxyModuleCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserDelProxyModuleCreateData, any>({
      path: `/user_del_proxy_module`,
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
   * @name UserUnbindProxyModuleCreate
   * @summary  批量解绑代理
   * @request POST:/user_unbind_proxy_module
   * @response `200` `UserUnbindProxyModuleCreateData` 成功
   */
  userUnbindProxyModuleCreate = (data: UserUnbindProxyModuleCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserUnbindProxyModuleCreateData, any>({
      path: `/user_unbind_proxy_module`,
      method: "POST",
      body: data,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Proxy
   * @name UserCheckIpCreate
   * @summary 检测单个静态IP
   * @request POST:/user_check_ip
   * @deprecated
   * @response `200` `UserCheckIpCreateData` 成功
   */
  userCheckIpCreate = (data: UserCheckIpCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserCheckIpCreateData, any>({
      path: `/user_check_ip`,
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
   * @summary 获取代理列表排序规则
   * @request GET:/user_get_proxy_table_sort_order
   * @response `200` `UserGetProxyTableSortOrderListData` 成功
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
   * @summary 保存代理列表排序规则
   * @request POST:/user_save_proxy_table_sort_order
   * @response `200` `UserSaveProxyTableSortOrderCreateData` 成功
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
}
