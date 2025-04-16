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
  UserAddLabelInfoCreateData,
  UserAddLabelInfoCreatePayload,
  UserAddWindowFilterNameCreateData,
  UserAddWindowFilterNameCreatePayload,
  UserAddWindowInfoV2CreateData,
  UserAddWindowInfoV2CreatePayload,
  UserAddWindowTemplateInfoCreateData,
  UserAddWindowTemplateInfoCreatePayload,
  UserAgreeTransferWindowCreateData,
  UserAgreeTransferWindowCreatePayload,
  UserAnalysisWindowInfoCreateData,
  UserAnalysisWindowInfoCreatePayload,
  UserBatchWindowInfoV2CreateData,
  UserBatchWindowInfoV2CreatePayload,
  UserCheckWindowTotalCountListData,
  UserClearTransferWorkspaceCreateData,
  UserClearTransferWorkspaceCreatePayload,
  UserClearWindowCacheCreateData,
  UserClearWindowCacheCreatePayload,
  UserCreateWindowInspectListData,
  UserDeleteWindowFilterNameCreateData,
  UserDeleteWindowFilterNameCreatePayload,
  UserDeleteWindowTemplateInfoCreateData,
  UserDeleteWindowTemplateInfoCreatePayload,
  UserDelLabelInfoCreateData,
  UserDelLabelInfoCreatePayload,
  UserDelWindowInfoCreateData,
  UserDelWindowInfoCreatePayload,
  UserDelWindowInfoRecycleCreateData,
  UserDelWindowInfoRecycleCreatePayload,
  UserGetBrowserVersionInfoListData,
  UserGetBrowserVersionInfoListParams,
  UserGetDeviceNameV2ListData,
  UserGetDeviceNameV2ListParams,
  UserGetLabelInfoListData,
  UserGetLabelInfoListParams,
  UserGetMacAddrV2ListData,
  UserGetMacAddrV2ListParams,
  UserGetTransferReceiveWindowListListData,
  UserGetTransferReceiveWindowListListParams,
  UserGetTransferWorkspaceListListData,
  UserGetTransferWorkspaceListListParams,
  UserGetUaWebglV2ListData,
  UserGetUaWebglV2ListParams,
  UserGetWindowFilterNameListListData,
  UserGetWindowInfoListListData,
  UserGetWindowInfoListListParams,
  UserGetWindowInfoV2ListData,
  UserGetWindowInfoV2ListParams,
  UserGetWindowRowsSortListData,
  UserGetWindowStatusInfoCreateData,
  UserGetWindowStatusInfoCreatePayload,
  UserGetWindowTableSortOrderListData,
  UserGetWindowTemplateListListData,
  UserImportWindowInfoV2CreateData,
  UserImportWindowInfoV2CreatePayload,
  UserMdfLabelInfoCreateData,
  UserMdfLabelInfoCreatePayload,
  UserMdfWindowInfoBatchV2CreateData,
  UserMdfWindowInfoBatchV2CreatePayload,
  UserMdfWindowInfoSingleV2CreateData,
  UserMdfWindowInfoSingleV2CreatePayload,
  UserMdfWindowSyncV2CreateData,
  UserMdfWindowSyncV2CreatePayload,
  UserMdfWindowTemplateInfoCreateData,
  UserMdfWindowTemplateInfoCreatePayload,
  UserModifyWindowReportTimeCreateData,
  UserModifyWindowReportTimeCreatePayload,
  UserRejectTransferWindowCreateData,
  UserRejectTransferWindowCreatePayload,
  UserSaveWindowRowsSortCreateData,
  UserSaveWindowRowsSortCreatePayload,
  UserSaveWindowTableSortOrderCreateData,
  UserSaveWindowTableSortOrderCreatePayload,
  UserTransferWindowCreateData,
  UserTransferWindowCreatePayload,
  UserTransferWindowVerifyCodeListData,
  UserUpdateWindowFilterNameCreateData,
  UserUpdateWindowFilterNameCreatePayload,
  UserUpdateWindowFilterSortCreateData,
  UserUpdateWindowFilterSortCreatePayload,
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
   * @summary 根据ID查询窗口详细信息
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
   * @summary 单个创建窗口
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
   * @summary 单个修改窗口
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
   * @name UserDelWindowInfoCreate
   * @summary 从窗口列表批量删除窗口
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
   * @summary 批量创建窗口
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
   * @name UserGetWindowRowsSortList
   * @summary 获取窗口过滤器表格列排序
   * @request GET:/user_get_window_rows_sort
   * @response `200` `UserGetWindowRowsSortListData`
   */
  userGetWindowRowsSortList = (params: RequestParams = {}) =>
    this.http.request<UserGetWindowRowsSortListData, any>({
      path: `/user_get_window_rows_sort`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserImportWindowInfoV2Create
   * @summary 批量导入窗口
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
   * @summary 批量修改窗口
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
   * @summary 窗口列表
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
   * @summary 解析窗口
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
  /**
   * No description
   *
   * @tags Window
   * @name UserSaveWindowRowsSortCreate
   * @summary 保存窗口过滤器表格列排序
   * @request POST:/user_save_window_rows_sort
   * @response `200` `UserSaveWindowRowsSortCreateData`
   */
  userSaveWindowRowsSortCreate = (data: UserSaveWindowRowsSortCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserSaveWindowRowsSortCreateData, any>({
      path: `/user_save_window_rows_sort`,
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
   * @name UserCreateWindowInspectList
   * @summary 窗口创建个数检验
   * @request GET:/user_create_window_inspect
   * @deprecated
   * @response `200` `UserCreateWindowInspectListData`
   */
  userCreateWindowInspectList = (params: RequestParams = {}) =>
    this.http.request<UserCreateWindowInspectListData, any>({
      path: `/user_create_window_inspect`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserCheckWindowTotalCountList
   * @summary 校验窗口总额度
   * @request GET:/user_check_window_total_count
   * @response `200` `UserCheckWindowTotalCountListData`
   */
  userCheckWindowTotalCountList = (params: RequestParams = {}) =>
    this.http.request<UserCheckWindowTotalCountListData, any>({
      path: `/user_check_window_total_count`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserDelWindowInfoRecycleCreate
   * @summary 从回收站批量删除窗口
   * @request POST:/user_del_window_info_recycle
   * @response `200` `UserDelWindowInfoRecycleCreateData`
   */
  userDelWindowInfoRecycleCreate = (data: UserDelWindowInfoRecycleCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserDelWindowInfoRecycleCreateData, any>({
      path: `/user_del_window_info_recycle`,
      method: "POST",
      body: data,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserTransferWindowVerifyCodeList
   * @summary 发送转移窗口的验证码
   * @request GET:/user_transfer_window_verify_code
   * @response `200` `UserTransferWindowVerifyCodeListData`
   */
  userTransferWindowVerifyCodeList = (params: RequestParams = {}) =>
    this.http.request<UserTransferWindowVerifyCodeListData, any>({
      path: `/user_transfer_window_verify_code`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserTransferWindowCreate
   * @summary 窗口转移
   * @request POST:/user_transfer_window
   * @response `200` `UserTransferWindowCreateData`
   */
  userTransferWindowCreate = (data: UserTransferWindowCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserTransferWindowCreateData, any>({
      path: `/user_transfer_window`,
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
   * @name UserGetTransferWorkspaceListList
   * @summary 获取转移空间列表
   * @request GET:/user_get_transfer_workspace_list
   * @response `200` `UserGetTransferWorkspaceListListData`
   */
  userGetTransferWorkspaceListList = (query: UserGetTransferWorkspaceListListParams, params: RequestParams = {}) =>
    this.http.request<UserGetTransferWorkspaceListListData, any>({
      path: `/user_get_transfer_workspace_list`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserGetTransferReceiveWindowListList
   * @summary 获取转移或接收窗口列表
   * @request GET:/user_get_transfer_receive_window_list
   * @response `200` `UserGetTransferReceiveWindowListListData`
   */
  userGetTransferReceiveWindowListList = (
    query: UserGetTransferReceiveWindowListListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<UserGetTransferReceiveWindowListListData, any>({
      path: `/user_get_transfer_receive_window_list`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Window
   * @name UserAgreeTransferWindowCreate
   * @summary 同意转移窗口
   * @request POST:/user_agree_transfer_window
   * @response `200` `UserAgreeTransferWindowCreateData`
   */
  userAgreeTransferWindowCreate = (data: UserAgreeTransferWindowCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserAgreeTransferWindowCreateData, any>({
      path: `/user_agree_transfer_window`,
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
   * @name UserRejectTransferWindowCreate
   * @summary 拒绝转移窗口
   * @request POST:/user_reject_transfer_window
   * @response `200` `UserRejectTransferWindowCreateData`
   */
  userRejectTransferWindowCreate = (data: UserRejectTransferWindowCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserRejectTransferWindowCreateData, any>({
      path: `/user_reject_transfer_window`,
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
   * @name UserClearTransferWorkspaceCreate
   * @summary 清除转移空间历史记录
   * @request POST:/user_clear_transfer_workspace
   * @response `200` `UserClearTransferWorkspaceCreateData`
   */
  userClearTransferWorkspaceCreate = (data: UserClearTransferWorkspaceCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserClearTransferWorkspaceCreateData, any>({
      path: `/user_clear_transfer_workspace`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
}
