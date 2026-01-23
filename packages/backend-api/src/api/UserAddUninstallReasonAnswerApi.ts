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
  UserAddUninstallReasonAnswerCreateData,
  UserAddUninstallReasonAnswerCreatePayload,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class UserAddUninstallReasonAnswerApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @name UserAddUninstallReasonAnswerCreate
   * @summary 上报卸载原因
   * @request POST:/user_add_uninstall_reason_answer
   * @response `200` `UserAddUninstallReasonAnswerCreateData`
   */
  userAddUninstallReasonAnswerCreate = (
    data: UserAddUninstallReasonAnswerCreatePayload,
    params: RequestParams = {},
  ) =>
    this.http.request<UserAddUninstallReasonAnswerCreateData, any>({
      path: `/user_add_uninstall_reason_answer`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
}
