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
  UserAddGroupInfoCreateData,
  UserAddGroupInfoCreatePayload,
  UserAddLabelInfoCreateData,
  UserAddLabelInfoCreatePayload,
  UserAddWindowFilterNameCreateData,
  UserAddWindowFilterNameCreatePayload,
  UserAddWindowInfoCreateData,
  UserAddWindowInfoCreatePayload,
  UserAddWindowInfoV2CreateData,
  UserAddWindowInfoV2CreatePayload,
  UserAddWindowTemplateInfoCreateData,
  UserAddWindowTemplateInfoCreatePayload,
  UserAnalysisWindowInfoCreateData,
  UserAnalysisWindowInfoCreatePayload,
  UserBatchUpdateWindowTableRowsCreateData,
  UserBatchUpdateWindowTableRowsCreatePayload,
  UserBatchWindowInfoCreateData,
  UserBatchWindowInfoCreatePayload,
  UserBatchWindowInfoV2CreateData,
  UserBatchWindowInfoV2CreatePayload,
  UserClearWindowCacheApiCreateData,
  UserClearWindowCacheApiCreatePayload,
  UserClearWindowCacheCreateData,
  UserClearWindowCacheCreatePayload,
  UserDeleteWindowFilterNameCreateData,
  UserDeleteWindowFilterNameCreatePayload,
  UserDeleteWindowTemplateInfoCreateData,
  UserDeleteWindowTemplateInfoCreatePayload,
  UserDelGroupInfoCreateData,
  UserDelGroupInfoCreatePayload,
  UserDelLabelInfoCreateData,
  UserDelLabelInfoCreatePayload,
  UserDelWindowInfoApiCreateData,
  UserDelWindowInfoApiCreatePayload,
  UserDelWindowInfoCreateData,
  UserDelWindowInfoCreatePayload,
  UserGetBrowserVersionInfoListData,
  UserGetBrowserVersionInfoListParams,
  UserGetDefaultWindowTableRowsListData,
  UserGetDeviceNameListData,
  UserGetDeviceNameListParams,
  UserGetDeviceNameV2ListData,
  UserGetDeviceNameV2ListParams,
  UserGetGroupInfoListData,
  UserGetGroupInfoListParams,
  UserGetLabelInfoListData,
  UserGetLabelInfoListParams,
  UserGetMacAddrV2ListData,
  UserGetMacAddrV2ListParams,
  UserGetUaWebglListData,
  UserGetUaWebglListParams,
  UserGetUaWebglV2ListData,
  UserGetUaWebglV2ListParams,
  UserGetWindowFilterNameListListData,
  UserGetWindowInfoListData,
  UserGetWindowInfoListListData,
  UserGetWindowInfoListListParams,
  UserGetWindowInfoListParams,
  UserGetWindowInfoRecycleListData,
  UserGetWindowInfoRecycleListParams,
  UserGetWindowInfoV2ListData,
  UserGetWindowInfoV2ListParams,
  UserGetWindowStatusInfoCreateData,
  UserGetWindowStatusInfoCreatePayload,
  UserGetWindowTableRowsListData,
  UserGetWindowTableSortOrderListData,
  UserGetWindowTemplateListListData,
  UserImportWindowInfoCreateData,
  UserImportWindowInfoCreatePayload,
  UserImportWindowInfoV2CreateData,
  UserImportWindowInfoV2CreatePayload,
  UserMdfGroupInfoCreateData,
  UserMdfGroupInfoCreatePayload,
  UserMdfLabelInfoCreateData,
  UserMdfLabelInfoCreatePayload,
  UserMdfWindowInfoBatchCreateData,
  UserMdfWindowInfoBatchCreatePayload,
  UserMdfWindowInfoBatchV2CreateData,
  UserMdfWindowInfoBatchV2CreatePayload,
  UserMdfWindowInfoRandomCreateData,
  UserMdfWindowInfoRandomCreatePayload,
  UserMdfWindowInfoSingleCreateData,
  UserMdfWindowInfoSingleCreatePayload,
  UserMdfWindowInfoSingleV2CreateData,
  UserMdfWindowInfoSingleV2CreatePayload,
  UserMdfWindowSyncStatusCreateData,
  UserMdfWindowSyncStatusCreatePayload,
  UserMdfWindowSyncV2CreateData,
  UserMdfWindowSyncV2CreatePayload,
  UserMdfWindowTemplateInfoCreateData,
  UserMdfWindowTemplateInfoCreatePayload,
  UserModifyWindowReportTimeCreateData,
  UserModifyWindowReportTimeCreatePayload,
  UserSaveWindowTableSortOrderCreateData,
  UserSaveWindowTableSortOrderCreatePayload,
  UserUpdateWindowFilterNameCreateData,
  UserUpdateWindowFilterNameCreatePayload,
  UserUpdateWindowFilterSortCreateData,
  UserUpdateWindowFilterSortCreatePayload,
  UserUpdateWindowTableRowsCreateData,
  UserUpdateWindowTableRowsCreatePayload,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class WindowApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description 新版本回收站列表也用此接口，is_delete传1即可
   *
   * @tags Window
   * @name UserGetWindowInfoV2List
   * @summary 窗口列表 (新版本浏览器使用,根据ID查询窗口详细信息)
   * @request GET:/user_get_window_info_v2
   * @response `200` `UserGetWindowInfoV2ListData`
   */
  userGetWindowInfoV2List = (query: UserGetWindowInfoV2ListParams, params: RequestParams = {}) =>
    this.http.request<UserGetWindowInfoV2ListData, any>({
      path: `/user_get_window_info_v2`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserAddWindowInfoV2Create
   * @summary 单个创建窗口 (新版本浏览器使用)
   * @request POST:/user_add_window_info_v2
   * @response `200` `UserAddWindowInfoV2CreateData`
   */
  userAddWindowInfoV2Create = (data: UserAddWindowInfoV2CreatePayload, params: RequestParams = {}) =>
    this.http.request<UserAddWindowInfoV2CreateData, any>({
      path: `/user_add_window_info_v2`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserMdfWindowInfoSingleV2Create
   * @summary 单个修改窗口 (新版本浏览器使用)
   * @request POST:/user_mdf_window_info_single_v2
   * @response `200` `UserMdfWindowInfoSingleV2CreateData`
   */
  userMdfWindowInfoSingleV2Create = (data: UserMdfWindowInfoSingleV2CreatePayload, params: RequestParams = {}) =>
    this.http.request<UserMdfWindowInfoSingleV2CreateData, any>({
      path: `/user_mdf_window_info_single_v2`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserGetWindowInfoList
   * @summary 窗口列表 (旧版本接口)
   * @request GET:/user_get_window_info
   * @response `200` `UserGetWindowInfoListData`
   */
  userGetWindowInfoList = (query: UserGetWindowInfoListParams, params: RequestParams = {}) =>
    this.http.request<UserGetWindowInfoListData, any>({
      path: `/user_get_window_info`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserGetWindowInfoRecycleList
   * @summary 回收站列表
   * @request GET:/user_get_window_info_recycle
   * @response `200` `UserGetWindowInfoRecycleListData`
   */
  userGetWindowInfoRecycleList = (query: UserGetWindowInfoRecycleListParams, params: RequestParams = {}) =>
    this.http.request<UserGetWindowInfoRecycleListData, any>({
      path: `/user_get_window_info_recycle`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserAddWindowInfoCreate
   * @summary 单个创建窗口
   * @request POST:/user_add_window_info
   * @response `200` `UserAddWindowInfoCreateData`
   */
  userAddWindowInfoCreate = (data: UserAddWindowInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserAddWindowInfoCreateData, any>({
      path: `/user_add_window_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserBatchWindowInfoCreate
   * @summary 批量创建窗口
   * @request POST:/user_batch_window_info
   * @response `200` `UserBatchWindowInfoCreateData`
   */
  userBatchWindowInfoCreate = (data: UserBatchWindowInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserBatchWindowInfoCreateData, any>({
      path: `/user_batch_window_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserImportWindowInfoCreate
   * @summary 批量导入窗口
   * @request POST:/user_import_window_info
   * @response `200` `UserImportWindowInfoCreateData`
   */
  userImportWindowInfoCreate = (data: UserImportWindowInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserImportWindowInfoCreateData, any>({
      path: `/user_import_window_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserMdfWindowInfoSingleCreate
   * @summary 单个修改窗口
   * @request POST:/user_mdf_window_info_single
   * @response `200` `UserMdfWindowInfoSingleCreateData`
   */
  userMdfWindowInfoSingleCreate = (data: UserMdfWindowInfoSingleCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserMdfWindowInfoSingleCreateData, any>({
      path: `/user_mdf_window_info_single`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserMdfWindowInfoBatchCreate
   * @summary 批量修改窗口
   * @request POST:/user_mdf_window_info_batch
   * @response `200` `UserMdfWindowInfoBatchCreateData`
   */
  userMdfWindowInfoBatchCreate = (data: UserMdfWindowInfoBatchCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserMdfWindowInfoBatchCreateData, any>({
      path: `/user_mdf_window_info_batch`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserModifyWindowReportTimeCreate
   * @summary 修改窗口上报时间
   * @request POST:/user_modify_window_report_time
   * @response `200` `UserModifyWindowReportTimeCreateData`
   */
  userModifyWindowReportTimeCreate = (data: UserModifyWindowReportTimeCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserModifyWindowReportTimeCreateData, any>({
      path: `/user_modify_window_report_time`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserMdfWindowInfoRandomCreate
   * @summary 浏览器窗口->窗口随机指纹api（旧版本使用）
   * @request POST:/user_mdf_window_info_random
   * @response `200` `UserMdfWindowInfoRandomCreateData`
   */
  userMdfWindowInfoRandomCreate = (data: UserMdfWindowInfoRandomCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserMdfWindowInfoRandomCreateData, any>({
      path: `/user_mdf_window_info_random`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserClearWindowCacheCreate
   * @summary 清空所有缓存
   * @request POST:/user_clear_window_cache
   * @response `200` `UserClearWindowCacheCreateData`
   */
  userClearWindowCacheCreate = (data: UserClearWindowCacheCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserClearWindowCacheCreateData, any>({
      path: `/user_clear_window_cache`,
      method: "POST",
      body: data,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserClearWindowCacheApiCreate
   * @summary 清空所有缓存api(旧版本使用)
   * @request POST:/user_clear_window_cache_api
   * @response `200` `UserClearWindowCacheApiCreateData`
   */
  userClearWindowCacheApiCreate = (data: UserClearWindowCacheApiCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserClearWindowCacheApiCreateData, any>({
      path: `/user_clear_window_cache_api`,
      method: "POST",
      body: data,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserDelWindowInfoCreate
   * @summary 批量删除窗口
   * @request POST:/user_del_window_info
   * @response `200` `UserDelWindowInfoCreateData`
   */
  userDelWindowInfoCreate = (data: UserDelWindowInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserDelWindowInfoCreateData, any>({
      path: `/user_del_window_info`,
      method: "POST",
      body: data,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserDelWindowInfoApiCreate
   * @summary 批量删除窗口api (旧版本使用)
   * @request POST:/user_del_window_info_api
   * @response `200` `UserDelWindowInfoApiCreateData`
   */
  userDelWindowInfoApiCreate = (data: UserDelWindowInfoApiCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserDelWindowInfoApiCreateData, any>({
      path: `/user_del_window_info_api`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserMdfWindowSyncStatusCreate
   * @summary 打开和关闭窗口时同步窗口状态
   * @request POST:/user_mdf_window_sync_status
   * @response `200` `UserMdfWindowSyncStatusCreateData`
   */
  userMdfWindowSyncStatusCreate = (data: UserMdfWindowSyncStatusCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserMdfWindowSyncStatusCreateData, any>({
      path: `/user_mdf_window_sync_status`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserMdfWindowSyncV2Create
   * @summary 关闭窗口时cookie同步 + 标签页同步 + 打开和关闭窗口时同步窗口状态
   * @request POST:/user_mdf_window_sync_v2
   * @response `200` `UserMdfWindowSyncV2CreateData`
   */
  userMdfWindowSyncV2Create = (data: UserMdfWindowSyncV2CreatePayload, params: RequestParams = {}) =>
    this.http.request<UserMdfWindowSyncV2CreateData, any>({
      path: `/user_mdf_window_sync_v2`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserGetUaWebglList
   * @summary 获取UA
   * @request GET:/user_get_ua_webgl
   * @response `200` `UserGetUaWebglListData`
   */
  userGetUaWebglList = (query: UserGetUaWebglListParams, params: RequestParams = {}) =>
    this.http.request<UserGetUaWebglListData, any>({
      path: `/user_get_ua_webgl`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserGetUaWebglV2List
   * @summary 批量获取UA
   * @request GET:/user_get_ua_webgl_v2
   * @response `200` `UserGetUaWebglV2ListData`
   */
  userGetUaWebglV2List = (query: UserGetUaWebglV2ListParams, params: RequestParams = {}) =>
    this.http.request<UserGetUaWebglV2ListData, any>({
      path: `/user_get_ua_webgl_v2`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserGetDeviceNameList
   * @summary 获取设备名称
   * @request GET:/user_get_device_name
   * @response `200` `UserGetDeviceNameListData`
   */
  userGetDeviceNameList = (query: UserGetDeviceNameListParams, params: RequestParams = {}) =>
    this.http.request<UserGetDeviceNameListData, any>({
      path: `/user_get_device_name`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserGetDeviceNameV2List
   * @summary 批量获取设备名称
   * @request GET:/user_get_device_name_v2
   * @response `200` `UserGetDeviceNameV2ListData`
   */
  userGetDeviceNameV2List = (query: UserGetDeviceNameV2ListParams, params: RequestParams = {}) =>
    this.http.request<UserGetDeviceNameV2ListData, any>({
      path: `/user_get_device_name_v2`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserGetMacAddrV2List
   * @summary 获取mac地址
   * @request GET:/user_get_mac_addr_v2
   * @response `200` `UserGetMacAddrV2ListData`
   */
  userGetMacAddrV2List = (query: UserGetMacAddrV2ListParams, params: RequestParams = {}) =>
    this.http.request<UserGetMacAddrV2ListData, any>({
      path: `/user_get_mac_addr_v2`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserGetGroupInfoList
   * @summary 分组查询
   * @request GET:/user_get_group_info
   * @response `200` `UserGetGroupInfoListData`
   */
  userGetGroupInfoList = (query: UserGetGroupInfoListParams, params: RequestParams = {}) =>
    this.http.request<UserGetGroupInfoListData, any>({
      path: `/user_get_group_info`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserAddGroupInfoCreate
   * @summary 分组新增
   * @request POST:/user_add_group_info
   * @response `200` `UserAddGroupInfoCreateData`
   */
  userAddGroupInfoCreate = (data: UserAddGroupInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserAddGroupInfoCreateData, any>({
      path: `/user_add_group_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserMdfGroupInfoCreate
   * @summary 分组修改
   * @request POST:/user_mdf_group_info
   * @response `200` `UserMdfGroupInfoCreateData`
   */
  userMdfGroupInfoCreate = (data: UserMdfGroupInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserMdfGroupInfoCreateData, any>({
      path: `/user_mdf_group_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserDelGroupInfoCreate
   * @summary 分组删除
   * @request POST:/user_del_group_info
   * @response `200` `UserDelGroupInfoCreateData`
   */
  userDelGroupInfoCreate = (data: UserDelGroupInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserDelGroupInfoCreateData, any>({
      path: `/user_del_group_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserGetLabelInfoList
   * @summary 标签查询
   * @request GET:/user_get_label_info
   * @response `200` `UserGetLabelInfoListData`
   */
  userGetLabelInfoList = (query: UserGetLabelInfoListParams, params: RequestParams = {}) =>
    this.http.request<UserGetLabelInfoListData, any>({
      path: `/user_get_label_info`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserAddLabelInfoCreate
   * @summary 标签新增
   * @request POST:/user_add_label_info
   * @response `200` `UserAddLabelInfoCreateData`
   */
  userAddLabelInfoCreate = (data: UserAddLabelInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserAddLabelInfoCreateData, any>({
      path: `/user_add_label_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserMdfLabelInfoCreate
   * @summary 标签修改
   * @request POST:/user_mdf_label_info
   * @response `200` `UserMdfLabelInfoCreateData`
   */
  userMdfLabelInfoCreate = (data: UserMdfLabelInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserMdfLabelInfoCreateData, any>({
      path: `/user_mdf_label_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserDelLabelInfoCreate
   * @summary 标签删除
   * @request POST:/user_del_label_info
   * @response `200` `UserDelLabelInfoCreateData`
   */
  userDelLabelInfoCreate = (data: UserDelLabelInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserDelLabelInfoCreateData, any>({
      path: `/user_del_label_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * @description old_filter_name必须传入（唯一值），因为new_filter_name和sort都是通过old_filter_name行字段判断的 注：1.如果是修改排序，old_filter_name和new_filter_name值传相同进行，原来值进行可以不用变 2.如果是修改标签页名称，sort值传原来值进行可以不用变
   *
   * @tags Window
   * @name UserUpdateWindowFilterNameCreate
   * @summary 修改窗口过滤器页签名称
   * @request POST:/user_update_window_filter_name
   * @response `200` `UserUpdateWindowFilterNameCreateData`
   */
  userUpdateWindowFilterNameCreate = (data: UserUpdateWindowFilterNameCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserUpdateWindowFilterNameCreateData, any>({
      path: `/user_update_window_filter_name`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserDeleteWindowFilterNameCreate
   * @summary 删除窗口过滤器页签名称
   * @request POST:/user_delete_window_filter_name
   * @response `200` `UserDeleteWindowFilterNameCreateData`
   */
  userDeleteWindowFilterNameCreate = (data: UserDeleteWindowFilterNameCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserDeleteWindowFilterNameCreateData, any>({
      path: `/user_delete_window_filter_name`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserAddWindowFilterNameCreate
   * @summary 新增窗口过滤器页签名称
   * @request POST:/user_add_window_filter_name
   * @response `200` `UserAddWindowFilterNameCreateData`
   */
  userAddWindowFilterNameCreate = (data: UserAddWindowFilterNameCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserAddWindowFilterNameCreateData, any>({
      path: `/user_add_window_filter_name`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserGetWindowFilterNameListList
   * @summary 获取窗口过滤器页签名称列表
   * @request GET:/user_get_window_filter_name_list
   * @response `200` `UserGetWindowFilterNameListListData`
   */
  userGetWindowFilterNameListList = (params: RequestParams = {}) =>
    this.http.request<UserGetWindowFilterNameListListData, any>({
      path: `/user_get_window_filter_name_list`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserUpdateWindowTableRowsCreate
   * @summary 修改窗口表格列顺序
   * @request POST:/user_update_window_table_rows
   * @deprecated
   * @response `200` `UserUpdateWindowTableRowsCreateData`
   */
  userUpdateWindowTableRowsCreate = (data: UserUpdateWindowTableRowsCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserUpdateWindowTableRowsCreateData, any>({
      path: `/user_update_window_table_rows`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserSaveWindowTableSortOrderCreate
   * @summary 保存窗口表格排序规则
   * @request POST:/user_save_window_table_sort_order
   * @response `200` `UserSaveWindowTableSortOrderCreateData`
   */
  userSaveWindowTableSortOrderCreate = (data: UserSaveWindowTableSortOrderCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserSaveWindowTableSortOrderCreateData, any>({
      path: `/user_save_window_table_sort_order`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserGetWindowTableRowsList
   * @summary 获取窗口表格列顺序
   * @request GET:/user_get_window_table_rows
   * @deprecated
   * @response `200` `UserGetWindowTableRowsListData`
   */
  userGetWindowTableRowsList = (params: RequestParams = {}) =>
    this.http.request<UserGetWindowTableRowsListData, any>({
      path: `/user_get_window_table_rows`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserGetWindowTableSortOrderList
   * @summary 获取窗口表格排序规则
   * @request GET:/user_get_window_table_sort_order
   * @response `200` `UserGetWindowTableSortOrderListData`
   */
  userGetWindowTableSortOrderList = (params: RequestParams = {}) =>
    this.http.request<UserGetWindowTableSortOrderListData, any>({
      path: `/user_get_window_table_sort_order`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserBatchWindowInfoV2Create
   * @summary 批量创建窗口 (新版本浏览器使用)
   * @request POST:/user_batch_window_info_v2
   * @response `200` `UserBatchWindowInfoV2CreateData`
   */
  userBatchWindowInfoV2Create = (data: UserBatchWindowInfoV2CreatePayload, params: RequestParams = {}) =>
    this.http.request<UserBatchWindowInfoV2CreateData, any>({
      path: `/user_batch_window_info_v2`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserBatchUpdateWindowTableRowsCreate
   * @summary 批量修改每个标签页表格列的顺序
   * @request POST:/user_batch_update_window_table_rows
   * @deprecated
   * @response `200` `UserBatchUpdateWindowTableRowsCreateData`
   */
  userBatchUpdateWindowTableRowsCreate = (
    data: UserBatchUpdateWindowTableRowsCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserBatchUpdateWindowTableRowsCreateData, any>({
      path: `/user_batch_update_window_table_rows`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserGetDefaultWindowTableRowsList
   * @summary 获取默认表格排序列
   * @request GET:/user_get_default_window_table_rows
   * @response `200` `UserGetDefaultWindowTableRowsListData`
   */
  userGetDefaultWindowTableRowsList = (params: RequestParams = {}) =>
    this.http.request<UserGetDefaultWindowTableRowsListData, any>({
      path: `/user_get_default_window_table_rows`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserImportWindowInfoV2Create
   * @summary 批量导入窗口 (新版本浏览器使用)
   * @request POST:/user_import_window_info_v2
   * @response `200` `UserImportWindowInfoV2CreateData`
   */
  userImportWindowInfoV2Create = (data: UserImportWindowInfoV2CreatePayload, params: RequestParams = {}) =>
    this.http.request<UserImportWindowInfoV2CreateData, any>({
      path: `/user_import_window_info_v2`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserUpdateWindowFilterSortCreate
   * @summary 修改窗口过滤器排序
   * @request POST:/user_update_window_filter_sort
   * @response `200` `UserUpdateWindowFilterSortCreateData`
   */
  userUpdateWindowFilterSortCreate = (data: UserUpdateWindowFilterSortCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserUpdateWindowFilterSortCreateData, any>({
      path: `/user_update_window_filter_sort`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserMdfWindowInfoBatchV2Create
   * @summary 批量修改窗口 (新版本浏览器使用)
   * @request POST:/user_mdf_window_info_batch_v2
   * @response `200` `UserMdfWindowInfoBatchV2CreateData`
   */
  userMdfWindowInfoBatchV2Create = (data: UserMdfWindowInfoBatchV2CreatePayload, params: RequestParams = {}) =>
    this.http.request<UserMdfWindowInfoBatchV2CreateData, any>({
      path: `/user_mdf_window_info_batch_v2`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserGetWindowTemplateListList
   * @summary 获取窗口模板列表
   * @request GET:/user_get_window_template_list
   * @response `200` `UserGetWindowTemplateListListData`
   */
  userGetWindowTemplateListList = (params: RequestParams = {}) =>
    this.http.request<UserGetWindowTemplateListListData, any>({
      path: `/user_get_window_template_list`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserAddWindowTemplateInfoCreate
   * @summary 新增窗口模板
   * @request POST:/user_add_window_template_info
   * @response `200` `UserAddWindowTemplateInfoCreateData`
   */
  userAddWindowTemplateInfoCreate = (data: UserAddWindowTemplateInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserAddWindowTemplateInfoCreateData, any>({
      path: `/user_add_window_template_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserMdfWindowTemplateInfoCreate
   * @summary 修改窗口模板
   * @request POST:/user_mdf_window_template_info
   * @response `200` `UserMdfWindowTemplateInfoCreateData`
   */
  userMdfWindowTemplateInfoCreate = (data: UserMdfWindowTemplateInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserMdfWindowTemplateInfoCreateData, any>({
      path: `/user_mdf_window_template_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserDeleteWindowTemplateInfoCreate
   * @summary 删除窗口模板
   * @request POST:/user_delete_window_template_info
   * @response `200` `UserDeleteWindowTemplateInfoCreateData`
   */
  userDeleteWindowTemplateInfoCreate = (data: UserDeleteWindowTemplateInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserDeleteWindowTemplateInfoCreateData, any>({
      path: `/user_delete_window_template_info`,
      method: "POST",
      body: data,
      format: "json",
      ...params,
    });
  /**
   * @description 新版本回收站列表也用此接口，is_delete传1即可
   *
   * @tags Window
   * @name UserGetWindowInfoListList
   * @summary 窗口列表（新版本浏览器使用，返回基本信息）
   * @request GET:/user_get_window_info_list
   * @response `200` `UserGetWindowInfoListListData`
   */
  userGetWindowInfoListList = (query: UserGetWindowInfoListListParams, params: RequestParams = {}) =>
    this.http.request<UserGetWindowInfoListListData, any>({
      path: `/user_get_window_info_list`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserGetWindowStatusInfoCreate
   * @summary 获取窗口状态信息
   * @request POST:/user_get_window_status_info
   * @response `200` `UserGetWindowStatusInfoCreateData`
   */
  userGetWindowStatusInfoCreate = (data: UserGetWindowStatusInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserGetWindowStatusInfoCreateData, any>({
      path: `/user_get_window_status_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserAnalysisWindowInfoCreate
   * @summary 解析窗口 (新版浏览器使用)
   * @request POST:/user_analysis_window_info
   * @response `200` `UserAnalysisWindowInfoCreateData`
   */
  userAnalysisWindowInfoCreate = (data: UserAnalysisWindowInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserAnalysisWindowInfoCreateData, any>({
      path: `/user_analysis_window_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserGetBrowserVersionInfoList
   * @summary 根据os和osVersion获取浏览器版本
   * @request GET:/user_get_browserVersion_info
   * @response `200` `UserGetBrowserVersionInfoListData`
   */
  userGetBrowserVersionInfoList = (query: UserGetBrowserVersionInfoListParams, params: RequestParams = {}) =>
    this.http.request<UserGetBrowserVersionInfoListData, any>({
      path: `/user_get_browserVersion_info`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
}
