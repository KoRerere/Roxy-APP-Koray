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

import { CheckIpDownloadLimitListData } from "./data-contracts";
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
}
