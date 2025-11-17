/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

import {
  CheckIpDownloadLimitListData,
  GetVersionListListData,
  GetVersionListListParams,
} from "./data-contracts";
import { HttpClient, RequestParams } from "./http-client";

export class AppStatisticsApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @name CheckIpDownloadLimitList
   * @summary 查询官网APP下载限制
   * @request GET:/app_statistics/check_ip_download_limit
   * @response `200` `CheckIpDownloadLimitListData`
   */
  checkIpDownloadLimitList = (params: RequestParams = {}) =>
    this.http.request<CheckIpDownloadLimitListData, any>({
      path: `/app_statistics/check_ip_download_limit`,
      method: "GET",
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @name GetVersionListList
   * @summary 官网获取APP版本信息
   * @request GET:/app_statistics/get_version_list
   * @response `200` `GetVersionListListData`
   */
  getVersionListList = (
    query: GetVersionListListParams,
    params: RequestParams = {},
  ) =>
    this.http.request<GetVersionListListData, any>({
      path: `/app_statistics/get_version_list`,
      method: "GET",
      query: query,
      format: "json",
      ...params,
    });
}
