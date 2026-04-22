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

import { UserGetCloudBrowserRemainingUsageListData } from "./data-contracts";
import { HttpClient, RequestParams } from "./http-client";

export class UserGetCloudBrowserRemainingUsageApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @name UserGetCloudBrowserRemainingUsageList
   * @summary 获取云端浏览器剩余可用时长
   * @request GET:/user_get_cloud_browser_remaining_usage
   * @response `200` `UserGetCloudBrowserRemainingUsageListData`
   */
  userGetCloudBrowserRemainingUsageList = (params: RequestParams = {}) =>
    this.http.request<UserGetCloudBrowserRemainingUsageListData, any>({
      path: `/user_get_cloud_browser_remaining_usage`,
      method: "GET",
      format: "json",
      ...params,
    });
}
