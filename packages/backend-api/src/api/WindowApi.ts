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
  AddWindowFilterNameCreateData,
  AddWindowFilterNameCreatePayload,
  DeleteWindowFilterNameCreateData,
  DeleteWindowFilterNameCreatePayload,
  GetWindowFilterNameListListData,
  SaveWindowTableSortOrderCreateData,
  SaveWindowTableSortOrderCreatePayload,
  UpdateWindowFilterNameCreateData,
  UpdateWindowFilterNameCreatePayload,
  UpdateWindowTableRowsCreateData,
  UpdateWindowTableRowsCreatePayload,
  UserAddGroupInfoCreateData,
  UserAddGroupInfoCreatePayload,
  UserAddLabelInfoCreateData,
  UserAddLabelInfoCreatePayload,
  UserAddPlatformInfoCreateData,
  UserAddPlatformInfoCreatePayload,
  UserAddWindowInfoCreateData,
  UserAddWindowInfoCreatePayload,
  UserBatchWindowInfoCreateData,
  UserBatchWindowInfoCreatePayload,
  UserClearWindowCacheApiCreateData,
  UserClearWindowCacheApiCreatePayload,
  UserClearWindowCacheCreateData,
  UserClearWindowCacheCreatePayload,
  UserDelGroupInfoCreateData,
  UserDelGroupInfoCreatePayload,
  UserDelLabelInfoCreateData,
  UserDelLabelInfoCreatePayload,
  UserDelPlatformInfoCreateData,
  UserDelPlatformInfoCreatePayload,
  UserDelWindowInfoApiCreateData,
  UserDelWindowInfoApiCreatePayload,
  UserDelWindowInfoCreateData,
  UserDelWindowInfoCreatePayload,
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
  UserGetPlatformInfoListData,
  UserGetPlatformInfoListParams,
  UserGetUaWebglListData,
  UserGetUaWebglListParams,
  UserGetUaWebglV2ListData,
  UserGetUaWebglV2ListParams,
  UserGetWindowInfoListData,
  UserGetWindowInfoListParams,
  UserGetWindowInfoRecycleListData,
  UserGetWindowInfoRecycleListParams,
  UserImportWindowInfoCreateData,
  UserImportWindowInfoCreatePayload,
  UserMdfGroupInfoCreateData,
  UserMdfGroupInfoCreatePayload,
  UserMdfLabelInfoCreateData,
  UserMdfLabelInfoCreatePayload,
  UserMdfWindowInfoBatchCreateData,
  UserMdfWindowInfoBatchCreatePayload,
  UserMdfWindowInfoRandomCreateData,
  UserMdfWindowInfoRandomCreatePayload,
  UserMdfWindowInfoSingleCreateData,
  UserMdfWindowInfoSingleCreatePayload,
  UserMdfWindowSyncStatusCreateData,
  UserMdfWindowSyncStatusCreatePayload,
  UserMdfWindowSyncV2CreateData,
  UserMdfWindowSyncV2CreatePayload,
  UserModifyWindowReportTimeCreateData,
  UserModifyWindowReportTimeCreatePayload,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class WindowApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @tags Window
   * @name UserGetWindowInfoList
   * @summary 窗口列表
   * @request GET:/user_get_window_info
   * @response `200` `UserGetWindowInfoListData` 成功
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
   * @response `200` `UserGetWindowInfoRecycleListData` 成功
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
   * @response `200` `UserAddWindowInfoCreateData` 成功
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
   * @response `200` `UserBatchWindowInfoCreateData` 成功
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
   * @response `200` `UserImportWindowInfoCreateData` 成功
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
   * @response `200` `UserMdfWindowInfoSingleCreateData` 成功
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
   * @response `200` `UserMdfWindowInfoBatchCreateData` 成功
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
   * @response `200` `UserModifyWindowReportTimeCreateData` 成功
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
   * @summary 一键随机指纹
   * @request POST:/user_mdf_window_info_random
   * @response `200` `UserMdfWindowInfoRandomCreateData` 成功
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
   * @response `200` `UserClearWindowCacheCreateData` 成功
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
   * @summary API清空所有缓存
   * @request POST:/user_clear_window_cache_api
   * @response `200` `UserClearWindowCacheApiCreateData` 成功
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
   * @summary 回收站->批量删除窗口
   * @request POST:/user_del_window_info
   * @response `200` `UserDelWindowInfoCreateData` 成功
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
   * @summary 回收站->api批量删除窗口
   * @request POST:/user_del_window_info_api
   * @response `200` `UserDelWindowInfoApiCreateData` 成功
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
   * @response `200` `UserMdfWindowSyncStatusCreateData` 成功
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
   * @response `200` `UserMdfWindowSyncV2CreateData` 成功
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
   * @response `200` `UserGetUaWebglListData` 成功
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
   * @response `200` `UserGetUaWebglV2ListData` 成功
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
   * @response `200` `UserGetDeviceNameListData` 成功
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
   * @response `200` `UserGetDeviceNameV2ListData` 成功
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
   * @response `200` `UserGetMacAddrV2ListData` 成功
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
   * @response `200` `UserGetGroupInfoListData` 成功
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
   * @response `200` `UserAddGroupInfoCreateData` 成功
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
   * @response `200` `UserMdfGroupInfoCreateData` 成功
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
   * @response `200` `UserDelGroupInfoCreateData` 成功
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
   * @response `200` `UserGetLabelInfoListData` 成功
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
   * @response `200` `UserAddLabelInfoCreateData` 成功
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
   * @response `200` `UserMdfLabelInfoCreateData` 成功
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
   * @response `200` `UserDelLabelInfoCreateData` 成功
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
   * No description
   *
   * @tags Window
   * @name UserGetPlatformInfoList
   * @summary 业务平台查询
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
   * No description
   *
   * @tags Window
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
   * @tags Window
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
   * @description 数据需要全部传入，后端直接存储你的数据格式
   *
   * @tags Window
   * @name UpdateWindowFilterNameCreate
   * @summary 修改窗口过滤器页签名称
   * @request POST:/update_window_filter_name
   * @response `200` `UpdateWindowFilterNameCreateData` 成功
   */
  updateWindowFilterNameCreate = (data: UpdateWindowFilterNameCreatePayload, params: RequestParams = {}) =>
    this.http.request<UpdateWindowFilterNameCreateData, any>({
      path: `/update_window_filter_name`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * @description 数据需要全部传入，后端直接存储你的数据格式
   *
   * @tags Window
   * @name DeleteWindowFilterNameCreate
   * @summary 删除窗口过滤器页签名称
   * @request POST:/delete_window_filter_name
   * @response `200` `DeleteWindowFilterNameCreateData` 成功
   */
  deleteWindowFilterNameCreate = (data: DeleteWindowFilterNameCreatePayload, params: RequestParams = {}) =>
    this.http.request<DeleteWindowFilterNameCreateData, any>({
      path: `/delete_window_filter_name`,
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
   * @name AddWindowFilterNameCreate
   * @summary 新增窗口过滤器页签名称
   * @request POST:/add_window_filter_name
   * @response `200` `AddWindowFilterNameCreateData` 成功
   */
  addWindowFilterNameCreate = (data: AddWindowFilterNameCreatePayload, params: RequestParams = {}) =>
    this.http.request<AddWindowFilterNameCreateData, any>({
      path: `/add_window_filter_name`,
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
   * @name GetWindowFilterNameListList
   * @summary 获取窗口过滤器页签名称列表
   * @request GET:/get_window_filter_name_list
   * @response `200` `GetWindowFilterNameListListData` 成功
   */
  getWindowFilterNameListList = (params: RequestParams = {}) =>
    this.http.request<GetWindowFilterNameListListData, any>({
      path: `/get_window_filter_name_list`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UpdateWindowTableRowsCreate
   * @summary 修改窗口表格列顺序
   * @request POST:/update_window_table_rows
   * @response `200` `UpdateWindowTableRowsCreateData` 成功
   */
  updateWindowTableRowsCreate = (data: UpdateWindowTableRowsCreatePayload, params: RequestParams = {}) =>
    this.http.request<UpdateWindowTableRowsCreateData, any>({
      path: `/update_window_table_rows`,
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
   * @name SaveWindowTableSortOrderCreate
   * @summary 保存窗口表格排序
   * @request POST:/save_window_table_sort_order
   * @response `200` `SaveWindowTableSortOrderCreateData` 成功
   */
  saveWindowTableSortOrderCreate = (data: SaveWindowTableSortOrderCreatePayload, params: RequestParams = {}) =>
    this.http.request<SaveWindowTableSortOrderCreateData, any>({
      path: `/save_window_table_sort_order`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
}
