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

import { UserReportRolaJumpClickCreateData } from "./data-contracts";
import { HttpClient, RequestParams } from "./http-client";

export class UserReportRolaJumpClickApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @name UserReportRolaJumpClickCreate
   * @summary Rola 跳转按钮点击上报
   * @request POST:/user_report_rola_jump_click
   * @response `200` `UserReportRolaJumpClickCreateData`
   */
  userReportRolaJumpClickCreate = (params: RequestParams = {}) =>
    this.http.request<UserReportRolaJumpClickCreateData, any>({
      path: `/user_report_rola_jump_click`,
      method: "POST",
      format: "json",
      ...params,
    });
}
