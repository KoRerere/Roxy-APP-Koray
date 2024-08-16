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
  UserAddGroupInfoCreatePayload,
  UserAddLabelInfoCreatePayload,
  UserAddPlatformInfoCreatePayload,
  UserAddWindowInfoCreatePayload,
  UserBatchWindowInfoCreatePayload,
  UserClearWindowCacheApiCreatePayload,
  UserClearWindowCacheCreatePayload,
  UserDelGroupInfoCreatePayload,
  UserDelLabelInfoCreatePayload,
  UserDelPlatformInfoCreatePayload,
  UserDelWindowInfoApiCreatePayload,
  UserDelWindowInfoCreatePayload,
  UserGetDeviceNameListParams,
  UserGetDeviceNameV2ListParams,
  UserGetGroupInfoListParams,
  UserGetLabelInfoListParams,
  UserGetMacAddrV2ListParams,
  UserGetPlatformInfoListParams,
  UserGetUaWebglListParams,
  UserGetUaWebglV2ListParams,
  UserGetWindowInfoListParams,
  UserGetWindowInfoRecycleListParams,
  UserImportWindowInfoCreatePayload,
  UserMdfGroupInfoCreatePayload,
  UserMdfLabelInfoCreatePayload,
  UserMdfWindowInfoBatchCreatePayload,
  UserMdfWindowInfoRandomCreatePayload,
  UserMdfWindowInfoSingleCreatePayload,
  UserMdfWindowSyncStatusCreatePayload,
  UserMdfWindowSyncV2CreatePayload,
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
   */
  userGetWindowInfoList = (query: UserGetWindowInfoListParams, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          total: number;
          rows: {
            id?: number;
            dirId?: string;
            windowSortNum?: number;
            windowName?: string;
            groupId?: number;
            groupName?: string;
            platformUrl?: string;
            platformUserName?: string;
            platformPassword?: string;
            defaultOpenUrl?: string[];
            coreVersion?: string;
            os?: string;
            osVersion?: string;
            browserVersion?: string;
            userAgent?: string;
            cookie?: {
              name?: string;
              value?: string;
              domain?: string;
            }[];
            windowRemark?: string;
            isOften?: boolean;
            openStatus?: boolean;
            statusInfo?: {
              openUserId: number;
              openUserName: string;
              openTime: string;
            }[];
            labelId?: number;
            labelColor?: string;
            labelName?: string;
            labelIds?: number[];
            labelInfo?: {
              labelId: number;
              labelName: string;
              labelColor: string;
            }[];
            loginData?: string[];
            createTime?: string;
            updateTime?: string;
            userName?: string;
            realName?: string;
            role?: string;
            moduleId?: number;
            proxyMethod?: string;
            addType?: string;
            proxyType?: string;
            proxyCategory?: string;
            ipType?: string;
            proxyProvider?: string;
            protocol?: string;
            country?: string;
            state?: string;
            city?: string;
            host?: string;
            port?: string;
            proxyUserName?: string;
            proxyPassword?: string;
            proxyTime?: string;
            refreshUrl?: string;
            accessServer?: string;
            checkChannel?: string;
            extraChannel?: string;
            isExtraNewIp?: boolean;
            isRepectCheck?: boolean;
            extraUrl?: string;
            lastIp?: string;
            lastCountry?: string;
            isLanguageBaseIp?: boolean;
            isDisplayLanguageBaseIp?: boolean;
            isTimeZone?: boolean;
            position?: number;
            longitude?: string;
            latitude?: string;
            precisionPos?: string;
            forbidAudio?: boolean;
            forbidImage?: number;
            forbiddenPictureSize?: string;
            forbidMedia?: boolean;
            syncTab?: boolean;
            localState?: {
              os_crypt: {
                audit_enabled: boolean;
                encrypted_key: string;
              };
            };
            syncCookie?: boolean;
            openMult?: boolean;
            forbidTranslatePopup?: boolean;
            forbidSavePassword?: boolean;
            stopOpenNet?: boolean;
            stopOpenIP?: boolean;
            stopOpenPosition?: boolean;
            syncIndexedDb?: boolean;
            syncLocalStorage?: boolean;
            syncBookmark?: boolean;
            syncPassword?: boolean;
            syncHistory?: boolean;
            syncExtensions?: boolean;
            syncValue?: object;
            clearCacheFile?: boolean;
            clearCookie?: boolean;
            clearHistory?: boolean;
            isDisplayName?: boolean;
            randomFingerprint?: boolean;
            allowLoginChrome?: boolean;
            allowRunApplication?: boolean;
            useGpu?: boolean;
            webRTC?: number;
            openWidth?: string;
            openHeight?: string;
            resolutionType?: boolean;
            resolutionY?: string;
            fontType?: boolean;
            canvas?: boolean;
            webGLValue?: string;
            webGLRender?: string;
            webGpu?: string;
            webGpuVendor?: string;
            audioContext?: boolean;
            audioContextValue?: string;
            computerName?: string;
            macAddress?: string;
            speechVoices?: boolean;
            speechVoicesValue?: {
              enable: boolean;
              voices: {
                name: string;
                lang: string;
                isLocalService: boolean;
              }[];
            };
            doNotTrack?: boolean;
            clientRectsValue?: {
              enable: boolean;
              clientRectsNoiseFactorX: number;
              clientRectsNoiseFactorY: number;
            };
            deviceInfo?: boolean;
            deviceNameSwitch?: boolean;
            macInfo?: boolean;
            portScanProtect?: boolean;
            disableSsl?: boolean;
            disableSslList?: string[];
            enablePlugin?: boolean;
            enablePluginList?: {
              name: string;
              description: string;
              filename: string;
              mimeType: string;
              mimeDescription: string;
              suffixes: number;
            }[];
            mediaDevice?: boolean;
            mediaDeviceList?: {
              deviceType?: string;
              deviceId?: string;
              label?: string;
              groupId?: string;
            }[];
            hardwareConcurrent?: number;
            deviceMemory?: number;
            userAgentNew?: string;
            userAgentVersion?: string;
            platform?: string;
            navigatorPlatform?: string;
            pixelDepth?: number;
            colorDepth?: number;
            isBindRpa?: boolean;
            pluginVersion?: string;
            pluginRoute?: string;
          }[];
        };
      },
      any
    >({
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
   */
  userGetWindowInfoRecycleList = (query: UserGetWindowInfoRecycleListParams, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          total: number;
          rows: {
            id?: number;
            windowSortNum?: number;
            windowName?: string;
            groupId?: number;
            groupName?: string;
            windowRemark?: string;
            labelId?: number;
            labelColor?: string;
            labelName?: string;
            labelIds?: number[];
            labelInfo?: {
              labelId: number;
              labelName: string;
              labelColor: string;
            }[];
            createUser?: string;
            operateUser?: string;
            deleteTime?: string;
            os?: string;
            platformUrl?: string;
            lastIp?: string;
            lastCountry?: string;
          }[];
        };
        msg: string;
      },
      any
    >({
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
   */
  userAddWindowInfoCreate = (data: UserAddWindowInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          createBy: number;
          windowUserId: number;
          windowId: number;
        };
        msg: string;
      },
      any
    >({
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
   */
  userBatchWindowInfoCreate = (data: UserBatchWindowInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
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
   */
  userImportWindowInfoCreate = (data: UserImportWindowInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          createBy: number;
          windowUserId: number;
          windowId: number;
        };
        msg: string;
      },
      any
    >({
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
   */
  userMdfWindowInfoSingleCreate = (data: UserMdfWindowInfoSingleCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
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
   */
  userMdfWindowInfoBatchCreate = (data: UserMdfWindowInfoBatchCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
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
   */
  userModifyWindowReportTimeCreate = (data: UserModifyWindowReportTimeCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
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
   */
  userMdfWindowInfoRandomCreate = (data: UserMdfWindowInfoRandomCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
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
   */
  userClearWindowCacheCreate = (data: UserClearWindowCacheCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
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
   */
  userClearWindowCacheApiCreate = (data: UserClearWindowCacheApiCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
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
   */
  userDelWindowInfoCreate = (data: UserDelWindowInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
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
   */
  userDelWindowInfoApiCreate = (data: UserDelWindowInfoApiCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
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
   */
  userMdfWindowSyncStatusCreate = (data: UserMdfWindowSyncStatusCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
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
   */
  userMdfWindowSyncV2Create = (data: UserMdfWindowSyncV2CreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
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
   */
  userGetUaWebglList = (query: UserGetUaWebglListParams, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          userAgent: string;
          webGLRender: string;
          webGLManufacturer: string;
        };
      },
      any
    >({
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
   */
  userGetUaWebglV2List = (query: UserGetUaWebglV2ListParams, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          userAgent?: string;
          webGLRender?: string;
          webGLManufacturer?: string;
        }[];
        msg: string;
      },
      any
    >({
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
   */
  userGetDeviceNameList = (query: UserGetDeviceNameListParams, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          deviceName: string;
        };
        msg: string;
      },
      any
    >({
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
   */
  userGetDeviceNameV2List = (query: UserGetDeviceNameV2ListParams, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          deviceName?: string;
        }[];
        msg: string;
      },
      any
    >({
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
   */
  userGetMacAddrV2List = (query: UserGetMacAddrV2ListParams, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          macAddr?: string;
        }[];
        msg: string;
      },
      any
    >({
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
   */
  userGetGroupInfoList = (query: UserGetGroupInfoListParams, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          total: number;
          rows: {
            id?: number;
            name?: string;
            userName?: string;
            isBind?: boolean;
          }[];
        };
        msg: string;
      },
      any
    >({
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
   */
  userAddGroupInfoCreate = (data: UserAddGroupInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: object;
        msg: string;
      },
      any
    >({
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
   */
  userMdfGroupInfoCreate = (data: UserMdfGroupInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
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
   */
  userDelGroupInfoCreate = (data: UserDelGroupInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
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
   */
  userGetLabelInfoList = (query: UserGetLabelInfoListParams, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          total: number;
          rows: {
            id?: number;
            color?: string;
            name?: string;
            isBind?: boolean;
          }[];
        };
        msg: string;
      },
      any
    >({
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
   */
  userAddLabelInfoCreate = (data: UserAddLabelInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: object;
        msg: string;
      },
      any
    >({
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
   */
  userMdfLabelInfoCreate = (data: UserMdfLabelInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
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
   */
  userDelLabelInfoCreate = (data: UserDelLabelInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
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
   */
  userGetPlatformInfoList = (query: UserGetPlatformInfoListParams, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: {
          platformUrl: string[];
        };
        msg: string;
      },
      any
    >({
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
   */
  userAddPlatformInfoCreate = (data: UserAddPlatformInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        data: object;
        msg: string;
      },
      any
    >({
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
   */
  userDelPlatformInfoCreate = (data: UserDelPlatformInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<
      {
        code: number;
        msg: string;
      },
      any
    >({
      path: `/user_del_platform_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
}
