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
  UserAddSystemPluginCreateData,
  UserAddSystemPluginCreatePayload,
  UserDelPluginInfoCreateData,
  UserDelPluginInfoCreatePayload,
  UserGetPluginCategoryListData,
  UserGetPluginListListData,
  UserGetPluginListListParams,
  UserGetSystemPluginListData,
  UserGetSystemPluginListParams,
  UserMdfPluginStatusCreateData,
  UserMdfPluginStatusCreatePayload,
  UserRecordPluginUploadListData,
  UserUploadChromePluginsCreateData,
  UserUploadChromePluginsCreatePayload,
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
   * @description url的格式必须是以下两种： 1、https://chromewebstore.google.com/detail/the-camelizer/ghnomdcacenbmilgjigehppbamfndblo 2、https://chromewebstore.google.com/detail/the-camelizer/ghnomdcacenbmilgjigehppbamfndblo?hl=zh-CN&utm_source=ext_sidebar
   *
   * @tags Plugins
   * @name UserUploadChromePluginsCreate
   * @summary 谷歌商店上传谷歌插件
   * @request POST:/user_upload_chrome_plugins
   * @response `200` `UserUploadChromePluginsCreateData` 成功
   */
  userUploadChromePluginsCreate = (data: UserUploadChromePluginsCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserUploadChromePluginsCreateData, any>({
      path: `/user_upload_chrome_plugins`,
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
   * @name UserRecordPluginUploadList
   * @summary 获取上传谷歌插件次数
   * @request GET:/user_record_plugin_upload
   * @response `200` `UserRecordPluginUploadListData` 成功
   */
  userRecordPluginUploadList = (params: RequestParams = {}) =>
    this.http.request<UserRecordPluginUploadListData, any>({
      path: `/user_record_plugin_upload`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @tags Plugins
   * @name UserUploadPluginInfoCreate
   * @summary 本地上传谷歌插件
   * @request POST:/user_upload_plugin_info
   * @response `200` `UserUploadPluginInfoCreateData` 成功
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
   * @summary 扩展中心->获取插件目录
   * @request GET:/user_get_plugin_category
   * @response `200` `UserGetPluginCategoryListData` 成功
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
   * @summary 扩展推荐->展示系统扩展列表
   * @request GET:/user_get_system_plugin
   * @response `200` `UserGetSystemPluginListData` 成功
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
   * @summary 扩展推荐->添加系统扩展
   * @request POST:/user_add_system_plugin
   * @response `200` `UserAddSystemPluginCreateData` 成功
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
   * @summary 扩展配置->扩展配置列表
   * @request GET:/user_get_plugin_list
   * @response `200` `UserGetPluginListListData` 成功
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
   * @summary 扩展中心->删除插件
   * @request POST:/user_del_plugin_info
   * @response `200` `UserDelPluginInfoCreateData` 成功
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
   * No description
   *
   * @tags Plugins
   * @name UserMdfPluginStatusCreate
   * @summary 扩展中心->启用或关闭插件
   * @request POST:/user_mdf_plugin_status
   * @response `200` `UserMdfPluginStatusCreateData` 成功
   */
  userMdfPluginStatusCreate = (data: UserMdfPluginStatusCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserMdfPluginStatusCreateData, any>({
      path: `/user_mdf_plugin_status`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
}
