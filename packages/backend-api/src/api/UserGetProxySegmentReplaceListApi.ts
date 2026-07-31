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

import { UserGetProxySegmentReplaceListListData } from "./data-contracts";
import { HttpClient, RequestParams } from "./http-client";

export class UserGetProxySegmentReplaceListApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @name UserGetProxySegmentReplaceListList
   * @summary 用户代理ip替换信息查询-临时接口
   * @request GET:/user_get_proxy_segment_replace_list
   * @response `200` `UserGetProxySegmentReplaceListListData`
   */
  userGetProxySegmentReplaceListList = (params: RequestParams = {}) =>
    this.http.request<UserGetProxySegmentReplaceListListData, any>({
      path: `/user_get_proxy_segment_replace_list`,
      method: "GET",
      format: "json",
      ...params,
    });
}
