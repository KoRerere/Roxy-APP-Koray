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

import { UserBatchInviteCreateData, UserBatchInviteCreatePayload } from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class UserBatchInviteApi<SecurityDataType = unknown> {
  http: HttpClient<SecurityDataType>;

  constructor(http: HttpClient<SecurityDataType>) {
    this.http = http;
  }

  /**
   * No description
   *
   * @name UserBatchInviteCreate
   * @summary 邀请用户
   * @request POST:/user_batch_invite
   * @response `200` `UserBatchInviteCreateData`
   */
  userBatchInviteCreate = (data: UserBatchInviteCreatePayload, params: RequestParams = {}) =>
    this.http.request<UserBatchInviteCreateData, any>({
      path: `/user_batch_invite`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      format: "json",
      ...params,
    });
}
