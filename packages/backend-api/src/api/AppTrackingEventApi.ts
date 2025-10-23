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
  AppTrackingEventCreateData,
  AppTrackingEventCreatePayload,
  AppTrackingEventDeleteData,
  AppTrackingEventDeletePayload,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class AppTrackingEventApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @name AppTrackingEventCreate
   * @summary 添加用户行为追踪事件
   * @request POST:/app_tracking_event
   * @response `200` `AppTrackingEventCreateData`
   */
  appTrackingEventCreate = (
    data: AppTrackingEventCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<AppTrackingEventCreateData, any>({
      path: `/app_tracking_event`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
  /**
   * No description
   *
   * @name AppTrackingEventDelete
   * @summary 删除用户跟踪事件
   * @request DELETE:/app_tracking_event
   * @response `200` `AppTrackingEventDeleteData`
   */
  appTrackingEventDelete = (
    data: AppTrackingEventDeletePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<AppTrackingEventDeleteData, any>({
      path: `/app_tracking_event`,
      method: "DELETE",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
}
