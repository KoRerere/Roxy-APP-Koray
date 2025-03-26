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
  UserAddPluginToWindowCreateData,
  UserAddPluginToWindowCreatePayload,
  UserAddSystemPluginCreateData,
  UserAddSystemPluginCreatePayload,
  UserBatchDelPluginInfoCreateData,
  UserBatchDelPluginInfoCreatePayload,
  UserCheckAllPluginsVersionListData,
  UserCheckAllPluginsVersionListParams,
  UserDelPluginInfoCreateData,
  UserDelPluginInfoCreatePayload,
  UserFixedPluginToWindowCreateData,
  UserFixedPluginToWindowCreatePayload,
  UserGetPluginCategoryListData,
  UserGetPluginInfoByIdListData,
  UserGetPluginInfoByIdListParams,
  UserGetPluginListListData,
  UserGetPluginListListParams,
  UserGetPluginWindowListData,
  UserGetPluginWindowListParams,
  UserGetSystemPluginListData,
  UserGetSystemPluginListParams,
  UserRecordPluginUploadV2ListData,
  UserUpgradePluginsCreateData,
  UserUpgradePluginsCreatePayload,
  UserUploadChromePluginsV2CreateData,
  UserUploadChromePluginsV2CreatePayload,
  UserUploadPluginInfoCreateData,
  UserUploadPluginInfoCreatePayload,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class PluginsApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description 一天一个空间最多上传5个（包括谷歌上传）
   *
   * @tags Plugins
   * @name UserUploadPluginInfoCreate
   * @summary 本地上传谷歌插件
   * @request POST:/user_upload_plugin_info
   * @response `200` `UserUploadPluginInfoCreateData`
   */
  userUploadPluginInfoCreate = (data: UserUploadPluginInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserUploadPluginInfoCreateData, any>({
      path: `/user_upload_plugin_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Plugins
   * @name UserGetPluginCategoryList
   * @summary 获取系统扩展插件类别
   * @request GET:/user_get_plugin_category
   * @response `200` `UserGetPluginCategoryListData`
   */
  userGetPluginCategoryList = (params: RequestParams = {}) =>
    this.http.request<UserGetPluginCategoryListData, any>({
      path: `/user_get_plugin_category`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Plugins
   * @name UserGetSystemPluginList
   * @summary 获取系统扩展的插件
   * @request GET:/user_get_system_plugin
   * @response `200` `UserGetSystemPluginListData`
   */
  userGetSystemPluginList = (query: UserGetSystemPluginListParams, params: RequestParams = {}) =>
    this.http.request<UserGetSystemPluginListData, any>({
      path: `/user_get_system_plugin`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Plugins
   * @name UserAddSystemPluginCreate
   * @summary 添加系统扩展到用户扩展列表
   * @request POST:/user_add_system_plugin
   * @response `200` `UserAddSystemPluginCreateData`
   */
  userAddSystemPluginCreate = (data: UserAddSystemPluginCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserAddSystemPluginCreateData, any>({
      path: `/user_add_system_plugin`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Plugins
   * @name UserGetPluginListList
   * @summary 获取用户自己添加的插件
   * @request GET:/user_get_plugin_list
   * @response `200` `UserGetPluginListListData`
   */
  userGetPluginListList = (query: UserGetPluginListListParams, params: RequestParams = {}) =>
    this.http.request<UserGetPluginListListData, any>({
      path: `/user_get_plugin_list`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Plugins
   * @name UserDelPluginInfoCreate
   * @summary 删除用户自己添加的插件
   * @request POST:/user_del_plugin_info
   * @response `200` `UserDelPluginInfoCreateData`
   */
  userDelPluginInfoCreate = (data: UserDelPluginInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserDelPluginInfoCreateData, any>({
      path: `/user_del_plugin_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * @description 分两种情况检测：1.如果是单个检测，就传pluginDir="xxxxxxxxxxxxxxxxxxx" 2.如果是多个检测，就传pluginDir=""就行
   *
   * @tags Plugins
   * @name UserCheckAllPluginsVersionList
   * @summary 用户检查自己所有插件版本
   * @request GET:/user_check_all_plugins_version
   * @response `200` `UserCheckAllPluginsVersionListData`
   */
  userCheckAllPluginsVersionList = (query: UserCheckAllPluginsVersionListParams, params: RequestParams = {}) =>
    this.http.request<UserCheckAllPluginsVersionListData, any>({
      path: `/user_check_all_plugins_version`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * @description 只有谷歌商店插件可以升级
   *
   * @tags Plugins
   * @name UserUpgradePluginsCreate
   * @summary 用户升级自己插件
   * @request POST:/user_upgrade_plugins
   * @response `200` `UserUpgradePluginsCreateData`
   */
  userUpgradePluginsCreate = (data: UserUpgradePluginsCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserUpgradePluginsCreateData, any>({
      path: `/user_upgrade_plugins`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * @description url的格式必须是以下两种： 1、https://chromewebstore.google.com/detail/the-camelizer/ghnomdcacenbmilgjigehppbamfndblo 2、https://chromewebstore.google.com/detail/the-camelizer/ghnomdcacenbmilgjigehppbamfndblo?hl=zh-CN&utm_source=ext_sidebar 一天一个空间最多上传5个（包括本地上传）
   *
   * @tags Plugins
   * @name UserUploadChromePluginsV2Create
   * @summary 谷歌商店上传谷歌插件
   * @request POST:/user_upload_chrome_plugins_v2
   * @response `200` `UserUploadChromePluginsV2CreateData`
   */
  userUploadChromePluginsV2Create = (data: UserUploadChromePluginsV2CreatePayload, params: RequestParams = {}) =>
    this.http.request<UserUploadChromePluginsV2CreateData, any>({
      path: `/user_upload_chrome_plugins_v2`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Plugins
   * @name UserBatchDelPluginInfoCreate
   * @summary 批量删除用户自己添加的插件
   * @request POST:/user_batch_del_plugin_info
   * @response `200` `UserBatchDelPluginInfoCreateData`
   */
  userBatchDelPluginInfoCreate = (data: UserBatchDelPluginInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserBatchDelPluginInfoCreateData, any>({
      path: `/user_batch_del_plugin_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Plugins
   * @name UserGetPluginWindowList
   * @summary 获取插件所在的窗口
   * @request GET:/user_get_plugin_window
   * @response `200` `UserGetPluginWindowListData`
   */
  userGetPluginWindowList = (query: UserGetPluginWindowListParams, params: RequestParams = {}) =>
    this.http.request<UserGetPluginWindowListData, any>({
      path: `/user_get_plugin_window`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Plugins
   * @name UserAddPluginToWindowCreate
   * @summary 安装插件到窗口
   * @request POST:/user_add_plugin_to_window
   * @response `200` `UserAddPluginToWindowCreateData`
   */
  userAddPluginToWindowCreate = (data: UserAddPluginToWindowCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserAddPluginToWindowCreateData, any>({
      path: `/user_add_plugin_to_window`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Plugins
   * @name UserRecordPluginUploadV2List
   * @summary 获取上传谷歌插件次数
   * @request GET:/user_record_plugin_upload_v2
   * @response `200` `UserRecordPluginUploadV2ListData`
   */
  userRecordPluginUploadV2List = (params: RequestParams = {}) =>
    this.http.request<UserRecordPluginUploadV2ListData, any>({
      path: `/user_record_plugin_upload_v2`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Plugins
   * @name UserGetPluginInfoByIdList
   * @summary 根据插件ID获取插件详细信息
   * @request GET:/user_get_plugin_info_by_id
   * @response `200` `UserGetPluginInfoByIdListData`
   */
  userGetPluginInfoByIdList = (query: UserGetPluginInfoByIdListParams, params: RequestParams = {}) =>
    this.http.request<UserGetPluginInfoByIdListData, any>({
      path: `/user_get_plugin_info_by_id`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Plugins
   * @name UserFixedPluginToWindowCreate
   * @summary 固定插件功能
   * @request POST:/user_fixed_plugin_to_window
   * @response `200` `UserFixedPluginToWindowCreateData`
   */
  userFixedPluginToWindowCreate = (data: UserFixedPluginToWindowCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserFixedPluginToWindowCreateData, any>({
      path: `/user_fixed_plugin_to_window`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
}
