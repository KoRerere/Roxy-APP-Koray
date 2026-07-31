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
  UserAppRatingData,
  UserAppRatingSubmitRequest,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class 用户评价api<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * @description 提交用户评价。图片需前端先上传 OSS，此处传完整 URL 列表。 服务端根据 workspaceId 自动记录 sceneMask（1=通用，2=电商）。
   *
   * @tags 用户评价
   * @name UserAppRating
   * @summary 提交 APP 评价
   * @request POST:/user_app_rating
   * @response `200` `UserAppRatingData` 成功
   */
  userAppRating = (
    data: UserAppRatingSubmitRequest,
    params: RequestParams = {},
  ) =>
    this.http.request<UserAppRatingData, any>({
      path: `/user_app_rating`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
}
