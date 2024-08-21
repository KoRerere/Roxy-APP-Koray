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

import { UserMdfPlatformInfoCreateData, UserMdfPlatformInfoCreatePayload } from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class UserMdfPlatformInfoApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @name UserMdfPlatformInfoCreate
   * @summary 业务平台修改
   * @request POST:/user_mdf_platform_info
   * @response `200` `UserMdfPlatformInfoCreateData` 成功
   */
  userMdfPlatformInfoCreate = (data: UserMdfPlatformInfoCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserMdfPlatformInfoCreateData, any>({
      path: `/user_mdf_platform_info`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
}
